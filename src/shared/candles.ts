import type { OHLCVBar } from './types';

export type CandleResolution = 'daily' | 'weekly' | 'monthly';

export interface AggregatedCandleSeries {
  bars: OHLCVBar[];
  resolution: CandleResolution;
  sourceBarCount: number;
}

function getIsoWeekKey(isoDate: string): string {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  // ISO week date: shift Thursday into current week to determine ISO year
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // YYYY-MM
}

function groupBars(bars: OHLCVBar[], keyFn: (isoDate: string) => string): OHLCVBar[] {
  const buckets = new Map<string, OHLCVBar>();
  const order: string[] = [];

  for (const bar of bars) {
    const key = keyFn(bar.date);
    const existing = buckets.get(key);
    if (!existing) {
      order.push(key);
      buckets.set(key, { ...bar });
    } else {
      existing.date = bar.date;
      existing.high = Math.max(existing.high, bar.high);
      existing.low = Math.min(existing.low, bar.low);
      existing.close = bar.close;
      existing.volume += bar.volume;
      existing.turnover += bar.turnover;
      existing.trades += bar.trades;
    }
  }

  return order.map((k) => buckets.get(k)!);
}

/**
 * Keeps full daily bars up to ~1 trading year (275 bars) so 3M, 6M, and 1Y
 * candlestick views display every daily candle without truncation.
 * Automatically aggregates multi-year histories into weekly (3Y/5Y) or
 * monthly (10Y/MAX) OHLCV candles for clean visual density.
 */
export function aggregateCandles(
  bars: OHLCVBar[],
  maxDailyCandles = 275,
  maxWeeklyCandles = 285,
): AggregatedCandleSeries {
  if (!bars || bars.length === 0) {
    return { bars: [], resolution: 'daily', sourceBarCount: 0 };
  }

  if (bars.length <= maxDailyCandles) {
    return { bars, resolution: 'daily', sourceBarCount: bars.length };
  }

  const weekly = groupBars(bars, getIsoWeekKey);
  if (weekly.length <= maxWeeklyCandles) {
    return { bars: weekly, resolution: 'weekly', sourceBarCount: bars.length };
  }

  const monthly = groupBars(bars, getMonthKey);
  return { bars: monthly, resolution: 'monthly', sourceBarCount: bars.length };
}
