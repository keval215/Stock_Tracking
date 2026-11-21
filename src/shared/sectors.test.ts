import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeTopBottomSectorPerformance,
  filterWatchlistItems,
  getWatchlistSectorOptions,
  normalizeNiftyIndustry,
} from './sectors.ts';
import type { EnrichedWatchlistItem, StockSnapshot } from './types.ts';

function makeItem(
  symbol: string,
  sector: string | null,
  scannerIds: string[] = [],
): EnrichedWatchlistItem {
  return {
    symbol,
    sector,
    snapshot: null,
    matchedScanners: scannerIds.map((id) => ({
      id,
      name: `Scanner ${id}`,
      category: 'Momentum',
    })),
  };
}

function makeSnapshot(symbol: string, changePct: number): StockSnapshot {
  return {
    symbol,
    name: `${symbol} Ltd`,
    series: 'EQ',
    isin: 'INE000000000',
    tradeDate: '2026-11-13',
    open: 100,
    high: 105,
    low: 95,
    close: 100 + changePct,
    prevClose: 100,
    change: changePct,
    changePct,
    change5dPct: 0,
    change20dPct: 0,
    volume: 100000,
    avgVol20: 100000,
    relVol: 1,
    turnoverCr: 10,
    trades: 1000,
    sma20: 100,
    sma50: 100,
    ema9: 100,
    ema20: 100,
    rsi14: 50,
    macd: 0,
    macdSignal: 0,
    high20d: 105,
    low20d: 95,
    distFromHigh20dPct: -2,
    gapPct: 0,
    dayRangePct: 2,
    atr14: 2,
    historyDays: 30,
    patterns: {
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
    },
  };
}

test('normalizeNiftyIndustry maps official NSE industry strings to concise sector labels', () => {
  assert.equal(normalizeNiftyIndustry('Information Technology'), 'IT');
  assert.equal(normalizeNiftyIndustry('Automobile and Auto Components'), 'Auto');
  assert.equal(normalizeNiftyIndustry('Fast Moving Consumer Goods'), 'FMCG');
  assert.equal(normalizeNiftyIndustry('Oil Gas & Consumable Fuels'), 'Energy');
  assert.equal(normalizeNiftyIndustry('Healthcare'), 'Pharma');
  assert.equal(normalizeNiftyIndustry('Capital Goods'), 'Capital Goods');
  assert.equal(normalizeNiftyIndustry(''), 'Other');
});

test('getWatchlistSectorOptions aggregates counts and handles unclassified items', () => {
  const items = [
    makeItem('HDFCBANK', 'Bank'),
    makeItem('ICICIBANK', 'Bank'),
    makeItem('TCS', 'IT'),
    makeItem('INFY', 'IT'),
    makeItem('SBIN', 'Bank'),
    makeItem('SMALLCAP1', null),
  ];

  const options = getWatchlistSectorOptions(items);
  assert.deepEqual(options, [
    { sector: 'Bank', label: 'Bank', count: 3 },
    { sector: 'IT', label: 'IT', count: 2 },
    { sector: 'UNCLASSIFIED', label: 'Other / Unclassified', count: 1 },
  ]);
});

test('filterWatchlistItems combines sector and scanner filters cleanly', () => {
  const items = [
    makeItem('HDFCBANK', 'Bank', ['sc-1']),
    makeItem('ICICIBANK', 'Bank', []),
    makeItem('TCS', 'IT', ['sc-1', 'sc-2']),
    makeItem('SUNPHARMA', 'Pharma', ['sc-2']),
    makeItem('SMALLCAP1', null, ['sc-1']),
  ];

  assert.equal(filterWatchlistItems(items, 'ALL', 'ALL').length, 5);
  assert.deepEqual(
    filterWatchlistItems(items, 'ALL', 'Bank').map((i) => i.symbol),
    ['HDFCBANK', 'ICICIBANK'],
  );
  assert.deepEqual(
    filterWatchlistItems(items, 'ANY_HIT', 'Bank').map((i) => i.symbol),
    ['HDFCBANK'],
  );
  assert.deepEqual(
    filterWatchlistItems(items, 'sc-2', 'Pharma').map((i) => i.symbol),
    ['SUNPHARMA'],
  );
  assert.deepEqual(
    filterWatchlistItems(items, 'ALL', 'UNCLASSIFIED').map((i) => i.symbol),
    ['SMALLCAP1'],
  );
});

