"""Velas y libro de Binance para la terminal. No guarda ni completa precios ausentes."""

from typing import Dict, List

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

_BINANCE = "https://api.binance.com"
_INTERVALS = {"1m", "5m", "15m", "1h", "4h", "1d"}
_PAIRS = {
    "BTC/USDT": "BTCUSDT",
    "ETH/USDT": "ETHUSDT",
    "SOL/USDT": "SOLUSDT",
}


def _pair(symbol: str) -> str:
    pair = _PAIRS.get(symbol)
    if not pair:
        raise HTTPException(status_code=404, detail="Ese símbolo no tiene mercado en vivo.")
    return pair


@router.get("/klines", summary="Velas recientes de Binance")
async def klines(
    symbol: str = Query(..., examples=["BTC/USDT"]),
    interval: str = Query("5m"),
    limit: int = Query(200, ge=20, le=500),
) -> Dict[str, object]:
    if interval not in _INTERVALS:
        raise HTTPException(status_code=400, detail="Intervalo no admitido.")
    pair = _pair(symbol)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{_BINANCE}/api/v3/klines",
                params={"symbol": pair, "interval": interval, "limit": limit},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Binance no respondió las velas.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Binance no entregó las velas.")

    candles: List[Dict[str, float]] = []
    for row in response.json():
        candles.append(
            {
                "time": int(row[0]) // 1000,
                "open": float(row[1]),
                "high": float(row[2]),
                "low": float(row[3]),
                "close": float(row[4]),
                "volume": float(row[5]),
            }
        )
    return {"symbol": symbol, "interval": interval, "candles": candles}


@router.get("/depth", summary="Libro de órdenes de Binance")
async def depth(
    symbol: str = Query(..., examples=["BTC/USDT"]),
    limit: int = Query(10, ge=5, le=20),
) -> Dict[str, object]:
    pair = _pair(symbol)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{_BINANCE}/api/v3/depth",
                params={"symbol": pair, "limit": limit},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Binance no respondió el libro.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Binance no entregó el libro.")

    body = response.json()
    bids = [{"price": float(price), "size": float(qty)} for price, qty in body.get("bids") or []]
    asks = [{"price": float(price), "size": float(qty)} for price, qty in body.get("asks") or []]
    return {"symbol": symbol, "bids": bids[:8], "asks": asks[:8]}
