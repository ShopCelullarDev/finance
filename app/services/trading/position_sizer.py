"""
Position Sizing Engine & Risk Management
Calcula el tamaño óptimo de posición (Position Sizing) adaptado a la volatilidad ATR,
fracción fija de riesgo del capital y límites de margen de cartera institucional.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class SizingResult:
    symbol: str
    side: str
    entry_price: float
    stop_loss: float
    take_profit: float
    recommended_size: float
    required_margin: float
    risk_amount_usdt: float
    risk_pct: float
    reward_risk_ratio: float
    estimated_entry_fee: float
    is_affordable: bool
    notes: str


class PositionSizer:
    def __init__(
        self,
        default_risk_pct: float = 1.0,        # 1% de riesgo por operación
        max_margin_pct: float = 25.0,         # Máximo 25% del capital total en una sola posición
        min_margin_usdt: float = 10.0,        # Tamaño mínimo de orden en USDT
        taker_fee_rate: float = 0.00015,      # 1.5 bps comisión taker de exchange
        default_rr_ratio: float = 2.2,        # Relación Riesgo/Recompensa objetivo
    ):
        self.default_risk_pct = default_risk_pct
        self.max_margin_pct = max_margin_pct
        self.min_margin_usdt = min_margin_usdt
        self.taker_fee_rate = taker_fee_rate
        self.default_rr_ratio = default_rr_ratio

    def calculate_size(
        self,
        symbol: str,
        side: str,
        entry_price: float,
        total_equity: float,
        available_cash: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        risk_pct: Optional[float] = None,
        atr_value: Optional[float] = None,
        explicit_size: Optional[float] = None,
    ) -> SizingResult:
        """
        Calcula el tamaño de la posición basándose en:
        - Si se especifica explicit_size, se valida el margen requerido.
        - De lo contrario, se aplica dimensionamiento por riesgo fijo y distancia al Stop Loss.
        """
        side = side.upper()
        if side not in ("BUY", "SELL"):
            raise ValueError(f"Side no reconocido: {side}. Debe ser 'BUY' o 'SELL'.")

        if entry_price <= 0:
            raise ValueError(f"Precio de entrada inválido: {entry_price}")

        risk_percent = risk_pct if risk_pct is not None else self.default_risk_pct
        risk_capital = total_equity * (risk_percent / 100.0)

        # 1. Determinar o validar Stop Loss y Take Profit
        if stop_loss is not None:
            if side == "BUY":
                distance = max(entry_price * 0.001, entry_price - stop_loss)
                calc_stop_loss = stop_loss
            else:
                distance = max(entry_price * 0.001, stop_loss - entry_price)
                calc_stop_loss = stop_loss
        elif atr_value is not None and atr_value > 0:
            distance = atr_value * 1.2
            calc_stop_loss = entry_price - distance if side == "BUY" else entry_price + distance
        else:
            # Fallback 1.5% de volatilidad base
            distance = entry_price * 0.015
            calc_stop_loss = entry_price - distance if side == "BUY" else entry_price + distance

        if take_profit is not None:
            calc_take_profit = take_profit
        else:
            target_distance = distance * self.default_rr_ratio
            calc_take_profit = entry_price + target_distance if side == "BUY" else entry_price - target_distance

        reward_dist = abs(calc_take_profit - entry_price)
        risk_dist = max(1e-6, abs(entry_price - calc_stop_loss))
        rr_ratio = round(reward_dist / risk_dist, 2)

        # 2. Si se proporciona explicit_size
        if explicit_size is not None and explicit_size > 0:
            units = explicit_size
            required_margin = units * entry_price
            est_fee = required_margin * self.taker_fee_rate
            total_cost = required_margin + est_fee
            is_affordable = total_cost <= available_cash and required_margin >= self.min_margin_usdt
            notes = (
                "Tamaño explícito manual asignado."
                if is_affordable
                else f"Margen insuficiente para tamaño manual ({required_margin:.2f} USDT vs disponible {available_cash:.2f} USDT)."
            )
            return SizingResult(
                symbol=symbol,
                side=side,
                entry_price=entry_price,
                stop_loss=round(calc_stop_loss, 4),
                take_profit=round(calc_take_profit, 4),
                recommended_size=round(units, 8),
                required_margin=round(required_margin, 4),
                risk_amount_usdt=round(units * risk_dist, 4),
                risk_pct=round((units * risk_dist / total_equity) * 100.0, 2),
                reward_risk_ratio=rr_ratio,
                estimated_entry_fee=round(est_fee, 4),
                is_affordable=is_affordable,
                notes=notes,
            )

        # 3. Dimensionamiento por Volatilidad y Riesgo Fijo
        # Size = Risk Capital / Distance to SL
        raw_units = risk_capital / max(1e-6, distance)
        required_margin = raw_units * entry_price
        max_allowed_margin = total_equity * (self.max_margin_pct / 100.0)

        capped_by_margin_limit = False
        if required_margin > max_allowed_margin:
            raw_units = max_allowed_margin / entry_price
            required_margin = raw_units * entry_price
            capped_by_margin_limit = True

        # Ajuste por efectivo disponible
        est_fee = required_margin * self.taker_fee_rate
        total_cost = required_margin + est_fee
        capped_by_cash = False

        if total_cost > available_cash:
            raw_units = (available_cash / (1.0 + self.taker_fee_rate)) / entry_price
            required_margin = raw_units * entry_price
            est_fee = required_margin * self.taker_fee_rate
            total_cost = required_margin + est_fee
            capped_by_cash = True

        units = round(raw_units, 8)
        is_affordable = required_margin >= self.min_margin_usdt and total_cost <= available_cash

        notes_parts = []
        if capped_by_margin_limit:
            notes_parts.append(f"Acotado al {self.max_margin_pct}% de margen de cartera.")
        if capped_by_cash:
            notes_parts.append("Acotado al efectivo líquido disponible.")
        if not is_affordable:
            notes_parts.append(f"Monto resultante menor al mínimo ({self.min_margin_usdt} USDT) o sin saldo.")
        else:
            notes_parts.append("Dimensionamiento óptimo completado.")

        notes = " ".join(notes_parts)
        effective_risk_amount = units * distance
        effective_risk_pct = round((effective_risk_amount / max(1.0, total_equity)) * 100.0, 2)

        return SizingResult(
            symbol=symbol,
            side=side,
            entry_price=entry_price,
            stop_loss=round(calc_stop_loss, 4),
            take_profit=round(calc_take_profit, 4),
            recommended_size=units,
            required_margin=round(required_margin, 4),
            risk_amount_usdt=round(effective_risk_amount, 4),
            risk_pct=effective_risk_pct,
            reward_risk_ratio=rr_ratio,
            estimated_entry_fee=round(est_fee, 4),
            is_affordable=is_affordable,
            notes=notes,
        )
