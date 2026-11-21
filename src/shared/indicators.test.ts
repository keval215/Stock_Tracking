import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN_SCANNERS,
  buildStockSnapshot,
  computeAlignedEMASeries,
  computeATR,
  computeEMA,
  computeMACD,
  computeRSI,
  computeRSISeries,
  computeSMA,
  computeSMASeries,
  detectPatterns,
  evaluateScanner,
  METRIC_MAP,
} from './indicators';
import type { OHLCVBar, ScannerDefinition, StockSnapshot } from './types';

function makeBars(closes: number[], baseVol = 100000): OHLCVBar[] {
  return closes.map((close, idx) => {
    const prev = idx > 0 ? closes[idx - 1] : close;
    const open = prev;
    const high = Math.max(open, close) + 2;
    const low = Math.min(open, close) - 2;
    return {
      date: `2026-10-${String(idx + 1).padStart(2, '0')}`,
      open,
      high,
      low,
      close,
      prevClose: prev,
      volume: baseVol,
      turnover: close * baseVol,
      trades: 1200,
    };
  });
}

test('computeSMA returns exact arithmetic mean over trailing period', () => {
  assert.equal(computeSMA([10, 20, 30, 40, 50], 3), 40);
  assert.equal(computeSMA([10, 20], 5), null);
});

test('computeEMA produces responsive exponential average', () => {
  const vals = [10, 11, 12, 13, 14, 15, 16, 17, 18, 22];
  const ema5 = computeEMA(vals, 5);
  assert.ok(ema5 !== null && ema5 > 17 && ema5 < 22);
});

test('computeRSI bounds between 0 and 100 and detects overbought/oversold', () => {
  const uptrend = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
  assert.equal(computeRSI(uptrend, 14), 100);

  const downtrend = Array.from({ length: 20 }, (_, i) => 200 - i * 3);
  const rsiDown = computeRSI(downtrend, 14);
  assert.ok(rsiDown !== null && rsiDown < 10);
});

test('aligned SMA, EMA, and RSI series align 1:1 with input length and match terminal values', () => {
  const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 8 + i * 0.7);
  const sma20Series = computeSMASeries(closes, 20);
  const ema9Series = computeAlignedEMASeries(closes, 9);
  const rsi14Series = computeRSISeries(closes, 14);

  assert.equal(sma20Series.length, closes.length);
  assert.equal(sma20Series[18], null);
  assert.equal(sma20Series[29], computeSMA(closes, 20));

  assert.equal(ema9Series.length, closes.length);
  assert.equal(ema9Series[7], null);
  assert.equal(ema9Series[29], computeEMA(closes, 9));

  assert.equal(rsi14Series.length, closes.length);
  assert.equal(rsi14Series[13], null);
  assert.equal(rsi14Series[29], computeRSI(closes, 14));
});

test('computeATR returns positive volatility range', () => {
  const bars = makeBars(Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 3 : -1)));
  const atr = computeATR(bars, 14);
  assert.ok(atr !== null && atr > 2);
});

test('computeMACD computes line, signal, and bullish crossover', () => {
  const downThenUp = [
    ...Array.from({ length: 30 }, (_, i) => 200 - i * 1.5),
    ...Array.from({ length: 15 }, (_, i) => 156 + i * 3.5),
  ];
  const res = computeMACD(downThenUp);
  assert.ok(res.macd !== null && res.signal !== null);
  assert.ok(res.macd > res.signal);
});

test('detectPatterns identifies Bullish Engulfing, White Marubozu, Morning Star, Prev Day High Break, and NR7', () => {
  const engulfBars: OHLCVBar[] = [
    { date: '2026-11-11', open: 105, high: 106, low: 99, close: 100, prevClose: 106, volume: 1000, turnover: 1e6, trades: 100 },
    { date: '2026-11-12', open: 99, high: 108, low: 98, close: 107, prevClose: 100, volume: 2000, turnover: 2e6, trades: 200 },
  ];
  const engulfPatterns = detectPatterns(engulfBars);
  assert.equal(engulfPatterns.bullishEngulfing, true);
  assert.equal(engulfPatterns.prevDayHighBreak, true);

  const marubozuBars: OHLCVBar[] = [
    { date: '2026-11-11', open: 100, high: 102, low: 99, close: 100, prevClose: 100, volume: 1000, turnover: 1e6, trades: 100 },
    { date: '2026-11-12', open: 100, high: 106.2, low: 99.8, close: 106, prevClose: 100, volume: 2500, turnover: 2e6, trades: 200 },
  ];
  assert.equal(detectPatterns(marubozuBars).whiteMarubozu, true);

  const morningStarBars: OHLCVBar[] = [
    { date: '2026-11-10', open: 120, high: 121, low: 108, close: 109, prevClose: 121, volume: 1000, turnover: 1e6, trades: 100 },
    { date: '2026-11-11', open: 108, high: 109.5, low: 106.5, close: 108.5, prevClose: 109, volume: 800, turnover: 1e6, trades: 80 },
    { date: '2026-11-12', open: 109.5, high: 118, low: 109, close: 117, prevClose: 108.5, volume: 2200, turnover: 2e6, trades: 200 },
  ];
  assert.equal(detectPatterns(morningStarBars).morningStar, true);

  const nr7Bars: OHLCVBar[] = [
    ...Array.from({ length: 6 }, (_, i) => ({
      date: `2026-11-0${i + 1}`,
      open: 100,
      high: 110,
      low: 95,
      close: 102,
      prevClose: 100,
      volume: 1000,
      turnover: 1e6,
      trades: 100,
    })),
    { date: '2026-11-07', open: 101, high: 102, low: 100, close: 101.5, prevClose: 102, volume: 1000, turnover: 1e6, trades: 100 },
  ];
  assert.equal(detectPatterns(nr7Bars).nr7, true);
});

