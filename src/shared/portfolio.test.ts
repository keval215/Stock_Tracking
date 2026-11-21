import assert from 'node:assert/strict';
import test from 'node:test';
import { computePortfolioMetrics, validateHoldingInput } from './portfolio.ts';
import type { PortfolioHolding, StockSnapshot } from './types.ts';

function makeSnapshot(symbol: string, close: number, prevClose: number): StockSnapshot {
  const change = Math.round((close - prevClose) * 100) / 100;
  const changePct = prevClose > 0 ? Math.round((change / prevClose) * 10000) / 100 : 0;
  return {
    symbol,
    name: `${symbol} Ltd`,
    series: 'EQ',
    isin: 'INE000000001',
    tradeDate: '2026-11-13',
    open: prevClose,
    high: Math.max(close, prevClose),
    low: Math.min(close, prevClose),
    close,
    prevClose,
    change,
    changePct,
    change5dPct: 0,
    change20dPct: 0,
    volume: 100000,
    avgVol20: 100000,
    relVol: 1,
    turnoverCr: 10,
    trades: 1000,
    sma20: close,
    sma50: close,
    ema9: close,
    ema20: close,
    rsi14: 55,
    macd: 0,
    macdSignal: 0,
    high20d: close,
    low20d: prevClose,
    distFromHigh20dPct: 0,
    gapPct: 0,
    dayRangePct: 1,
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

test('validateHoldingInput rejects empty symbols and non-positive quantity or price', () => {
  assert.ok(validateHoldingInput('', 10, 100) !== null);
  assert.ok(validateHoldingInput('TCS', 0, 100) !== null);
  assert.ok(validateHoldingInput('TCS', -5, 100) !== null);
  assert.ok(validateHoldingInput('TCS', 5, 0) !== null);
  assert.equal(validateHoldingInput('tcs', 5, 3500.5), null);
});

test('computePortfolioMetrics calculates P&L, day P&L, weights, and handles unpriced symbols cleanly', () => {
  const holdings: PortfolioHolding[] = [
    {
      id: 'h1',
      symbol: 'RELIANCE',
      quantity: 10,
      avgPrice: 1200,
      createdAt: '2026-11-10T00:00:00Z',
      updatedAt: '2026-11-10T00:00:00Z',
    },
    {
      id: 'h2',
      symbol: 'INFY',
      quantity: 5,
      avgPrice: 1600,
      createdAt: '2026-11-11T00:00:00Z',
      updatedAt: '2026-11-11T00:00:00Z',
    },
  ];

  const snaps = new Map<string, StockSnapshot>([
    ['RELIANCE', makeSnapshot('RELIANCE', 1350, 1300)], // invested 12000, curr 13500, pnl +1500, dayPnl +500
    ['INFY', makeSnapshot('INFY', 1400, 1420)], // invested 8000, curr 7000, pnl -1000, dayPnl -100
  ]);
  const sectors = new Map<string, string>([
    ['RELIANCE', 'Energy'],
    ['INFY', 'IT'],
  ]);

  const res = computePortfolioMetrics(
    holdings,
    (sym) => snaps.get(sym) ?? null,
    (sym) => sectors.get(sym) ?? null,
    '2026-11-13',
  );

  assert.equal(res.summary.totalInvested, 20000);
  assert.equal(res.summary.totalCurrentValue, 20500);
  assert.equal(res.summary.totalPnl, 500);
  assert.equal(res.summary.totalPnlPct, 2.5);
  assert.equal(res.summary.dayPnl, 400);
  assert.equal(res.summary.holdingsCount, 2);
  assert.equal(res.summary.gainersCount, 1);
  assert.equal(res.summary.losersCount, 1);

  assert.equal(res.holdings[0].pnl, 1500);
  assert.equal(res.holdings[0].pnlPct, 12.5);
  assert.equal(res.holdings[0].sector, 'Energy');
  assert.equal(res.holdings[0].weightPct, 65.85);
  assert.equal(res.holdings[1].pnl, -1000);
  assert.equal(res.holdings[1].weightPct, 34.15);
});
