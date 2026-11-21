import type {
  OHLCVBar,
  ScannerCondition,
  ScannerDefinition,
  ScannerMetric,
  StockPatterns,
  StockSnapshot,
} from './types';

export interface MetricMeta {
  key: ScannerMetric;
  label: string;
  shortLabel: string;
  unit: 'price' | 'pct' | 'ratio' | 'cr' | 'count' | 'boolean';
  description: string;
  isBoolean?: boolean;
}

export const SCANNER_METRICS: MetricMeta[] = [
  { key: 'close', label: 'Close Price (INR)', shortLabel: 'Close', unit: 'price', description: 'Latest end-of-day closing price' },
  { key: 'open', label: 'Open Price (INR)', shortLabel: 'Open', unit: 'price', description: 'Day opening price' },
  { key: 'high', label: 'Day High (INR)', shortLabel: 'High', unit: 'price', description: 'Intraday highest price' },
  { key: 'low', label: 'Day Low (INR)', shortLabel: 'Low', unit: 'price', description: 'Intraday lowest price' },
  { key: 'changePct', label: '1-Day Change %', shortLabel: '1D %', unit: 'pct', description: 'Close vs previous session close %' },
  { key: 'change5dPct', label: '5-Day Change %', shortLabel: '5D %', unit: 'pct', description: '5-session price return %' },
  { key: 'change20dPct', label: '20-Day Change %', shortLabel: '20D %', unit: 'pct', description: '20-session price return %' },
  { key: 'volume', label: 'Traded Volume', shortLabel: 'Volume', unit: 'count', description: 'Total shares traded in session' },
  { key: 'relVol', label: 'Relative Volume (20D)', shortLabel: 'Rel Vol', unit: 'ratio', description: 'Session volume / 20-day average volume' },
  { key: 'turnoverCr', label: 'Turnover (INR Cr)', shortLabel: 'Turnover', unit: 'cr', description: 'Total traded value in Crores' },
  { key: 'trades', label: 'Total Trades', shortLabel: 'Trades', unit: 'count', description: 'Executed trade count on NSE' },
  { key: 'rsi14', label: 'RSI (14)', shortLabel: 'RSI 14', unit: 'ratio', description: '14-period Wilder Relative Strength Index' },
  { key: 'macd', label: 'MACD Line (12, 26)', shortLabel: 'MACD', unit: 'price', description: '12-day EMA minus 26-day EMA' },
  { key: 'macdSignal', label: 'MACD Signal (9)', shortLabel: 'Signal', unit: 'price', description: '9-day EMA of MACD line' },
  { key: 'sma20', label: 'SMA (20)', shortLabel: 'SMA 20', unit: 'price', description: '20-day Simple Moving Average' },
  { key: 'sma50', label: 'SMA (50)', shortLabel: 'SMA 50', unit: 'price', description: '50-day Simple Moving Average' },
  { key: 'ema9', label: 'EMA (9)', shortLabel: 'EMA 9', unit: 'price', description: '9-day Exponential Moving Average' },
  { key: 'ema20', label: 'EMA (20)', shortLabel: 'EMA 20', unit: 'price', description: '20-day Exponential Moving Average' },
  { key: 'high20d', label: '20-Day High', shortLabel: '20D High', unit: 'price', description: 'Highest high over last 20 sessions' },
  { key: 'low20d', label: '20-Day Low', shortLabel: '20D Low', unit: 'price', description: 'Lowest low over last 20 sessions' },
  { key: 'distFromHigh20dPct', label: 'Dist from 20D High %', shortLabel: 'From 20D Hi', unit: 'pct', description: 'Percentage below (negative) or at 20D high' },
  { key: 'gapPct', label: 'Opening Gap %', shortLabel: 'Gap %', unit: 'pct', description: 'Open vs previous close %' },
  { key: 'dayRangePct', label: 'Day Range %', shortLabel: 'Range %', unit: 'pct', description: '(High - Low) / Close %' },
  { key: 'atr14', label: 'ATR (14)', shortLabel: 'ATR 14', unit: 'price', description: '14-day Average True Range' },
  { key: 'patternPrevDayHighBreak', label: 'Breakout: Prev Day High', shortLabel: 'Prev Day Hi Break', unit: 'boolean', description: '1 when close breaks above prior session high', isBoolean: true },
  { key: 'patternPrevDayLowBreak', label: 'Breakdown: Prev Day Low', shortLabel: 'Prev Day Lo Break', unit: 'boolean', description: '1 when close breaks below prior session low', isBoolean: true },
  { key: 'patternWeeklyBreakout', label: 'Breakout: 5-Day Weekly High', shortLabel: 'Weekly Break', unit: 'boolean', description: '1 when close breaks above prior 5 sessions high', isBoolean: true },
  { key: 'patternSma20CrossUp', label: 'MA: Cross Above 20 SMA', shortLabel: 'Cross > 20 SMA', unit: 'boolean', description: '1 when close crosses above 20-day SMA', isBoolean: true },
  { key: 'patternSma50CrossUp', label: 'MA: Cross Above 50 SMA', shortLabel: 'Cross > 50 SMA', unit: 'boolean', description: '1 when close crosses above 50-day SMA', isBoolean: true },
  { key: 'patternEmaCross', label: 'MA: EMA 9/20 Bull Cross', shortLabel: 'EMA 9/20 Cross', unit: 'boolean', description: '1 when EMA9 crossed above EMA20 today', isBoolean: true },
  { key: 'patternMacdBullCross', label: 'Tech: MACD Bullish Cross', shortLabel: 'MACD Bull Cross', unit: 'boolean', description: '1 when MACD line crosses above Signal line', isBoolean: true },
  { key: 'patternRsiCrossAbove50', label: 'RSI: Crossed Above 50', shortLabel: 'RSI > 50 Cross', unit: 'boolean', description: '1 when RSI(14) crosses above 50', isBoolean: true },
  { key: 'patternRsiCrossAbove70', label: 'RSI: Crossed Above 70', shortLabel: 'RSI > 70 Cross', unit: 'boolean', description: '1 when RSI(14) crosses above 70', isBoolean: true },
  { key: 'patternBullishEngulfing', label: 'Candle: Bullish Engulfing', shortLabel: 'Bull Engulf', unit: 'boolean', description: '1 when bullish engulfing candle forms', isBoolean: true },
  { key: 'patternBearishEngulfing', label: 'Candle: Bearish Engulfing', shortLabel: 'Bear Engulf', unit: 'boolean', description: '1 when bearish engulfing candle forms', isBoolean: true },
  { key: 'patternHammer', label: 'Candle: Hammer', shortLabel: 'Hammer', unit: 'boolean', description: '1 when lower-wick hammer reversal forms', isBoolean: true },
  { key: 'patternMorningStar', label: 'Candle: Morning Star', shortLabel: 'Morning Star', unit: 'boolean', description: '1 when 3-bar Morning Star bullish reversal forms', isBoolean: true },
  { key: 'patternWhiteMarubozu', label: 'Candle: White Marubozu', shortLabel: 'White Marubozu', unit: 'boolean', description: '1 when strong full-body bullish candle forms', isBoolean: true },
  { key: 'patternBlackMarubozu', label: 'Candle: Black Marubozu', shortLabel: 'Black Marubozu', unit: 'boolean', description: '1 when strong full-body bearish candle forms', isBoolean: true },
  { key: 'patternDoji', label: 'Candle: Doji', shortLabel: 'Doji', unit: 'boolean', description: '1 when tight open/close Doji candle forms', isBoolean: true },
  { key: 'patternInsideBar', label: 'Pattern: Inside Bar', shortLabel: 'Inside Bar', unit: 'boolean', description: '1 when bar high/low stays inside prior bar', isBoolean: true },
  { key: 'patternNR7', label: 'Pattern: NR7 Contraction', shortLabel: 'NR7', unit: 'boolean', description: '1 when session has narrowest range in 7 days', isBoolean: true },
];

