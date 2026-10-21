import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import desc, select

from app.core.database import AsyncSessionLocal
from app.models.asset import Asset
from app.models.market_tick import MarketTick
from app.models.news_event import NewsEvent


class QuantitativeFeatureStore:
    """
    Feature Store Cuantitativo y Etiquetado Triple Barrier (Marcos López de Prado).
    Extrae matrices de características multivariables libres de data leakage y genera
    etiquetas forward-looking para entrenamiento de modelos supervisados (LightGBM).
    """

    FEATURE_COLUMNS = [
        "log_return_5m",
        "log_return_15m",
        "log_return_1h",
        "realized_volatility",
        "vwap_deviation",
        "ofi_score",
        "cvd_ratio",
        "spread_bps",
        "hl_range_pct",
        "news_sentiment",
        "macro_bias",
        "regime_is_trending",
        "regime_is_choppy",
        "regime_is_squeeze",
    ]

    def __init__(self, asset_symbol: str = "BTC/USDT"):
        self.asset_symbol = asset_symbol

    async def fetch_historical_dataset(
        self,
        max_ticks: int = 5000,
    ) -> Tuple[pd.DataFrame, List[NewsEvent]]:
        """Extrae ticks históricos ordenados cronológicamente desde TimescaleDB."""
        async with AsyncSessionLocal() as session:
            # 1. Obtener el activo
            asset_res = await session.execute(
                select(Asset).where(Asset.symbol == self.asset_symbol)
            )
            asset = asset_res.scalar_one_or_none()
            if not asset:
                raise ValueError(f"Activo '{self.asset_symbol}' no encontrado en la base de datos.")

            # 2. Consultar ticks en orden cronológico ascendente
            stmt = (
                select(MarketTick)
                .where(MarketTick.asset_id == asset.id)
                .order_by(MarketTick.time.asc())
                .limit(max_ticks)
            )
            ticks_res = await session.execute(stmt)
            ticks = ticks_res.scalars().all()

            # 3. Consultar noticias recientes
            news_stmt = (
                select(NewsEvent)
                .order_by(NewsEvent.published_at.asc())
            )
            news_res = await session.execute(news_stmt)
            news = news_res.scalars().all()

        if not ticks:
            raise ValueError(f"No hay ticks suficientes para '{self.asset_symbol}'.")

        data = []
        for t in ticks:
            data.append({
                "time": t.time if t.time.tzinfo else t.time.replace(tzinfo=timezone.utc),
                "price": float(t.price),
                "volume": float(t.volume_24h or 1.0),
                "spread": float(t.bid_ask_spread or 0.0),
            })

        df = pd.DataFrame(data)
        df.sort_values("time", inplace=True)
        df.reset_index(drop=True, inplace=True)
        return df, news

    def extract_features(
        self,
        df: pd.DataFrame,
        news: List[NewsEvent],
        window_5m: int = 20,
        window_15m: int = 60,
        window_1h: int = 240,
    ) -> pd.DataFrame:
        """
        Calcula el vector de features cuantitativas para cada punto temporal t.
        Respeta el estricto orden cronológico para evitar look-ahead bias (sin data leakage).
        """
        n = len(df)
        prices = df["price"].values
        volumes = df["volume"].values
        spreads = df["spread"].values
        times = df["time"].values

        features_list = []

        base_sym = self.asset_symbol.split("/")[0]

        for i in range(window_1h, n):
            p_t = prices[i]
            t_curr = pd.to_datetime(times[i], utc=True)

            # 1. Log Returns multi-horizonte
            p_5m = prices[max(0, i - window_5m)]
            p_15m = prices[max(0, i - window_15m)]
            p_1h = prices[max(0, i - window_1h)]

            ret_5m = math.log(p_t / p_5m) if p_5m > 0 else 0.0
            ret_15m = math.log(p_t / p_15m) if p_15m > 0 else 0.0
            ret_1h = math.log(p_t / p_1h) if p_1h > 0 else 0.0

            # 2. Volatilidad Realizada sobre ventana corta
            recent_p = prices[i - window_5m : i + 1]
            log_rets = np.diff(np.log(recent_p))
            std_vol = float(np.std(log_rets) * math.sqrt(window_5m) * 100.0) if len(log_rets) > 1 else 1.0

            # Rango High-Low reciente
            hl_range_pct = float(((np.max(recent_p) - np.min(recent_p)) / np.mean(recent_p)) * 100.0)

            # 3. VWAP Deviation
            recent_v = volumes[i - window_5m : i + 1]
            sum_v = np.sum(recent_v)
            vwap = float(np.sum(recent_p * recent_v) / sum_v) if sum_v > 0 else p_t
            vwap_dev = float(((p_t - vwap) / vwap) * 100.0) if vwap > 0 else 0.0

            # 4. Order Flow Imbalance (Lee-Ready Tick Rule)
            buy_v, sell_v = 0.0, 0.0
            for k in range(i - window_5m + 1, i + 1):
                dp = prices[k] - prices[k - 1]
                dv = abs(volumes[k] - volumes[k - 1]) or 1.0
                if dp >= 0:
                    buy_v += dv
                else:
                    sell_v += dv

            tot_v = buy_v + sell_v
            cvd_ratio = (buy_v - sell_v) / tot_v if tot_v > 0 else 0.0
            ofi_score = math.tanh(cvd_ratio * 2.2 + (vwap_dev / 0.5) * 0.4)

            # 5. Spread en Basis Points (bps)
            spread_bps = (spreads[i] / p_t) * 10000.0 if p_t > 0 else 0.0

            # 6. Decaimiento Exponencial de Noticias hacia t_curr
            decay_sent = 0.0
            decay_lambda = math.log(2) / 45.0  # 45 min half-life
            weight_sum = 0.0
            for item in news:
                if item.published_at.tzinfo is not None and item.published_at.tzinfo.utcoffset(item.published_at) is not None:
                    item_time = pd.to_datetime(item.published_at, utc=True)
                else:
                    item_time = pd.to_datetime(item.published_at.replace(tzinfo=timezone.utc), utc=True)

                if item_time <= t_curr:
                    delta_m = (t_curr - item_time).total_seconds() / 60.0
                    if delta_m <= 1440.0:  # Últimas 24h
                        w = math.exp(-decay_lambda * delta_m)
                        if item.affected_assets and (base_sym in item.affected_assets or "ALL" in item.affected_assets):
                            decay_sent += float(item.sentiment_score or 0.0) * w
                            weight_sum += w

            final_sent = decay_sent / weight_sum if weight_sum > 0 else 0.0

            # 7. Regímenes de Mercado (One-Hot Encoded)
            regime_trending = 1.0 if abs(ret_5m) > 0.003 and std_vol > 0.8 else 0.0
            regime_squeeze = 1.0 if std_vol < 0.5 and hl_range_pct < 0.3 else 0.0
            regime_choppy = 1.0 if abs(ret_5m) < 0.001 and std_vol < 1.0 and regime_squeeze == 0.0 else 0.0

            features_list.append({
                "index": i,
                "time": t_curr,
                "price": p_t,
                "log_return_5m": ret_5m,
                "log_return_15m": ret_15m,
                "log_return_1h": ret_1h,
                "realized_volatility": std_vol,
                "vwap_deviation": vwap_dev,
                "ofi_score": ofi_score,
                "cvd_ratio": cvd_ratio,
                "spread_bps": spread_bps,
                "hl_range_pct": hl_range_pct,
                "news_sentiment": final_sent,
                "macro_bias": 0.0,
                "regime_is_trending": regime_trending,
                "regime_is_choppy": regime_choppy,
                "regime_is_squeeze": regime_squeeze,
            })

        return pd.DataFrame(features_list)

    def apply_triple_barrier_labeling(
        self,
        df_features: pd.DataFrame,
        full_df: pd.DataFrame,
        k_tp: float = 1.8,
        k_sl: float = 1.0,
        max_holding_ticks: int = 50,
    ) -> pd.DataFrame:
        """
        Implementa el Triple Barrier Method de Marcos López de Prado:
        - Barrera Superior (+1 / BUY): Precio alcanza el target Take Profit antes que el Stop Loss o límite temporal.
        - Barrera Inferior (0 / SELL): Precio alcanza el Stop Loss primero.
        - Barrera Temporal (2 / NEUTRAL): Se agota el tiempo (max_holding_ticks) sin tocar ninguna barrera vertical.

        Mapeo numérico para LightGBM multiclass:
        - 0: SELL (toca stop loss)
        - 1: BUY (toca take profit)
        - 2: NEUTRAL (rango / time-out)
        """
        labels = []
        return_at_exit = []
        barrier_touched = []

        full_prices = full_df["price"].values
        total_len = len(full_prices)

        for _, row in df_features.iterrows():
            idx = int(row["index"])
            p_entry = row["price"]
            recent_p = full_prices[max(0, idx - 20) : idx + 1]
            std_ret = float(np.std(np.diff(np.log(recent_p)))) if len(recent_p) > 2 else 0.0001
            expected_move = max(0.00015, std_ret * math.sqrt(max_holding_ticks))

            tp_level = p_entry * (1.0 + (k_tp * expected_move))
            sl_level = p_entry * (1.0 - (k_sl * expected_move))

            end_idx = min(total_len, idx + max_holding_ticks)
            future_prices = full_prices[idx + 1 : end_idx]

            if len(future_prices) == 0:
                labels.append(2)  # Neutral
                return_at_exit.append(0.0)
                barrier_touched.append("TIME_LIMIT")
                continue

            hit_label = 2
            exit_ret = (future_prices[-1] - p_entry) / p_entry
            barrier = "TIME_LIMIT"

            for p_f in future_prices:
                if p_f >= tp_level:
                    hit_label = 1  # BUY Target Hit
                    exit_ret = (tp_level - p_entry) / p_entry
                    barrier = "TAKE_PROFIT"
                    break
                elif p_f <= sl_level:
                    hit_label = 0  # SELL / Stop Hit
                    exit_ret = (sl_level - p_entry) / p_entry
                    barrier = "STOP_LOSS"
                    break

            labels.append(hit_label)
            return_at_exit.append(exit_ret)
            barrier_touched.append(barrier)

        result_df = df_features.copy()
        result_df["target_label"] = labels
        result_df["return_at_exit"] = return_at_exit
        result_df["barrier_touched"] = barrier_touched
        return result_df
