import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMarketCapCr, getHeatmapTileColors } from '../shared/heatmap';
import type { NiftyHeatmapStock } from '../shared/types';
import { formatCrores, formatINR, formatSignedPct } from '../utils/format';

interface NiftyHeatmapChartProps {
  constituents: NiftyHeatmapStock[];
  totalMarketCapCr: number;
  groupBySector: boolean;
  sizeMetric: 'marketCapCr' | 'turnoverCr';
  onSelectStock: (symbol: string) => void;
  height?: number;
  idPrefix?: string;
  ariaTitle?: string;
}

interface TreeNodeData {
  name: string;
  stock?: NiftyHeatmapStock;
  children?: TreeNodeData[];
}

interface TooltipState {
  stock: NiftyHeatmapStock;
  x: number;
  y: number;
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function NiftyHeatmapChart({
  constituents,
  totalMarketCapCr,
  groupBySector,
  sizeMetric,
  onSelectStock,
  height,
  idPrefix = 'hm',
  ariaTitle = 'NSE market breadth treemap heatmap',
}: NiftyHeatmapChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: height ? 560 : 1080,
    height: height ?? 560,
  });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const w = Math.max(280, Math.floor(el.clientWidth));
      const h = height ?? (w < 640 ? 480 : w < 1024 ? 540 : 600);
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  useEffect(() => {
    setTooltip(null);
    setHoveredSymbol(null);
  }, [constituents, groupBySector, sizeMetric, size.width, size.height]);

  const layout = useMemo(() => {
    if (constituents.length === 0) {
      return {
        sectorNodes: [] as d3.HierarchyRectangularNode<TreeNodeData>[],
        leafNodes: [] as d3.HierarchyRectangularNode<TreeNodeData>[],
      };
    }

    let rootData: TreeNodeData;
    if (groupBySector) {
      const grouped = d3.group(constituents, (d) => d.sector || 'Other');
      rootData = {
        name: ariaTitle,
        children: Array.from(grouped.entries()).map(([sector, stocks]) => ({
          name: sector,
          children: stocks.map((stock) => ({
            name: stock.symbol,
            stock,
          })),
        })),
      };
    } else {
      rootData = {
        name: ariaTitle,
        children: constituents.map((stock) => ({
          name: stock.symbol,
          stock,
        })),
      };
    }

    const root = d3
      .hierarchy<TreeNodeData>(rootData)
      .sum((d) => {
        if (!d.stock) return 0;
        const val = sizeMetric === 'turnoverCr' ? d.stock.turnoverCr : d.stock.marketCapCr;
        return Math.max(val, 1);
      })
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const dense = constituents.length > 100;
    const treemapLayout = d3
      .treemap<TreeNodeData>()
      .size([size.width, size.height])
      .tile(d3.treemapSquarify)
      .paddingOuter(groupBySector ? 4 : dense ? 1 : 2)
      .paddingInner(dense ? 1 : 2)
      .paddingTop((node) => (groupBySector && node.depth === 1 ? 20 : dense ? 1 : 2))
      .round(true);

    const laidOut = treemapLayout(root);
    const sectorNodes = groupBySector
      ? laidOut.children?.filter((n) => n.x1 - n.x0 > 24 && n.y1 - n.y0 > 24) || []
      : [];
    const leafNodes = laidOut.leaves();

    return { sectorNodes, leafNodes };
  }, [constituents, groupBySector, sizeMetric, size.width, size.height, ariaTitle]);

  const safePrefix = sanitizeId(idPrefix);

  const handlePointerMove = (
    e: React.MouseEvent<SVGGElement, MouseEvent>,
    stock: NiftyHeatmapStock,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      stock,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  if (constituents.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No NSE stocks match the selected filter.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseLeave={() => {
        setHoveredSymbol(null);
        setTooltip(null);
      }}
      className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950"
    >
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={ariaTitle}
        className="block w-full select-none"
      >
        <defs>
          {layout.sectorNodes.map((sec, idx) => {
            const w = Math.max(0, sec.x1 - sec.x0);
            return (
              <clipPath key={`sec-${idx}`} id={`${safePrefix}-sec-clip-${idx}`}>
                <rect x={sec.x0 + 4} y={sec.y0} width={Math.max(0, w - 8)} height={20} />
              </clipPath>
            );
          })}
          {layout.leafNodes.map((leaf) => {
            const w = Math.max(0, leaf.x1 - leaf.x0);
            const h = Math.max(0, leaf.y1 - leaf.y0);
            if (w < 34 || h < 18) return null;
            const sym = sanitizeId(leaf.data.stock?.symbol || leaf.data.name);
            return (
              <clipPath key={sym} id={`${safePrefix}-clip-${sym}`}>
                <rect
                  x={leaf.x0 + 2}
                  y={leaf.y0 + 2}
                  width={Math.max(0, w - 4)}
                  height={Math.max(0, h - 4)}
                  rx={2}
                />
              </clipPath>
            );
          })}
        </defs>

        {/* Sector Group Frames */}
        {layout.sectorNodes.map((sec, idx) => {
          const w = sec.x1 - sec.x0;
          const h = sec.y1 - sec.y0;
          const sectorCap = (sec.children || []).reduce(
            (s, c) => s + (c.data.stock?.marketCapCr || 0),
            0,
          );
          const sectorWeighted =
            sectorCap > 0
              ? (sec.children || []).reduce(
                  (s, c) =>
                    s + (c.data.stock?.changePct || 0) * (c.data.stock?.marketCapCr || 0),
                  0,
                ) / sectorCap
              : 0;

          return (
            <g key={sec.data.name}>
              <rect
                x={sec.x0}
                y={sec.y0}
                width={w}
                height={h}
                rx={5}
                className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-700"
                strokeWidth={1}
              />
              {w >= 65 && (
                <text
                  clipPath={`url(#${safePrefix}-sec-clip-${idx})`}
                  x={sec.x0 + 7}
                  y={sec.y0 + 13}
                  fontSize={10}
                  fontWeight={600}
                  className="fill-slate-700 dark:fill-slate-200"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {w >= 175
                    ? `${sec.data.name} (${formatSignedPct(sectorWeighted)})`
                    : sec.data.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Stock Tiles */}
        {layout.leafNodes.map((leaf) => {
          const stock = leaf.data.stock;
          if (!stock) return null;
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          if (w < 2 || h < 2) return null;

          const colors = getHeatmapTileColors(stock.changePct);
          const isHovered = hoveredSymbol === stock.symbol;
          const cx = leaf.x0 + w / 2;
          const cy = leaf.y0 + h / 2;

          const showFull = w >= 88 && h >= 54;
          const showMedium = !showFull && w >= 52 && h >= 32;
          const showCompact = !showFull && !showMedium && w >= 34 && h >= 18;
          const hasText = showFull || showMedium || showCompact;

          const baseFont = showFull
            ? w >= 145 && h >= 90
              ? 13.5
              : 11.5
            : showMedium
              ? 9.5
              : 8.5;
          const maxFitFont = Math.max(
            7.5,
            Math.floor((w - 8) / Math.max(stock.symbol.length * 0.64, 1)),
          );
          const symbolFontSize = Math.min(baseFont, maxFitFont);
          const maxChars = Math.max(3, Math.floor((w - 8) / (symbolFontSize * 0.64)));
          const displaySymbol =
            stock.symbol.length <= maxChars
              ? stock.symbol
              : `${stock.symbol.slice(0, Math.max(2, maxChars - 1))}…`;
          const pctFontSize = w >= 145 && h >= 90 ? 12 : 10;
          const safeSym = sanitizeId(stock.symbol);

          return (
            <g
              key={stock.symbol}
              role="button"
              tabIndex={hasText ? 0 : -1}
              aria-label={`${stock.symbol} ${stock.name}, ${formatSignedPct(stock.changePct)}, Market Cap ${formatMarketCapCr(stock.marketCapCr)}`}
              className="cursor-pointer focus:outline-none"
              onClick={() => onSelectStock(stock.symbol)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectStock(stock.symbol);
                }
              }}
              onMouseEnter={(e) => {
                setHoveredSymbol(stock.symbol);
                handlePointerMove(e, stock);
              }}
              onMouseMove={(e) => handlePointerMove(e, stock)}
              onMouseLeave={() => {
                setHoveredSymbol((prev) => (prev === stock.symbol ? null : prev));
                setTooltip((prev) => (prev?.stock.symbol === stock.symbol ? null : prev));
              }}
            >
              <rect
                x={leaf.x0}
                y={leaf.y0}
                width={w}
                height={h}
                rx={w >= 12 && h >= 12 ? 2.5 : 0.5}
                fill={colors.bg}
                stroke={isHovered ? undefined : colors.border}
                className={isHovered ? 'stroke-slate-900 dark:stroke-white' : undefined}
                strokeWidth={isHovered ? 1.8 : w >= 8 ? 0.8 : 0.35}
              />

              {hasText && (
                <g clipPath={`url(#${safePrefix}-clip-${safeSym})`} pointerEvents="none">
                  {showFull && (
                    <>
                      <text
                        x={cx}
                        y={cy - 10}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={symbolFontSize}
                        fontWeight={700}
                        fill={colors.text}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {displaySymbol}
                      </text>
                      <text
                        x={cx}
                        y={cy + 6}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={pctFontSize}
                        fontWeight={600}
                        fill={colors.text}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {formatSignedPct(stock.changePct)}
                      </text>
                      <text
                        x={cx}
                        y={cy + 20}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={9}
                        fontWeight={500}
                        fill={colors.subText}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {formatMarketCapCr(stock.marketCapCr)}
                      </text>
                    </>
                  )}

                  {showMedium && (
                    <>
                      <text
                        x={cx}
                        y={cy - 5.5}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={symbolFontSize}
                        fontWeight={700}
                        fill={colors.text}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {displaySymbol}
                      </text>
                      <text
                        x={cx}
                        y={cy + 7.5}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={9}
                        fontWeight={600}
                        fill={colors.text}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {formatSignedPct(stock.changePct)}
                      </text>
                    </>
                  )}

                  {showCompact && (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={symbolFontSize}
                      fontWeight={700}
                      fill={colors.text}
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {displaySymbol}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating Inspection Tooltip */}
      {tooltip && (
        <div
          style={{
            left: tooltip.x > size.width - 255 ? Math.max(8, tooltip.x - 248) : tooltip.x + 14,
            top: tooltip.y > size.height - 170 ? Math.max(8, tooltip.y - 160) : tooltip.y + 14,
          }}
          className="pointer-events-none absolute z-30 w-60 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {tooltip.stock.symbol}
              </div>
              <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {tooltip.stock.name}
              </div>
            </div>
            <span
              className={`shrink-0 font-mono text-xs font-semibold tabular-nums ${
                tooltip.stock.changePct > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : tooltip.stock.changePct < 0
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {formatSignedPct(tooltip.stock.changePct)}
            </span>
          </div>

          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 font-mono text-[11px] tabular-nums dark:border-slate-800">
            <div className="flex justify-between gap-3">
              <span className="font-sans text-slate-500 dark:text-slate-400">Category</span>
              <span className="truncate font-sans font-medium text-slate-800 dark:text-slate-200">
                {tooltip.stock.sector}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-sans text-slate-500 dark:text-slate-400">Close</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatINR(tooltip.stock.close)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-sans text-slate-500 dark:text-slate-400">Market cap</span>
              <span className="text-slate-800 dark:text-slate-200">
                {formatMarketCapCr(tooltip.stock.marketCapCr)} (
                {totalMarketCapCr > 0
                  ? `${((tooltip.stock.marketCapCr / totalMarketCapCr) * 100).toFixed(2)}%`
                  : '—'}
                )
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-sans text-slate-500 dark:text-slate-400">Turnover</span>
              <span className="text-slate-800 dark:text-slate-200">
                {formatCrores(tooltip.stock.turnoverCr)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-sans text-slate-500 dark:text-slate-400">RSI (14)</span>
              <span className="text-slate-800 dark:text-slate-200">
                {tooltip.stock.rsi14 !== null ? tooltip.stock.rsi14.toFixed(1) : '—'}
              </span>
            </div>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
            Click tile to open 5Y+ analysis
          </div>
        </div>
      )}
    </div>
  );
}

