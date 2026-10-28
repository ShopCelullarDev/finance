import {
  Asset,
  PredictiveSignal,
  NewsEvent,
  SystemTelemetry,
  SignalAction,
  BacktestResult,
  DualPortfolioSummary,
  PaperAccount,
  PaperPosition,
  PaperEquitySnapshot,
  PositionSizingResult,
  OpenPositionPayload,
  OrderDispatcherStatus,
  OrderDispatcherConfig,
} from '@/types/market';
import { authService } from '@/services/auth';
import { getApiBase } from '@/services/origin';

function withAuth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  const token = authService.getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers, credentials: 'include' };
}

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, withAuth(init));
}

const ASSET_ID_TO_SYMBOL: Record<number, string> = {
  1: 'BTC/USDT',
  2: 'ETH/USDT',
  3: 'SOL/USDT',
  4: 'DXY',
  5: 'SP500',
  6: 'GLD',
  7: 'USO',
};

export function normalizeSignal(raw: any): PredictiveSignal {
  const symbol = raw.symbol || ASSET_ID_TO_SYMBOL[raw.asset_id] || 'BTC/USDT';
  const actionRaw = (raw.action || raw.action_suggested || 'HOLD').toUpperCase();
  const validActions: SignalAction[] = ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'];
  const action: SignalAction = validActions.includes(actionRaw as SignalAction)
    ? (actionRaw as SignalAction)
    : 'HOLD';

  const confidence = typeof raw.confidence_score === 'number'
    ? raw.confidence_score
    : parseFloat(raw.confidence_score);
  const entry = typeof raw.entry_price === 'number'
    ? raw.entry_price
    : parseFloat(raw.entry_price);
  const sl = typeof raw.stop_loss === 'number'
    ? raw.stop_loss
    : parseFloat(raw.stop_loss);
  const tp = typeof raw.take_profit === 'number'
    ? raw.take_profit
    : parseFloat(raw.take_profit);

  return {
    id: String(raw.id || `sig-${Date.now()}`),
    symbol,
    timeframe: raw.timeframe || '5m',
    action,
    confidence_score: Number.isFinite(confidence) ? confidence : 0,
    entry_price: Number.isFinite(entry) ? entry : 0,
    stop_loss: Number.isFinite(sl) ? sl : 0,
    take_profit: Number.isFinite(tp) ? tp : 0,
    status: raw.status || 'ACTIVE',
    created_at: raw.generated_at || raw.created_at || new Date().toISOString(),
    trigger_factors: raw.trigger_factors,
  };
}