test('computeTopBottomSectorPerformance ranks top 3 and bottom 3 Nifty sectors and skips small outliers', () => {
  const entries = [
    // IT avg = +2.00
    { sector: 'IT', snapshot: makeSnapshot('TCS', 3.0) },
    { sector: 'IT', snapshot: makeSnapshot('INFY', 2.0) },
    { sector: 'IT', snapshot: makeSnapshot('HCLTECH', 1.0) },
    // Bank avg = +1.00
    { sector: 'Bank', snapshot: makeSnapshot('HDFCBANK', 1.5) },
    { sector: 'Bank', snapshot: makeSnapshot('ICICIBANK', 1.0) },
    { sector: 'Bank', snapshot: makeSnapshot('SBIN', 0.5) },
    // Pharma avg = +0.50
    { sector: 'Pharma', snapshot: makeSnapshot('SUNPHARMA', 1.5) },
    { sector: 'Pharma', snapshot: makeSnapshot('CIPLA', 0.5) },
    { sector: 'Pharma', snapshot: makeSnapshot('DRREDDY', -0.5) },
    // Auto avg = +0.10
    { sector: 'Auto', snapshot: makeSnapshot('M&M', 0.3) },
    { sector: 'Auto', snapshot: makeSnapshot('MARUTI', 0.0) },
    { sector: 'Auto', snapshot: makeSnapshot('BAJAJ-AUTO', 0.0) },
    // FMCG avg = -0.30
    { sector: 'FMCG', snapshot: makeSnapshot('ITC', -0.1) },
    { sector: 'FMCG', snapshot: makeSnapshot('HINDUNILVR', -0.3) },
    { sector: 'FMCG', snapshot: makeSnapshot('NESTLEIND', -0.5) },
    // Metal avg = -1.20
    { sector: 'Metal', snapshot: makeSnapshot('TATASTEEL', -0.6) },
    { sector: 'Metal', snapshot: makeSnapshot('HINDALCO', -1.2) },
    { sector: 'Metal', snapshot: makeSnapshot('JSWSTEEL', -1.8) },
    // Realty avg = -2.40
    { sector: 'Realty', snapshot: makeSnapshot('DLF', -1.4) },
    { sector: 'Realty', snapshot: makeSnapshot('LODHA', -2.4) },
    { sector: 'Realty', snapshot: makeSnapshot('GODREJPROP', -3.4) },
    // Single-stock outlier should be excluded when minConstituents = 3
    { sector: 'Diversified', snapshot: makeSnapshot('OUTLIER', 9.9) },
  ];

  const result = computeTopBottomSectorPerformance(entries, 3, 3);
  assert.equal(result.totalSectors, 7);
  assert.deepEqual(
    result.topSectors.map((s) => [s.sector, s.avgChangePct, s.leadSymbol]),
    [
      ['IT', 2, 'TCS'],
      ['Bank', 1, 'HDFCBANK'],
      ['Pharma', 0.5, 'SUNPHARMA'],
    ],
  );
  assert.deepEqual(
    result.bottomSectors.map((s) => [s.sector, s.avgChangePct, s.leadSymbol]),
    [
      ['Realty', -2.4, 'GODREJPROP'],
      ['Metal', -1.2, 'JSWSTEEL'],
      ['FMCG', -0.3, 'NESTLEIND'],
    ],
  );
});

test('computeTopBottomSectorPerformance avoids overlap when fewer than 6 sectors exist', () => {
  const entries = [
    { sector: 'IT', snapshot: makeSnapshot('TCS', 2.0) },
    { sector: 'Bank', snapshot: makeSnapshot('HDFCBANK', 1.0) },
    { sector: 'Auto', snapshot: makeSnapshot('MARUTI', -0.5) },
    { sector: 'Metal', snapshot: makeSnapshot('TATASTEEL', -1.5) },
  ];

  const result = computeTopBottomSectorPerformance(entries, 3, 3);
  assert.deepEqual(result.topSectors.map((s) => s.sector), ['IT', 'Bank', 'Auto']);
  assert.deepEqual(result.bottomSectors.map((s) => s.sector), ['Metal']);
});
