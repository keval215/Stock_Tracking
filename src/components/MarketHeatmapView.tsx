import { ArrowLeft, Maximize2, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import {
  computeHeatmapAggregates,
  formatMarketCapCr,
  getHeatmapTileColors,
  groupStocksByCategory,
} from '../shared/heatmap';
import type { HeatmapUniverse, NiftyHeatmapResponse } from '../shared/types';
import { formatCrores, formatDateShort, formatINR, formatSignedPct } from '../utils/format';
import { NiftyHeatmapChart } from './NiftyHeatmapChart';

interface MarketHeatmapViewProps {
  onSelectStock: (symbol: string) => void;
}

const LEGEND_STEPS = [-3, -2, -1, 0, 1, 2, 3];
const CARD_PREVIEW_CAP = 70;

export function MarketHeatmapView({ onSelectStock }: MarketHeatmapViewProps) {
  const [universe, setUniverse] = useState<HeatmapUniverse>('ALL_NSE');
  const [data, setData] = useState<NiftyHeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'perCategory' | 'unified'>('perCategory');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [groupBySector, setGroupBySector] = useState<boolean>(true);
  const [sizeMetric, setSizeMetric] = useState<'marketCapCr' | 'turnoverCr'>('marketCapCr');
  const [searchQuery, setSearchQuery] = useState('');
  const [unifiedLimit, setUnifiedLimit] = useState<number>(250);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const loadHeatmap = useCallback(async (targetUniverse: HeatmapUniverse) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMarketHeatmap(targetUniverse);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load NSE market heatmap.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedSector('ALL');
    setExpandedCards({});
    void loadHeatmap(universe);
  }, [universe, loadHeatmap]);

  const searchedConstituents = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toUpperCase();
    if (!q) return data.constituents;
    return data.constituents.filter(
      (c) =>
        c.symbol.includes(q) ||
        c.name.toUpperCase().includes(q) ||
        c.sector.toUpperCase().includes(q),
    );
  }, [data, searchQuery]);

  const filteredConstituents = useMemo(() => {
    if (selectedSector === 'ALL') return searchedConstituents;
    return searchedConstituents.filter((c) => c.sector === selectedSector);
  }, [searchedConstituents, selectedSector]);

  const activeAgg = useMemo(
    () => computeHeatmapAggregates(filteredConstituents),
    [filteredConstituents],
  );

  const categoryGroups = useMemo(
    () => groupStocksByCategory(searchedConstituents),
    [searchedConstituents],
  );

  const focusedGroup = useMemo(
    () =>
      selectedSector !== 'ALL'
        ? categoryGroups.find((g) => g.sector === selectedSector) || null
        : null,
    [categoryGroups, selectedSector],
  );

  const { topGainer, topLoser } = useMemo(() => {
    if (!filteredConstituents.length) return { topGainer: null, topLoser: null };
    const sorted = [...filteredConstituents].sort((a, b) => b.changePct - a.changePct);
    return {
      topGainer: sorted[0],
      topLoser: sorted[sorted.length - 1],
    };
  }, [filteredConstituents]);

  const unifiedConstituents = useMemo(() => {
    if (unifiedLimit <= 0 || filteredConstituents.length <= unifiedLimit) {
      return filteredConstituents;
    }
    const sorted = [...filteredConstituents].sort((a, b) =>
      sizeMetric === 'turnoverCr' ? b.turnoverCr - a.turnoverCr : b.marketCapCr - a.marketCapCr,
    );
    return sorted.slice(0, unifiedLimit);
  }, [filteredConstituents, unifiedLimit, sizeMetric]);

  const universeLabel =
    universe === 'ALL_NSE' ? 'All NSE Equities' : universe === 'NIFTY_500' ? 'Nifty 500' : 'Nifty 50';

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-100">
            Market heatmap
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            {universeLabel}:{' '}
            {data
              ? `${data.constituents.length.toLocaleString('en-IN')} stocks in ${data.sectors.length} categories`
              : 'all stocks by category'}
            {data?.tradeDate ? `, as of the ${formatDateShort(data.tradeDate)} close` : ''}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Market universe"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {(
              [
                { id: 'ALL_NSE', label: 'All NSE' },
                { id: 'NIFTY_500', label: 'Nifty 500' },
                { id: 'NIFTY_50', label: 'Nifty 50' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setUniverse(opt.id)}
                className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 font-medium transition-colors ${
                  universe === opt.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadHeatmap(universe)}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-[340px] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadHeatmap(universe)}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Summary Breadth KPIs */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
            <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {selectedSector === 'ALL'
                  ? `${universeLabel} Cap-Weighted`
                  : `${selectedSector} Cap-Weighted`}
              </div>
              <div
                className={`mt-1 text-2xl font-medium tabular-nums ${
                  activeAgg.weightedChangePct > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : activeAgg.weightedChangePct < 0
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {formatSignedPct(activeAgg.weightedChangePct)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                Equal-weight: {formatSignedPct(activeAgg.avgChangePct)}
              </div>
            </div>

            <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Adv / Dec / Flat ({filteredConstituents.length.toLocaleString('en-IN')})
              </div>
              <div className="mt-1 text-2xl font-medium tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-400">
                  {activeAgg.advances.toLocaleString('en-IN')}
                </span>
                <span className="text-slate-400 dark:text-slate-600"> / </span>
                <span className="text-red-700 dark:text-red-400">
                  {activeAgg.declines.toLocaleString('en-IN')}
                </span>
                <span className="text-slate-400 dark:text-slate-600"> / </span>
                <span className="text-slate-700 dark:text-slate-300">
                  {activeAgg.unchanged.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                {filteredConstituents.length > 0 && (
                  <>
                    <div
                      className="bg-emerald-600 dark:bg-emerald-500"
                      style={{
                        width: `${(activeAgg.advances / filteredConstituents.length) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-slate-400 dark:bg-slate-600"
                      style={{
                        width: `${(activeAgg.unchanged / filteredConstituents.length) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-red-600 dark:bg-red-500"
                      style={{
                        width: `${(activeAgg.declines / filteredConstituents.length) * 100}%`,
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total market cap
              </div>
              <div className="mt-1 text-2xl font-medium text-slate-900 tabular-nums dark:text-slate-100">
                {formatMarketCapCr(activeAgg.totalMarketCapCr)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {selectedSector === 'ALL'
                  ? `Across ${categoryGroups.length} NSE categories`
                  : selectedSector}
              </div>
            </div>

            <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Session movers
              </div>
              <div className="mt-1.5 space-y-1 text-xs">
                {topGainer && (
                  <button
                    type="button"
                    onClick={() => onSelectStock(topGainer.symbol)}
                    className="flex w-full items-center justify-between gap-2 text-left hover:underline"
                  >
                    <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {topGainer.symbol}
                    </span>
                    <span className="shrink-0 font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
                      {formatSignedPct(topGainer.changePct)}
                      <span className="hidden sm:inline"> · {formatINR(topGainer.close)}</span>
                    </span>
                  </button>
                )}
                {topLoser && (
                  <button
                    type="button"
                    onClick={() => onSelectStock(topLoser.symbol)}
                    className="flex w-full items-center justify-between gap-2 text-left hover:underline"
                  >
                    <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {topLoser.symbol}
                    </span>
                    <span className="shrink-0 font-medium text-red-700 tabular-nums dark:text-red-400">
                      {formatSignedPct(topLoser.changePct)}
                      <span className="hidden sm:inline"> · {formatINR(topLoser.close)}</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Controls + Legend Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Layout Mode: By category vs Unified Treemap */}
              <div
                role="group"
                aria-label="Heatmap layout mode"
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('perCategory')}
                  className={`whitespace-nowrap shrink-0 rounded px-2.5 py-1 font-medium ${
                    viewMode === 'perCategory'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  By category
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('unified')}
                  className={`whitespace-nowrap shrink-0 rounded px-2.5 py-1 font-medium ${
                    viewMode === 'unified'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Whole market
                </button>
              </div>

              <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSizeMetric('marketCapCr')}
                  className={`whitespace-nowrap shrink-0 rounded px-2.5 py-1 font-medium ${
                    sizeMetric === 'marketCapCr'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Size: Market Cap
                </button>
                <button
                  type="button"
                  onClick={() => setSizeMetric('turnoverCr')}
                  className={`whitespace-nowrap shrink-0 rounded px-2.5 py-1 font-medium ${
                    sizeMetric === 'turnoverCr'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Size: Turnover
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="heatmap-sector-filter"
                  className="text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Category:
                </label>
                <select
                  id="heatmap-sector-filter"
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="ALL">
                    All categories ({searchedConstituents.length.toLocaleString('en-IN')})
                  </option>
                  {categoryGroups.map((grp) => (
                    <option key={grp.sector} value={grp.sector}>
                      {grp.sector} ({grp.stockCount})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                  aria-hidden="true"
                />
                <input
                  id="heatmap-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search symbol or category"
                  aria-label="Filter heatmap stocks by symbol or category"
                  className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pr-2.5 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-accent-600 focus:outline-none sm:w-56 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
                />
              </div>
            </div>

            {/* Color Scale Legend */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="mr-1 font-medium">1D %:</span>
              {LEGEND_STEPS.map((step) => {
                const c = getHeatmapTileColors(step);
                return (
                  <div
                    key={step}
                    style={{ backgroundColor: c.bg, color: c.text }}
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                  >
                    {step > 0 ? `+${step}%` : `${step}%`}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Focused Single-Category Deep View OR Per-Category Grid OR Unified Treemap */}
          {selectedSector !== 'ALL' && focusedGroup ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedSector('ALL')}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      All categories
                    </button>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {focusedGroup.sector} Category Heatmap ({focusedGroup.stockCount} NSE stocks)
                      </h2>
                      <p className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                        Cap-Weighted {formatSignedPct(focusedGroup.weightedChangePct)} · Equal-Weight{' '}
                        {formatSignedPct(focusedGroup.avgChangePct)} · {focusedGroup.advances} Up /{' '}
                        {focusedGroup.declines} Down · {formatMarketCapCr(focusedGroup.totalMarketCapCr)}
                      </p>
                    </div>
                  </div>
                </div>

                <NiftyHeatmapChart
                  constituents={focusedGroup.stocks}
                  totalMarketCapCr={focusedGroup.totalMarketCapCr}
                  groupBySector={false}
                  sizeMetric={sizeMetric}
                  onSelectStock={onSelectStock}
                  height={560}
                  idPrefix={`focus-${focusedGroup.sector}`}
                  ariaTitle={`${focusedGroup.sector} category heatmap covering all ${focusedGroup.stockCount} NSE stocks`}
                />
              </div>

              {/* Complete Stock Table for Focused Category */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    All {focusedGroup.stockCount} Stocks in {focusedGroup.sector}
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sorted by {sizeMetric === 'turnoverCr' ? 'Turnover' : 'Market Cap'}
                  </span>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950">
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-400">
                        <th className="whitespace-nowrap px-4 py-2.5">Symbol / Company</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right">Close</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right">1D %</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right">Market cap</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right">Turnover</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-right">RSI (14)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[...focusedGroup.stocks]
                        .sort((a, b) =>
                          sizeMetric === 'turnoverCr'
                            ? b.turnoverCr - a.turnoverCr
                            : b.marketCapCr - a.marketCapCr,
                        )
                        .map((st) => (
                          <tr key={st.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => onSelectStock(st.symbol)}
                                className="group text-left"
                              >
                                <div className="font-semibold text-slate-900 group-hover:text-accent-700 dark:text-slate-100 dark:group-hover:text-accent-400">
                                  {st.symbol}
                                </div>
                                <div className="max-w-[260px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                                  {st.name}
                                </div>
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right text-slate-900 tabular-nums dark:text-slate-100">
                              {formatINR(st.close)}
                            </td>
                            <td
                              className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${
                                st.changePct > 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : st.changePct < 0
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {formatSignedPct(st.changePct)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                              {formatMarketCapCr(st.marketCapCr)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                              {formatCrores(st.turnoverCr)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600 tabular-nums dark:text-slate-400">
                              {st.rsi14 !== null ? st.rsi14.toFixed(1) : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : viewMode === 'perCategory' ? (
            categoryGroups.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                No categories match &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {categoryGroups.map((grp, idx) => {
                  const isExpanded = Boolean(expandedCards[grp.sector]);
                  const sortedStocks =
                    sizeMetric === 'turnoverCr'
                      ? [...grp.stocks].sort((a, b) => b.turnoverCr - a.turnoverCr)
                      : grp.stocks;
                  const visibleStocks =
                    isExpanded || sortedStocks.length <= CARD_PREVIEW_CAP
                      ? sortedStocks
                      : sortedStocks.slice(0, CARD_PREVIEW_CAP);
                  const hiddenCount = sortedStocks.length - visibleStocks.length;

                  return (
                    <section
                      key={grp.sector}
                      aria-label={`${grp.sector} category heatmap`}
                      className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedSector(grp.sector)}
                              className="truncate text-sm font-semibold text-slate-900 hover:text-accent-700 hover:underline dark:text-slate-100 dark:hover:text-accent-400"
                            >
                              {grp.sector}
                            </button>
                            <span className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                              {grp.stockCount} stocks
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            <span
                              className={`font-semibold ${
                                grp.weightedChangePct > 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : grp.weightedChangePct < 0
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {formatSignedPct(grp.weightedChangePct)} cap-wt
                            </span>
                            <span>
                              <span className="text-emerald-700 dark:text-emerald-400">
                                {grp.advances}
                              </span>
                              /
                              <span className="text-red-700 dark:text-red-400">
                                {grp.declines}
                              </span>{' '}
                              A/D
                            </span>
                            <span>{formatMarketCapCr(grp.totalMarketCapCr)}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedSector(grp.sector)}
                          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Maximize2 className="h-3 w-3" aria-hidden="true" />
                          All {grp.stockCount}
                        </button>
                      </div>

                      <NiftyHeatmapChart
                        constituents={visibleStocks}
                        totalMarketCapCr={grp.totalMarketCapCr}
                        groupBySector={false}
                        sizeMetric={sizeMetric}
                        onSelectStock={onSelectStock}
                        height={265}
                        idPrefix={`cat-${idx}-${grp.sector}`}
                        ariaTitle={`${grp.sector} NSE category heatmap`}
                      />

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex flex-wrap items-center gap-3 tabular-nums">
                          {grp.topGainer && (
                            <button
                              type="button"
                              onClick={() => onSelectStock(grp.topGainer!.symbol)}
                              className="hover:underline"
                            >
                              <span className="font-sans text-slate-400 dark:text-slate-500">Top: </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {grp.topGainer.symbol}
                              </span>{' '}
                              <span className="text-emerald-700 dark:text-emerald-400">
                                {formatSignedPct(grp.topGainer.changePct)}
                              </span>
                            </button>
                          )}
                          {grp.topLoser && grp.topLoser.symbol !== grp.topGainer?.symbol && (
                            <button
                              type="button"
                              onClick={() => onSelectStock(grp.topLoser!.symbol)}
                              className="hover:underline"
                            >
                              <span className="font-sans text-slate-400 dark:text-slate-500">Lag: </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {grp.topLoser.symbol}
                              </span>{' '}
                              <span className="text-red-700 dark:text-red-400">
                                {formatSignedPct(grp.topLoser.changePct)}
                              </span>
                            </button>
                          )}
                        </div>

                        {hiddenCount > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCards((prev) => ({ ...prev, [grp.sector]: true }))
                            }
                            className="font-medium text-accent-700 hover:underline dark:text-accent-400"
                          >
                            +{hiddenCount} more stocks in map
                          </button>
                        ) : isExpanded && grp.stockCount > CARD_PREVIEW_CAP ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCards((prev) => ({ ...prev, [grp.sector]: false }))
                            }
                            className="font-medium text-slate-600 hover:underline dark:text-slate-400"
                          >
                            Show top {CARD_PREVIEW_CAP}
                          </button>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            )
          ) : (
            /* Unified Full-Market Treemap Mode */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setGroupBySector(true)}
                      className={`whitespace-nowrap rounded px-2 py-0.5 font-medium ${
                        groupBySector
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Group by Category
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupBySector(false)}
                      className={`whitespace-nowrap rounded px-2 py-0.5 font-medium ${
                        !groupBySector
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Flat market cap
                    </button>
                  </div>
                </div>

                {filteredConstituents.length > 250 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tile density
                    </span>
                    {[250, 500, 0].map((lim) => (
                      <button
                        key={lim}
                        type="button"
                        onClick={() => setUnifiedLimit(lim)}
                        className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                          unifiedLimit === lim
                            ? 'border-accent-200 bg-accent-50 text-accent-800 dark:border-accent-800 dark:bg-accent-950/60 dark:text-accent-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {lim === 0
                          ? `All (${filteredConstituents.length.toLocaleString('en-IN')})`
                          : `Top ${lim}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <NiftyHeatmapChart
                constituents={unifiedConstituents}
                totalMarketCapCr={data.totalMarketCapCr}
                groupBySector={groupBySector && selectedSector === 'ALL'}
                sizeMetric={sizeMetric}
                onSelectStock={onSelectStock}
                idPrefix="unified-market"
                ariaTitle={`${universeLabel} unified market treemap`}
              />
            </div>
          )}

          {/* Category Breadth Breakdown Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Category Breadth &amp; Weight Breakdown ({categoryGroups.length} categories ·{' '}
                {searchedConstituents.length.toLocaleString('en-IN')} stocks)
              </h2>
              {selectedSector !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedSector('ALL')}
                  className="text-xs font-medium text-accent-700 hover:underline dark:text-accent-400"
                >
                  Show All categories
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                    <th className="whitespace-nowrap px-4 py-2.5">Category</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right">Stocks</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right">Adv / Dec</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right">Market cap</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right">Market weight</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right">Avg 1D %</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right">Weighted 1D %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categoryGroups.map((sec) => {
                    const isSelected = selectedSector === sec.sector;
                    return (
                      <tr
                        key={sec.sector}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-accent-50/70 dark:bg-accent-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSector(isSelected ? 'ALL' : sec.sector)
                            }
                            className="font-medium text-slate-900 hover:text-accent-700 hover:underline dark:text-slate-100 dark:hover:text-accent-400"
                          >
                            {sec.sector}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {sec.stockCount.toLocaleString('en-IN')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                          <span className="text-emerald-700 dark:text-emerald-400">{sec.advances}</span>
                          <span className="text-slate-400 dark:text-slate-600"> / </span>
                          <span className="text-red-700 dark:text-red-400">{sec.declines}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-200">
                          {formatMarketCapCr(sec.totalMarketCapCr)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {sec.weightPct.toFixed(1)}%
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${
                            sec.avgChangePct > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : sec.avgChangePct < 0
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {formatSignedPct(sec.avgChangePct)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${
                            sec.weightedChangePct > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : sec.weightedChangePct < 0
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {formatSignedPct(sec.weightedChangePct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

