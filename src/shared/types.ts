export interface OHLCVBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  volume: number;
  turnover: number; // INR
  trades: number;
}

export interface StockPatterns {
  bullishEngulfing: boolean;
  bearishEngulfing: boolean;
  hammer: boolean;
  insideBar: boolean;
  nr7: boolean;
  emaCross: boolean;
  prevDayHighBreak: boolean;
  prevDayLowBreak: boolean;
  weeklyBreakout: boolean;
  sma20CrossUp: boolean;
  sma50CrossUp: boolean;
  macdBullCross: boolean;
  rsiCrossAbove50: boolean;
  rsiCrossAbove70: boolean;
  whiteMarubozu: boolean;
  blackMarubozu: boolean;
  doji: boolean;
  morningStar: boolean;
}

export interface StockSnapshot {
  symbol: string;
  name: string;
  series: string;
  isin: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  change: number;
  changePct: number;
  change5dPct: number | null;
  change20dPct: number | null;
  volume: number;
  avgVol20: number | null;
  relVol: number | null;
  turnoverCr: number;
  trades: number;
  sma20: number | null;
  sma50: number | null;
  ema9: number | null;
  ema20: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  high20d: number | null;
  low20d: number | null;
  distFromHigh20dPct: number | null;
  gapPct: number;
  dayRangePct: number;
  atr14: number | null;
  historyDays: number;
  patterns: StockPatterns;
}

export type ScannerMetric =
  | 'close'
  | 'open'
  | 'high'
  | 'low'
  | 'changePct'
  | 'change5dPct'
  | 'change20dPct'
  | 'volume'
  | 'relVol'
  | 'turnoverCr'
  | 'trades'
  | 'rsi14'
  | 'macd'
  | 'macdSignal'
  | 'sma20'
  | 'sma50'
  | 'ema9'
  | 'ema20'
  | 'high20d'
  | 'low20d'
  | 'distFromHigh20dPct'
  | 'gapPct'
  | 'dayRangePct'
  | 'atr14'
  | 'patternBullishEngulfing'
  | 'patternBearishEngulfing'
  | 'patternHammer'
  | 'patternInsideBar'
  | 'patternNR7'
  | 'patternEmaCross'
  | 'patternPrevDayHighBreak'
  | 'patternPrevDayLowBreak'
  | 'patternWeeklyBreakout'
  | 'patternSma20CrossUp'
  | 'patternSma50CrossUp'
  | 'patternMacdBullCross'
  | 'patternRsiCrossAbove50'
  | 'patternRsiCrossAbove70'
  | 'patternWhiteMarubozu'
  | 'patternBlackMarubozu'
  | 'patternDoji'
  | 'patternMorningStar';

export type ScannerOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export interface ScannerCondition {
  id: string;
  metric: ScannerMetric;
  operator: ScannerOperator;
  compareToType: 'value' | 'metric';
  value?: number;
  compareMetric?: ScannerMetric;
  multiplier?: number;
}

export type SeriesFilter = 'EQ' | 'BE' | 'SM' | 'ALL';

export interface ScannerDefinition {
  id: string;
  name: string;
  description: string;
  category:
    | 'Momentum'
    | 'Breakout'
    | 'Reversal'
    | 'Volume'
    | 'Moving Avg'
    | 'Candlestick'
    | 'Price Action'
    | 'Custom';
  seriesFilter: SeriesFilter;
  minClose: number;
  minTurnoverCr: number;
  logic: 'AND' | 'OR';
  conditions: ScannerCondition[];
  afterMarketAlert: boolean;
  isBuiltIn: boolean;
  createdAt: string;
}

export interface ScannerSummary extends ScannerDefinition {
  matchCount: number;
  topSymbols: string[];
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
}

export interface EnrichedWatchlistItem {
  symbol: string;
  sector: string | null;
  snapshot: StockSnapshot | null;
  matchedScanners: { id: string; name: string; category: string }[];
}

export interface EnrichedWatchlist {
  id: string;
  name: string;
  createdAt: string;
  items: EnrichedWatchlistItem[];
}

export interface PriceAlertRule {
  id: string;
  symbol: string;
  metric: 'close' | 'changePct' | 'rsi14' | 'relVol';
  operator: 'gte' | 'lte';
  targetValue: number;
  enabled: boolean;
  createdAt: string;
  lastTriggeredDate: string | null;
}

