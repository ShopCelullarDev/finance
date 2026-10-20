from datetime import datetime, timezone
from decimal import Decimal
import json
import re
from typing import Any, Dict, List, Optional, Set
import redis.asyncio as aioredis
from sqlalchemy import insert

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_pool
from app.models.news_event import NewsEvent


class FinancialNLPEngine:
    """
    Motor NLP de análisis de sentimiento financiero y extracción de entidades.
    Calibrado con léxico de finanzas de alta frecuencia (Loughran-McDonald adaptado).
    Rango de score: -1.000 (Extremadamente Bajista) a +1.000 (Extremadamente Alcista).
    """

    # Diccionario financiero con pesos ponderados
    BULLISH_WORDS = {
        "surge": 0.8, "rally": 0.75, "breakout": 0.7, "ath": 0.9, "all-time high": 0.9,
        "adoption": 0.65, "inflow": 0.6, "accumulate": 0.7, "bullish": 0.8, "rate cut": 0.85,
        "partnership": 0.6, "upgrade": 0.65, "liquidity injection": 0.8, "institutional buying": 0.85,
        "approval": 0.9, "growth": 0.5, "soar": 0.75, "record high": 0.85, "gain": 0.55,
        "profit": 0.6, "expansion": 0.55, "etf approved": 0.95, "stimulus": 0.7, "buy": 0.5,
        "outperform": 0.65, "recovery": 0.6, "bull": 0.6, "accumulating": 0.7, "dovish": 0.75,
    }

    BEARISH_WORDS = {
        "crash": -0.85, "plunge": -0.8, "dump": -0.75, "ban": -0.8, "lawsuit": -0.7,
        "sec": -0.5, "hack": -0.9, "exploit": -0.9, "liquidation": -0.8, "rate hike": -0.8,
        "inflation spike": -0.75, "insolvency": -0.95, "bearish": -0.8, "recession": -0.85,
        "downgrade": -0.65, "outflow": -0.6, "selloff": -0.75, "slump": -0.65, "drop": -0.5,
        "loss": -0.55, "collapse": -0.95, "fraud": -0.9, "investigation": -0.6, "bankrupt": -0.95,
        "hawkish": -0.75, "default": -0.9, "bear": -0.6, "selling": -0.5, "crackdown": -0.8,
    }

    INTENSIFIERS = {
        "massive": 1.5, "huge": 1.4, "historic": 1.6, "record": 1.5, "severe": 1.5,
        "unprecedented": 1.6, "sharp": 1.3, "strong": 1.3, "heavy": 1.4,
    }

    NEGATIONS = {"not", "no", "never", "without", "failed to", "fails to", "despite"}

    # Mapeo de términos a activos canónicos del catálogo
    ASSET_MAP = {
        "bitcoin": "BTC", "btc": "BTC",
        "ethereum": "ETH", "ether": "ETH", "eth": "ETH",
        "solana": "SOL", "sol": "SOL",
        "binance": "BNB", "bnb": "BNB",
        "ripple": "XRP", "xrp": "XRP",
        "gold": "GLD", "oro": "GLD", "gld": "GLD",
        "silver": "SLV", "plata": "SLV", "slv": "SLV",
        "oil": "USO", "crude": "USO", "petroleo": "USO", "petróleo": "USO", "wti": "USO", "uso": "USO",
        "gas": "UNG", "natural gas": "UNG", "ung": "UNG",
        "sp500": "SPY", "s&p 500": "SPY", "s&p": "SPY", "spy": "SPY",
        "nasdaq": "QQQ", "tech stocks": "QQQ", "qqq": "QQQ",
        "russell": "IWM", "iwm": "IWM",
        "dollar": "UUP", "dxy": "UUP", "fed": "UUP", "powell": "UUP",
    }

    def _stem_candidates(self, word: str) -> List[str]:
        """Genera candidatos de lemas/raíces para palabras en inglés."""
        candidates = [word]
        if word.endswith("ing"):
            candidates.append(word[:-3])
            candidates.append(word[:-3] + "e")
        elif word.endswith("ies"):
            candidates.append(word[:-3] + "y")
        elif word.endswith("es"):
            candidates.append(word[:-2])
        elif word.endswith("ed"):
            candidates.append(word[:-2])
            candidates.append(word[:-1])
        elif word.endswith("s"):
            candidates.append(word[:-1])
        return candidates

    def analyze_headline(self, text: str) -> Dict[str, Any]:
        """
        Analiza un titular o noticia financiera.
        Calcula polaridad, etiqueta semántica y activos vinculados.
        """
        clean_text = text.lower()
        score_accumulator = 0.0
        word_matches = 0

        # 1. Búsqueda de frases compuestas primero (ej: "rate cut", "record high")
        for phrase, score in self.BULLISH_WORDS.items():
            if " " in phrase and phrase in clean_text:
                score_accumulator += score
                word_matches += 1

        for phrase, score in self.BEARISH_WORDS.items():
            if " " in phrase and phrase in clean_text:
                score_accumulator += score
                word_matches += 1

        # 2. Tokenización de palabras individuales
        words = re.findall(r"\b[a-z0-9\-]+\b", clean_text)
        negated = False
        intensifier = 1.0

        for word in words:
            # Detección de negaciones
            if word in self.NEGATIONS:
                negated = True
                continue

            # Detección de intensificadores
            if word in self.INTENSIFIERS:
                intensifier = self.INTENSIFIERS[word]
                continue

            # Evaluación de polaridad léxica probando raíz e inflexiones
            current_val = None
            for candidate in self._stem_candidates(word):
                if candidate in self.BULLISH_WORDS and " " not in candidate:
                    current_val = self.BULLISH_WORDS[candidate]
                    break
                elif candidate in self.BEARISH_WORDS and " " not in candidate:
                    current_val = self.BEARISH_WORDS[candidate]
                    break

            if current_val is not None:
                val = current_val * intensifier
                if negated:
                    val = -val * 0.7  # Invertir con factor de atenuación
                    negated = False
                intensifier = 1.0  # Reiniciar intensificador

                score_accumulator += val
                word_matches += 1

        # Normalización matemática del score entre -1.000 y +1.000
        if word_matches > 0:
            raw_score = score_accumulator / max(word_matches, 1)
            normalized_score = max(-1.0, min(1.0, raw_score))
        else:
            normalized_score = 0.0


        # Determinación de etiqueta
        if normalized_score >= 0.5:
            label = "VERY_BULLISH"
        elif normalized_score >= 0.15:
            label = "BULLISH"
        elif normalized_score <= -0.5:
            label = "VERY_BEARISH"
        elif normalized_score <= -0.15:
            label = "BEARISH"
        else:
            label = "NEUTRAL"

        # Extracción de entidades afectadas
        affected_assets = self.extract_affected_assets(clean_text)

        confidence = min(0.95, 0.40 + (word_matches * 0.15)) if word_matches > 0 else 0.30

        return {
            "headline": text,
            "sentiment_score": round(normalized_score, 3),
            "label": label,
            "confidence": round(confidence, 2),
            "word_matches": word_matches,
            "affected_assets": list(affected_assets),
        }

    def extract_affected_assets(self, text: str) -> Set[str]:
        """Identifica qué activos están directamente involucrados en la noticia."""
        clean_text = text.lower()
        found_assets = set()

        for term, canonical_symbol in self.ASSET_MAP.items():
            pattern = rf"\b{re.escape(term)}\b"
            if re.search(pattern, clean_text):
                found_assets.add(canonical_symbol)

        return found_assets

    async def ingest_news_event(
        self,
        source: str,
        title: str,
        url: Optional[str] = None,
        published_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Analiza el texto, lo persiste en la hipertabla news_events de TimescaleDB
        y emite el evento en Redis Pub/Sub para distribución en tiempo real.
        """
        pub_time = published_at or datetime.now(timezone.utc)
        nlp_result = self.analyze_headline(title)

        affected = nlp_result["affected_assets"]
        sentiment_score = Decimal(str(nlp_result["sentiment_score"]))

        # 1. Persistencia en TimescaleDB
        async with AsyncSessionLocal() as session:
            stmt = (
                insert(NewsEvent)
                .values(
                    published_at=pub_time,
                    source=source.upper(),
                    title=title,
                    url=url,
                    sentiment_score=sentiment_score,
                    affected_assets=affected if affected else None,
                )
                .returning(NewsEvent.id)
            )
            res = await session.execute(stmt)
            await session.commit()
            news_id = res.scalar()

        # 2. Publicación en Redis Pub/Sub
        event_payload = {
            "id": news_id,
            "published_at": pub_time.isoformat(),
            "source": source.upper(),
            "title": title,
            "url": url,
            "sentiment_score": float(sentiment_score),
            "label": nlp_result["label"],
            "affected_assets": affected,
        }

        try:
            client = aioredis.Redis(connection_pool=redis_pool)
            await client.publish("news:feed", json.dumps(event_payload))
            for asset in affected:
                await client.publish(f"news:{asset}", json.dumps(event_payload))
            await client.aclose()
        except Exception as e:
            print(f"[FinancialNLPEngine - Redis ERROR] {e}")

        return event_payload


# Instancia singleton
nlp_engine = FinancialNLPEngine()
