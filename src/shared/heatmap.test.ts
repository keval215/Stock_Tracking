import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeHeatmapAggregates,
  computeMultiYearSummary,
  computeSectorSummaries,
  formatMarketCapCr,
  getHeatmapTileColors,
  groupStocksByCategory,
  normalizeStockCategory,
} from './heatmap';
import type { NiftyHeatmapStock, OHLCVBar } from './types';

const SAMPLE_STOCKS: NiftyHeatmapStock[] = [
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    sector: 'Oil Gas & Consumable Fuels',
    close: 1340,
    change: 26.8,
    changePct: 2.0,
    marketCapCr: 1800000,
    turnoverCr: 1800,
    volume: 13000000,
    rsi14: 62,
    relVol: 1.2,
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    sector: 'Financial Services',
    close: 810,
    change: -8.1,
    changePct: -1.0,
    marketCapCr: 1200000,
    turnoverCr: 1500,
    volume: 18000000,
    rsi14: 48,
    relVol: 0.9,
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    sector: 'Financial Services',
    close: 1580,
    change: 0,
    changePct: 0,
    marketCapCr: 1000000,
    turnoverCr: 1100,
    volume: 7000000,
    rsi14: 55,
    relVol: 1.0,
  },
];

test('computeHeatmapAggregates computes cap-weighted return and breadth counts', () => {
  const agg = computeHeatmapAggregates(SAMPLE_STOCKS);
  assert.equal(agg.totalMarketCapCr, 4000000);
  assert.equal(agg.advances, 1);
  assert.equal(agg.declines, 1);
  assert.equal(agg.unchanged, 1);
  assert.equal(agg.avgChangePct, 0.33);
  // (2 * 1.8M + (-1) * 1.2M + 0 * 1.0M) / 4.0M = 2.4 / 4.0 = 0.60
  assert.equal(agg.weightedChangePct, 0.6);
});

test('computeSectorSummaries groups and sorts sectors by total market cap', () => {
  const sectors = computeSectorSummaries(SAMPLE_STOCKS);
  assert.equal(sectors.length, 2);
  assert.equal(sectors[0].sector, 'Financial Services');
  assert.equal(sectors[0].stockCount, 2);
  assert.equal(sectors[0].weightPct, 55.0);
  assert.equal(sectors[1].sector, 'Oil Gas & Consumable Fuels');
  assert.equal(sectors[1].weightPct, 45.0);
});

test('groupStocksByCategory creates category heatmap groups with top gainer, top loser, and sorted stocks', () => {
  const groups = groupStocksByCategory(SAMPLE_STOCKS);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].sector, 'Financial Services');
  assert.equal(groups[0].stocks.length, 2);
  assert.equal(groups[0].topGainer?.symbol, 'ICICIBANK');
  assert.equal(groups[0].topLoser?.symbol, 'HDFCBANK');
});

test('normalizeStockCategory classifies TradingView sectors, industries, and company names accurately', () => {
  assert.equal(normalizeStockCategory('Finance', 'Regional Banks', 'State Bank of India'), 'Bank');
  assert.equal(normalizeStockCategory('Technology Services', 'IT Services', 'Infosys Ltd'), 'IT');
  assert.equal(normalizeStockCategory('', '', 'Sun Pharmaceutical Industries Ltd'), 'Pharma');
  assert.equal(normalizeStockCategory('Producer Manufacturing', 'Motor Vehicles', 'Tata Motors'), 'Auto');
});

test('computeMultiYearSummary calculates 30D, 1Y, 3Y, 5Y returns and 5Y CAGR over multi-year bars', () => {
  const bars: OHLCVBar[] = [];
  const startMs = new Date('2021-11-15T00:00:00Z').getTime();
  // Generate 1,250 trading days (~5 years) doubling from 100 to 200
  for (let i = 0; i < 1250; i++) {
    const dt = new Date(startMs + Math.floor((i * 365.25 * 5) / 1249) * 86400000)
      .toISOString()
      .slice(0, 10);
    const close = Number((100 + (100 * i) / 1249).toFixed(2));
    bars.push({
      date: dt,
      open: close - 1,
      high: close + 2,
      low: close - 2,
      close,
      prevClose: close - 0.5,
      volume: 100000,
      turnover: close * 100000,
      trades: 1000,
    });
  }
  const summary = computeMultiYearSummary(bars);
  assert.equal(summary.totalBars, 1250);
  assert.equal(summary.return5yPct, 100);
  assert.ok(summary.cagr5yPct !== null && summary.cagr5yPct > 14 && summary.cagr5yPct < 16);
  assert.equal(summary.high5y, 202);
  assert.equal(summary.low5y, 98);
});

test('getHeatmapTileColors distinguishes negative, flat, and positive moves with accessible text', () => {
  const flat = getHeatmapTileColors(0);
  assert.equal(flat.bg, '#e2e8f0');
  assert.equal(flat.text, '#0f172a');

  const strongUp = getHeatmapTileColors(3.2);
  assert.equal(strongUp.text, '#ffffff');

  const strongDown = getHeatmapTileColors(-3.2);
  assert.equal(strongDown.text, '#ffffff');
});

test('formatMarketCapCr formats Lakh Crores and Crores cleanly', () => {
  assert.equal(formatMarketCapCr(1812819), '₹18.13L Cr');
  assert.equal(formatMarketCapCr(85420), '₹85,420 Cr');
  assert.equal(formatMarketCapCr(null), '—');
});

