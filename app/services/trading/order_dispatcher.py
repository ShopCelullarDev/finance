"""
Order Dispatcher & Auto-Execution Engine (Fase 7.2 & 7.3)
Worker en segundo plano que se suscribe a Redis Pub/Sub:
1. `signals:stream`: Evalúa señales de IA bajo filtro estricto de confluencia institucional
   (confianza ML >= 55%, OFI en concordancia, filtro de régimen) y auto-ejecuta órdenes simuladas con slippage.
2. `ticks:stream`: Monitoriza tick a tick las posiciones abiertas frente a precios de Binance,
   actualizando PnL flotante, ratcheting de Trailing Stop y disparando Stop Loss / Take Profit en tiempo real.
"""

import asyncio
import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_pool
from app.models.paper_trading import PaperAccount, PaperPosition
from app.schemas.paper_trading import OpenPositionRequest
from app.services.trading.portfolio_manager import PortfolioManager

logger = logging.getLogger("market.order_dispatcher")


class OrderDispatcher:
    def __init__(
        self,
        portfolio_manager: Optional[PortfolioManager] = None,
        auto_trade_enabled: bool = True,
        min_confidence: float = 55.0,
        risk_per_trade_pct: float = 1.0,
        require_ml_agreement: bool = True,
        require_ofi_confluence: bool = True,
        avoid_squeeze_regime: bool = True,
        default_taker_slippage_bps: float = 1.5,
        trade_amount_usd: float = 1000.0,
        target_profit_pct: float = 5.0,
        asset_selection_mode: str = "AUTOMATIC",
        selected_symbol: str = "BTC/USDT",
        compound_interest_enabled: bool = False,
        trading_mode: str = "SIMULATED",
    ):
        self.portfolio_manager = portfolio_manager or PortfolioManager()
        self.auto_trade_enabled = auto_trade_enabled
        self.trading_mode = trading_mode
        self.min_confidence = min_confidence
        self.risk_per_trade_pct = risk_per_trade_pct
        self.trade_amount_usd = trade_amount_usd
        self.target_profit_pct = target_profit_pct
        self.asset_selection_mode = asset_selection_mode
        self.selected_symbol = selected_symbol
        self.compound_interest_enabled = compound_interest_enabled
        self.accumulated_compound_profit = 0.0
        self.require_ml_agreement = require_ml_agreement
        self.require_ofi_confluence = require_ofi_confluence
        self.avoid_squeeze_regime = avoid_squeeze_regime
        self.default_taker_slippage_bps = default_taker_slippage_bps
        self.allowed_symbols: Optional[Set[str]] = None  # None = todos los permitidos

        # Estado del worker
        self._is_running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._redis_client: Optional[aioredis.Redis] = None

        # Caché rápida de símbolos con posiciones abiertas para filtrado O(1) de ticks
        self.active_open_symbols: Set[str] = set()

        # Telemetría y auditoría de ejecución
        self.signals_received: int = 0
        self.signals_filtered: int = 0
        self.orders_dispatched: int = 0
        self.orders_failed: int = 0
        self.ticks_processed: int = 0
        self.last_dispatched_at: Optional[datetime] = None
        self.recent_activity: deque = deque(maxlen=30)  # Últimos 30 eventos de auditoría

    async def start(self) -> None:
        """Inicia el worker de escucha Pub/Sub en segundo plano."""
        if self._is_running:
            return
        self._is_running = True

        logger.info("[OrderDispatcher] Iniciando worker de auto-ejecución y monitoreo en vivo...")
        await self._sync_active_symbols()

        self._redis_client = aioredis.Redis(connection_pool=redis_pool)
        self._worker_task = asyncio.create_task(self._listen_loop())
        logger.info("[OrderDispatcher] Worker activo y suscrito a signals:stream y ticks:stream.")

    async def stop(self) -> None:
        """Detiene el worker de auto-ejecución."""
        if not self._is_running:
            return
        self._is_running = False

        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None

        if self._redis_client:
            await self._redis_client.aclose()
            self._redis_client = None

        logger.info("[OrderDispatcher] Worker detenido limpiamente.")

    async def _sync_active_symbols(self) -> None:
        """Sincroniza los símbolos que tienen posiciones abiertas actualmente."""
        try:
            async with AsyncSessionLocal() as db:
                stmt = select(PaperPosition.symbol).where(PaperPosition.status == "OPEN").distinct()
                res = await db.execute(stmt)
                symbols = set(res.scalars().all())
                self.active_open_symbols = symbols
        except Exception as e:
            logger.warning(f"[OrderDispatcher] Error al sincronizar símbolos activos: {e}")

    async def _listen_loop(self) -> None:
        """Bucle principal de escucha en canales Pub/Sub."""
        pubsub = self._redis_client.pubsub()
        await pubsub.subscribe("signals:stream", "ticks:stream")

        try:
            while self._is_running:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if not message:
                    await asyncio.sleep(0.01)
                    continue

                channel = message.get("channel")
                raw_data = message.get("data")
                if not raw_data:
                    continue

                try:
                    payload = json.loads(raw_data)
                    if channel == "signals:stream":
                        await self._handle_signal_event(payload)
                    elif channel == "ticks:stream":
                        await self._handle_tick_event(payload)
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    logger.error(f"[OrderDispatcher] Error procesando mensaje de {channel}: {e}", exc_info=True)
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe("signals:stream", "ticks:stream")
            await pubsub.aclose()

    async def _handle_signal_event(self, signal: Dict[str, Any]) -> None:
        """Procesa una señal emitida por signal_engine.py."""
        self.signals_received += 1
        symbol = signal.get("symbol")
        action = signal.get("action", "HOLD").upper()
        confidence = float(signal.get("confidence_score", 0.0))
        entry_price = float(signal.get("entry_price", 0.0))

        stop_loss = signal.get("stop_loss")
        take_profit = signal.get("take_profit")
        trigger_factors = signal.get("trigger_factors", {})

        # 1. Filtro: Auto-Trading Habilitado
        if not self.auto_trade_enabled:
            self._record_filter(symbol, action, confidence, "AUTO_TRADE_DISABLED")
            return

        # 2. Filtro: Acción Operable (BUY / SELL)
        if action in ("HOLD", "NEUTRAL"):
            self._record_filter(symbol, action, confidence, "HOLD_ACTION_IGNORED")
            return

        # 3. Filtro: Selección de Criptomoneda (Automática por IA vs Específica)
        if self.asset_selection_mode == "SPECIFIC" and self.selected_symbol:
            if symbol != self.selected_symbol:
                self._record_filter(symbol, action, confidence, f"ASSET_SELECTION_SPECIFIC (Operando solo {self.selected_symbol})")
                return
        elif self.allowed_symbols and symbol not in self.allowed_symbols:
            self._record_filter(symbol, action, confidence, f"SYMBOL_NOT_ALLOWED ({symbol})")
            return

        # 4. Filtro: Umbral de Confianza Cuantitativa
        if confidence < self.min_confidence:
            self._record_filter(symbol, action, confidence, f"CONFIDENCE_BELOW_THRESHOLD ({confidence:.1f}% < {self.min_confidence:.1f}%)")
            return

        # 5. Filtro de Confluencia de Machine Learning Supervisado
        is_long = action in ("BUY", "STRONG_BUY")
        target_side = "BUY" if is_long else "SELL"

        if self.require_ml_agreement:
            ml_data = trigger_factors.get("ml_supervised", {})
            ml_pred = ml_data.get("predicted_class")
            if ml_pred:
                # Si la señal de reglas es BUY, ML no puede ser opuesto (SELL)
                if is_long and ml_pred == "SELL":
                    self._record_filter(symbol, action, confidence, "ML_DIVERGENCE (Rules: BUY vs ML: SELL)")
                    return
                # Si la señal de reglas es SELL, ML no puede ser opuesto (BUY)
                elif not is_long and ml_pred == "BUY":
                    self._record_filter(symbol, action, confidence, "ML_DIVERGENCE (Rules: SELL vs ML: BUY)")
                    return

        # 6. Filtro de Order Flow Imbalance (OFI)
        if self.require_ofi_confluence:
            order_flow = trigger_factors.get("order_flow", {})
            ofi_score = float(order_flow.get("ofi_score", 0.0))
            if is_long and ofi_score < -0.20:
                self._record_filter(symbol, action, confidence, f"OFI_CONTRARY_PRESSURE (OFI={ofi_score:.2f} < -0.20)")
                return
            elif not is_long and ofi_score > 0.20:
                self._record_filter(symbol, action, confidence, f"OFI_CONTRARY_PRESSURE (OFI={ofi_score:.2f} > 0.20)")
                return

        # 7. Filtro de Régimen de Mercado
        if self.avoid_squeeze_regime:
            regime_data = trigger_factors.get("regime_detection", {})
            regime = regime_data.get("regime", "")
            if regime == "VOLATILITY_SQUEEZE":
                self._record_filter(symbol, action, confidence, "VOLATILITY_SQUEEZE_REGIME_FILTER")
                return

        # 8. Verificación en Base de Datos: Duplicidad y Ejecución
        async with AsyncSessionLocal() as db:
            account = await self.portfolio_manager.get_or_create_account_by_type(db, self.trading_mode)

            # Comprobar si ya existe una posición abierta para este símbolo
            dup_stmt = select(PaperPosition).where(
                PaperPosition.account_id == account.id,
                PaperPosition.symbol == symbol,
                PaperPosition.status == "OPEN",
            )
            dup_res = await db.execute(dup_stmt)
            existing = dup_res.scalar_one_or_none()
            if existing:
                self._record_filter(symbol, action, confidence, f"POSITION_ALREADY_OPEN ({existing.side} {symbol})")
                return

            # Calcular precio con deslizamiento (Slippage) institucional
            slippage_factor = 1.0 + (self.default_taker_slippage_bps / 10000.0) if is_long else 1.0 - (self.default_taker_slippage_bps / 10000.0)
            executed_price = entry_price * slippage_factor

            # Dimensionamiento con Monto Asignado e Interés Compuesto
            explicit_size = None
            if self.trade_amount_usd and self.trade_amount_usd > 0:
                base_trade_amount = self.trade_amount_usd
                if self.compound_interest_enabled:
                    effective_trade_amount = base_trade_amount + max(0.0, self.accumulated_compound_profit)
                else:
                    effective_trade_amount = base_trade_amount
                explicit_size = round(effective_trade_amount / max(1e-6, executed_price), 8)

            # Cálculo de Take Profit y Stop Loss basados en el % de profit objetivo
            final_take_profit = float(take_profit) if take_profit else None
            final_stop_loss = float(stop_loss) if stop_loss else None
            if self.target_profit_pct and self.target_profit_pct > 0:
                profit_margin = self.target_profit_pct / 100.0
                if is_long:
                    final_take_profit = executed_price * (1.0 + profit_margin)
                    final_stop_loss = executed_price * (1.0 - (profit_margin / 2.0))
                else:
                    final_take_profit = executed_price * (1.0 - profit_margin)
                    final_stop_loss = executed_price * (1.0 + (profit_margin / 2.0))

            open_req = OpenPositionRequest(
                symbol=symbol,
                side=target_side,
                risk_pct=self.risk_per_trade_pct,
                explicit_size=explicit_size,
                stop_loss=final_stop_loss,
                take_profit=final_take_profit,
                signal_id=signal.get("id"),
                metadata={
                    "source": "auto_order_dispatcher",
                    "signal_action": action,
                    "confidence_score": confidence,
                    "asset_selection_mode": self.asset_selection_mode,
                    "compound_interest_active": self.compound_interest_enabled,
                    "compound_profit_applied": self.accumulated_compound_profit if self.compound_interest_enabled else 0.0,
                    "trade_amount_usd": self.trade_amount_usd,
                    "target_profit_pct": self.target_profit_pct,
                    "ml_predicted_class": trigger_factors.get("ml_supervised", {}).get("predicted_class"),
                    "ofi_score": trigger_factors.get("order_flow", {}).get("ofi_score"),
                    "regime": trigger_factors.get("regime_detection", {}).get("regime"),
                    "slippage_bps": self.default_taker_slippage_bps,
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                },
            )

            try:
                pos = await self.portfolio_manager.open_position(
                    db=db,
                    account_id=account.id,
                    req=open_req,
                    current_market_price=executed_price,
                )
                self.orders_dispatched += 1
                self.last_dispatched_at = datetime.now(timezone.utc)
                self.active_open_symbols.add(symbol)

                self._record_dispatch(
                    status="SUCCESS",
                    position_id=str(pos.id),
                    symbol=symbol,
                    side=target_side,
                    price=executed_price,
                    size=float(pos.size),
                    confidence=confidence,
                    notes=f"Auto-ejecutado con {self.default_taker_slippage_bps} bps slippage.",
                )
                logger.info(
                    f"[ORDER DISPATCHER] Auto-ejecución exitosa: {target_side} {pos.size} {symbol} @ {executed_price:.2f} (Conf: {confidence}%)"
                )
            except Exception as e:
                self.orders_failed += 1
                self._record_dispatch(
                    status="FAILED",
                    position_id="",
                    symbol=symbol,
                    side=target_side,
                    price=executed_price,
                    size=0.0,
                    confidence=confidence,
                    notes=f"Fallo al abrir posición: {e}",
                )
                logger.error(f"[ORDER DISPATCHER] Fallo al auto-ejecutar {symbol}: {e}")

    async def _handle_tick_event(self, tick: Dict[str, Any]) -> None:
        """Monitoriza tick a tick las posiciones abiertas (Fase 7.3)."""
        symbol = tick.get("symbol")
        price = tick.get("price")
        if not symbol or not price or price <= 0:
            return

        self.ticks_processed += 1

        # Optimización de alto rendimiento: Solo consultar base de datos si el símbolo tiene posiciones abiertas activas
        if symbol not in self.active_open_symbols:
            return

        async with AsyncSessionLocal() as db:
            try:
                closed_or_updated = await self.portfolio_manager.update_market_price(
                    db=db,
                    symbol=symbol,
                    latest_price=float(price),
                )
                # Si se cerró alguna posición por SL, TP o Trailing Stop, revisar si quedan más en ese símbolo
                for p in closed_or_updated:
                    if p.status == "CLOSED":
                        logger.info(f"[MONITOR EN VIVO] Posición cerrada automáticamente: {p.symbol} {p.side} por {p.close_reason}")
                        # Interés compuesto: Si la posición cerró en ganancia, acumular profit para el siguiente trade
                        if self.compound_interest_enabled and p.realized_pnl and float(p.realized_pnl) > 0:
                            self.accumulated_compound_profit += float(p.realized_pnl)
                            logger.info(
                                f"[INTERÉS COMPUESTO] Profit de +${float(p.realized_pnl):.2f} capitalizado. "
                                f"Ganancia compuesta acumulada: ${self.accumulated_compound_profit:.2f}. "
                                f"Siguiente operación utilizará base de ${self.trade_amount_usd + self.accumulated_compound_profit:.2f}"
                            )
                        # Re-sincronizar símbolos activos
                        await self._sync_active_symbols()
                        break
            except Exception as e:
                logger.error(f"[MONITOR EN VIVO] Error actualizando precio de {symbol}: {e}")

    def _record_filter(self, symbol: str, action: str, confidence: float, reason: str) -> None:
        """Registra un evento de filtrado en el libro de auditoría."""
        self.signals_filtered += 1
        entry = {
            "type": "SIGNAL_FILTERED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "symbol": symbol,
            "action": action,
            "confidence": confidence,
            "reason": reason,
        }
        self.recent_activity.append(entry)

    def _record_dispatch(
        self,
        status: str,
        position_id: str,
        symbol: str,
        side: str,
        price: float,
        size: float,
        confidence: float,
        notes: str,
    ) -> None:
        """Registra un intento de despacho en el libro de auditoría."""
        entry = {
            "type": "ORDER_DISPATCH",
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "position_id": position_id,
            "symbol": symbol,
            "side": side,
            "price": price,
            "size": size,
            "confidence": confidence,
            "notes": notes,
        }
        self.recent_activity.append(entry)

    def get_status(self) -> Dict[str, Any]:
        """Devuelve el estado de telemetría y configuración del despachador."""
        effective_trade_amount = (
            self.trade_amount_usd + (self.accumulated_compound_profit if self.compound_interest_enabled else 0.0)
            if self.trade_amount_usd else None
        )
        return {
            "is_running": self._is_running,
            "auto_trade_enabled": self.auto_trade_enabled,
            "trading_mode": self.trading_mode,
            "min_confidence": self.min_confidence,
            "risk_per_trade_pct": self.risk_per_trade_pct,
            "trade_amount_usd": self.trade_amount_usd,
            "target_profit_pct": self.target_profit_pct,
            "asset_selection_mode": self.asset_selection_mode,
            "selected_symbol": self.selected_symbol,
            "compound_interest_enabled": self.compound_interest_enabled,
            "accumulated_compound_profit": round(self.accumulated_compound_profit, 2),
            "effective_trade_amount": round(effective_trade_amount, 2) if effective_trade_amount else None,
            "require_ml_agreement": self.require_ml_agreement,
            "require_ofi_confluence": self.require_ofi_confluence,
            "avoid_squeeze_regime": self.avoid_squeeze_regime,
            "default_taker_slippage_bps": self.default_taker_slippage_bps,
            "allowed_symbols": list(self.allowed_symbols) if self.allowed_symbols else None,
            "active_monitored_symbols": list(self.active_open_symbols),
            "telemetry": {
                "signals_received": self.signals_received,
                "signals_filtered": self.signals_filtered,
                "orders_dispatched": self.orders_dispatched,
                "orders_failed": self.orders_failed,
                "ticks_processed": self.ticks_processed,
                "last_dispatched_at": self.last_dispatched_at.isoformat() if self.last_dispatched_at else None,
            },
            "recent_activity": list(self.recent_activity),
        }

    def update_config(
        self,
        auto_trade_enabled: Optional[bool] = None,
        trading_mode: Optional[str] = None,
        min_confidence: Optional[float] = None,
        risk_per_trade_pct: Optional[float] = None,
        trade_amount_usd: Optional[float] = None,
        target_profit_pct: Optional[float] = None,
        asset_selection_mode: Optional[str] = None,
        selected_symbol: Optional[str] = None,
        compound_interest_enabled: Optional[bool] = None,
        require_ml_agreement: Optional[bool] = None,
        require_ofi_confluence: Optional[bool] = None,
        avoid_squeeze_regime: Optional[bool] = None,
        default_taker_slippage_bps: Optional[float] = None,
        allowed_symbols: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Actualiza parámetros de control del despachador en tiempo real."""
        if auto_trade_enabled is not None:
            self.auto_trade_enabled = auto_trade_enabled
        if trading_mode is not None:
            self.trading_mode = "REAL" if trading_mode.upper() == "REAL" else "SIMULATED"
        if min_confidence is not None:
            self.min_confidence = min_confidence
        if risk_per_trade_pct is not None:
            self.risk_per_trade_pct = risk_per_trade_pct
        if trade_amount_usd is not None:
            self.trade_amount_usd = trade_amount_usd
        if target_profit_pct is not None:
            self.target_profit_pct = target_profit_pct
        if asset_selection_mode is not None:
            self.asset_selection_mode = asset_selection_mode
        if selected_symbol is not None:
            self.selected_symbol = selected_symbol
        if compound_interest_enabled is not None:
            self.compound_interest_enabled = compound_interest_enabled
        if require_ml_agreement is not None:
            self.require_ml_agreement = require_ml_agreement
        if require_ofi_confluence is not None:
            self.require_ofi_confluence = require_ofi_confluence
        if avoid_squeeze_regime is not None:
            self.avoid_squeeze_regime = avoid_squeeze_regime
        if default_taker_slippage_bps is not None:
            self.default_taker_slippage_bps = default_taker_slippage_bps
        if allowed_symbols is not None:
            self.allowed_symbols = set(allowed_symbols) if allowed_symbols else None

        return self.get_status()


# Instancia singleton global del despachador
order_dispatcher = OrderDispatcher()