export async function fetchHealth(): Promise<{ status: string; database_connected: boolean; redis_connected: boolean }> {
  const res = await apiFetch(`${getApiBase()}/api/v1/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchAssets(): Promise<Asset[]> {
  try {
    const res = await apiFetch(`${getApiBase()}/api/v1/assets/`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch assets: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Fallback for assets:', err);
    return [
      { id: 1, symbol: 'BTC/USDT', name: 'Bitcoin', category: 'CRYPTO', quote_currency: 'USDT', is_active: true },
      { id: 2, symbol: 'ETH/USDT', name: 'Ethereum', category: 'CRYPTO', quote_currency: 'USDT', is_active: true },
      { id: 3, symbol: 'SOL/USDT', name: 'Solana', category: 'CRYPTO', quote_currency: 'USDT', is_active: true },
      { id: 4, symbol: 'DXY', name: 'US Dollar Index', category: 'MACRO', quote_currency: 'USD', is_active: true },
      { id: 5, symbol: 'SP500', name: 'S&P 500 Index', category: 'INDEX', quote_currency: 'USD', is_active: true },
      { id: 6, symbol: 'GLD', name: 'Gold Trust ETF', category: 'COMMODITY', quote_currency: 'USD', is_active: true },
      { id: 7, symbol: 'USO', name: 'United States Oil Fund', category: 'COMMODITY', quote_currency: 'USD', is_active: true },
    ];
  }
}

export async function fetchSignals(limit: number = 20): Promise<PredictiveSignal[]> {
  try {
    const res = await apiFetch(`${getApiBase()}/api/v1/signals/?limit=${limit}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch signals: ${res.statusText}`);
    const raw = await res.json();
    if (Array.isArray(raw)) {
      return raw.map(normalizeSignal);
    }
    return [];
  } catch (err) {
    console.warn('[API] Fallback for signals:', err);
    return [];
  }
}

export async function triggerSignalEvaluation(symbol: string, timeframe: string = '5m'): Promise<PredictiveSignal> {
  const res = await apiFetch(`${getApiBase()}/api/v1/signals/evaluate/${encodeURIComponent(symbol)}?timeframe=${timeframe}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Signal evaluation failed: ${res.statusText}`);
  const raw = await res.json();
  return normalizeSignal(raw);
}

export function normalizeNews(raw: any): NewsEvent {
  const scoreNum = parseFloat(String(raw.sentiment_score ?? 0));
  const score = isNaN(scoreNum) ? 0 : scoreNum;

  let label = raw.sentiment_label;
  if (!label) {
    if (score >= 0.5) label = 'VERY_BULLISH';
    else if (score >= 0.15) label = 'BULLISH';
    else if (score <= -0.5) label = 'VERY_BEARISH';
    else if (score <= -0.15) label = 'BEARISH';
    else label = 'NEUTRAL';
  }

  const assets: string[] = Array.isArray(raw.related_assets)
    ? raw.related_assets
    : Array.isArray(raw.affected_assets)
    ? raw.affected_assets
    : [];

  return {
    id: String(raw.id || `news-${Date.now()}`),
    title: raw.title || 'Actualización de mercado en vivo',
    source: raw.source || 'MOTOR_PREDICTIVO',
    url: raw.url || undefined,
    published_at: raw.published_at || new Date().toISOString(),
    sentiment_score: score,
    sentiment_label: label,
    confidence: Number(raw.confidence) || 0.85,
    related_assets: assets,
  };
}

export async function fetchNews(limit: number = 15): Promise<NewsEvent[]> {
  try {
    const res = await apiFetch(`${getApiBase()}/api/v1/news/?limit=${limit}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch news: ${res.statusText}`);
    const raw = await res.json();
    if (Array.isArray(raw)) {
      return raw.map(normalizeNews);
    }
    return [];
  } catch (err) {
    console.warn('[API] Fallback for news:', err);
    return [];
  }
}

export async function fetchTelemetry(): Promise<SystemTelemetry> {
  try {
    const res = await apiFetch(`${getApiBase()}/api/v1/telemetry/overview`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch telemetry: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Telemetría no disponible:', err);
    return {
      database_connected: false,
      redis_connected: false,
      ticks_ingested_total: 0,
      signals_generated_total: null,
      active_websocket_clients: null,
      hypertable_chunks_total: null,
      compressed_chunks: null,
      timestamp: new Date().toISOString(),
      sources: [],
    };
  }
}

export async function fetchLatestBacktest(): Promise<BacktestResult | null> {
  try {
    const res = await apiFetch(`${getApiBase()}/api/v1/backtest/latest`, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch backtest results: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] Fallback or error fetching backtest:', err);
    return null;
  }
}

export async function triggerBacktestRun(params?: {
  symbol?: string;
  limit_ticks?: number;
  min_confidence?: number;
  max_holding_ticks?: number;
  taker_fee_bps?: number;
}): Promise<BacktestResult> {
  const res = await apiFetch(`${getApiBase()}/api/v1/backtest/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Backtest run failed: ${res.statusText}`);
  }
  return await res.json();
}

// ----------------------------------------------------------------------------
// API de Paper Trading & Portfolio Management
// ----------------------------------------------------------------------------

export async function fetchPaperAccount(accountType: 'SIMULATED' | 'REAL' = 'SIMULATED'): Promise<PaperAccount> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/account?account_type=${accountType}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Error al obtener cuenta de paper trading: ${res.statusText}`);
  return await res.json();
}

export async function fetchDualPortfolioSummary(): Promise<DualPortfolioSummary> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/portfolio/dual-summary`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Error al obtener resumen dual de carteras: ${res.statusText}`);
  return await res.json();
}

export async function fundAccount(payload: {
  amount: number;
  operation_type?: 'SET' | 'DEPOSIT';
  account_type?: 'SIMULATED' | 'REAL';
}): Promise<PaperAccount> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/account/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: payload.amount,
      operation_type: payload.operation_type || 'SET',
      account_type: payload.account_type || 'REAL',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error al fondear cuenta: ${res.statusText}`);
  }
  return await res.json();
}

export async function fetchOpenPositions(accountType: 'SIMULATED' | 'REAL' = 'SIMULATED'): Promise<PaperPosition[]> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/positions/open?account_type=${accountType}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Error al obtener posiciones abiertas: ${res.statusText}`);
  return await res.json();
}

