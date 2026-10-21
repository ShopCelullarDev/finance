export type MarketCategory = 'CRYPTO' | 'PREDICTION' | 'MACRO' | 'COMMODITY' | 'INDEX';

export type SignalAction = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export type SentimentLabel = 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH';

export interface Asset {
  id: number;
  symbol: string;
  name: string;
  category: MarketCategory;
  quote_currency: string;
  is_active: boolean;
  metadata?: Record<string, unknown>;
}

export interface MarketTick {
  symbol: string;
  price: number;
  volume_24h?: number;
  change_24h?: number;
  high_24h?: number;
  low_24h?: number;
  source: string;
  timestamp: string;
}

export interface CandleData {
  time: number; // Unix timestamp in seconds for Lightweight Charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TriggerFactors {
  nlp_sentiment: {
    score: number;
    label: SentimentLabel;
    weight: number;
    contribution: number;
    half_life_minutes?: number;
    headlines_count?: number;
    sample_headline?: string;
  };
  price_momentum: {
    score?: number;
    change_pct: number;
    weight: number;
    contribution: number;
    vwap_deviation_pct?: number;
    realized_volatility_pct?: number;
    last_spread?: number | null;
  };
  order_flow?: {
    ofi_score: number;
    cvd_ratio: number;
    flow_regime: string;
    weight: number;
    contribution: number;
  };
  multi_timeframe?: {
    confluence_score: number;
    status: string;
    fast_trend: string;
    medium_trend: string;
    macro_trend: string;
    fast_delta_pct: number;
    macro_delta_pct: number;
    multiplier?: number;
  };
  macro_bias: {
    bias: number;
    weight: number;
    contribution: number;
    market_regime?: string;
  };
  market_regime?: string;
  ml_supervised?: {
    ml_action: string;
    confidence_score: number;
    probabilities: {
      p_buy: number;
      p_sell: number;
      p_neutral: number;
    };
    top_features?: [string, number][];
    error?: string;
  };
  total_composite_score: number;
  risk_reward_ratio: number;
  volatility_risk: string;
  rationale?: string;
}

export interface PredictiveSignal {
  id: string;
  symbol: string;
  timeframe: string;
  action: SignalAction;
  confidence_score: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  trigger_factors: TriggerFactors;
  status: 'ACTIVE' | 'EXPIRED' | 'TARGET_REACHED' | 'STOPPED_OUT';
  created_at: string;
}

export interface NewsEvent {
  id: string;
  title: string;
  source: string;
  url?: string;
  published_at: string;
  sentiment_score: number;
  sentiment_label: SentimentLabel;
  confidence: number;
  related_assets: string[];
}

export interface TelemetrySource {
  id: string;
  name: string;
  category: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  latency_ms: number;
  last_event_at: string;
  error_count: number;
  rate_per_second: number;
  total_events: number;
}

export interface SystemTelemetry {
  database_connected: boolean;
  redis_connected: boolean;
  ticks_ingested_total: number;
  signals_generated_total: number;
  active_websocket_clients: number;
  hypertable_chunks_total: number;
  compressed_chunks: number;
  sources: TelemetrySource[];
  timestamp: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'trader';
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface BacktestMetadata {
  asset_symbol: string;
  ticks_analyzed: number;
  features_analyzed: number;
  initial_capital: number;
  final_equity: number;
  taker_fee_bps: number;
  min_ml_confidence: number;
  max_holding_ticks: number;
  tested_at: string;
}

export interface PerformanceMetrics {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  profit_factor: number;
  total_return_pct: number;
  net_profit_usd: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown_pct: number;
  expectancy_usd: number;
  payoff_ratio: number;
  avg_win_usd: number;
  avg_loss_usd: number;
  exit_distribution: {
    TIME_LIMIT: number;
    STOP_LOSS: number;
    TAKE_PROFIT: number;
    TRAILING_STOP?: number;
  };
}

export interface WalkForwardFold {
  fold: number;
  window: string;
  start_time: string;
  end_time: string;
  trades: number;
  win_rate_pct: number;
  profit_factor: number;
  return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
}

export interface SampleTrade {
  trade_id: number;
  type: 'LONG' | 'SHORT';
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  position_size: number;
  stop_loss: number;
  take_profit: number;
  pnl_usd: number;
  return_pct: number;
  exit_reason: string;
  ticks_held: number;
  equity_after: number;
}

export interface BacktestResult {
  metadata: BacktestMetadata;
  performance_metrics: PerformanceMetrics;
  walk_forward_matrix: WalkForwardFold[];
  sample_trades: SampleTrade[];
}

