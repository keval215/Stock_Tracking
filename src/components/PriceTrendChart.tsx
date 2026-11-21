import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  computeAlignedEMASeries,
  computeRSISeries,
  computeSMASeries,
} from '../shared/indicators';
import {
  computeChartYBounds,
  computeTargetDistancePct,
  TARGET_GOAL_META,
} from '../shared/targets';
import type { OHLCVBar, TargetPriceMarker } from '../shared/types';
import { formatDateShort, formatINR, formatSignedPct, formatVolume } from '../utils/format';

export type TrendIndicatorKey = 'sma5' | 'sma20' | 'ema9' | 'ema20' | 'rsi14';

export interface TrendIndicatorMeta {
  key: TrendIndicatorKey;
  label: string;
  shortLabel: string;
  group: 'Moving Averages' | 'Momentum Oscillator';
  color: string;
  dashed?: boolean;
  description: string;
}

export const TREND_INDICATORS: TrendIndicatorMeta[] = [
  {
    key: 'sma5',
    label: 'SMA (5)',
    shortLabel: '5D SMA',
    group: 'Moving Averages',
    color: '#3b82f6',
    dashed: true,
    description: '5-day Simple Moving Average',
  },
  {
    key: 'sma20',
    label: 'SMA (20)',
    shortLabel: '20D SMA',
    group: 'Moving Averages',
    color: '#f59e0b',
    dashed: false,
    description: '20-day Simple Moving Average',
  },
  {
    key: 'ema9',
    label: 'EMA (9)',
    shortLabel: '9D EMA',
    group: 'Moving Averages',
    color: '#8b5cf6',
    dashed: false,
    description: '9-day Exponential Moving Average',
  },
  {
    key: 'ema20',
    label: 'EMA (20)',
    shortLabel: '20D EMA',
    group: 'Moving Averages',
    color: '#0891b2',
    dashed: true,
    description: '20-day Exponential Moving Average',
  },
  {
    key: 'rsi14',
    label: 'RSI (14)',
    shortLabel: 'RSI 14',
    group: 'Momentum Oscillator',
    color: '#4f46e5',
    description: '14-period Wilder RSI sub-panel (70 / 30)',
  },
];

interface PriceTrendChartProps {
  bars: OHLCVBar[];
  lookbackBars?: OHLCVBar[];
  rangeLabel?: string;
  activeIndicators?: TrendIndicatorKey[];
  targetMarkers?: TargetPriceMarker[];
  referenceClose?: number;
  onPickTargetPrice?: (price: number) => void;
}

interface ChartPoint {
  date: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma5: number | null;
  sma20: number | null;
  ema9: number | null;
  ema20: number | null;
  rsi14: number | null;
}

function formatAxisDate(iso: string, multiYear = false): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  if (multiYear) {
    return d.toLocaleDateString('en-IN', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    });
  }
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  activeIndicators: TrendIndicatorKey[];
}

