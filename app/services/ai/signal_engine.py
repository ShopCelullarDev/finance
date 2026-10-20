import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
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
    Correlaciona ticks de alta frecuencia, polaridad NLP de noticias y sesgo macroeconómico.
    Almacena en hipertabla predictive_signals y emite a Redis Pub/Sub.
    """

    def __init__(self):
        pass

    async def evaluate_asset_signal(
        self,
        asset: Asset,
        timeframe: str = "5m",
        macro_bias: float = 0.0,  # Sesgo macro (-1.0 a +1.0)
    ) -> Optional[Dict[str, Any]]:
        """
        Evalúa un activo específico y genera una señal predictiva cuantificada y explicable.
        """
        now = datetime.now(timezone.utc)
        asset_id = asset.id
        symbol = asset.symbol
        base_symbol = symbol.split("/")[0]

        async with AsyncSessionLocal() as session:
            # 1. Obtener los últimos ticks de mercado (para momentum y precio actual)
            tick_stmt = (
                select(MarketTick)
                .where(MarketTick.asset_id == asset_id)
                .order_by(desc(MarketTick.time))
                .limit(20)
            )
            tick_res = await session.execute(tick_stmt)
            recent_ticks = tick_res.scalars().all()

            if not recent_ticks:
                return None

            latest_tick = recent_ticks[0]
            current_price = latest_tick.price

            # Calcular momentum sobre los ticks recientes
            oldest_tick = recent_ticks[-1]
            if oldest_tick.price and oldest_tick.price > 0:
                price_delta_pct = float((current_price - oldest_tick.price) / oldest_tick.price) * 100.0
            else:
                price_delta_pct = 0.0

            # Momentum normalizado entre -1.0 y +1.0
            momentum_score = max(-1.0, min(1.0, price_delta_pct / 1.5))

            # 2. Obtener sentimiento NLP reciente (últimas 24 horas)
            cutoff_news = now - timedelta(hours=24)
            news_stmt = (
                select(NewsEvent)
                .where(NewsEvent.published_at >= cutoff_news)
                .order_by(desc(NewsEvent.published_at))
                .limit(10)
            )
            news_res = await session.execute(news_stmt)
            recent_news = news_res.scalars().all()

            # Filtrar noticias vinculadas al activo o de contexto global
            relevant_scores = []
            sample_headlines = []
            for n in recent_news:
                if n.affected_assets and (base_symbol in n.affected_assets or "ALL" in n.affected_assets):
                    if n.sentiment_score is not None:
                        relevant_scores.append(float(n.sentiment_score))
                        sample_headlines.append(n.title)

            if relevant_scores:
                avg_sentiment = sum(relevant_scores) / len(relevant_scores)
            else:
                avg_sentiment = 0.0

            # 3. Modelo de Decisión Compuesto
            # Ponderaciones: 40% Sentimiento NLP + 35% Momentum Ticks + 25% Macro/Predictive
            w_sentiment = 0.40
            w_momentum = 0.35
            w_macro = 0.25

            composite_score = (
                (avg_sentiment * w_sentiment) +
                (momentum_score * w_momentum) +
                (macro_bias * w_macro)
            )

            # Clasificación de la acción
            if composite_score >= 0.50:
                action = "STRONG_BUY"
            elif composite_score >= 0.18:
                action = "BUY"
            elif composite_score <= -0.50:
                action = "STRONG_SELL"
            elif composite_score <= -0.18:
                action = "SELL"
            else:
                action = "HOLD"

            # Confianza (50.0% a 98.5%)
            confidence = min(98.5, max(52.0, 50.0 + abs(composite_score) * 48.0))

            # 4. Gestión de Riesgo Basada en Volatilidad
            # Margen según tipo de activo (Cripto 2.0%, Commodities 1.0%, Índices 0.6%)
            risk_pct = 0.020 if asset.asset_type == "CRYPTO" else (0.010 if asset.asset_type == "COMMODITY" else 0.006)
            rr_ratio = 2.2  # Ratio Riesgo/Recompensa 1:2.2

            entry_p = current_price
            if action in ("BUY", "STRONG_BUY"):
                stop_l = entry_p * Decimal(str(1.0 - risk_pct))
                take_p = entry_p * Decimal(str(1.0 + (risk_pct * rr_ratio)))
            elif action in ("SELL", "STRONG_SELL"):
                stop_l = entry_p * Decimal(str(1.0 + risk_pct))
                take_p = entry_p * Decimal(str(1.0 - (risk_pct * rr_ratio)))
            else:
                stop_l = None
                take_p = None

            # 5. Estructuración Explicable del Payload trigger_factors (JSONB)
            trigger_factors = {
                "composite_score": round(composite_score, 4),
                "nlp_sentiment": {
                    "score": round(avg_sentiment, 3),
                    "weight": w_sentiment,
                    "headlines_count": len(relevant_scores),
                    "sample_headline": sample_headlines[0] if sample_headlines else "Sin noticias directas recientes",
                },
                "technical_momentum": {
                    "score": round(momentum_score, 3),
                    "weight": w_momentum,
                    "price_delta_pct": round(price_delta_pct, 3),
                    "last_spread": float(latest_tick.bid_ask_spread) if latest_tick.bid_ask_spread else None,
                },
                "macro_alignment": {
                    "score": round(macro_bias, 3),
                    "weight": w_macro,
                    "market_regime": "BULLISH_BIAS" if macro_bias > 0.1 else ("BEARISH_BIAS" if macro_bias < -0.1 else "NEUTRAL"),
                },
                "rationale": (
                    f"Señal {action} fundamentada por sentimiento NLP ({avg_sentiment:+.2f}) "
                    f"y momentum de ticks ({price_delta_pct:+.2f}%)."
                ),
            }

            # 6. Persistencia en la Hipertabla predictive_signals
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

        # 7. Publicación en Redis Pub/Sub
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