export async function fetchClosedPositions(limit: number = 50, accountType: 'SIMULATED' | 'REAL' = 'SIMULATED'): Promise<PaperPosition[]> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/positions/history?limit=${limit}&account_type=${accountType}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Error al obtener historial de posiciones: ${res.statusText}`);
  return await res.json();
}

export async function fetchEquityCurve(limit: number = 100, accountType: 'SIMULATED' | 'REAL' = 'SIMULATED'): Promise<PaperEquitySnapshot[]> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/equity-curve?limit=${limit}&account_type=${accountType}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Error al obtener curva de capital: ${res.statusText}`);
  return await res.json();
}

export async function calculatePositionSizing(params: {
  symbol: string;
  side: string;
  entry_price: number;
  stop_loss?: number;
  take_profit?: number;
  risk_pct?: number;
  account_type?: 'SIMULATED' | 'REAL';
}): Promise<PositionSizingResult> {
  const accountType = params.account_type || 'SIMULATED';
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/calculate-sizing?account_type=${accountType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error calculando dimensionamiento: ${res.statusText}`);
  }
  return await res.json();
}

export async function openPaperPosition(
  payload: OpenPositionPayload,
  price?: number,
  accountType: 'SIMULATED' | 'REAL' = 'SIMULATED'
): Promise<PaperPosition> {
  const query = new URLSearchParams({ account_type: accountType });
  if (price) query.append('price', price.toString());
  const url = `${getApiBase()}/api/v1/paper/positions/open?${query.toString()}`;
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error abriendo posición: ${res.statusText}`);
  }
  return await res.json();
}

export async function closePaperPosition(
  positionId: string,
  exitPrice?: number,
  reason: string = 'MANUAL_EXIT'
): Promise<PaperPosition> {
  const url = exitPrice
    ? `${getApiBase()}/api/v1/paper/positions/${positionId}/close?exit_price=${exitPrice}`
    : `${getApiBase()}/api/v1/paper/positions/${positionId}/close`;
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ close_reason: reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error cerrando posición: ${res.statusText}`);
  }
  return await res.json();
}

export async function resetPaperAccount(
  initialBalance: number = 10000.0,
  accountType: 'SIMULATED' | 'REAL' = 'SIMULATED'
): Promise<PaperAccount> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/account/reset?initial_balance=${initialBalance}&account_type=${accountType}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error reiniciando cuenta: ${res.statusText}`);
  }
  return await res.json();
}

export async function fetchDispatcherStatus(): Promise<OrderDispatcherStatus> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/dispatcher/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Error obteniendo estado del despachador: ${res.statusText}`);
  return await res.json();
}

export async function updateDispatcherConfig(config: OrderDispatcherConfig): Promise<OrderDispatcherStatus> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/dispatcher/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error actualizando configuración del despachador: ${res.statusText}`);
  }
  return await res.json();
}

export async function startDispatcher(): Promise<OrderDispatcherStatus> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/dispatcher/start`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Error iniciando despachador: ${res.statusText}`);
  return await res.json();
}

export interface LiveCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DepthLevel {
  price: number;
  size: number;
}

export async function fetchKlines(symbol: string, interval: string): Promise<LiveCandle[]> {
  const params = new URLSearchParams({ symbol, interval, limit: '200' });
  const res = await apiFetch(`${getApiBase()}/api/v1/market/klines?${params}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const body = await res.json();
  return Array.isArray(body.candles) ? body.candles : [];
}

export async function fetchDepth(symbol: string): Promise<{ bids: DepthLevel[]; asks: DepthLevel[] } | null> {
  const params = new URLSearchParams({ symbol, limit: '10' });
  const res = await apiFetch(`${getApiBase()}/api/v1/market/depth?${params}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const body = await res.json();
  if (!Array.isArray(body.bids) || !Array.isArray(body.asks)) return null;
  return { bids: body.bids, asks: body.asks };
}

export async function stopDispatcher(): Promise<OrderDispatcherStatus> {
  const res = await apiFetch(`${getApiBase()}/api/v1/paper/dispatcher/stop`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Error deteniendo despachador: ${res.statusText}`);
  return await res.json();
}