function TrendTooltip({ active, payload, activeIndicators }: CustomTooltipProps) {
  const pt = payload?.[0]?.payload;
  if (!active || !pt) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="font-semibold text-slate-900 dark:text-slate-100">
        {formatDateShort(pt.date)}
      </div>
      <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Close</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {formatINR(pt.close)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">High / Low</span>
          <span className="text-slate-700 dark:text-slate-300">
            {formatINR(pt.high)} / {formatINR(pt.low)}
          </span>
        </div>
        {TREND_INDICATORS.map((ind) => {
          if (!activeIndicators.includes(ind.key)) return null;
          const val = pt[ind.key];
          if (val === null || val === undefined) return null;
          return (
            <div key={ind.key} className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">{ind.shortLabel}</span>
              <span style={{ color: ind.color }} className="font-medium">
                {ind.key === 'rsi14' ? val.toFixed(1) : formatINR(val)}
              </span>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Volume</span>
          <span className="text-slate-700 dark:text-slate-300">{formatVolume(pt.volume)}</span>
        </div>
      </div>
    </div>
  );
}

interface RsiTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
}

function RsiTooltip({ active, payload }: RsiTooltipProps) {
  const pt = payload?.[0]?.payload;
  if (!active || !pt) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] shadow-sm tabular-nums dark:border-slate-700 dark:bg-slate-900">
      <span className="text-slate-500 dark:text-slate-400">{formatAxisDate(pt.date)} · </span>
      <span className="font-semibold text-indigo-700 dark:text-indigo-400">
        RSI(14): {pt.rsi14 !== null ? pt.rsi14.toFixed(1) : '—'}
      </span>
    </div>
  );
}

export function PriceTrendChart({
  bars,
  lookbackBars,
  rangeLabel = '30D',
  activeIndicators = ['sma5'],
  targetMarkers = [],
  referenceClose,
  onPickTargetPrice,
}: PriceTrendChartProps) {
  const { data, stats } = useMemo(() => {
    if (!bars.length) {
      return {
        data: [] as ChartPoint[],
        stats: null,
      };
    }

    const warmSource =
      lookbackBars && lookbackBars.length > bars.length ? lookbackBars : bars;
    const warmCloses = warmSource.map((b) => b.close);
    const warmSma5 = computeSMASeries(warmCloses, 5);
    const warmSma20 = computeSMASeries(warmCloses, 20);
    const warmEma9 = computeAlignedEMASeries(warmCloses, 9);
    const warmEma20 = computeAlignedEMASeries(warmCloses, 20);
    const warmRsi14 = computeRSISeries(warmCloses, 14);

    const warmByDate = new Map<
      string,
      {
        sma5: number | null;
        sma20: number | null;
        ema9: number | null;
        ema20: number | null;
        rsi14: number | null;
      }
    >();
    warmSource.forEach((b, idx) => {
      warmByDate.set(b.date, {
        sma5: warmSma5[idx],
        sma20: warmSma20[idx],
        ema9: warmEma9[idx],
        ema20: warmEma20[idx],
        rsi14: warmRsi14[idx],
      });
    });

    const localCloses = bars.map((b) => b.close);
    const localSma5 = computeSMASeries(localCloses, 5);
    const localSma20 = computeSMASeries(localCloses, 20);
    const localEma9 = computeAlignedEMASeries(localCloses, 9);
    const localEma20 = computeAlignedEMASeries(localCloses, 20);
    const localRsi14 = computeRSISeries(localCloses, 14);

    const spanDays =
      (new Date(`${bars[bars.length - 1].date}T00:00:00Z`).getTime() -
        new Date(`${bars[0].date}T00:00:00Z`).getTime()) /
      86400000;
    const isMultiYear = spanDays > 260;

    const fullPoints: ChartPoint[] = bars.map((bar, idx) => {
      const warmed = warmByDate.get(bar.date);
      return {
        date: bar.date,
        label: formatAxisDate(bar.date, isMultiYear),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        sma5: warmed?.sma5 ?? localSma5[idx],
        sma20: warmed?.sma20 ?? localSma20[idx],
        ema9: warmed?.ema9 ?? localEma9[idx],
        ema20: warmed?.ema20 ?? localEma20[idx],
        rsi14: warmed?.rsi14 ?? localRsi14[idx],
      };
    });

    // Keep Recharts snappy on 5Y–10Y daily histories (1,250–2,500 bars) while preserving first & last exact points
    let points = fullPoints;
    if (fullPoints.length > 420) {
      const stride = Math.ceil(fullPoints.length / 360);
      points = fullPoints.filter((_, i) => i === 0 || i === fullPoints.length - 1 || i % stride === 0);
    }

    const firstClose = bars[0].close;
    const lastClose = bars[bars.length - 1].close;
    const changePct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
    const periodHigh = Math.max(...bars.map((b) => b.high));
    const periodLow = Math.min(...bars.map((b) => b.low));
    const latestRsi = fullPoints[fullPoints.length - 1]?.rsi14 ?? null;

    const seriesVals: number[] = [];
    for (const pt of points) {
      seriesVals.push(pt.close);
      if (activeIndicators.includes('sma5') && pt.sma5 !== null) seriesVals.push(pt.sma5);
      if (activeIndicators.includes('sma20') && pt.sma20 !== null) seriesVals.push(pt.sma20);
      if (activeIndicators.includes('ema9') && pt.ema9 !== null) seriesVals.push(pt.ema9);
      if (activeIndicators.includes('ema20') && pt.ema20 !== null) seriesVals.push(pt.ema20);
    }
    const dataMin = Math.min(...seriesVals);
    const dataMax = Math.max(...seriesVals);
    const [yMin, yMax] = computeChartYBounds(
      dataMin,
      dataMax,
      targetMarkers.map((m) => m.price),
      0.08,
    );

    return {
      data: points,
      stats: {
        firstClose,
        lastClose,
        changePct,
        periodHigh,
        periodLow,
        sessions: bars.length,
        latestRsi,
        yMin,
        yMax,
      },
    };
  }, [bars, lookbackBars, activeIndicators, targetMarkers]);

  if (!data.length || !stats) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Historical 30-day bar data unavailable for this symbol.
      </div>
    );
  }

  const isPositive = stats.changePct > 0;
  const isNegative = stats.changePct < 0;
  const strokeColor = isPositive ? '#10b981' : isNegative ? '#ef4444' : '#64748b';
  const gradientId = isPositive ? 'trendFillUp' : isNegative ? 'trendFillDown' : 'trendFillFlat';

  const activeOverlays = TREND_INDICATORS.filter(
    (ind) => ind.key !== 'rsi14' && activeIndicators.includes(ind.key),
  );
  const showRsi = activeIndicators.includes('rsi14');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      {/* Period Summary Strip */}
      <div className="mb-3 grid grid-cols-2 gap-3 border-b border-slate-100 pb-2.5 text-xs dark:border-slate-800 sm:grid-cols-4">
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{rangeLabel} Change</div>
          <div
            className={`font-mono font-semibold tabular-nums ${
              isPositive
                ? 'text-emerald-700 dark:text-emerald-400'
                : isNegative
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {formatSignedPct(stats.changePct)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{rangeLabel} High</div>
          <div className="font-mono font-medium text-slate-900 tabular-nums dark:text-slate-100">
            {formatINR(stats.periodHigh)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{rangeLabel} Low</div>
          <div className="font-mono font-medium text-slate-900 tabular-nums dark:text-slate-100">
            {formatINR(stats.periodLow)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Trading sessions</div>
          <div className="font-mono font-medium text-slate-900 tabular-nums dark:text-slate-100">
            {stats.sessions.toLocaleString('en-IN')} bars
          </div>
        </div>
      </div>

      {/* Recharts 30D Area + Moving Average Overlays */}
      <div className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            syncId="price-trend-30d"
            margin={{ top: 10, right: 8, left: 0, bottom: 2 }}
            onClick={(state) => {
              const idx = Number(state?.activeTooltipIndex);
              const pt = Number.isInteger(idx) && idx >= 0 ? data[idx] : undefined;
              if (pt && onPickTargetPrice) {
                onPickTargetPrice(pt.close);
              }
            }}
          >
            <defs>
              <linearGradient id="trendFillUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="trendFillDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="trendFillFlat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#475569" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#475569" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--chart-tick)', fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              minTickGap={24}
            />
            <YAxis
              domain={[stats.yMin, stats.yMax]}
              orientation="right"
              width={64}
              tick={{ fontSize: 10, fill: 'var(--chart-tick)', fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`}
            />
            <Tooltip content={<TrendTooltip activeIndicators={activeIndicators} />} />
            <ReferenceLine
              y={stats.firstClose}
              stroke="var(--chart-ref)"
              strokeDasharray="4 4"
            />
            <Area
              type="monotone"
              dataKey="close"
              name="Close"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
            {activeOverlays.map((ind) => (
              <Line
                key={ind.key}
                type="monotone"
                dataKey={ind.key}
                name={ind.shortLabel}
                stroke={ind.color}
                strokeWidth={1.6}
                strokeDasharray={ind.dashed ? '4 3' : undefined}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            {targetMarkers.map((marker) => {
              const meta = TARGET_GOAL_META[marker.goal];
              const basePrice = referenceClose && referenceClose > 0 ? referenceClose : stats.lastClose;
              const distPct = computeTargetDistancePct(marker.price, basePrice);
              const tagText = `${meta.shortTag} ₹${marker.price.toLocaleString('en-IN')} (${
                distPct > 0 ? '+' : ''
              }${distPct.toFixed(1)}%)${marker.label ? ` · ${marker.label}` : ''}`;
              return (
                <ReferenceLine
                  key={marker.id}
                  y={marker.price}
                  stroke={meta.color}
                  strokeWidth={1.6}
                  strokeDasharray="5 3"
                  label={({ viewBox }: { viewBox?: { x?: number; y?: number } }) => {
                    const vx = viewBox?.x ?? 0;
                    const vy = viewBox?.y ?? 0;
                    const boxW = Math.min(240, tagText.length * 6.1 + 14);
                    const boxY = Math.max(4, vy - 18);
                    return (
                      <g>
                        <rect
                          x={vx + 6}
                          y={boxY}
                          width={boxW}
                          height={16}
                          rx={3}
                          fill={meta.bgTint}
                          stroke={meta.borderTint}
                          strokeWidth={1}
                        />
                        <text
                          x={vx + 12}
                          y={boxY + 11.5}
                          fontSize={9.5}
                          fontWeight={600}
                          fill={meta.color}
                          style={{ fontFamily: 'JetBrains Mono, monospace' }}
                        >
                          {tagText}
                        </text>
                      </g>
                    );
                  }}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Optional RSI (14) Synchronized Sub-Chart */}
      {showRsi && (
        <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-indigo-700 dark:text-indigo-400">
              RSI (14) Momentum
            </span>
            <span className="font-mono text-slate-500 tabular-nums dark:text-slate-400">
              Latest:{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.latestRsi !== null ? stats.latestRsi.toFixed(1) : '—'}
              </span>{' '}
              · OB 70 / OS 30
            </span>
          </div>
          <div className="h-[96px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                syncId="price-trend-30d"
                margin={{ top: 4, right: 8, left: 0, bottom: 2 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" hide />
                <YAxis
                  domain={[0, 100]}
                  ticks={[30, 50, 70]}
                  orientation="right"
                  width={64}
                  tick={{
                    fontSize: 10,
                    fill: 'var(--chart-tick)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<RsiTooltip />} />
                <ReferenceLine y={70} stroke="var(--rsi-ob)" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="var(--rsi-os)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="rsi14"
                  name="RSI (14)"
                  stroke="var(--rsi-line)"
                  strokeWidth={1.6}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: strokeColor }}
            />
            Daily close
          </span>
          {activeOverlays.map((ind) => (
            <span key={ind.key} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-3"
                style={{
                  backgroundColor: ind.color,
                  borderTop: ind.dashed ? `1px dashed ${ind.color}` : undefined,
                }}
              />
              {ind.shortLabel}
            </span>
          ))}
          {showRsi && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 bg-indigo-600 dark:bg-indigo-400" />
              RSI (14)
            </span>
          )}
        </div>
        <span className="font-mono tabular-nums">
          Baseline: {formatINR(stats.firstClose)}
        </span>
      </div>
    </div>
  );
}
