import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
import math
from typing import Any, Dict, List, Optional
import redis.asyncio as aioredis
from sqlalchemy import desc, func, insert, select

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_pool
from app.models.asset import Asset
from app.models.market_tick import MarketTick
from app.models.news_event import NewsEvent
from app.models.predictive_signal import PredictiveSignal
from app.services.ai.ml_model import ml_classifier



class SignalEngine:
    """
    Motor Cuantitativo y de Inteligencia Artificial para la Generación de Señales Predictivas.
    Fase B:
    1. Decaimiento temporal exponencial de noticias (Half-Life Kernel).
    2. Estimación de volatilidad realizada y Stop-Loss/Take-Profit dinámicos basados en ATR.
    3. Microestructura: Order Flow Imbalance (OFI), Cumulative Volume Delta (CVD) y VWAP.
    4. Confluencia Multi-Timeframe (MTF: 1m, 5m, 1h) con filtro anti-whipsaw.
    5. Detección cuantitativa de Régimen de Mercado (Trending vs Choppy vs Volatility Squeeze).
    6. Calibración probabilística logística del nivel de confianza.
    """

    def __init__(self):
        pass

    @staticmethod
    def _calculate_exponential_sentiment(
        news_items: List[NewsEvent],
        base_symbol: str,
        now: datetime,
        half_life_minutes: float = 45.0,
    ) -> tuple[float, str, int, Optional[str]]:
        """Calcula el sentimiento ponderado con decaimiento temporal exponencial."""
        relevant_news = [
            n for n in news_items
            if n.affected_assets and (base_symbol in n.affected_assets or "ALL" in n.affected_assets)
            and n.sentiment_score is not None
        ]

        if not relevant_news:
            return 0.0, "NEUTRAL", 0, None

        decay_lambda = math.log(2) / half_life_minutes
        weighted_sum = 0.0
        total_weight = 0.0

        for item in relevant_news:
            item_time = item.published_at if item.published_at.tzinfo else item.published_at.replace(tzinfo=timezone.utc)
            delta_minutes = max(0.0, (now - item_time).total_seconds() / 60.0)
            weight = math.exp(-decay_lambda * delta_minutes)

            score = float(item.sentiment_score)
            weighted_sum += score * weight
            total_weight += weight

        decay_sentiment = weighted_sum / total_weight if total_weight > 0 else 0.0

        # Clasificación semántica del sentimiento ponderado
        if decay_sentiment >= 0.40:
            label = "VERY_BULLISH"
        elif decay_sentiment >= 0.12:
            label = "BULLISH"
        elif decay_sentiment <= -0.40:
            label = "VERY_BEARISH"
        elif decay_sentiment <= -0.12:
            label = "BEARISH"
        else:
            label = "NEUTRAL"

        sample_headline = relevant_news[0].title if relevant_news else None
        return round(decay_sentiment, 4), label, len(relevant_news), sample_headline

    @staticmethod
    def _calculate_realized_volatility(ticks: List[MarketTick]) -> tuple[float, float, float, float]:
        """
        Calcula volatilidad realizada empírica (%), desviación respecto a VWAP (%),
        spread medio y rango High-Low porcentual.
        """
        if len(ticks) < 3:
            return 1.5, 0.0, 0.0, 1.0

        prices = [float(t.price) for t in ticks if t.price is not None]
        if len(prices) < 3:
            return 1.5, 0.0, 0.0, 1.0

        # 1. Log returns para volatilidad realizada
        log_returns = [math.log(prices[i] / prices[i + 1]) for i in range(len(prices) - 1) if prices[i + 1] > 0]
        if log_returns:
            mean_ret = sum(log_returns) / len(log_returns)
            variance = sum((r - mean_ret) ** 2 for r in log_returns) / max(1, len(log_returns) - 1)
            tick_std = math.sqrt(variance)
            vol_pct = tick_std * math.sqrt(40) * 100.0
        else:
            vol_pct = 1.0

        # Rango empírico High-Low reciente
        max_p = max(prices)
        min_p = min(prices)
        mean_p = sum(prices) / len(prices)
        hl_range_pct = ((max_p - min_p) / mean_p) * 100.0 if mean_p > 0 else 0.0

        composite_vol_pct = max(vol_pct, hl_range_pct * 0.6)

        # 2. VWAP sobre la muestra
        volumes = [float(t.volume_24h or 1.0) for t in ticks]
        sum_vol = sum(volumes)
        vwap = sum(p * v for p, v in zip(prices, volumes)) / sum_vol if sum_vol > 0 else mean_p
        vwap_deviation_pct = ((prices[0] - vwap) / vwap) * 100.0 if vwap > 0 else 0.0

        # 3. Spread promedio
        spreads = [float(t.bid_ask_spread) for t in ticks if t.bid_ask_spread is not None]
        avg_spread = sum(spreads) / len(spreads) if spreads else 0.0

        return round(composite_vol_pct, 4), round(vwap_deviation_pct, 4), round(avg_spread, 6), round(hl_range_pct, 4)

    @staticmethod
    def _calculate_order_flow_imbalance(
        ticks: List[MarketTick],
        vwap_dev_pct: float,
    ) -> tuple[float, float, str]:
        """
        Calcula el Order Flow Imbalance (OFI) y Cumulative Volume Delta (CVD)
        mediante la regla del tick (Lee-Ready algorithm) sobre la microestructura.
        Retorna: (ofi_score [-1.0, 1.0], cvd_ratio [-1.0, 1.0], flow_regime)
        """
        if len(ticks) < 4:
            return 0.0, 0.0, "BALANCED_FLOW"

        prices = [float(t.price) for t in ticks if t.price is not None]
        volumes = [float(t.volume_24h or 1.0) for t in ticks]

        # Invertir para recorrer en orden cronológico ascendente
        p_asc = list(reversed(prices))
        v_asc = list(reversed(volumes))

        buy_volume = 0.0
        sell_volume = 0.0
        last_sign = 1.0

        for i in range(1, len(p_asc)):
            delta_p = p_asc[i] - p_asc[i - 1]
            delta_v = abs(v_asc[i] - v_asc[i - 1])
            if delta_v == 0:
                delta_v = 1.0

            if delta_p > 0:
                trade_sign = 1.0
            elif delta_p < 0:
                trade_sign = -1.0
            else:
                trade_sign = last_sign

            last_sign = trade_sign

            if trade_sign > 0:
                buy_volume += delta_v
            else:
                sell_volume += delta_v

        total_vol = buy_volume + sell_volume
        cvd_ratio = (buy_volume - sell_volume) / total_vol if total_vol > 0 else 0.0

        # OFI Score: combina CVD normalizado con sesgo de posición frente a VWAP
        ofi_score = math.tanh(cvd_ratio * 2.2 + (vwap_dev_pct / 0.5) * 0.4)

        if ofi_score >= 0.35:
            flow_regime = "STRONG_BUY_PRESSURE"
        elif ofi_score >= 0.12:
            flow_regime = "MODERATE_BUY_PRESSURE"
        elif ofi_score <= -0.35:
            flow_regime = "STRONG_SELL_PRESSURE"
        elif ofi_score <= -0.12:
            flow_regime = "MODERATE_SELL_PRESSURE"
        else:
            flow_regime = "BALANCED_FLOW"

        return round(ofi_score, 4), round(cvd_ratio, 4), flow_regime

    @staticmethod
    def _calculate_multi_timeframe_confluence(ticks: List[MarketTick]) -> Dict[str, Any]:
        """
        Evalúa la alineación jerárquica de tendencia en múltiples marcos temporales:
        - Fast (1m / ~8 ticks)
        - Medium (5m / ~25 ticks)
        - Macro (15m - 1h / ventana completa de ticks)
        """
        n = len(ticks)
        if n < 10:
            return {
                "confluence_score": 0.0,
                "status": "INSUFFICIENT_DATA",
                "fast_trend": "NEUTRAL",
                "medium_trend": "NEUTRAL",
                "macro_trend": "NEUTRAL",
                "fast_delta_pct": 0.0,
                "macro_delta_pct": 0.0,
                "multiplier": 1.0,
            }

        prices = [float(t.price) for t in ticks if t.price is not None]
        p_current = prices[0]

        # 1. Fast Trend (~8 ticks / 1m)
        p_fast = prices[min(7, n - 1)]
        fast_pct = ((p_current - p_fast) / p_fast) * 100.0 if p_fast > 0 else 0.0
        fast_dir = 1 if fast_pct > 0.03 else (-1 if fast_pct < -0.03 else 0)

        # 2. Medium Trend (~25 ticks / 5m)
        p_med = prices[min(24, n - 1)]
        med_pct = ((p_current - p_med) / p_med) * 100.0 if p_med > 0 else 0.0
        med_dir = 1 if med_pct > 0.06 else (-1 if med_pct < -0.06 else 0)

        # 3. Macro Trend (ventana amplia de hasta 100 ticks)
        p_macro = prices[-1]
        macro_pct = ((p_current - p_macro) / p_macro) * 100.0 if p_macro > 0 else 0.0
        macro_dir = 1 if macro_pct > 0.12 else (-1 if macro_pct < -0.12 else 0)

        raw_confluence = (fast_dir * 0.35) + (med_dir * 0.35) + (macro_dir * 0.30)

        if fast_dir == med_dir == macro_dir and fast_dir != 0:
            status = "FULL_CONFLUENCE"
            multiplier = 1.20
        elif fast_dir != 0 and macro_dir != 0 and fast_dir != macro_dir:
            status = "COUNTER_TREND_WARNING"
            multiplier = 0.55
        else:
            status = "PARTIAL_CONFLUENCE"
            multiplier = 1.0

        return {
            "confluence_score": round(raw_confluence, 3),
            "status": status,
            "fast_trend": "BULLISH" if fast_dir > 0 else ("BEARISH" if fast_dir < 0 else "NEUTRAL"),
            "medium_trend": "BULLISH" if med_dir > 0 else ("BEARISH" if med_dir < 0 else "NEUTRAL"),
            "macro_trend": "BULLISH" if macro_dir > 0 else ("BEARISH" if macro_dir < 0 else "NEUTRAL"),
            "fast_delta_pct": round(fast_pct, 3),
            "macro_delta_pct": round(macro_pct, 3),
            "multiplier": multiplier,
        }

    @staticmethod
    def _detect_market_regime(
        realized_vol_pct: float,
        momentum_score: float,
        hl_range_pct: float,
    ) -> tuple[str, float, float, float, float]:
        """
        Clasifica cuantitativamente el régimen de mercado y adapta los pesos del ensamble:
        - TRENDING_EXPANSION: Alta direccionalidad, expande momentum.
        - CHOPPY_RANGE: Oscilatorio/lateral, reduce momentum y prioriza reversión a la media.
        - VOLATILITY_SQUEEZE: Contracción extrema, prioriza order flow anticipado.
        - BALANCED_MARKET: Condiciones normales equilibradas.
        Retorna: (regime, w_sentiment, w_momentum, w_ofi, w_macro)
        """
        abs_mom = abs(momentum_score)

        if realized_vol_pct < 0.55 and hl_range_pct < 0.35:
            regime = "VOLATILITY_SQUEEZE"
            w_sent, w_mom, w_ofi, w_macro = 0.35, 0.15, 0.30, 0.20
        elif abs_mom < 0.12 and realized_vol_pct < 1.1:
            regime = "CHOPPY_RANGE"
            w_sent, w_mom, w_ofi, w_macro = 0.40, 0.15, 0.25, 0.20
        elif abs_mom >= 0.30 and realized_vol_pct >= 0.90:
            regime = "TRENDING_EXPANSION"
            w_sent, w_mom, w_ofi, w_macro = 0.25, 0.40, 0.20, 0.15
        else:
            regime = "BALANCED_MARKET"
            w_sent, w_mom, w_ofi, w_macro = 0.35, 0.30, 0.15, 0.20

        return regime, w_sent, w_mom, w_ofi, w_macro

    async def evaluate_asset_signal(
        self,
        asset: Asset,
        timeframe: str = "5m",
        macro_bias: float = 0.0,
    ) -> Optional[Dict[str, Any]]:
        """
        Evalúa un activo específico y genera una señal predictiva cuantitativa de Fase B.
        Incorpora OFI, Confluencia Multi-Timeframe, Detección de Régimen y Stops Adaptativos.
        """
        now = datetime.now(timezone.utc)
        asset_id = asset.id
        symbol = asset.symbol
        base_symbol = symbol.split("/")[0]

        async with AsyncSessionLocal() as session:
            # 1. Obtener los últimos 100 ticks para muestreo multi-temporal profundo
            tick_stmt = (
                select(MarketTick)
                .where(MarketTick.asset_id == asset_id)
                .order_by(desc(MarketTick.time))
                .limit(100)
            )
            tick_res = await session.execute(tick_stmt)
            recent_ticks = tick_res.scalars().all()

            if not recent_ticks:
                return None

            latest_tick = recent_ticks[0]
            current_price = latest_tick.price

            # Momentum sobre la ventana local (últimos 35 ticks)
            sample_ticks = recent_ticks[:35]
            oldest_sample = sample_ticks[-1]
            if oldest_sample.price and oldest_sample.price > 0:
                price_delta_pct = float((current_price - oldest_sample.price) / oldest_sample.price) * 100.0
            else:
                price_delta_pct = 0.0

            momentum_score = math.tanh(price_delta_pct / 1.5)

            # Volatilidad realizada empírica, VWAP y Rango High-Low
            realized_vol_pct, vwap_dev_pct, avg_spread, hl_range_pct = self._calculate_realized_volatility(recent_ticks)

            # 2. Microestructura: Order Flow Imbalance (OFI) y CVD
            ofi_score, cvd_ratio, flow_regime = self._calculate_order_flow_imbalance(sample_ticks, vwap_dev_pct)

            # 3. Confluencia Multi-Timeframe (MTF: 1m, 5m, 1h)
            mtf = self._calculate_multi_timeframe_confluence(recent_ticks)

            # 4. Sentimiento NLP con Kernel de Decaimiento Exponencial
            half_life = 45.0 if asset.asset_type == "CRYPTO" else 120.0
            cutoff_news = now - timedelta(hours=24)
            news_stmt = (
                select(NewsEvent)
                .where(NewsEvent.published_at >= cutoff_news)
                .order_by(desc(NewsEvent.published_at))
                .limit(20)
            )
            news_res = await session.execute(news_stmt)
            recent_news = news_res.scalars().all()

            decay_sentiment, sentiment_label, news_count, sample_headline = self._calculate_exponential_sentiment(
                recent_news, base_symbol, now, half_life_minutes=half_life
            )

            # 5. Detección Cuantitativa de Régimen de Mercado y Ponderación Dinámica
            regime, w_sentiment, w_momentum, w_ofi, w_macro = self._detect_market_regime(
                realized_vol_pct, momentum_score, hl_range_pct
            )

            raw_composite = (
                (decay_sentiment * w_sentiment) +
                (momentum_score * w_momentum) +
                (ofi_score * w_ofi) +
                (macro_bias * w_macro)
            )

            # Aplicar multiplicador de confluencia multi-temporal
            composite_score = raw_composite * mtf["multiplier"]

            # Clasificación inicial de acción
            if composite_score >= 0.40:
                action = "STRONG_BUY"
            elif composite_score >= 0.15:
                action = "BUY"
            elif composite_score <= -0.40:
                action = "STRONG_SELL"
            elif composite_score <= -0.15:
                action = "SELL"
            else:
                action = "HOLD"

            # 6. Filtro Anti-Whipsaw de Confluencia Multi-Timeframe
            whipsaw_mitigated = False
            if mtf["status"] == "COUNTER_TREND_WARNING":
                # Rebote en fast/medium contra tendencia macro bajista
                if action in ("BUY", "STRONG_BUY") and mtf["macro_trend"] == "BEARISH":
                    if composite_score < 0.32:
                        action = "HOLD"
                        whipsaw_mitigated = True
                    else:
                        action = "BUY"  # Capped at BUY, nunca STRONG_BUY en contratendencia
                # Retroceso en fast/medium contra tendencia macro alcista
                elif action in ("SELL", "STRONG_SELL") and mtf["macro_trend"] == "BULLISH":
                    if composite_score > -0.32:
                        action = "HOLD"
                        whipsaw_mitigated = True
                    else:
                        action = "SELL"

            # Si hay FULL_CONFLUENCE, elevar acciones claras
            if mtf["status"] == "FULL_CONFLUENCE":
                if action == "BUY" and composite_score >= 0.30:
                    action = "STRONG_BUY"
                elif action == "SELL" and composite_score <= -0.30:
                    action = "STRONG_SELL"

            # 7. Penalización por Spread de Mercado (Microestructura)
            spread_penalty = 0.0
            if latest_tick.bid_ask_spread and current_price and current_price > 0:
                spread_pct = (float(latest_tick.bid_ask_spread) / float(current_price)) * 100.0
                if spread_pct > 0.08:
                    spread_penalty = min(0.20, (spread_pct - 0.08) * 1.5)

            # Inferencia Supervisada con LightGBM (Fase C)
            prices_arr = [float(t.price) for t in recent_ticks if t.price is not None]
            p_0 = prices_arr[0] if prices_arr else float(current_price)
            p_5m_val = prices_arr[min(20, len(prices_arr) - 1)] if prices_arr else p_0
            p_15m_val = prices_arr[min(60, len(prices_arr) - 1)] if prices_arr else p_0
            p_1h_val = prices_arr[-1] if prices_arr else p_0

            log_ret_5m = math.log(p_0 / p_5m_val) if p_5m_val > 0 else 0.0
            log_ret_15m = math.log(p_0 / p_15m_val) if p_15m_val > 0 else 0.0
            log_ret_1h = math.log(p_0 / p_1h_val) if p_1h_val > 0 else 0.0

            spread_bps = (float(latest_tick.bid_ask_spread or 0.0) / float(current_price)) * 10000.0 if current_price and current_price > 0 else 0.0

            feature_vector = {
                "log_return_5m": log_ret_5m,
                "log_return_15m": log_ret_15m,
                "log_return_1h": log_ret_1h,
                "realized_volatility": realized_vol_pct,
                "vwap_deviation": vwap_dev_pct,
                "ofi_score": ofi_score,
                "cvd_ratio": cvd_ratio,
                "spread_bps": spread_bps,
                "hl_range_pct": hl_range_pct,
                "news_sentiment": decay_sentiment,
                "macro_bias": macro_bias,
                "regime_is_trending": 1.0 if regime == "TRENDING_EXPANSION" else 0.0,
                "regime_is_choppy": 1.0 if regime == "CHOPPY_RANGE" else 0.0,
                "regime_is_squeeze": 1.0 if regime == "VOLATILITY_SQUEEZE" else 0.0,
            }

            try:
                ml_prediction = ml_classifier.predict_signal(feature_vector)
            except Exception as e:
                ml_prediction = {
                    "ml_action": "NEUTRAL",
                    "confidence_score": 50.0,
                    "probabilities": {"p_buy": 0.3333, "p_sell": 0.3333, "p_neutral": 0.3334},
                    "top_features": [],
                    "error": str(e),
                }

            # Calibración de confianza mediante función logística + bonus de confluencia + acuerdo ML
            calibrated_raw = 50.0 + (1.0 / (1.0 + math.exp(-3.5 * abs(composite_score))) - 0.5) * 2.0 * 48.0
            confluence_bonus = 6.0 if mtf["status"] == "FULL_CONFLUENCE" else (
                -8.0 if mtf["status"] == "COUNTER_TREND_WARNING" else 0.0
            )

            # Bonus / penalización por acuerdo con el clasificador supervisado LightGBM
            ml_bonus = 0.0
            if (composite_score > 0 and ml_prediction["ml_action"] == "BUY") or (composite_score < 0 and ml_prediction["ml_action"] == "SELL"):
                ml_bonus = 4.0
            elif (composite_score > 0.2 and ml_prediction["ml_action"] == "SELL") or (composite_score < -0.2 and ml_prediction["ml_action"] == "BUY"):
                ml_bonus = -5.0

            confidence = min(98.5, max(50.0, (calibrated_raw + confluence_bonus + ml_bonus) * (1.0 - spread_penalty)))

            # 8. Gestión de Riesgo Dinámica Basada en Volatilidad (ATR Empírico)
            if asset.asset_type == "CRYPTO":
                base_risk, min_risk, max_risk = 0.018, 0.008, 0.042
            elif asset.asset_type == "COMMODITY":
                base_risk, min_risk, max_risk = 0.010, 0.005, 0.025
            else:
                base_risk, min_risk, max_risk = 0.006, 0.003, 0.015

            # En contratendencia apretamos el stop loss para proteger capital
            risk_scale = 0.75 if mtf["status"] == "COUNTER_TREND_WARNING" else 1.0
            vol_multiplier = max(0.6, min(2.5, realized_vol_pct / 1.5)) * risk_scale
            dynamic_risk_pct = max(min_risk, min(max_risk, base_risk * vol_multiplier))
            rr_ratio = 2.2

            entry_p = current_price
            if action in ("BUY", "STRONG_BUY"):
                stop_l = entry_p * Decimal(str(round(1.0 - dynamic_risk_pct, 6)))
                take_p = entry_p * Decimal(str(round(1.0 + (dynamic_risk_pct * rr_ratio), 6)))
            elif action in ("SELL", "STRONG_SELL"):
                stop_l = entry_p * Decimal(str(round(1.0 + dynamic_risk_pct, 6)))
                take_p = entry_p * Decimal(str(round(1.0 - (dynamic_risk_pct * rr_ratio), 6)))
            else:
                stop_l = None
                take_p = None

            volatility_risk = "HIGH" if realized_vol_pct >= 2.5 else ("MODERATE" if realized_vol_pct >= 1.2 else "LOW")

            # Construcción de Rationale transparente
            ml_str = f" | LightGBM ML: {ml_prediction['ml_action']} ({ml_prediction['confidence_score']:.1f}%)"
            if whipsaw_mitigated:
                rationale = (
                    f"Señal neutralizada a HOLD por filtro Anti-Whipsaw: "
                    f"rebote local de {mtf['fast_trend']} contra tendencia macro {mtf['macro_trend']} ({mtf['macro_delta_pct']:+.2f}%)."
                    f"{ml_str}"
                )
            elif mtf["status"] == "FULL_CONFLUENCE":
                rationale = (
                    f"Señal {action} confirmada con CONFLUENCIA PLENA (1m, 5m y 1h {mtf['macro_trend']}), "
                    f"Order Flow {flow_regime} (OFI {ofi_score:+.2f}) y régimen {regime}."
                    f"{ml_str}"
                )
            else:
                rationale = (
                    f"Señal {action} calculada en régimen {regime}: Sentimiento ({decay_sentiment:+.2f}), "
                    f"Momentum ({price_delta_pct:+.2f}%), OFI ({ofi_score:+.2f}) y Confluencia ({mtf['status']})."
                    f"{ml_str}"
                )

            # 9. Payload de Explicabilidad Avanzada trigger_factors (JSONB)
            trigger_factors = {
                "total_composite_score": round(composite_score, 4),
                "composite_score": round(composite_score, 4),
                "risk_reward_ratio": rr_ratio,
                "volatility_risk": volatility_risk,
                "market_regime": regime,
                "nlp_sentiment": {
                    "score": round(decay_sentiment, 3),
                    "label": sentiment_label,
                    "weight": w_sentiment,
                    "contribution": round(decay_sentiment * w_sentiment, 4),
                    "half_life_minutes": half_life,
                    "headlines_count": news_count,
                    "sample_headline": sample_headline or "Sin titulares directos recientes",
                },
                "price_momentum": {
                    "score": round(momentum_score, 3),
                    "change_pct": round(price_delta_pct, 3),
                    "weight": w_momentum,
                    "contribution": round(momentum_score * w_momentum, 4),
                    "vwap_deviation_pct": round(vwap_dev_pct, 3),
                    "realized_volatility_pct": round(realized_vol_pct, 3),
                    "last_spread": float(latest_tick.bid_ask_spread) if latest_tick.bid_ask_spread else None,
                },
                "order_flow": {
                    "ofi_score": round(ofi_score, 3),
                    "cvd_ratio": round(cvd_ratio, 3),
                    "flow_regime": flow_regime,
                    "weight": w_ofi,
                    "contribution": round(ofi_score * w_ofi, 4),
                },
                "multi_timeframe": {
                    "confluence_score": mtf["confluence_score"],
                    "status": mtf["status"],
                    "fast_trend": mtf["fast_trend"],
                    "medium_trend": mtf["medium_trend"],
                    "macro_trend": mtf["macro_trend"],
                    "fast_delta_pct": mtf["fast_delta_pct"],
                    "macro_delta_pct": mtf["macro_delta_pct"],
                    "multiplier": mtf["multiplier"],
                },
                "macro_bias": {
                    "bias": round(macro_bias, 3),
                    "weight": w_macro,
                    "contribution": round(macro_bias * w_macro, 4),
                    "market_regime": "BULLISH_BIAS" if macro_bias > 0.1 else ("BEARISH_BIAS" if macro_bias < -0.1 else "NEUTRAL"),
                },
                "technical_momentum": {
                    "score": round(momentum_score, 3),
                    "weight": w_momentum,
                    "price_delta_pct": round(price_delta_pct, 3),
                },
                "macro_alignment": {
                    "score": round(macro_bias, 3),
                    "weight": w_macro,
                    "market_regime": "BULLISH_BIAS" if macro_bias > 0.1 else ("BEARISH_BIAS" if macro_bias < -0.1 else "NEUTRAL"),
                },
                "risk_tuning": {
                    "dynamic_risk_pct": round(dynamic_risk_pct * 100, 3),
                    "realized_volatility_pct": round(realized_vol_pct, 3),
                    "spread_penalty_applied": round(spread_penalty, 4),
                    "whipsaw_mitigated": whipsaw_mitigated,
                },
                "ml_supervised": ml_prediction,
                "rationale": rationale,
            }

            # 10. Persistencia en Hipertabla predictive_signals
            signal_time = now
            insert_stmt = (
                insert(PredictiveSignal)
                .values(
                    generated_at=signal_time,
                    asset_id=asset_id,
                    timeframe=timeframe,
                    action_suggested=action,
                    confidence_score=Decimal(str(round(confidence, 2))),
                    entry_price=entry_p,
                    stop_loss=stop_l,
                    take_profit=take_p,
                    trigger_factors=trigger_factors,
                )
                .returning(PredictiveSignal.id)
            )
            res = await session.execute(insert_stmt)
            await session.commit()
            signal_id = res.scalar()

        # 11. Emisión a Redis Pub/Sub en Tiempo Real
        signal_payload = {
            "id": signal_id,
            "generated_at": signal_time.isoformat(),
            "asset_id": asset_id,
            "symbol": symbol,
            "timeframe": timeframe,
            "action": action,
            "confidence_score": round(confidence, 2),
            "entry_price": float(entry_p),
            "stop_loss": float(stop_l) if stop_l else None,
            "take_profit": float(take_p) if take_p else None,
            "trigger_factors": trigger_factors,
        }

        try:
            client = aioredis.Redis(connection_pool=redis_pool)
            payload_str = json.dumps(signal_payload)
            await client.publish(f"signals:{symbol}", payload_str)
            await client.publish("signals:stream", payload_str)
            await client.aclose()
        except Exception as e:
            print(f"[SignalEngine - Redis ERROR] {e}")

        return signal_payload


# Instancia singleton del motor de señales
signal_engine = SignalEngine()