export const METRIC_MAP = new Map<ScannerMetric, MetricMeta>(
  SCANNER_METRICS.map((m) => [m.key, m]),
);

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeSMA(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i];
  }
  return round2(sum / period);
}

export function computeSMASeries(values: number[], period: number): Array<number | null> {
  if (period <= 0) return values.map(() => null);
  const out: Array<number | null> = [];
  let windowSum = 0;
  for (let i = 0; i < values.length; i++) {
    windowSum += values[i];
    if (i >= period) {
      windowSum -= values[i - period];
    }
    if (i >= period - 1) {
      out.push(round2(windowSum / period));
    } else {
      out.push(null);
    }
  }
  return out;
}

export function computeEMASeries(values: number[], period: number): number[] {
  if (values.length < period || period <= 0) return [];
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < period; i++) {
    ema += values[i];
  }
  ema /= period;
  const series = [ema];
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    series.push(ema);
  }
  return series;
}

export function computeAlignedEMASeries(values: number[], period: number): Array<number | null> {
  if (period <= 0 || values.length < period) return values.map(() => null);
  const raw = computeEMASeries(values, period);
  const out: Array<number | null> = Array(period - 1).fill(null);
  for (const val of raw) {
    out.push(round2(val));
  }
  return out;
}

export function computeEMA(values: number[], period: number): number | null {
  const series = computeEMASeries(values, period);
  if (series.length === 0) return null;
  return round2(series[series.length - 1]);
}

export function computeRSISeries(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(closes.length).fill(null);
  if (closes.length <= period || period <= 0) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : round2(100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : round2(100 - 100 / (1 + avgGain / avgLoss));
  }

  return out;
}

export function computeRSI(closes: number[], period = 14): number | null {
  const series = computeRSISeries(closes, period);
  if (series.length === 0) return null;
  return series[series.length - 1];
}