test('buildStockSnapshot computes metrics and relative volume accurately', () => {
  const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
  const bars = makeBars(closes, 100000);
  bars[bars.length - 1].volume = 300000;
  bars[bars.length - 1].turnover = bars[bars.length - 1].close * 300000;

  const snap = buildStockSnapshot('TESTCO', 'Test Company Ltd', 'EQ', 'INE000A01001', bars);
  assert.ok(snap !== null);
  assert.equal(snap.symbol, 'TESTCO');
  assert.equal(snap.close, 124);
  assert.ok(snap.relVol !== null && snap.relVol > 2.5);
  assert.ok(snap.sma20 !== null && snap.close > snap.sma20);
  assert.ok(snap.rsi14 !== null && snap.rsi14 > 70);
});

test('evaluateScanner filters universe, AND/OR conditions, and metric comparisons', () => {
  const snapA = buildStockSnapshot(
    'ALPHA',
    'Alpha Ltd',
    'EQ',
    'INE1',
    makeBars(Array.from({ length: 25 }, (_, i) => 100 + i * 2), 200000),
  )!;
  const snapB = buildStockSnapshot(
    'BETA',
    'Beta SME',
    'SM',
    'INE2',
    makeBars(Array.from({ length: 25 }, (_, i) => 100 + i * 2), 200000),
  )!;
  const snapC = buildStockSnapshot(
    'GAMMA',
    'Gamma Ltd',
    'EQ',
    'INE3',
    makeBars(Array.from({ length: 25 }, (_, i) => 200 - i * 2), 200000),
  )!;

  const stocks: StockSnapshot[] = [snapA, snapB, snapC];
  const scanner: ScannerDefinition = {
    id: 'test-scan',
    name: 'Above SMA20',
    description: 'Test',
    category: 'Custom',
    seriesFilter: 'EQ',
    minClose: 50,
    minTurnoverCr: 1,
    logic: 'AND',
    conditions: [
      { id: 'c1', metric: 'close', operator: 'gt', compareToType: 'metric', compareMetric: 'sma20', multiplier: 1 },
      { id: 'c2', metric: 'changePct', operator: 'gt', compareToType: 'value', value: 0 },
    ],
    afterMarketAlert: false,
    isBuiltIn: false,
    createdAt: '2026-11-16T00:00:00Z',
  };

  const results = evaluateScanner(stocks, scanner);
  assert.equal(results.length, 1);
  assert.equal(results[0].symbol, 'ALPHA');
});

test('all BUILT_IN_SCANNERS including StockEdge scans have unique IDs, valid metrics, and evaluate cleanly', () => {
  assert.ok(BUILT_IN_SCANNERS.length >= 25);
  const seenIds = new Set<string>();
  const sampleStocks: StockSnapshot[] = [
    buildStockSnapshot(
      'SAMPLE1',
      'Sample Stock One',
      'EQ',
      'INE999',
      makeBars(Array.from({ length: 55 }, (_, i) => 100 + i * 1.2), 250000),
    )!,
  ];

  for (const sc of BUILT_IN_SCANNERS) {
    assert.ok(!seenIds.has(sc.id), `Duplicate scanner ID: ${sc.id}`);
    seenIds.add(sc.id);
    assert.ok(sc.conditions.length > 0, `Scanner ${sc.id} has no conditions`);
    for (const cond of sc.conditions) {
      assert.ok(METRIC_MAP.has(cond.metric), `Unknown metric ${cond.metric} in ${sc.id}`);
      if (cond.compareToType === 'metric' && cond.compareMetric) {
        assert.ok(METRIC_MAP.has(cond.compareMetric), `Unknown compareMetric ${cond.compareMetric} in ${sc.id}`);
      }
    }
    const matches = evaluateScanner(sampleStocks, sc);
    assert.ok(Array.isArray(matches));
  }
});
