import { useEffect, useMemo, useState } from 'react';
import { aggregateCandles } from '../shared/candles';
import { computeChartYBounds, TARGET_GOAL_META } from '../shared/targets';
import type { OHLCVBar, TargetPriceMarker } from '../shared/types';
import { formatDateShort, formatINR, formatVolume } from '../utils/format';

interface CandlestickChartProps {
  bars: OHLCVBar[];
  height?: number;
  targetMarkers?: TargetPriceMarker[];
}

function formatCandleAxisDate(iso: string, multiYear: boolean): string {
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

export function CandlestickChart({
  bars,
  height = 300,
  targetMarkers = [],
}: CandlestickChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    setHoverIdx(null);
  }, [bars]);

  const { bars: visible, resolution } = useMemo(() => aggregateCandles(bars), [bars]);

  const sma20Series = useMemo(() => {
    const out: Array<number | null> = [];
    for (let i = 0; i < visible.length; i++) {
      if (i < 19) {
        out.push(null);
      } else {
        let sum = 0;
        for (let j = i - 19; j <= i; j++) sum += visible[j].close;
        out.push(sum / 20);
      }
    }
    return out;
  }, [visible]);

  if (visible.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No historical OHLCV bars available for chart.
      </div>
    );
  }

  const width = 760;
  const padLeft = 10;
  const padRight = 64;
  const padTop = 14;
  const priceHeight = 186;
  const volTop = padTop + priceHeight + 16;
  const volHeight = 46;
  const axisY = volTop + volHeight + 15;
  const totalHeight = Math.max(height, axisY + 10);

  const minPrice = Math.min(...visible.map((b) => b.low));
  const maxPrice = Math.max(...visible.map((b) => b.high));
  const [yMin, yMax] = computeChartYBounds(
    minPrice,
    maxPrice,
    targetMarkers.map((m) => m.price),
    0.06,
  );

  const maxVol = Math.max(1, ...visible.map((b) => b.volume));
  const plotWidth = width - padLeft - padRight;
  const stepX = plotWidth / Math.max(1, visible.length);
  const candleW = Math.max(1.4, Math.min(8, stepX * 0.68));
  const wickStroke = visible.length > 180 ? 0.9 : 1.2;

  const priceToY = (p: number) =>
    padTop + ((yMax - p) / Math.max(0.01, yMax - yMin)) * priceHeight;

  const smaPath = sma20Series
    .map((val, i) => {
      if (val === null) return null;
      const x = padLeft + i * stepX + stepX / 2;
      const y = priceToY(val);
      return `${i === 19 || sma20Series[i - 1] === null ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');

  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const price = yMax - t * (yMax - yMin);
    const y = padTop + t * priceHeight;
    return { price, y };
  });

  const firstDate = visible[0].date;
  const lastDate = visible[visible.length - 1].date;
  const spanDays =
    (new Date(`${lastDate}T00:00:00Z`).getTime() -
      new Date(`${firstDate}T00:00:00Z`).getTime()) /
    86400000;
  const multiYear = spanDays > 260;

  const xTickIndices = Array.from(
    new Set([
      0,
      Math.floor((visible.length - 1) * 0.25),
      Math.floor((visible.length - 1) * 0.5),
      Math.floor((visible.length - 1) * 0.75),
      visible.length - 1,
    ]),
  ).filter((idx) => idx >= 0 && idx < visible.length);

  const activeBar =
    hoverIdx !== null && visible[hoverIdx] ? visible[hoverIdx] : visible[visible.length - 1];
  const activeSma =
    hoverIdx !== null ? sma20Series[hoverIdx] : sma20Series[sma20Series.length - 1];

  const resolutionLabel =
    resolution === 'daily' ? 'Daily' : resolution === 'weekly' ? 'Weekly' : 'Monthly';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-mono tabular-nums dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-sans font-medium text-slate-800 dark:text-slate-200">
            {formatDateShort(activeBar.date)}
          </span>
          <span>O {formatINR(activeBar.open)}</span>
          <span>H {formatINR(activeBar.high)}</span>
          <span>L {formatINR(activeBar.low)}</span>
          <span
            className={
              activeBar.close >= activeBar.open
                ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                : 'font-semibold text-red-700 dark:text-red-400'
            }
          >
            C {formatINR(activeBar.close)}
          </span>
          <span>Vol {formatVolume(activeBar.volume)}</span>
          {activeSma !== null && (
            <span className="text-accent-700 dark:text-accent-400">SMA20 {formatINR(activeSma)}</span>
          )}
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {visible.length} {resolutionLabel} candles · {formatDateShort(firstDate)} –{' '}
          {formatDateShort(lastDate)}
        </span>
      </div>

      <div className="relative rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <svg
          viewBox={`0 0 ${width} ${totalHeight}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label={`${resolutionLabel} OHLC Candlestick and Volume Chart spanning ${firstDate} to ${lastDate}`}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Horizontal gridlines & right-axis labels */}
          {gridTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
              />
              <text
                x={width - padRight + 6}
                y={tick.y + 3.5}
                fontSize="10"
                fill="var(--chart-tick)"
                fontFamily="JetBrains Mono, monospace"
              >
                {tick.price.toFixed(tick.price >= 1000 ? 0 : 1)}
              </text>
            </g>
          ))}

          {/* SMA 20 Overlay */}
          {smaPath && (
            <path
              d={smaPath}
              fill="none"
              stroke="var(--sma-line)"
              strokeWidth="1.5"
              strokeOpacity="0.9"
            />
          )}

          {/* Candlesticks + Volume */}
          {visible.map((bar, i) => {
            const xCenter = padLeft + i * stepX + stepX / 2;
            const isUp = bar.close >= bar.open;
            const color = isUp ? 'var(--candle-up)' : 'var(--candle-down)';
            const yHigh = priceToY(bar.high);
            const yLow = priceToY(bar.low);
            const yOpen = priceToY(bar.open);
            const yClose = priceToY(bar.close);
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

            const volBarH = (bar.volume / maxVol) * volHeight;
            const volY = volTop + volHeight - volBarH;

            return (
              <g key={`${bar.date}-${i}`}>
                {hoverIdx === i && (
                  <line
                    x1={xCenter}
                    x2={xCenter}
                    y1={padTop}
                    y2={volTop + volHeight}
                    stroke="var(--chart-crosshair)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                )}
                <line
                  x1={xCenter}
                  x2={xCenter}
                  y1={yHigh}
                  y2={yLow}
                  stroke={color}
                  strokeWidth={wickStroke}
                />
                <rect
                  x={xCenter - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={bodyHeight}
                  fill={color}
                  rx="0.5"
                />
                <rect
                  x={xCenter - candleW / 2}
                  y={volY}
                  width={candleW}
                  height={Math.max(1, volBarH)}
                  fill={isUp ? 'var(--vol-up)' : 'var(--vol-down)'}
                />
                <rect
                  x={padLeft + i * stepX}
                  y={padTop}
                  width={stepX}
                  height={volTop + volHeight - padTop}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              </g>
            );
          })}

          {/* Bottom X-axis date ticks */}
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={volTop + volHeight + 2}
            y2={volTop + volHeight + 2}
            stroke="var(--chart-axis)"
            strokeWidth="1"
          />
          {xTickIndices.map((idx, tickPos) => {
            const x = padLeft + idx * stepX + stepX / 2;
            const anchor =
              tickPos === 0
                ? 'start'
                : tickPos === xTickIndices.length - 1
                  ? 'end'
                  : 'middle';
            const clampedX =
              anchor === 'start'
                ? Math.max(padLeft, x)
                : anchor === 'end'
                  ? Math.min(width - padRight, x)
                  : x;
            return (
              <text
                key={`xtick-${idx}`}
                x={clampedX}
                y={axisY}
                textAnchor={anchor}
                fontSize="9.5"
                fill="var(--chart-tick)"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatCandleAxisDate(visible[idx].date, multiYear)}
              </text>
            );
          })}

          {/* Price targets (painted above candlesticks for crisp readability) */}
          {targetMarkers.map((marker) => {
            const meta = TARGET_GOAL_META[marker.goal];
            const y = priceToY(marker.price);
            const tagText = `${meta.shortTag} ₹${marker.price.toLocaleString('en-IN')}${
              marker.label ? ` · ${marker.label}` : ''
            }`;
            const tagW = Math.min(230, tagText.length * 6.1 + 14);
            const badgeY = Math.max(padTop + 2, y - 17);
            return (
              <g key={marker.id} pointerEvents="none">
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke={meta.color}
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
                <rect
                  x={padLeft + 4}
                  y={badgeY}
                  width={tagW}
                  height={15}
                  rx="3"
                  fill={meta.bgTint}
                  stroke={meta.borderTint}
                  strokeWidth="1"
                />
                <text
                  x={padLeft + 10}
                  y={badgeY + 10.5}
                  fontSize="9.5"
                  fontWeight="600"
                  fill={meta.color}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {tagText}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