export function computeMACD(closes: number[]): {
  macd: number | null;
  signal: number | null;
  bullCross: boolean;
} {
  if (closes.length < 35) {
    return { macd: null, signal: null, bullCross: false };
  }
  const ema12 = computeAlignedEMASeries(closes, 12);
  const ema26 = computeAlignedEMASeries(closes, 26);

  const macdRaw: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const a = ema12[i];
    const b = ema26[i];
    if (a !== null && b !== null) {
      macdRaw.push(a - b);
    }
  }
  if (macdRaw.length < 10) {
    return { macd: null, signal: null, bullCross: false };
  }

  const sigSeries = computeEMASeries(macdRaw, 9);
  if (sigSeries.length < 2) {
    return { macd: null, signal: null, bullCross: false };
  }

  const currMacd = macdRaw[macdRaw.length - 1];
  const prevMacd = macdRaw[macdRaw.length - 2];
  const currSig = sigSeries[sigSeries.length - 1];
  const prevSig = sigSeries[sigSeries.length - 2];

  return {
    macd: round2(currMacd),
    signal: round2(currSig),
    bullCross: prevMacd <= prevSig && currMacd > currSig,
  };
}

export function computeATR(bars: OHLCVBar[], period = 14): number | null {
  if (bars.length <= period) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const prevClose = bars[i - 1].close;
    const tr = Math.max(
      b.high - b.low,
      Math.abs(b.high - prevClose),
      Math.abs(b.low - prevClose),
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  let atr = 0;
  for (let i = 0; i < period; i++) atr += trs[i];
  atr /= period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return round2(atr);
}

export function detectPatterns(bars: OHLCVBar[]): StockPatterns {
  const n = bars.length;
  if (n < 2) {
    return {
      bullishEngulfing: false,
      bearishEngulfing: false,
      hammer: false,
      insideBar: false,
      nr7: false,
      emaCross: false,
      prevDayHighBreak: false,
      prevDayLowBreak: false,
      weeklyBreakout: false,
      sma20CrossUp: false,
      sma50CrossUp: false,
      macdBullCross: false,
      rsiCrossAbove50: false,
      rsiCrossAbove70: false,
      whiteMarubozu: false,
      blackMarubozu: false,
      doji: false,
      morningStar: false,
    };
  }
  const curr = bars[n - 1];
  const prev = bars[n - 2];
  const closes = bars.map((b) => b.close);

  const currBody = Math.abs(curr.close - curr.open);
  const currRange = curr.high - curr.low;
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const dayPct = prev.close > 0 ? ((curr.close - prev.close) / prev.close) * 100 : 0;

  const bullishEngulfing =
    prev.close < prev.open &&
    curr.close > curr.open &&
    curr.open <= prev.close &&
    curr.close >= prev.open &&
    currBody > Math.abs(prev.close - prev.open) * 0.9;

  const bearishEngulfing =
    prev.close > prev.open &&
    curr.close < curr.open &&
    curr.open >= prev.close &&
    curr.close <= prev.open &&
    currBody > Math.abs(prev.close - prev.open) * 0.9;

  const hammer =
    currRange > 0 &&
    currBody / currRange <= 0.35 &&
    lowerWick >= currBody * 2 &&
    upperWick <= currBody * 0.6 &&
    curr.close >= curr.open * 0.99;

  const whiteMarubozu =
    currRange > 0 &&
    curr.close > curr.open &&
    currBody / currRange >= 0.82 &&
    dayPct >= 2;

  const blackMarubozu =
    currRange > 0 &&
    curr.close < curr.open &&
    currBody / currRange >= 0.82 &&
    dayPct <= -2;

  const doji = currRange > 0 && currBody / currRange <= 0.12;

  let morningStar = false;
  if (n >= 3) {
    const first = bars[n - 3];
    const second = bars[n - 2];
    const firstRange = first.high - first.low;
    const firstBody = first.open - first.close;
    const secondRange = second.high - second.low;
    const secondBody = Math.abs(second.close - second.open);
    const firstMid = (first.open + first.close) / 2;
    morningStar =
      first.close < first.open &&
      firstRange > 0 &&
      firstBody / firstRange >= 0.5 &&
      secondRange > 0 &&
      secondBody <= firstBody * 0.4 &&
      Math.max(second.open, second.close) <= first.close * 1.01 &&
      curr.close > curr.open &&
      curr.close >= firstMid;
  }

  const insideBar = curr.high <= prev.high && curr.low >= prev.low;
  const prevDayHighBreak = curr.close > prev.high && prev.close <= prev.high;
  const prevDayLowBreak = curr.close < prev.low && prev.close >= prev.low;

  let weeklyBreakout = false;
  if (n >= 6) {
    const prior5 = bars.slice(n - 6, n - 1);
    const prior5High = Math.max(...prior5.map((b) => b.high));
    weeklyBreakout = curr.close > prior5High && prev.close <= prior5High;
  }

  let nr7 = false;
  if (n >= 7) {
    const todayRange = curr.high - curr.low;
    const last7 = bars.slice(n - 7);
    const minRange = Math.min(...last7.map((b) => b.high - b.low));
    nr7 = todayRange > 0 && todayRange <= minRange + 1e-6;
  }

  let emaCross = false;
  if (n >= 22) {
    const ema9Series = computeEMASeries(closes, 9);
    const ema20Series = computeEMASeries(closes, 20);
    if (ema9Series.length >= 2 && ema20Series.length >= 2) {
      const curr9 = ema9Series[ema9Series.length - 1];
      const prev9 = ema9Series[ema9Series.length - 2];
      const curr20 = ema20Series[ema20Series.length - 1];
      const prev20 = ema20Series[ema20Series.length - 2];
      emaCross = prev9 <= prev20 && curr9 > curr20;
    }
  }

  const sma20Series = computeSMASeries(closes, 20);
  const currSma20 = sma20Series[n - 1];
  const prevSma20 = sma20Series[n - 2];
  const sma20CrossUp =
    currSma20 !== null &&
    prevSma20 !== null &&
    prev.close <= prevSma20 &&
    curr.close > currSma20;

  const sma50Series = computeSMASeries(closes, 50);
  const currSma50 = sma50Series[n - 1];
  const prevSma50 = sma50Series[n - 2];
  const sma50CrossUp =
    currSma50 !== null &&
    prevSma50 !== null &&
    prev.close <= prevSma50 &&
    curr.close > currSma50;

  const rsiSeries = computeRSISeries(closes, 14);
  const currRsi = rsiSeries[n - 1];
  const prevRsi = rsiSeries[n - 2];
  const rsiCrossAbove50 =
    currRsi !== null && prevRsi !== null && prevRsi < 50 && currRsi >= 50;
  const rsiCrossAbove70 =
    currRsi !== null && prevRsi !== null && prevRsi < 70 && currRsi >= 70;

  const macdBullCross = computeMACD(closes).bullCross;

  return {
    bullishEngulfing,
    bearishEngulfing,
    hammer,
    insideBar,
    nr7,
    emaCross,
    prevDayHighBreak,
    prevDayLowBreak,
    weeklyBreakout,
    sma20CrossUp,
    sma50CrossUp,
    macdBullCross,
    rsiCrossAbove50,
    rsiCrossAbove70,
    whiteMarubozu,
    blackMarubozu,
    doji,
    morningStar,
  };
}

export function buildStockSnapshot(
  symbol: string,
  name: string,
  series: string,
  isin: string,
  bars: OHLCVBar[],
): StockSnapshot | null {
  if (bars.length === 0) return null;
  const latest = bars[bars.length - 1];
  const prev = bars.length >= 2 ? bars[bars.length - 2] : null;
  const prevClose = latest.prevClose > 0 ? latest.prevClose : prev ? prev.close : latest.open;

  const change = round2(latest.close - prevClose);
  const changePct = prevClose > 0 ? round2((change / prevClose) * 100) : 0;

  const closes = bars.map((b) => b.close);
  const change5dPct =
    bars.length >= 6 && bars[bars.length - 6].close > 0
      ? round2(((latest.close - bars[bars.length - 6].close) / bars[bars.length - 6].close) * 100)
      : null;

  const change20dPct =
    bars.length >= 21 && bars[bars.length - 21].close > 0
      ? round2(((latest.close - bars[bars.length - 21].close) / bars[bars.length - 21].close) * 100)
      : null;

  let avgVol20: number | null = null;
  let relVol: number | null = null;
  if (bars.length >= 20) {
    const slice = bars.slice(bars.length - 20);
    const avg = slice.reduce((acc, b) => acc + b.volume, 0) / 20;
    avgVol20 = Math.round(avg);
    relVol = avg > 0 ? round2(latest.volume / avg) : null;
  } else if (bars.length >= 5) {
    const avg = bars.reduce((acc, b) => acc + b.volume, 0) / bars.length;
    avgVol20 = Math.round(avg);
    relVol = avg > 0 ? round2(latest.volume / avg) : null;
  }

  const window20 = bars.slice(Math.max(0, bars.length - 20));
  const high20d = round2(Math.max(...window20.map((b) => b.high)));
  const low20d = round2(Math.min(...window20.map((b) => b.low)));
  const distFromHigh20dPct =
    high20d > 0 ? round2(((latest.close - high20d) / high20d) * 100) : null;

  const gapPct = prevClose > 0 ? round2(((latest.open - prevClose) / prevClose) * 100) : 0;
  const dayRangePct =
    latest.close > 0 ? round2(((latest.high - latest.low) / latest.close) * 100) : 0;
  const macdRes = computeMACD(closes);

  return {
    symbol,
    name: name.trim() || symbol,
    series: series.trim() || 'EQ',
    isin,
    tradeDate: latest.date,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    close: latest.close,
    prevClose,
    change,
    changePct,
    change5dPct,
    change20dPct,
    volume: latest.volume,
    avgVol20,
    relVol,
    turnoverCr: round2(latest.turnover / 1e7),
    trades: latest.trades,
    sma20: computeSMA(closes, 20),
    sma50: computeSMA(closes, 50),
    ema9: computeEMA(closes, 9),
    ema20: computeEMA(closes, 20),
    rsi14: computeRSI(closes, 14),
    macd: macdRes.macd,
    macdSignal: macdRes.signal,
    high20d,
    low20d,
    distFromHigh20dPct,
    gapPct,
    dayRangePct,
    atr14: computeATR(bars, 14),
    historyDays: bars.length,
    patterns: detectPatterns(bars),
  };
}

export function getMetricValue(stock: StockSnapshot, metric: ScannerMetric): number | null {
  switch (metric) {
    case 'close':
      return stock.close;
    case 'open':
      return stock.open;
    case 'high':
      return stock.high;
    case 'low':
      return stock.low;
    case 'changePct':
      return stock.changePct;
    case 'change5dPct':
      return stock.change5dPct;
    case 'change20dPct':
      return stock.change20dPct;
    case 'volume':
      return stock.volume;
    case 'relVol':
      return stock.relVol;
    case 'turnoverCr':
      return stock.turnoverCr;
    case 'trades':
      return stock.trades;
    case 'rsi14':
      return stock.rsi14;
    case 'macd':
      return stock.macd;
    case 'macdSignal':
      return stock.macdSignal;
    case 'sma20':
      return stock.sma20;
    case 'sma50':
      return stock.sma50;
    case 'ema9':
      return stock.ema9;
    case 'ema20':
      return stock.ema20;
    case 'high20d':
      return stock.high20d;
    case 'low20d':
      return stock.low20d;
    case 'distFromHigh20dPct':
      return stock.distFromHigh20dPct;
    case 'gapPct':
      return stock.gapPct;
    case 'dayRangePct':
      return stock.dayRangePct;
    case 'atr14':
      return stock.atr14;
    case 'patternBullishEngulfing':
      return stock.patterns.bullishEngulfing ? 1 : 0;
    case 'patternBearishEngulfing':
      return stock.patterns.bearishEngulfing ? 1 : 0;
    case 'patternHammer':
      return stock.patterns.hammer ? 1 : 0;
    case 'patternInsideBar':
      return stock.patterns.insideBar ? 1 : 0;
    case 'patternNR7':
      return stock.patterns.nr7 ? 1 : 0;
    case 'patternEmaCross':
      return stock.patterns.emaCross ? 1 : 0;
    case 'patternPrevDayHighBreak':
      return stock.patterns.prevDayHighBreak ? 1 : 0;
    case 'patternPrevDayLowBreak':
      return stock.patterns.prevDayLowBreak ? 1 : 0;
    case 'patternWeeklyBreakout':
      return stock.patterns.weeklyBreakout ? 1 : 0;
    case 'patternSma20CrossUp':
      return stock.patterns.sma20CrossUp ? 1 : 0;
    case 'patternSma50CrossUp':
      return stock.patterns.sma50CrossUp ? 1 : 0;
    case 'patternMacdBullCross':
      return stock.patterns.macdBullCross ? 1 : 0;
    case 'patternRsiCrossAbove50':
      return stock.patterns.rsiCrossAbove50 ? 1 : 0;
    case 'patternRsiCrossAbove70':
      return stock.patterns.rsiCrossAbove70 ? 1 : 0;
    case 'patternWhiteMarubozu':
      return stock.patterns.whiteMarubozu ? 1 : 0;
    case 'patternBlackMarubozu':
      return stock.patterns.blackMarubozu ? 1 : 0;
    case 'patternDoji':
      return stock.patterns.doji ? 1 : 0;
    case 'patternMorningStar':
      return stock.patterns.morningStar ? 1 : 0;
    default:
      return null;
  }
}

export function evaluateCondition(stock: StockSnapshot, condition: ScannerCondition): boolean {
  const left = getMetricValue(stock, condition.metric);
  if (left === null || Number.isNaN(left)) return false;

  let right: number | null = null;
  if (condition.compareToType === 'metric' && condition.compareMetric) {
    const base = getMetricValue(stock, condition.compareMetric);
    if (base === null || Number.isNaN(base)) return false;
    const mult = condition.multiplier ?? 1;
    right = base * mult;
  } else if (typeof condition.value === 'number' && !Number.isNaN(condition.value)) {
    right = condition.value;
  }

  if (right === null) return false;

  switch (condition.operator) {
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
    case 'eq':
      return Math.abs(left - right) < 1e-6;
    default:
      return false;
  }
}

export function evaluateScanner(
  stocks: StockSnapshot[],
  scanner: ScannerDefinition,
): StockSnapshot[] {
  return stocks.filter((stock) => {
    if (scanner.seriesFilter !== 'ALL' && stock.series !== scanner.seriesFilter) {
      return false;
    }
    if (stock.close < scanner.minClose) {
      return false;
    }
    if (stock.turnoverCr < scanner.minTurnoverCr) {
      return false;
    }
    if (scanner.conditions.length === 0) {
      return true;
    }
    if (scanner.logic === 'OR') {
      return scanner.conditions.some((c) => evaluateCondition(stock, c));
    }
    return scanner.conditions.every((c) => evaluateCondition(stock, c));
  });
}

export function formatConditionSummary(c: ScannerCondition): string {
  const left = METRIC_MAP.get(c.metric)?.shortLabel ?? c.metric;
  const opMap: Record<ScannerCondition['operator'], string> = {
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    eq: '=',
  };
  if (METRIC_MAP.get(c.metric)?.isBoolean) {
    return `${left} = Active`;
  }
  if (c.compareToType === 'metric' && c.compareMetric) {
    const right = METRIC_MAP.get(c.compareMetric)?.shortLabel ?? c.compareMetric;
    const mult = c.multiplier && c.multiplier !== 1 ? ` × ${c.multiplier}` : '';
    return `${left} ${opMap[c.operator]} ${right}${mult}`;
  }
  return `${left} ${opMap[c.operator]} ${c.value ?? 0}`;
}

export const BUILT_IN_SCANNERS: ScannerDefinition[] = [
  // --- Breakout Scans (StockEdge Price & Breakout Scans) ---
  {
    id: 'builtin-20d-breakout',
    name: '20-Day High Breakout',
    description: 'Stocks closing within 0.5% of or above their 20-day high with elevated participation.',
    category: 'Breakout',
    seriesFilter: 'EQ',
    minClose: 50,
    minTurnoverCr: 10,
    logic: 'AND',
    conditions: [
      { id: 'bo-1', metric: 'distFromHigh20dPct', operator: 'gte', compareToType: 'value', value: -0.5 },
      { id: 'bo-2', metric: 'relVol', operator: 'gte', compareToType: 'value', value: 1.2 },
      { id: 'bo-3', metric: 'changePct', operator: 'gt', compareToType: 'value', value: 0 },
    ],
    afterMarketAlert: true,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-prev-day-high-breakout',
    name: 'Previous Day High Breakout',
    description: 'StockEdge Price Scan: Equities closing decisively above the previous session high on 1.1x+ volume.',
    category: 'Breakout',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-pdh-1', metric: 'patternPrevDayHighBreak', operator: 'eq', compareToType: 'value', value: 1 },
      { id: 'se-pdh-2', metric: 'relVol', operator: 'gte', compareToType: 'value', value: 1.1 },
    ],
    afterMarketAlert: true,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-weekly-high-breakout',
    name: 'Weekly High Breakout (5D)',
    description: 'StockEdge Weekly Breakout: Fresh breakout closing above the prior 5 trading sessions high.',
    category: 'Breakout',
    seriesFilter: 'EQ',
    minClose: 40,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-wb-1', metric: 'patternWeeklyBreakout', operator: 'eq', compareToType: 'value', value: 1 },
      { id: 'se-wb-2', metric: 'changePct', operator: 'gte', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-monthly-high-zone',
    name: 'Monthly High Zone Leaders',
    description: 'StockEdge Monthly Breakout: Equities closing within 0.25% of 20-day highs with >= 5% monthly gain.',
    category: 'Breakout',
    seriesFilter: 'EQ',
    minClose: 50,
    minTurnoverCr: 10,
    logic: 'AND',
    conditions: [
      { id: 'se-mhz-1', metric: 'distFromHigh20dPct', operator: 'gte', compareToType: 'value', value: -0.25 },
      { id: 'se-mhz-2', metric: 'change20dPct', operator: 'gte', compareToType: 'value', value: 5 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-gap-up-opening',
    name: 'Gap Up Opening (> 2%)',
    description: 'StockEdge Price Behavior Scan: Stocks opening >= 2% above prior close and holding gains into close.',
    category: 'Breakout',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-gu-1', metric: 'gapPct', operator: 'gte', compareToType: 'value', value: 2 },
      { id: 'se-gu-2', metric: 'changePct', operator: 'gte', compareToType: 'value', value: 2 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },

  // --- Volume Scans (StockEdge Volume & Participation Scans) ---
  {
    id: 'builtin-volume-shockers',
    name: 'Volume Shockers (2x+ Surge)',
    description: 'Liquid NSE equities closing higher on at least 2x their 20-day average volume.',
    category: 'Volume',
    seriesFilter: 'EQ',
    minClose: 20,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'vs-1', metric: 'relVol', operator: 'gte', compareToType: 'value', value: 2 },
      { id: 'vs-2', metric: 'changePct', operator: 'gte', compareToType: 'value', value: 1.5 },
    ],
    afterMarketAlert: true,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-high-traded-volume',
    name: 'High Traded Volume (> 1.5x Avg)',
    description: 'StockEdge Volume Scan: Positive price close backed by >= 1.5x 20-day average traded volume.',
    category: 'Volume',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 10,
    logic: 'AND',
    conditions: [
      { id: 'se-htv-1', metric: 'relVol', operator: 'gte', compareToType: 'value', value: 1.5 },
      { id: 'se-htv-2', metric: 'changePct', operator: 'gt', compareToType: 'value', value: 0 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-high-volume-selloff',
    name: 'High Volume Distribution',
    description: 'StockEdge Volume Scan: Heavy selling pressure (>= 2% drop on >= 2x 20-day average volume).',
    category: 'Volume',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-hvs-1', metric: 'relVol', operator: 'gte', compareToType: 'value', value: 2 },
      { id: 'se-hvs-2', metric: 'changePct', operator: 'lte', compareToType: 'value', value: -2 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },

  // --- Moving Average Scans (StockEdge SMA & EMA Scans) ---
  {
    id: 'stockedge-cross-above-20sma',
    name: 'Close Crossing Above 20 SMA',
    description: 'StockEdge SMA Scan: Stocks freshly crossing above their 20-day Simple Moving Average.',
    category: 'Moving Avg',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-sma20-1', metric: 'patternSma20CrossUp', operator: 'eq', compareToType: 'value', value: 1 },
      { id: 'se-sma20-2', metric: 'relVol', operator: 'gte', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-cross-above-50sma',
    name: 'Close Crossing Above 50 SMA',
    description: 'StockEdge Medium-Term SMA Scan: Stocks breaking back above their 50-day Simple Moving Average.',
    category: 'Moving Avg',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-sma50-1', metric: 'patternSma50CrossUp', operator: 'eq', compareToType: 'value', value: 1 },
      { id: 'se-sma50-2', metric: 'changePct', operator: 'gt', compareToType: 'value', value: 0 },
    ],
    afterMarketAlert: true,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-ema-cross',
    name: 'EMA 9/20 Bullish Crossover',
    description: 'Fresh end-of-day crossover where 9-day EMA moves above 20-day EMA.',
    category: 'Moving Avg',
    seriesFilter: 'EQ',
    minClose: 25,
    minTurnoverCr: 3,
    logic: 'AND',
    conditions: [
      { id: 'ec-1', metric: 'patternEmaCross', operator: 'eq', compareToType: 'value', value: 1 },
      { id: 'ec-2', metric: 'changePct', operator: 'gt', compareToType: 'value', value: 0 },
    ],
    afterMarketAlert: true,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-sma-trend-stack',
    name: 'Bullish MA Alignment (20 > 50 SMA)',
    description: 'StockEdge SMA Scan: Price above 20 SMA, 20 SMA above 50 SMA, and healthy RSI >= 55.',
    category: 'Moving Avg',
    seriesFilter: 'EQ',
    minClose: 50,
    minTurnoverCr: 15,
    logic: 'AND',
    conditions: [
      { id: 'se-mastack-1', metric: 'close', operator: 'gt', compareToType: 'metric', compareMetric: 'sma20', multiplier: 1 },
      { id: 'se-mastack-2', metric: 'sma20', operator: 'gt', compareToType: 'metric', compareMetric: 'sma50', multiplier: 1 },
      { id: 'se-mastack-3', metric: 'rsi14', operator: 'gte', compareToType: 'value', value: 55 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-near-20sma-support',
    name: 'Close Near 20 SMA Support',
    description: 'StockEdge Near-SMA Pullback: Uptrending stocks (20 SMA > 50 SMA) pulling back within 1.5% of 20 SMA.',
    category: 'Moving Avg',
    seriesFilter: 'EQ',
    minClose: 50,
    minTurnoverCr: 10,
    logic: 'AND',
    conditions: [
      { id: 'se-n20-1', metric: 'close', operator: 'gte', compareToType: 'metric', compareMetric: 'sma20', multiplier: 0.99 },
      { id: 'se-n20-2', metric: 'close', operator: 'lte', compareToType: 'metric', compareMetric: 'sma20', multiplier: 1.015 },
      { id: 'se-n20-3', metric: 'sma20', operator: 'gt', compareToType: 'metric', compareMetric: 'sma50', multiplier: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },

  // --- Momentum, RSI & MACD Scans (StockEdge Technical Scans) ---
  {
    id: 'builtin-trend-momentum',
    name: 'Trend Leaders (Above SMA 20)',
    description: 'Stocks trading above SMA 20 with strong 20-day momentum and healthy RSI (55–78).',
    category: 'Momentum',
    seriesFilter: 'EQ',
    minClose: 50,
    minTurnoverCr: 15,
    logic: 'AND',
    conditions: [
      { id: 'tm-1', metric: 'close', operator: 'gt', compareToType: 'metric', compareMetric: 'sma20', multiplier: 1 },
      { id: 'tm-2', metric: 'rsi14', operator: 'gte', compareToType: 'value', value: 55 },
      { id: 'tm-3', metric: 'rsi14', operator: 'lte', compareToType: 'value', value: 78 },
      { id: 'tm-4', metric: 'change20dPct', operator: 'gte', compareToType: 'value', value: 4 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-macd-bullish-cross',
    name: 'MACD Bullish Crossover',
    description: 'StockEdge MACD Scan: MACD(12, 26) line freshly crossing above its 9-day Signal line.',
    category: 'Momentum',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-macd-1', metric: 'patternMacdBullCross', operator: 'eq', compareToType: 'value', value: 1 },
      { id: 'se-macd-2', metric: 'changePct', operator: 'gt', compareToType: 'value', value: 0 },
    ],
    afterMarketAlert: true,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-rsi-crossed-50',
    name: 'RSI Crossed Above 50 (Bullish)',
    description: 'StockEdge RSI Scan: Daily RSI(14) crossing above the 50 midpoint to confirm bullish momentum shift.',
    category: 'Momentum',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-rsi50-1', metric: 'patternRsiCrossAbove50', operator: 'eq', compareToType: 'value', value: 1 },
      { id: 'se-rsi50-2', metric: 'changePct', operator: 'gt', compareToType: 'value', value: 0 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-rsi-overbought-zone',
    name: 'RSI Overbought Momentum (>= 70)',
    description: 'StockEdge RSI Scan: High-momentum leaders trading in the RSI >= 70 overbought zone.',
    category: 'Momentum',
    seriesFilter: 'EQ',
    minClose: 40,
    minTurnoverCr: 10,
    logic: 'AND',
    conditions: [
      { id: 'se-rsi70-1', metric: 'rsi14', operator: 'gte', compareToType: 'value', value: 70 },
      { id: 'se-rsi70-2', metric: 'changePct', operator: 'gt', compareToType: 'value', value: 0 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-top-gainers-5pct',
    name: 'Strong Daily Gainers (>= 5%)',
    description: 'StockEdge Price Scan: Liquid NSE equities surging 5% or more in today’s session.',
    category: 'Momentum',
    seriesFilter: 'EQ',
    minClose: 25,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-tg-1', metric: 'changePct', operator: 'gte', compareToType: 'value', value: 5 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },

  // --- Reversal Scans (StockEdge Oversold & Bottoming Scans) ---
  {
    id: 'stockedge-rsi-oversold-30',
    name: 'RSI Oversold Zone (<= 30)',
    description: 'StockEdge RSI Scan: Equities trading in extreme oversold territory with RSI(14) <= 30.',
    category: 'Reversal',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-rsi30-1', metric: 'rsi14', operator: 'lte', compareToType: 'value', value: 30 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-rsi-oversold',
    name: 'RSI Oversold Rebound',
    description: 'Deeply oversold equities (RSI 14 <= 35) printing a positive reversal session.',
    category: 'Reversal',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'rsi-1', metric: 'rsi14', operator: 'lte', compareToType: 'value', value: 35 },
      { id: 'rsi-2', metric: 'changePct', operator: 'gt', compareToType: 'value', value: 0.25 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-morning-star',
    name: 'Morning Star Bullish Reversal',
    description: 'StockEdge Candlestick Scan: Classic 3-candle Morning Star bottoming pattern.',
    category: 'Reversal',
    seriesFilter: 'EQ',
    minClose: 25,
    minTurnoverCr: 3,
    logic: 'AND',
    conditions: [
      { id: 'se-ms-1', metric: 'patternMorningStar', operator: 'eq', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-prev-day-low-break',
    name: 'Previous Day Low Breakdown',
    description: 'StockEdge Price Scan: Equities closing below the previous session low on weakness.',
    category: 'Reversal',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 10,
    logic: 'AND',
    conditions: [
      { id: 'se-pdl-1', metric: 'patternPrevDayLowBreak', operator: 'eq', compareToType: 'value', value: 1 },
      { id: 'se-pdl-2', metric: 'changePct', operator: 'lte', compareToType: 'value', value: -1.5 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },

  // --- Candlestick & Price Action Scans (StockEdge Candlestick Scans) ---
  {
    id: 'builtin-bullish-candles',
    name: 'Bullish Engulfing & Hammer',
    description: 'StockEdge Candlestick Scan: Bullish Engulfing or Hammer reversal patterns across liquid NSE stocks.',
    category: 'Candlestick',
    seriesFilter: 'EQ',
    minClose: 25,
    minTurnoverCr: 5,
    logic: 'OR',
    conditions: [
      { id: 'pa-1', metric: 'patternBullishEngulfing', operator: 'eq', compareToType: 'value', value: 1 },
      { id: 'pa-2', metric: 'patternHammer', operator: 'eq', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-white-marubozu',
    name: 'White Marubozu (Bull Conviction)',
    description: 'StockEdge Candlestick Scan: Full-bodied bullish candles closing near session highs (>= 2% gain).',
    category: 'Candlestick',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-wm-1', metric: 'patternWhiteMarubozu', operator: 'eq', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-black-marubozu',
    name: 'Black Marubozu (Bear Conviction)',
    description: 'StockEdge Candlestick Scan: Full-bodied bearish candles closing near session lows (<= -2% drop).',
    category: 'Candlestick',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-bm-1', metric: 'patternBlackMarubozu', operator: 'eq', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-bearish-engulfing',
    name: 'Bearish Engulfing Pattern',
    description: 'StockEdge Candlestick Scan: Bearish engulfing candle reversing prior session gains.',
    category: 'Candlestick',
    seriesFilter: 'EQ',
    minClose: 30,
    minTurnoverCr: 5,
    logic: 'AND',
    conditions: [
      { id: 'se-be-1', metric: 'patternBearishEngulfing', operator: 'eq', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-doji-indecision',
    name: 'Doji Indecision Candles',
    description: 'StockEdge Candlestick Scan: Tight open-to-close Doji candles signaling potential trend inflection.',
    category: 'Candlestick',
    seriesFilter: 'EQ',
    minClose: 50,
    minTurnoverCr: 15,
    logic: 'AND',
    conditions: [
      { id: 'se-doji-1', metric: 'patternDoji', operator: 'eq', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'stockedge-inside-bar',
    name: 'Inside Bar Contraction',
    description: 'StockEdge Price Pattern: Session high/low contained inside the prior bar range (coiling breakout setup).',
    category: 'Price Action',
    seriesFilter: 'EQ',
    minClose: 50,
    minTurnoverCr: 10,
    logic: 'AND',
    conditions: [
      { id: 'se-ib-1', metric: 'patternInsideBar', operator: 'eq', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-nr7-squeeze',
    name: 'NR7 Volatility Squeeze',
    description: 'Narrowest 7-day range contraction setups poised for directional expansion.',
    category: 'Price Action',
    seriesFilter: 'EQ',
    minClose: 50,
    minTurnoverCr: 10,
    logic: 'AND',
    conditions: [
      { id: 'nr7-1', metric: 'patternNR7', operator: 'eq', compareToType: 'value', value: 1 },
    ],
    afterMarketAlert: false,
    isBuiltIn: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];
