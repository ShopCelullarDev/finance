from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.news_event import NewsEvent
from app.schemas.news_event import NewsEventResponse
from app.services.ai.sentiment_nlp import nlp_engine

router = APIRouter()


class IngestNewsRequest(BaseModel):
    source: str = Field(..., examples=["REUTERS", "BLOOMBERG", "FINANCIAL_JUICE"])
    title: str = Field(..., examples=["Fed signals aggressive rate cuts as inflation cools down"])
    url: Optional[str] = Field(None, examples=["https://reuters.com/markets/rates-update"])


class AnalyzeTextRequest(BaseModel):
    text: str = Field(..., examples=["Bitcoin surges past resistance as institutional adoption accelerates"])


@router.get(
    "/",
    response_model=List[NewsEventResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Eventos de Noticias y Sentimiento",
    description="Recupera las noticias indexadas en la hipertabla news_events con sus scores de sentimiento.",
)
async def list_news(
    source: Optional[str] = Query(None, description="Filtrar por fuente (ej: REUTERS)"),
    asset: Optional[str] = Query(None, description="Filtrar por activo afectado (ej: BTC)"),
    limit: int = Query(25, ge=1, le=100, description="Límite de registros a recuperar"),
    db: AsyncSession = Depends(get_db),
) -> List[NewsEvent]:
    query = select(NewsEvent).order_by(desc(NewsEvent.published_at))

    if source:
        query = query.where(NewsEvent.source == source.upper())
    if asset:
        query = query.where(NewsEvent.affected_assets.contains([asset.upper()]))

    query = query.limit(limit)
    res = await db.execute(query)
    return list(res.scalars().all())


@router.post(
    "/ingest",
    status_code=status.HTTP_201_CREATED,
    summary="Ingestar y Analizar Noticia Financiera",
    description="Ejecuta el análisis de sentimiento NLP, persiste en TimescaleDB y emite en Redis Pub/Sub.",
)
async def ingest_news(
    request: IngestNewsRequest,
) -> Dict[str, Any]:
    event = await nlp_engine.ingest_news_event(
        source=request.source,
        title=request.title,
        url=request.url,
    )
    return event


@router.post(
    "/analyze",
    status_code=status.HTTP_200_OK,
    summary="Análisis Semántico en Vivo sin Persistencia",
    description="Evalúa la polaridad y entidades de un texto de inmediato sin guardarlo en la base de datos.",
)
async def analyze_text(
    request: AnalyzeTextRequest,
) -> Dict[str, Any]:
    return nlp_engine.analyze_headline(request.text)
