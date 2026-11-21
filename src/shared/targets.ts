import type { TargetMarkerGoal } from './types';

export const TARGET_GOAL_META: Record<
  TargetMarkerGoal,
  { label: string; shortTag: string; color: string; bgTint: string; borderTint: string }
> = {
  entry: {
    label: 'Entry Goal',
    shortTag: 'ENTRY',
    color: '#2563eb',
    bgTint: '#eff6ff',
    borderTint: '#bfdbfe',
  },
  exit: {
    label: 'Exit Target',
    shortTag: 'EXIT',
    color: '#059669',
    bgTint: '#ecfdf5',
    borderTint: '#a7f3d0',
  },
  stop: {
    label: 'Stop Loss',
    shortTag: 'STOP',
    color: '#dc2626',
    bgTint: '#fef2f2',
    borderTint: '#fecaca',
  },
};

export function computeTargetDistancePct(targetPrice: number, currentPrice: number): number {
  if (!Number.isFinite(targetPrice) || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return 0;
  }
  return Number((((targetPrice - currentPrice) / currentPrice) * 100).toFixed(2));
}

export function computeChartYBounds(
  dataMin: number,
  dataMax: number,
  markerPrices: number[],
  padFraction = 0.06,
): [number, number] {
  const validMarkers = markerPrices.filter((p) => Number.isFinite(p) && p > 0);
  const combinedMin = validMarkers.length > 0 ? Math.min(dataMin, ...validMarkers) : dataMin;
  const combinedMax = validMarkers.length > 0 ? Math.max(dataMax, ...validMarkers) : dataMax;

  const span = Math.max(combinedMax - combinedMin, Math.max(combinedMax * 0.02, 0.5));
  const pad = span * padFraction;

  return [
    Number(Math.max(0, combinedMin - pad).toFixed(2)),
    Number((combinedMax + pad).toFixed(2)),
  ];
}
