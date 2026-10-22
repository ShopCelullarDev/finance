"""
Portfolio Manager & Paper Trading Service
Gestiona la cartera simulada, apertura/cierre de posiciones, actualización de PnL tick a tick,
trailing stops dinámicos y registro de curvas de capital institucional en TimescaleDB y Redis.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.core.redis import get_redis_client
from app.models.asset import Asset
from app.models.paper_trading import PaperAccount, PaperEquitySnapshot, PaperPosition
from app.schemas.paper_trading import OpenPositionRequest, PositionSizingResponse
from app.services.trading.position_sizer import PositionSizer, SizingResult

logger = logging.getLogger("market.paper_trading")


class PortfolioManager:
    def __init__(self, position_sizer: Optional[PositionSizer] = None):
        self.sizer = position_sizer or PositionSizer()
        self._redis = get_redis_client()

    async def get_or_create_default_account(self, db: AsyncSession) -> PaperAccount:
        """Obtiene o crea la cuenta institucional de Paper Trading por defecto."""
        stmt = select(PaperAccount).where(PaperAccount.is_active == True).order_by(PaperAccount.created_at.asc())
        result = await db.execute(stmt)
        account = result.scalars().first()

        if not account:
            account = PaperAccount(
                id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
                name="Cartera Institucional Alpha (Simulada)",
                initial_balance=10000.0000,
                current_balance=10000.0000,
                allocated_margin=0.0000,
                realized_pnl=0.0000,
            )
            db.add(account)
            await db.commit()
            await db.refresh(account)

            # Snapshot inicial
            snapshot = PaperEquitySnapshot(
                time=datetime.now(timezone.utc),
                account_id=account.id,
                total_equity=10000.0000,
                cash_balance=10000.0000,
                allocated_margin=0.0000,
                unrealized_pnl=0.0000,
                realized_pnl=0.0000,
                open_positions_count=0,
            )
            db.add(snapshot)
            await db.commit()

        return account

    async def get_account_summary(self, db: AsyncSession, account_id: UUID) -> Dict[str, Any]:
        """Calcula métricas consolidadas en tiempo real para la cuenta."""
        account_stmt = select(PaperAccount).where(PaperAccount.id == account_id)
        account_res = await db.execute(account_stmt)
        account = account_res.scalar_one_or_none()
        if not account:
            raise ValueError(f"Cuenta de paper trading {account_id} no encontrada.")

        # Obtener posiciones abiertas
        open_pos_stmt = select(PaperPosition).where(
            PaperPosition.account_id == account_id,
            PaperPosition.status == "OPEN",
        )
        open_pos_res = await db.execute(open_pos_stmt)
        open_positions = open_pos_res.scalars().all()

        total_unrealized_pnl = sum(float(p.unrealized_pnl) for p in open_positions)
        total_allocated_margin = sum(float(p.margin_used) for p in open_positions)
        current_cash = float(account.current_balance)
        total_equity = current_cash + total_allocated_margin + total_unrealized_pnl

        # Métricas de rendimiento
        total_trades = account.total_trades
        winning = account.winning_trades
        losing = account.losing_trades
        win_rate_pct = round((winning / total_trades * 100.0), 2) if total_trades > 0 else 0.0

        # Profit Factor histórico desde posiciones cerradas
        closed_stmt = select(PaperPosition).where(
            PaperPosition.account_id == account_id,
            PaperPosition.status == "CLOSED",
        )
        closed_res = await db.execute(closed_stmt)
        closed_positions = closed_res.scalars().all()

        gross_profit = sum(float(p.realized_pnl) for p in closed_positions if float(p.realized_pnl) > 0)
        gross_loss = abs(sum(float(p.realized_pnl) for p in closed_positions if float(p.realized_pnl) < 0))
        profit_factor = round(gross_profit / max(1e-4, gross_loss), 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 1.0)

        return {
            "id": account.id,
            "name": account.name,
            "initial_balance": float(account.initial_balance),
            "current_balance": current_cash,
            "allocated_margin": total_allocated_margin,
            "unrealized_pnl": round(total_unrealized_pnl, 4),
            "total_equity": round(total_equity, 4),
            "realized_pnl": float(account.realized_pnl),
            "total_trades": total_trades,
            "winning_trades": winning,
            "losing_trades": losing,
            "win_rate_pct": win_rate_pct,
            "profit_factor": profit_factor,
            "open_positions_count": len(open_positions),
            "created_at": account.created_at,
            "updated_at": account.updated_at,
        }

    async def calculate_sizing_for_order(
        self,
        db: AsyncSession,
        account_id: UUID,
        symbol: str,
        side: str,
        entry_price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        risk_pct: float = 1.0,
        explicit_size: Optional[float] = None,
    ) -> PositionSizingResponse:
        """Pre-evalúa y calcula el dimensionamiento de una orden antes de colocarla."""
        summary = await self.get_account_summary(db, account_id)
        total_equity = summary["total_equity"]
        available_cash = summary["current_balance"]

        sizing = self.sizer.calculate_size(
            symbol=symbol,
            side=side,
            entry_price=entry_price,
            total_equity=total_equity,
            available_cash=available_cash,
            stop_loss=stop_loss,
            take_profit=take_profit,
            risk_pct=risk_pct,
            explicit_size=explicit_size,
        )

        return PositionSizingResponse(
            symbol=sizing.symbol,
            side=sizing.side,
            entry_price=sizing.entry_price,
            stop_loss=sizing.stop_loss,
            take_profit=sizing.take_profit,
            recommended_size=sizing.recommended_size,
            required_margin=sizing.required_margin,
            risk_amount_usdt=sizing.risk_amount_usdt,
            risk_pct=sizing.risk_pct,
            reward_risk_ratio=sizing.reward_risk_ratio,
            estimated_entry_fee=sizing.estimated_entry_fee,
            is_affordable=sizing.is_affordable,
            notes=sizing.notes,
        )

    async def open_position(
        self,
        db: AsyncSession,
        account_id: UUID,
        req: OpenPositionRequest,
        current_market_price: float,
    ) -> PaperPosition:
        """Abre una nueva posición simulada en la cartera."""
        account_stmt = select(PaperAccount).where(PaperAccount.id == account_id).with_for_update()
        account_res = await db.execute(account_stmt)
        account = account_res.scalar_one_or_none()
        if not account:
            raise ValueError(f"Cuenta {account_id} no encontrada.")

        # Obtener asset_id del símbolo
        asset_stmt = select(Asset).where(Asset.symbol == req.symbol)
        asset_res = await db.execute(asset_stmt)
        asset = asset_res.scalar_one_or_none()
        if not asset:
            raise ValueError(f"Activo con símbolo {req.symbol} no está registrado en el catálogo.")

        # Dimensionamiento
        current_cash = float(account.current_balance)
        allocated_margin = float(account.allocated_margin)
        total_equity = current_cash + allocated_margin

        sizing = self.sizer.calculate_size(
            symbol=req.symbol,
            side=req.side,
            entry_price=current_market_price,
            total_equity=total_equity,
            available_cash=current_cash,
            stop_loss=req.stop_loss,
            take_profit=req.take_profit,
            risk_pct=req.risk_pct,
            explicit_size=req.explicit_size,
        )

        if not sizing.is_affordable:
            raise ValueError(f"Fondos insuficientes o tamaño no viable para abrir {req.symbol}: {sizing.notes}")

        # Descontar margen y comisión de entrada del efectivo
        total_deduction = sizing.required_margin + sizing.estimated_entry_fee
        account.current_balance = float(account.current_balance) - total_deduction
        account.allocated_margin = float(account.allocated_margin) + sizing.required_margin

        position = PaperPosition(
            account_id=account.id,
            asset_id=asset.id,
            symbol=req.symbol,
            side=sizing.side,
            status="OPEN",
            size=sizing.recommended_size,
            entry_price=sizing.entry_price,
            current_price=sizing.entry_price,
            stop_loss=sizing.stop_loss,
            take_profit=sizing.take_profit,
            trailing_stop_active=False,
            trailing_stop_price=None,
            margin_used=sizing.required_margin,
            unrealized_pnl=0.0000,
            realized_pnl=0.0000,
            return_pct=0.0000,
            entry_fee=sizing.estimated_entry_fee,
            exit_fee=0.0000,
            slippage_incurred=0.0000,
            signal_id=req.signal_id,
            extra_metadata=req.metadata,
        )
        db.add(position)
        await db.flush()

        # Registrar Snapshot de Equity
        new_total_equity = float(account.current_balance) + float(account.allocated_margin)
        snapshot = PaperEquitySnapshot(
            time=datetime.now(timezone.utc),
            account_id=account.id,
            total_equity=new_total_equity,
            cash_balance=float(account.current_balance),
            allocated_margin=float(account.allocated_margin),
            unrealized_pnl=0.0000,
            realized_pnl=float(account.realized_pnl),
            open_positions_count=1,
        )
        db.add(snapshot)
        await db.commit()
        await db.refresh(position)

        # Emitir evento a Redis Pub/Sub
        await self._publish_event(
            "POSITION_OPENED",
            {
                "position_id": str(position.id),
                "symbol": position.symbol,
                "side": position.side,
                "size": float(position.size),
                "entry_price": float(position.entry_price),
                "stop_loss": float(position.stop_loss) if position.stop_loss else None,
                "take_profit": float(position.take_profit) if position.take_profit else None,
                "margin_used": float(position.margin_used),
                "account_balance": float(account.current_balance),
            },
        )

        logger.info(
            f"[PAPER TRADING] Posición abierta: {position.side} {position.size} {position.symbol} @ {position.entry_price} (SL: {position.stop_loss}, TP: {position.take_profit})"
        )
        return position

    async def update_market_price(
        self,
        db: AsyncSession,
        symbol: str,
        latest_price: float,
    ) -> List[PaperPosition]:
        """
        Actualiza el precio de mercado de todas las posiciones abiertas del símbolo,
        recalculando PnL flotante, gestionando Trailing Stop a Breakeven y
        disparando cierres automáticos si se alcanza Stop Loss o Take Profit.
        """
        if latest_price <= 0:
            return []

        stmt = select(PaperPosition).where(
            PaperPosition.symbol == symbol,
            PaperPosition.status == "OPEN",
        )
        res = await db.execute(stmt)
        open_positions = res.scalars().all()

        closed_or_updated: List[PaperPosition] = []

        for pos in open_positions:
            entry_p = float(pos.entry_price)
            size = float(pos.size)
            margin = float(pos.margin_used)
            sl = float(pos.stop_loss) if pos.stop_loss else None
            tp = float(pos.take_profit) if pos.take_profit else None
            is_long = pos.side == "BUY"

            pos.current_price = latest_price

            # 1. Recalcular PnL no realizado
            price_diff = (latest_price - entry_p) if is_long else (entry_p - latest_price)
            unrealized_pnl = price_diff * size
            pos.unrealized_pnl = round(unrealized_pnl, 4)
            pos.return_pct = round((unrealized_pnl / margin) * 100.0, 4) if margin > 0 else 0.0

            # 2. Gestión dinámica de Trailing Stop a Breakeven (50% del camino a TP)
            if tp is not None and not pos.trailing_stop_active:
                target_dist = abs(tp - entry_p)
                current_favorable_move = (latest_price - entry_p) if is_long else (entry_p - latest_price)
                if current_favorable_move >= (target_dist * 0.50):
                    # Activar trailing stop en Breakeven + comisiones
                    entry_fee_per_unit = float(pos.entry_fee) / size if size > 0 else 0.0
                    breakeven_price = entry_p + (entry_fee_per_unit * 1.5) if is_long else entry_p - (entry_fee_per_unit * 1.5)
                    pos.trailing_stop_active = True
                    pos.trailing_stop_price = round(breakeven_price, 4)
                    logger.info(
                        f"[TRAILING STOP ACTIVADO] {pos.symbol} {pos.side} movido a Breakeven @ {pos.trailing_stop_price}"
                    )

            # Si ya está activo el trailing stop, ratcheting alcista/bajista para asegurar ganancias
            if pos.trailing_stop_active and pos.trailing_stop_price is not None:
                current_tsp = float(pos.trailing_stop_price)
                if is_long and (latest_price - entry_p) > 0:
                    potential_stop = latest_price - (abs(tp - entry_p) * 0.35 if tp else latest_price * 0.008)
                    if potential_stop > current_tsp:
                        pos.trailing_stop_price = round(potential_stop, 4)
                elif not is_long and (entry_p - latest_price) > 0:
                    potential_stop = latest_price + (abs(tp - entry_p) * 0.35 if tp else latest_price * 0.008)
                    if potential_stop < current_tsp:
                        pos.trailing_stop_price = round(potential_stop, 4)

            # 3. Comprobar si se tocó Stop Loss, Trailing Stop o Take Profit
            trigger_reason: Optional[str] = None
            exit_price = latest_price

            effective_sl = float(pos.trailing_stop_price) if (pos.trailing_stop_active and pos.trailing_stop_price) else sl

            if is_long:
                if effective_sl is not None and latest_price <= effective_sl:
                    trigger_reason = "TRAILING_STOP" if pos.trailing_stop_active else "STOP_LOSS"
                    exit_price = effective_sl
                elif tp is not None and latest_price >= tp:
                    trigger_reason = "TAKE_PROFIT"
                    exit_price = tp
            else:  # Short (SELL)
                if effective_sl is not None and latest_price >= effective_sl:
                    trigger_reason = "TRAILING_STOP" if pos.trailing_stop_active else "STOP_LOSS"
                    exit_price = effective_sl
                elif tp is not None and latest_price <= tp:
                    trigger_reason = "TAKE_PROFIT"
                    exit_price = tp

            if trigger_reason:
                # Disparar cierre automático
                closed_pos = await self.close_position(
                    db=db,
                    position_id=pos.id,
                    exit_price=exit_price,
                    reason=trigger_reason,
                )
                closed_or_updated.append(closed_pos)
            else:
                closed_or_updated.append(pos)

        await db.commit()
        return closed_or_updated

    async def close_position(
        self,
        db: AsyncSession,
        position_id: UUID,
        exit_price: float,
        reason: str = "MANUAL_EXIT",
    ) -> PaperPosition:
        """Cierra una posición simulada, liquida el PnL y actualiza el saldo de la cartera."""
        pos_stmt = select(PaperPosition).where(PaperPosition.id == position_id).with_for_update()
        pos_res = await db.execute(pos_stmt)
        pos = pos_res.scalar_one_or_none()
        if not pos:
            raise ValueError(f"Posición {position_id} no encontrada.")

        if pos.status != "OPEN":
            return pos  # Ya cerrada

        account_stmt = select(PaperAccount).where(PaperAccount.id == pos.account_id).with_for_update()
        account_res = await db.execute(account_stmt)
        account = account_res.scalar_one_or_none()
        if not account:
            raise ValueError(f"Cuenta vinculada a la posición no encontrada.")

        entry_p = float(pos.entry_price)
        size = float(pos.size)
        margin = float(pos.margin_used)
        entry_fee = float(pos.entry_fee)
        is_long = pos.side == "BUY"

        # Liquidación de tarifas y slippage
        exit_margin = size * exit_price
        exit_fee = exit_margin * self.sizer.taker_fee_rate

        gross_pnl = (exit_price - entry_p) * size if is_long else (entry_p - exit_price) * size
        net_realized_pnl = gross_pnl - entry_fee - exit_fee
        return_pct = (net_realized_pnl / margin) * 100.0 if margin > 0 else 0.0

        # Actualizar posición
        pos.status = "CLOSED"
        pos.exit_price = exit_price
        pos.current_price = exit_price
        pos.exit_fee = exit_fee
        pos.realized_pnl = round(net_realized_pnl, 4)
        pos.unrealized_pnl = 0.0000
        pos.return_pct = round(return_pct, 4)
        pos.closed_at = datetime.now(timezone.utc)
        pos.close_reason = reason

        # Devolver margen comprometido + PnL neto al efectivo de la cuenta
        account.current_balance = float(account.current_balance) + margin + net_realized_pnl
        account.allocated_margin = max(0.0, float(account.allocated_margin) - margin)
        account.realized_pnl = float(account.realized_pnl) + net_realized_pnl
        account.total_trades += 1
        if net_realized_pnl > 0:
            account.winning_trades += 1
        else:
            account.losing_trades += 1

        # Registrar instantánea de Equity
        new_total_equity = float(account.current_balance) + float(account.allocated_margin)
        snapshot = PaperEquitySnapshot(
            time=datetime.now(timezone.utc),
            account_id=account.id,
            total_equity=new_total_equity,
            cash_balance=float(account.current_balance),
            allocated_margin=float(account.allocated_margin),
            unrealized_pnl=0.0000,
            realized_pnl=float(account.realized_pnl),
            open_positions_count=0,
        )
        db.add(snapshot)
        await db.commit()
        await db.refresh(pos)

        # Emitir evento a Redis
        await self._publish_event(
            "POSITION_CLOSED",
            {
                "position_id": str(pos.id),
                "symbol": pos.symbol,
                "side": pos.side,
                "entry_price": entry_p,
                "exit_price": exit_price,
                "realized_pnl": float(pos.realized_pnl),
                "return_pct": float(pos.return_pct),
                "close_reason": reason,
                "new_account_balance": float(account.current_balance),
                "total_trades": account.total_trades,
            },
        )

        logger.info(
            f"[PAPER TRADING] Posición cerrada: {pos.symbol} {pos.side} @ {exit_price} | PnL: ${pos.realized_pnl:.2f} ({pos.return_pct:.2f}%) Motivo: {reason}"
        )
        return pos

    async def reset_account(
        self,
        db: AsyncSession,
        account_id: UUID,
        initial_balance: float = 10000.0000,
    ) -> PaperAccount:
        """Reinicia la cuenta a saldo inicial y cancela posiciones abiertas."""
        account_stmt = select(PaperAccount).where(PaperAccount.id == account_id).with_for_update()
        res = await db.execute(account_stmt)
        account = res.scalar_one_or_none()
        if not account:
            raise ValueError(f"Cuenta {account_id} no encontrada.")

        # Cancelar / cerrar forzadamente posiciones abiertas
        await db.execute(
            update(PaperPosition)
            .where(PaperPosition.account_id == account_id, PaperPosition.status == "OPEN")
            .values(
                status="CANCELLED",
                closed_at=datetime.now(timezone.utc),
                close_reason="ACCOUNT_RESET",
            )
        )

        account.initial_balance = initial_balance
        account.current_balance = initial_balance
        account.allocated_margin = 0.0000
        account.realized_pnl = 0.0000
        account.total_trades = 0
        account.winning_trades = 0
        account.losing_trades = 0

        snapshot = PaperEquitySnapshot(
            time=datetime.now(timezone.utc),
            account_id=account.id,
            total_equity=initial_balance,
            cash_balance=initial_balance,
            allocated_margin=0.0000,
            unrealized_pnl=0.0000,
            realized_pnl=0.0000,
            open_positions_count=0,
        )
        db.add(snapshot)
        await db.commit()
        await db.refresh(account)

        await self._publish_event(
            "ACCOUNT_RESET",
            {"account_id": str(account.id), "initial_balance": initial_balance},
        )
        return account

    async def get_open_positions(self, db: AsyncSession, account_id: UUID) -> List[PaperPosition]:
        """Obtiene todas las posiciones abiertas activas."""
        stmt = (
            select(PaperPosition)
            .where(PaperPosition.account_id == account_id, PaperPosition.status == "OPEN")
            .order_by(desc(PaperPosition.opened_at))
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_closed_positions(
        self, db: AsyncSession, account_id: UUID, limit: int = 50
    ) -> List[PaperPosition]:
        """Obtiene el historial de posiciones cerradas para auditoría."""
        stmt = (
            select(PaperPosition)
            .where(PaperPosition.account_id == account_id, PaperPosition.status.in_(["CLOSED", "CANCELLED"]))
            .order_by(desc(PaperPosition.closed_at))
            .limit(limit)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_equity_curve(
        self, db: AsyncSession, account_id: UUID, limit: int = 100
    ) -> List[PaperEquitySnapshot]:
        """Obtiene los puntos cronológicos de la curva de capital."""
        stmt = (
            select(PaperEquitySnapshot)
            .where(PaperEquitySnapshot.account_id == account_id)
            .order_by(desc(PaperEquitySnapshot.time))
            .limit(limit)
        )
        res = await db.execute(stmt)
        snapshots = list(res.scalars().all())
        snapshots.reverse()  # Orden ascendente cronológico para gráficos
        return snapshots

    async def _publish_event(self, event_type: str, data: Dict[str, Any]):
        """Publica eventos del motor de paper trading a Redis Pub/Sub."""
        try:
            payload = json.dumps({"event": event_type, "timestamp": datetime.now(timezone.utc).isoformat(), "data": data})
            await self._redis.publish("paper:events", payload)
        except Exception as e:
            logger.warning(f"Error publicando evento {event_type} a Redis: {e}")
