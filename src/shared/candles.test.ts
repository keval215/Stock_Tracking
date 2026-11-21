import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateCandles } from './candles';
import type { OHLCVBar } from './types';

function makeDailyBars(count: number, startDate = '2021-01-04'): OHLCVBar[] {
  const out: OHLCVBar[] = [];
  let cursor = new Date(`${startDate}T00:00:00Z`);
  let price = 100;

  while (out.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      const date = cursor.toISOString().slice(0, 10);
      const open = Number(price.toFixed(2));
      const close = Number((price + 0.5).toFixed(2));
      out.push({
        date,
        open,
        high: Number((close + 2).toFixed(2)),
        low: Number((open - 1.5).toFixed(2)),
        close,
        prevClose: open,
        volume: 1000,
        turnover: close * 1000,
        trades: 50,
      });
      price = close;
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return out;
}

test('aggregateCandles keeps full 1-year daily bars without truncation', () => {
  const oneYear = makeDailyBars(252, '2025-11-17');
  const res = aggregateCandles(oneYear);
  assert.equal(res.resolution, 'daily');
  assert.equal(res.bars.length, 252);
  assert.equal(res.bars[0].date, oneYear[0].date);
  assert.equal(res.bars[251].date, oneYear[251].date);
});

test('aggregateCandles aggregates 5-year daily bars into weekly OHLCV candles preserving OHLCV invariants', () => {
  const fiveYear = makeDailyBars(1250, '2021-11-15');
  const res = aggregateCandles(fiveYear);
  assert.equal(res.resolution, 'weekly');
  assert.ok(res.bars.length >= 240 && res.bars.length <= 270);
  assert.equal(res.bars[0].open, fiveYear[0].open);
  assert.equal(res.bars[res.bars.length - 1].close, fiveYear[fiveYear.length - 1].close);

  const totalSourceVol = fiveYear.reduce((s, b) => s + b.volume, 0);
  const totalAggVol = res.bars.reduce((s, b) => s + b.volume, 0);
  assert.equal(totalAggVol, totalSourceVol);
});

test('aggregateCandles aggregates 10-year daily bars into monthly OHLCV candles', () => {
  const tenYear = makeDailyBars(2500, '2016-11-15');
  const res = aggregateCandles(tenYear);
  assert.equal(res.resolution, 'monthly');
  assert.ok(res.bars.length >= 110 && res.bars.length <= 130);
});
