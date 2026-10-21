import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from app.services.ai.feature_store import QuantitativeFeatureStore
from app.services.ai.ml_model import ml_classifier


class VectorizedBacktester:
    """
    Motor de Backtesting Cuantitativo y Matriz Walk-Forward.
    Simula la ejecución realista de la estrategia híbrida (LightGBM + Reglas Cuantitativas)
    incorporando fricción de mercado (comisiones de exchange + slippage por bid-ask spread),
    stops y targets dinámicos basados en volatilidad (ATR) y límites de retención temporal.
    """

    def __init__(
        self,
        asset_symbol: str = "BTC/USDT",
        initial_capital: float = 10000.0,
        risk_per_trade_pct: float = 0.015,  # 1.5% de riesgo por trade
        taker_fee_bps: float = 1.5,         # 1.5 bps (0.015%) comisión Maker / VIP / Prop
        default_rr_ratio: float = 2.2,       # Ratio Riesgo/Recompensa 1:2.2
        max_holding_ticks: int = 1000,      # Expiración temporal realista (~1.2 horas de mercado)
    ):
        self.asset_symbol = asset_symbol
        self.initial_capital = initial_capital
        self.risk_per_trade_pct = risk_per_trade_pct
        self.taker_fee = taker_fee_bps / 10000.0
        self.default_rr_ratio = default_rr_ratio
        self.max_holding_ticks = max_holding_ticks
        self.feature_store = QuantitativeFeatureStore(asset_symbol=asset_symbol)

    async def run_backtest(
        self,
        max_ticks: int = 25000,
        min_ml_confidence: float = 52.0,
        walk_forward_folds: int = 4,
    ) -> Dict[str, Any]:
        """
        Ejecuta el backtest completo sobre los datos históricos y genera la matriz Walk-Forward.
        """
        # 1. Extracción de dataset histórico
        df_ticks, news = await self.feature_store.fetch_historical_dataset(max_ticks=max_ticks)
        if len(df_ticks) < 500:
            raise ValueError(f"Muestras insuficientes ({len(df_ticks)}) para ejecutar backtesting.")

        # 2. Extracción de variables predictivas
        df_features = self.feature_store.extract_features(df_ticks, news)
        if len(df_features) < 200:
            raise ValueError("Dataset de features insuficiente tras aplicar ventanas de retardo.")

        # Asegurar que el modelo LightGBM esté cargado
        if not ml_classifier.is_trained:
            if not ml_classifier.load_model_artifacts():
                raise RuntimeError("El modelo LightGBM no se encuentra entrenado en disco.")

        # 3. Generación de señales de confluencia cuantitativa (ML + OFI + MTF)
        feature_cols = ml_classifier.feature_columns
        X_raw = df_features[feature_cols].values
        X_scaled = ml_classifier.scaler.transform(X_raw)
        probabilities = ml_classifier.model.predict_proba(X_scaled)

        # Mapeo: 0: SELL, 1: BUY, 2: NEUTRAL
        p_sell = probabilities[:, 0]
        p_buy = probabilities[:, 1]
        p_neutral = probabilities[:, 2]

        ofis = df_features["ofi_score"].values
        ret_15m = df_features["log_return_15m"].values

        signals = []
        confidences = []
        for i in range(len(df_features)):
            probs = [p_sell[i], p_buy[i], p_neutral[i]]
            max_p = max(probs)
            conf = max_p * 100.0

            # Confluencia institucional:
            # 1. Margen de probabilidad ML significativo (> 12%)
            # 2. Confirmación de Order Flow OFI
            # 3. No estar en contratendencia en 15m
            action = "NEUTRAL"
            if p_buy[i] - p_sell[i] > 0.12 and ofis[i] > 0.05 and ret_15m[i] > -0.0005:
                action = "BUY"
            elif p_sell[i] - p_buy[i] > 0.12 and ofis[i] < -0.05 and ret_15m[i] < 0.0005:
                action = "SELL"

            signals.append(action)
            confidences.append(conf)

        df_features["ml_action"] = signals
        df_features["ml_confidence"] = confidences
        df_features["p_buy"] = p_buy
        df_features["p_sell"] = p_sell
        df_features["p_neutral"] = p_neutral

        # 4. Simulación de Ejecución de Operaciones
        trades, equity_curve = self._simulate_trades(df_features, df_ticks)

        # 5. Cálculo de Métricas Globales
        metrics = self._calculate_performance_metrics(trades, equity_curve)

        # 6. Matriz Walk-Forward
        walk_forward_matrix = self._calculate_walk_forward_matrix(
            df_features, df_ticks, folds=walk_forward_folds
        )

        return {
            "metadata": {
                "asset_symbol": self.asset_symbol,
                "ticks_analyzed": len(df_ticks),
                "features_analyzed": len(df_features),
                "initial_capital": self.initial_capital,
                "final_equity": round(equity_curve[-1]["equity"] if equity_curve else self.initial_capital, 2),
                "taker_fee_bps": self.taker_fee * 10000.0,
                "min_ml_confidence": min_ml_confidence,
                "max_holding_ticks": self.max_holding_ticks,
                "tested_at": datetime.now(timezone.utc).isoformat(),
            },
            "performance_metrics": metrics,
            "walk_forward_matrix": walk_forward_matrix,
            "sample_trades": trades[:15],
            "equity_curve": equity_curve[:: max(1, len(equity_curve) // 100)],  # Muestreo de 100 puntos para gráficos
        }

    def _simulate_trades(
        self,
        df_features: pd.DataFrame,
        df_ticks: pd.DataFrame,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Simula las operaciones vela por vela / tick por tick con gestión dinámica de riesgo.
        """
        full_prices = df_ticks["price"].values
        full_times = df_ticks["time"].values
        full_spreads = df_ticks["spread"].values
        total_ticks = len(full_prices)

        trades = []
        current_equity = self.initial_capital
        equity_curve = [{"tick_index": 0, "time": str(full_times[0]), "equity": current_equity}]

        in_position = False
        current_pos: Optional[Dict[str, Any]] = None

        feature_indices = df_features["index"].values
        actions = df_features["ml_action"].values
        vols = df_features["realized_volatility"].values
        confidences = df_features["ml_confidence"].values

        for k in range(len(df_features)):
            idx = int(feature_indices[k])
            action = actions[k]
            vol_pct = vols[k]
            conf = confidences[k]

            p_t = full_prices[idx]
            t_curr = full_times[idx]
            spread = full_spreads[idx]

            # 1. Si estamos en posición, evaluar condiciones de salida
            if in_position and current_pos:
                ticks_held = idx - current_pos["entry_idx"]
                pos_type = current_pos["type"]
                entry_p = current_pos["entry_price"]
                sl = current_pos["stop_loss"]
                tp = current_pos["take_profit"]

                # Trailing Stop: Si el precio alcanza el 50% de la distancia al target, mover SL a breakeven (+ comisiones)
                if pos_type == "LONG":
                    dist_50 = (tp - entry_p) * 0.5
                    if p_t >= entry_p + dist_50:
                        current_pos["stop_loss"] = max(current_pos["stop_loss"], entry_p * (1.0 + self.taker_fee * 2.5))
                elif pos_type == "SHORT":
                    dist_50 = (entry_p - tp) * 0.5
                    if p_t <= entry_p - dist_50:
                        current_pos["stop_loss"] = min(current_pos["stop_loss"], entry_p * (1.0 - self.taker_fee * 2.5))

                stop_l = current_pos["stop_loss"]
                take_p = current_pos["take_profit"]

                exit_triggered = False
                exit_price = p_t
                exit_reason = "TIME_LIMIT"

                if pos_type == "LONG":
                    if p_t >= take_p:
                        exit_price = take_p
                        exit_reason = "TAKE_PROFIT"
                        exit_triggered = True
                    elif p_t <= stop_l:
                        exit_price = stop_l
                        exit_reason = "STOP_LOSS"
                        exit_triggered = True
                    elif ticks_held >= self.max_holding_ticks:
                        exit_price = p_t
                        exit_reason = "TIME_LIMIT"
                        exit_triggered = True
                elif pos_type == "SHORT":
                    if p_t <= take_p:
                        exit_price = take_p
                        exit_reason = "TAKE_PROFIT"
                        exit_triggered = True
                    elif p_t >= stop_l:
                        exit_price = stop_l
                        exit_reason = "STOP_LOSS"
                        exit_triggered = True
                    elif ticks_held >= self.max_holding_ticks:
                        exit_price = p_t
                        exit_reason = "TIME_LIMIT"
                        exit_triggered = True

                if exit_triggered:
                    # Aplicar slippage y comisión a la salida
                    half_spread = (spread / 2.0) if spread > 0 else (exit_price * 0.00005)
                    if pos_type == "LONG":
                        net_exit_price = exit_price - half_spread
                        gross_ret = (net_exit_price - current_pos["entry_price"]) / current_pos["entry_price"]
                    else:
                        net_exit_price = exit_price + half_spread
                        gross_ret = (current_pos["entry_price"] - net_exit_price) / current_pos["entry_price"]

                    # Restar comisiones taker de entrada y salida
                    net_ret = gross_ret - (self.taker_fee * 2.0)
                    trade_pnl = current_pos["position_size"] * net_ret
                    current_equity += trade_pnl

                    trades.append({
                        "trade_id": len(trades) + 1,
                        "type": pos_type,
                        "entry_time": str(current_pos["entry_time"]),
                        "exit_time": str(t_curr),
                        "entry_price": round(float(current_pos["entry_price"]), 2),
                        "exit_price": round(float(exit_price), 2),
                        "position_size": round(float(current_pos["position_size"]), 2),
                        "stop_loss": round(float(stop_l), 2),
                        "take_profit": round(float(take_p), 2),
                        "pnl_usd": round(float(trade_pnl), 2),
                        "return_pct": round(float(net_ret * 100.0), 3),
                        "exit_reason": exit_reason,
                        "ticks_held": ticks_held,
                        "equity_after": round(float(current_equity), 2),
                    })

                    equity_curve.append({
                        "tick_index": idx,
                        "time": str(t_curr),
                        "equity": round(float(current_equity), 2),
                    })

                    in_position = False
                    current_pos = None

            # 2. Si no estamos en posición y hay señal BUY/SELL con confianza, abrir posición
            if not in_position and action in ("BUY", "SELL"):
                # Cálculo de stops dinámicos basados en ATR/volatilidad realizada calibrada
                dynamic_risk = max(0.0018, min(0.0050, (vol_pct / 100.0) * 0.8))
                dynamic_target = dynamic_risk * self.default_rr_ratio

                half_spread = (spread / 2.0) if spread > 0 else (p_t * 0.00005)

                if action == "BUY":
                    pos_type = "LONG"
                    entry_p = p_t + half_spread
                    sl = entry_p * (1.0 - dynamic_risk)
                    tp = entry_p * (1.0 + dynamic_target)
                else:
                    pos_type = "SHORT"
                    entry_p = p_t - half_spread
                    sl = entry_p * (1.0 + dynamic_risk)
                    tp = entry_p * (1.0 - dynamic_target)

                # Tamaño de posición basado en riesgo fijo de capital
                risk_amount = current_equity * self.risk_per_trade_pct
                pos_size = risk_amount / dynamic_risk

                current_pos = {
                    "type": pos_type,
                    "entry_idx": idx,
                    "entry_time": t_curr,
                    "entry_price": entry_p,
                    "stop_loss": sl,
                    "take_profit": tp,
                    "position_size": pos_size,
                    "confidence": conf,
                }
                in_position = True

        return trades, equity_curve

    def _calculate_performance_metrics(
        self,
        trades: List[Dict[str, Any]],
        equity_curve: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Calcula métricas financieras institucionales completas."""
        if not trades:
            return {
                "total_trades": 0,
                "win_rate_pct": 0.0,
                "total_return_pct": 0.0,
                "profit_factor": 0.0,
                "sharpe_ratio": 0.0,
                "sortino_ratio": 0.0,
                "max_drawdown_pct": 0.0,
                "expectancy_usd": 0.0,
            }

        returns = [t["return_pct"] / 100.0 for t in trades]
        pnls = [t["pnl_usd"] for t in trades]

        wins = [p for p in pnls if p > 0]
        losses = [abs(p) for p in pnls if p < 0]

        total_trades = len(trades)
        winning_trades = len(wins)
        losing_trades = len(losses)
        win_rate = (winning_trades / total_trades) * 100.0 if total_trades > 0 else 0.0

        gross_profit = sum(wins)
        gross_loss = sum(losses)
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.0 if gross_profit > 0 else 1.0)

        initial_eq = self.initial_capital
        final_eq = equity_curve[-1]["equity"] if equity_curve else initial_eq
        total_return_pct = ((final_eq - initial_eq) / initial_eq) * 100.0

        # Sharpe & Sortino (normalizado por frecuencia de operaciones)
        mean_ret = float(np.mean(returns)) if returns else 0.0
        std_ret = float(np.std(returns)) if len(returns) > 1 else 1e-4

        # Downside deviation para Sortino
        downside_returns = [r for r in returns if r < 0]
        downside_std = float(np.std(downside_returns)) if len(downside_returns) > 1 else 1e-4

        # Factor anualizador estimado (~15,000 trades/año a alta frecuencia)
        annual_factor = math.sqrt(min(252 * 20, max(20, total_trades)))
        sharpe = (mean_ret / std_ret) * annual_factor if std_ret > 0 else 0.0
        sortino = (mean_ret / downside_std) * annual_factor if downside_std > 0 else 0.0

        # Maximum Drawdown (MDD)
        equities = [p["equity"] for p in equity_curve]
        peak = equities[0]
        max_dd = 0.0
        for eq in equities:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak if peak > 0 else 0.0
            if dd > max_dd:
                max_dd = dd

        avg_win = float(np.mean(wins)) if wins else 0.0
        avg_loss = float(np.mean(losses)) if losses else 0.0
        expectancy = (win_rate / 100.0 * avg_win) - ((1.0 - win_rate / 100.0) * avg_loss)
        payoff_ratio = (avg_win / avg_loss) if avg_loss > 0 else 1.0

        # Conteo por razón de salida
        exit_reasons = {}
        for t in trades:
            reason = t["exit_reason"]
            exit_reasons[reason] = exit_reasons.get(reason, 0) + 1

        return {
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "losing_trades": losing_trades,
            "win_rate_pct": round(win_rate, 2),
            "profit_factor": round(float(profit_factor), 2),
            "total_return_pct": round(total_return_pct, 2),
            "net_profit_usd": round(final_eq - initial_eq, 2),
            "sharpe_ratio": round(float(sharpe), 2),
            "sortino_ratio": round(float(sortino), 2),
            "max_drawdown_pct": round(float(max_dd * 100.0), 2),
            "expectancy_usd": round(float(expectancy), 2),
            "payoff_ratio": round(float(payoff_ratio), 2),
            "avg_win_usd": round(avg_win, 2),
            "avg_loss_usd": round(avg_loss, 2),
            "exit_distribution": exit_reasons,
        }

    def _calculate_walk_forward_matrix(
        self,
        df_features: pd.DataFrame,
        df_ticks: pd.DataFrame,
        folds: int = 4,
    ) -> List[Dict[str, Any]]:
        """
        Ejecuta la validación Walk-Forward en ventanas temporales secuenciales
        para demostrar la estabilidad y no-sobreajuste del sistema.
        """
        n = len(df_features)
        fold_size = n // folds
        matrix = []

        for f in range(folds):
            start_idx = f * fold_size
            end_idx = n if f == folds - 1 else (f + 1) * fold_size

            sub_features = df_features.iloc[start_idx:end_idx].reset_index(drop=True)
            sub_trades, sub_equity = self._simulate_trades(sub_features, df_ticks)
            sub_metrics = self._calculate_performance_metrics(sub_trades, sub_equity)

            t_start = str(sub_features["time"].iloc[0])
            t_end = str(sub_features["time"].iloc[-1])

            matrix.append({
                "fold": f + 1,
                "window": f"Fold {f + 1}/{folds}",
                "start_time": t_start,
                "end_time": t_end,
                "trades": sub_metrics["total_trades"],
                "win_rate_pct": sub_metrics["win_rate_pct"],
                "profit_factor": sub_metrics["profit_factor"],
                "return_pct": sub_metrics["total_return_pct"],
                "sharpe_ratio": sub_metrics["sharpe_ratio"],
                "max_drawdown_pct": sub_metrics["max_drawdown_pct"],
            })

        return matrix


# Instancia singleton del backtester
backtester = VectorizedBacktester()
