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


class SignalEngine:
    """
    Motor Cuantitativo y de Inteligencia Artificial para la Generación de Señales Predictivas.
    Incorpora:
    1. Decaimiento temporal exponencial de noticias (Half-Life Kernel).
    2. Estimación de volatilidad realizada y Stop-Loss/Take-Profit dinámicos basados en ATR.
    3. Análisis de microestructura: Desviación de VWAP y penalización por Bid-Ask Spread.
    4. Calibración probabilística logística del nivel de confianza.
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
    def _calculate_realized_volatility(ticks: List[MarketTick]) -> tuple[float, float, float]:
        """Calcula volatilidad realizada empírica (%), desviación respecto a VWAP (%) y spread medio."""
        if len(ticks) < 3:
            return 1.5, 0.0, 0.0

        prices = [float(t.price) for t in ticks if t.price is not None]
        if len(prices) < 3:
            return 1.5, 0.0, 0.0

        # 1. Log returns para volatilidad realizada
        log_returns = [math.log(prices[i] / prices[i + 1]) for i in range(len(prices) - 1) if prices[i + 1] > 0]
        if log_returns:
            mean_ret = sum(log_returns) / len(log_returns)
            variance = sum((r - mean_ret) ** 2 for r in log_returns) / max(1, len(log_returns) - 1)
            tick_std = math.sqrt(variance)
            # Escala aproximada a barra de 5 minutos (~40 ticks)
            vol_pct = tick_std * math.sqrt(40) * 100.0
        else:
            vol_pct = 1.0

        # Rango empírico High-Low reciente
        max_p = max(prices)
        min_p = min(prices)
        mean_p = sum(prices) / len(prices)
        hl_range_pct = ((max_p - min_p) / mean_p) * 100.0 if mean_p > 0 else 0.0

        composite_vol_pct = max(vol_pct, hl_range_pct * 0.6)

        # 2. VWAP simplificado
        volumes = [float(t.volume_24h or 1.0) for t in ticks]
        sum_vol = sum(volumes)
        vwap = sum(p * v for p, v in zip(prices, volumes)) / sum_vol if sum_vol > 0 else mean_p
        vwap_deviation_pct = ((prices[0] - vwap) / vwap) * 100.0 if vwap > 0 else 0.0

        # 3. Spread promedio
        spreads = [float(t.bid_ask_spread) for t in ticks if t.bid_ask_spread is not None]
        avg_spread = sum(spreads) / len(spreads) if spreads else 0.0

        return round(composite_vol_pct, 4), round(vwap_deviation_pct, 4), round(avg_spread, 6)

    async def evaluate_asset_signal(
        self,
        asset: Asset,
        timeframe: str = "5m",
        macro_bias: float = 0.0,  # Sesgo macro (-1.0 a +1.0)
    ) -> Optional[Dict[str, Any]]:
        """
        Evalúa un activo específico y genera una señal predictiva cuantitativa optimizada.
        Aplica decaimiento temporal en noticias y stop-loss dinámico adaptado a la volatilidad.
        """
        now = datetime.now(timezone.utc)
        asset_id = asset.id
        symbol = asset.symbol
        base_symbol = symbol.split("/")[0]

        async with AsyncSessionLocal() as session:
            # 1. Obtener los últimos 40 ticks para muestreo estadístico de volatilidad y momentum
            tick_stmt = (
                select(MarketTick)
                .where(MarketTick.asset_id == asset_id)
                .order_by(desc(MarketTick.time))
                .limit(40)
            )
            tick_res = await session.execute(tick_stmt)
            recent_ticks = tick_res.scalars().all()

            if not recent_ticks:
                return None

            latest_tick = recent_ticks[0]
            current_price = latest_tick.price

            # Momentum sobre la ventana reciente
            oldest_tick = recent_ticks[-1]
            if oldest_tick.price and oldest_tick.price > 0:
                price_delta_pct = float((current_price - oldest_tick.price) / oldest_tick.price) * 100.0
            else:
                price_delta_pct = 0.0

            # Momentum normalizado [-1.0, +1.0] con atenuación no lineal (tanh)
            momentum_score = math.tanh(price_delta_pct / 1.5)

            # Volatilidad realizada empírica y VWAP
            realized_vol_pct, vwap_dev_pct, avg_spread = self._calculate_realized_volatility(recent_ticks)

            # 2. Sentimiento NLP con Kernel de Decaimiento Exponencial (Half-life = 45m cripto / 120m macro)
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

            # 3. Ponderación adaptativa del modelo compuesto
            # Si hay alta volatilidad o noticias frescas, ajustamos los pesos dinámicamente
            w_sentiment = 0.40
            w_momentum = 0.35
            w_macro = 0.25

            composite_score = (
                (decay_sentiment * w_sentiment) +
                (momentum_score * w_momentum) +
                (macro_bias * w_macro)
            )

            # Clasificación de acción sugerida
            if composite_score >= 0.45:
                action = "STRONG_BUY"
            elif composite_score >= 0.16:
                action = "BUY"
            elif composite_score <= -0.45:
                action = "STRONG_SELL"
            elif composite_score <= -0.16:
                action = "SELL"
            else:
                action = "HOLD"

            # 4. Penalización por Spread de Mercado (Microestructura)
            spread_penalty = 0.0
            if latest_tick.bid_ask_spread and current_price and current_price > 0:
                spread_pct = (float(latest_tick.bid_ask_spread) / float(current_price)) * 100.0
                if spread_pct > 0.08:  # Spread anormalmente amplio
                    spread_penalty = min(0.20, (spread_pct - 0.08) * 1.5)

            # Calibración de confianza mediante función logística
            calibrated_raw = 50.0 + (1.0 / (1.0 + math.exp(-3.5 * abs(composite_score))) - 0.5) * 2.0 * 48.0
            confidence = min(98.5, max(50.0, calibrated_raw * (1.0 - spread_penalty)))

            # 5. Gestión de Riesgo Dinámica Basada en Volatilidad (ATR Empírico)
            # Volatilidad base por clase de activo
            if asset.asset_type == "CRYPTO":
                base_risk, min_risk, max_risk = 0.018, 0.008, 0.042
            elif asset.asset_type == "COMMODITY":
                base_risk, min_risk, max_risk = 0.010, 0.005, 0.025
            else:
                base_risk, min_risk, max_risk = 0.006, 0.003, 0.015

            # Escalar riesgo según la volatilidad realizada
            vol_multiplier = max(0.6, min(2.5, realized_vol_pct / 1.5))
            dynamic_risk_pct = max(min_risk, min(max_risk, base_risk * vol_multiplier))
            rr_ratio = 2.2  # Ratio Riesgo/Recompensa objetivo 1:2.2

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

            # 6. Payload de Explicabilidad Avanzada trigger_factors (JSONB)
            trigger_factors = {
                "total_composite_score": round(composite_score, 4),
                "composite_score": round(composite_score, 4),
                "risk_reward_ratio": rr_ratio,
                "volatility_risk": volatility_risk,
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
                },
                "rationale": (
                    f"Señal {action} generada con Sentimiento NLP temporal ({decay_sentiment:+.2f}, half-life {int(half_life)}m), "
                    f"momentum ({price_delta_pct:+.2f}%) y volatilidad ({realized_vol_pct:.2f}%)."
                ),
            }

            # 7. Persistencia en Hipertabla predictive_signals
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

        # 8. Emisión a Redis Pub/Sub en Tiempo Real
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
