from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetResponse

router = APIRouter()


@router.get(
    "/",
    response_model=List[AssetResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Activos Financieros Monitoreados",
    description="Retorna el catálogo de activos con soporte de filtrado por tipo y estado.",
)
async def list_assets(
    asset_type: Optional[str] = Query(None, description="Filtro por tipo: CRYPTO, INDEX, COMMODITY, FOREX"),
    is_active: Optional[bool] = Query(True, description="Filtrar por estado activo/inactivo"),
    limit: int = Query(50, ge=1, le=100, description="Límite de resultados"),
    offset: int = Query(0, ge=0, description="Desplazamiento / paginación"),
    db: AsyncSession = Depends(get_db),
) -> List[Asset]:
    query = select(Asset)

    if asset_type:
        query = query.where(Asset.asset_type == asset_type.upper())
    if is_active is not None:
        query = query.where(Asset.is_active == is_active)

    query = query.order_by(Asset.id).offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get(
    "/{symbol:path}",
    response_model=AssetResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener Detalle de un Activo por Símbolo",
    description="Permite buscar activos por su símbolo canónico (ej: BTC/USDT o SPY).",
)
async def get_asset_by_symbol(
    symbol: str,
    db: AsyncSession = Depends(get_db),
) -> Asset:
    query = select(Asset).where(Asset.symbol == symbol)
    result = await db.execute(query)
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activo con símbolo '{symbol}' no encontrado en el catálogo.",
        )
    return asset


@router.post(
    "/",
    response_model=AssetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar Nuevo Activo en el Catálogo",
    description="Agrega un nuevo activo al catálogo para su posterior ingesta y monitoreo.",
)
async def create_asset(
    asset_in: AssetCreate,
    db: AsyncSession = Depends(get_db),
) -> Asset:
    # Verificar si el símbolo ya existe
    query = select(Asset).where(Asset.symbol == asset_in.symbol)
    result = await db.execute(query)
    existing_asset = result.scalar_one_or_none()

    if existing_asset:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El activo '{asset_in.symbol}' ya está registrado con el ID {existing_asset.id}.",
        )

    new_asset = Asset(
        symbol=asset_in.symbol,
        name=asset_in.name,
        asset_type=asset_in.asset_type.upper(),
        is_active=asset_in.is_active,
    )
    db.add(new_asset)
    await db.commit()
    await db.refresh(new_asset)
    return new_asset
