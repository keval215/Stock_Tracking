import assert from 'node:assert/strict';
import test from 'node:test';
import { computeChartYBounds, computeTargetDistancePct, TARGET_GOAL_META } from './targets';

test('computeTargetDistancePct computes signed percentage from current close', () => {
  assert.equal(computeTargetDistancePct(1100, 1000), 10);
  assert.equal(computeTargetDistancePct(950, 1000), -5);
  assert.equal(computeTargetDistancePct(1000, 1000), 0);
  assert.equal(computeTargetDistancePct(1000, 0), 0);
});

test('computeChartYBounds expands domain to fit target markers with padding', () => {
  const [yMin, yMax] = computeChartYBounds(1150, 1350, [1450, 1100]);
  assert.ok(yMin < 1100);
  assert.ok(yMax > 1450);

  const [noMarkerMin, noMarkerMax] = computeChartYBounds(100, 120, []);
  assert.ok(noMarkerMin < 100);
  assert.ok(noMarkerMax > 120);
});

test('TARGET_GOAL_META defines colors and short tags for entry, exit, and stop goals', () => {
  assert.equal(TARGET_GOAL_META.entry.shortTag, 'ENTRY');
  assert.equal(TARGET_GOAL_META.exit.shortTag, 'EXIT');
  assert.equal(TARGET_GOAL_META.stop.shortTag, 'STOP');
});