export interface NotificationItem {
  id: string;
  createdAt: string;
  tradeDate: string;
  type: 'scanner' | 'price_alert' | 'eod_summary';
  title: string;
  summary: string;
  scannerId?: string;
  symbols: { symbol: string; close: number; changePct: number }[];
  read: boolean;
}

export interface AlertSettings {
  autoScanEnabled: boolean;
  scanTimeIst: string;
  lastAutoScanTradeDate: string | null;
  lastRunAt: string | null;
}

export interface MarketStatus {
  tradeDate: string | null;
  historyDaysLoaded: number;
  totalSymbols: number;
  eqSymbols: number;
  advances: number;
  declines: number;
  unchanged: number;
  totalTurnoverCr: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

export interface MarketBreadthResponse {
  status: MarketStatus;
  topGainers: StockSnapshot[];
  topLosers: StockSnapshot[];
  topTurnover: StockSnapshot[];
  volumeShockers: StockSnapshot[];
}

export type TargetMarkerGoal = 'entry' | 'exit' | 'stop';

export interface TargetPriceMarker {
  id: string;
  symbol: string;
  price: number;
  goal: TargetMarkerGoal;
  label: string;
  createdAt: string;
}

export type HistoryRange = '30d' | '3mo' | '6mo' | '1y' | '3y' | '5y' | '10y' | 'max';

export interface MultiYearReturnSummary {
  return30dPct: number | null;
  return1yPct: number | null;
  return3yPct: number | null;
  return5yPct: number | null;
  cagr5yPct: number | null;
  high5y: number | null;
  low5y: number | null;
  firstDate: string | null;
  lastDate: string | null;
  totalBars: number;
}

export interface StockDetailResponse {
  snapshot: StockSnapshot;
  matchedScanners: { id: string; name: string; category: string }[];
  bars: OHLCVBar[];
  barSource: 'yahoo' | 'nse-bhavcopy';
  inWatchlists: string[];
  targetMarkers: TargetPriceMarker[];
  multiYearSummary?: MultiYearReturnSummary;
}

export interface StockHistoryResponse {
  symbol: string;
  days: number;
  range?: HistoryRange;
  bars: OHLCVBar[];
  lookbackBars?: OHLCVBar[];
  source: 'yahoo' | 'nse-bhavcopy';
  multiYearSummary?: MultiYearReturnSummary;
}

export interface GroundedSource {
  title: string;
  uri: string;
}

export interface StockResearchResponse {
  symbol: string;
  summary: string;
  sources: GroundedSource[];
  generatedAt: string;
}

export type HeatmapUniverse = 'ALL_NSE' | 'NIFTY_500' | 'NIFTY_50';

export interface NiftyHeatmapStock {
  symbol: string;
  name: string;
  sector: string;
  close: number;
  change: number;
  changePct: number;
  marketCapCr: number;
  turnoverCr: number;
  volume: number;
  rsi14: number | null;
  relVol: number | null;
  inNifty50?: boolean;
  inNifty500?: boolean;
}

export interface NiftyHeatmapResponse {
  indexName: string;
  universe?: HeatmapUniverse;
  tradeDate: string | null;
  totalMarketCapCr: number;
  advances: number;
  declines: number;
  unchanged: number;
  avgChangePct: number;
  weightedChangePct: number;
  sectors: string[];
  constituents: NiftyHeatmapStock[];
}

export interface NiftySectorPerformanceItem {
  sector: string;
  avgChangePct: number;
  stockCount: number;
  advances: number;
  declines: number;
  leadSymbol: string | null;
  leadChangePct: number | null;
}

export interface SectorPerformanceSummary {
  tradeDate: string | null;
  totalSectors: number;
  topSectors: NiftySectorPerformanceItem[];
  bottomSectors: NiftySectorPerformanceItem[];
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichedPortfolioHolding extends PortfolioHolding {
  name: string;
  sector: string | null;
  currentPrice: number | null;
  prevClose: number | null;
  changePct: number | null;
  investedValue: number;
  currentValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  dayPnl: number | null;
  weightPct: number | null;
}

export interface PortfolioSummary {
  tradeDate: string | null;
  totalInvested: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalPnlPct: number;
  dayPnl: number;
  dayPnlPct: number;
  holdingsCount: number;
  gainersCount: number;
  losersCount: number;
}

export interface PortfolioResponse {
  holdings: EnrichedPortfolioHolding[];
  summary: PortfolioSummary;
}
