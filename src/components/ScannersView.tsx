import {
  ArrowDownUp,
  Bell,
  BellOff,
  BookmarkPlus,
  Check,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatConditionSummary } from '../shared/indicators';
import type {
  EnrichedWatchlist,
  MarketStatus,
  ScannerDefinition,
  ScannerSummary,
  StockSnapshot,
} from '../shared/types';
import {
  formatCrores,
  formatDateShort,
  formatINR,
  formatSignedPct,
} from '../utils/format';

interface ScannersViewProps {
  scanners: ScannerSummary[];
  selectedScannerId: string;
  onSelectScannerId: (id: string) => void;
  marketStatus: MarketStatus | null;
  watchlists: EnrichedWatchlist[];
  onRefreshAll: () => Promise<void>;
  onSelectStock: (symbol: string) => void;
  onOpenBuilder: () => void;
}

type SortKey = 'turnoverCr' | 'changePct' | 'change5dPct' | 'relVol' | 'rsi14' | 'close' | 'symbol';

export function ScannersView({
  scanners,
  selectedScannerId,
  onSelectScannerId,
  marketStatus,
  watchlists,
  onRefreshAll,
  onSelectStock,
  onOpenBuilder,
}: ScannersViewProps) {
  const [activeScanner, setActiveScanner] = useState<ScannerDefinition | null>(null);
  const [results, setResults] = useState<StockSnapshot[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalUniverse, setTotalUniverse] = useState(0);
  const [loadingResults, setLoadingResults] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('turnoverCr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [targetWatchlistId, setTargetWatchlistId] = useState<string>('');
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [scannerListQuery, setScannerListQuery] = useState<string>('');

  useEffect(() => {
    if (watchlists.length > 0 && !watchlists.some((w) => w.id === targetWatchlistId)) {
      setTargetWatchlistId(watchlists[0].id);
    }
  }, [watchlists, targetWatchlistId]);

  useEffect(() => {
    if (!selectedScannerId && scanners.length > 0) {
      onSelectScannerId(scanners[0].id);
    }
  }, [scanners, selectedScannerId, onSelectScannerId]);

  useEffect(() => {
    if (!selectedScannerId) return;
    let cancelled = false;
    const load = async () => {
      setLoadingResults(true);
      setErrorMsg(null);
      try {
        const res = await api.getScannerResults(selectedScannerId, searchTerm, sortBy, sortDir);
        if (!cancelled) {
          setActiveScanner(res.scanner);
          setResults(res.results);
          setTotalMatches(res.totalMatches);
          setTotalUniverse(res.totalUniverse);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to run scanner');
        }
      } finally {
        if (!cancelled) setLoadingResults(false);
      }
    };
    const t = setTimeout(load, searchTerm ? 150 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [selectedScannerId, searchTerm, sortBy, sortDir]);

  const handleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'symbol' ? 'asc' : 'desc');
    }
  };

  const handleToggleAlert = async (scanner: ScannerSummary) => {
    try {
      await api.updateScanner(scanner.id, { afterMarketAlert: !scanner.afterMarketAlert });
      await onRefreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update alert preference');
    }
  };

  const handleDeleteCustom = async (id: string) => {
    try {
      await api.deleteScanner(id);
      const next = scanners.find((s) => s.id !== id);
      if (next) onSelectScannerId(next.id);
      await onRefreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete scanner');
    }
  };

  const handleAddToWatchlist = async (symbol: string) => {
    if (!targetWatchlistId) return;
    setAddingSymbol(symbol);
    try {
      await api.addToWatchlist(targetWatchlistId, symbol);
      await onRefreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add to watchlist');
    } finally {
      setAddingSymbol(null);
    }
  };

  const targetWl = watchlists.find((w) => w.id === targetWatchlistId);
  const watchedSet = new Set((targetWl?.items || []).map((i) => i.symbol));

  const categoryCounts = new Map<string, number>();
  for (const sc of scanners) {
    const cat = sc.isBuiltIn ? sc.category : 'Custom';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  const filteredScanners = scanners.filter((sc) => {
    const cat = sc.isBuiltIn ? sc.category : 'Custom';
    if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false;
    const q = scannerListQuery.trim().toLowerCase();
    if (q && !sc.name.toLowerCase().includes(q) && !sc.description.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Market Breadth Strip */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-100">
            Scanners
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            {marketStatus
              ? `${marketStatus.totalSymbols.toLocaleString('en-IN')} NSE stocks, as of the ${formatDateShort(marketStatus.tradeDate)} close, with ${marketStatus.historyDaysLoaded} sessions of history.`
              : 'Every NSE stock, scanned at the latest close.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenBuilder}
          className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Build a scanner
        </button>
      </div>

      {/* Market Breadth KPI Row */}
      {marketStatus && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Stocks indexed</div>
            <div className="mt-1 text-2xl font-medium text-slate-900 tabular-nums dark:text-slate-100">
              {marketStatus.totalSymbols.toLocaleString('en-IN')}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {marketStatus.eqSymbols.toLocaleString('en-IN')} EQ · all series
            </div>
          </div>
          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Market breadth</div>
            <div className="mt-1 text-2xl font-medium tabular-nums">
              <span className="text-emerald-700 dark:text-emerald-400">{marketStatus.advances}</span>
              <span className="mx-1.5 text-slate-300 dark:text-slate-700">/</span>
              <span className="text-red-700 dark:text-red-400">{marketStatus.declines}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Advances / Declines
            </div>
          </div>
          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Cash turnover</div>
            <div className="mt-1 text-2xl font-medium text-slate-900 tabular-nums dark:text-slate-100">
              ₹{marketStatus.totalTurnoverCr.toLocaleString('en-IN')} Cr
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              NSE BhavCopy
            </div>
          </div>
          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Scanner matches</div>
            <div className="mt-1 text-2xl font-medium text-accent-700 tabular-nums dark:text-accent-400">
              {totalMatches}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Out of {totalUniverse.toLocaleString('en-IN')} symbols
            </div>
          </div>
        </div>
      )}

      {/* Scanner Selector Grid + Results */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left List: Built-In & Custom Scanners */}
        <div className="space-y-2.5 lg:col-span-4">
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>
              Scanners ({filteredScanners.length}/{scanners.length})
            </span>
            <span className="font-normal text-slate-500 dark:text-slate-400">Alert</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="scanner-category-filter" className="sr-only">
                Filter scanners by category
              </label>
              <select
                id="scanner-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-accent-500"
              >
                <option value="ALL">All categories ({scanners.length})</option>
                {Array.from(categoryCounts.entries()).map(([cat, count]) => (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label htmlFor="scanner-list-search" className="sr-only">
                Search scanners by name
              </label>
              <Search
                className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="scanner-list-search"
                type="text"
                value={scannerListQuery}
                onChange={(e) => setScannerListQuery(e.target.value)}
                placeholder="Find a scanner"
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-2.5 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
              />
            </div>
          </div>

          <div className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filteredScanners.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No scanners match your filter.
              </div>
            ) : (
              filteredScanners.map((sc) => {
                const isSelected = sc.id === selectedScannerId;
                return (
                  <div
                    key={sc.id}
                    className={`flex items-start justify-between gap-3 p-3.5 transition-colors ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-white/[0.06]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectScannerId(sc.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`truncate text-sm font-semibold ${
                            isSelected
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {sc.name}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{sc.isBuiltIn ? sc.category : 'Custom Scanner'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-slate-700 tabular-nums dark:text-slate-300">
                          {sc.matchCount} hits
                        </span>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleAlert(sc)}
                        aria-label={`${sc.afterMarketAlert ? 'Disable' : 'Enable'} after-market alert for ${sc.name}`}
                        title={
                          sc.afterMarketAlert
                            ? 'After-market alert enabled'
                            : 'After-market alert disabled'
                        }
                        className={`rounded p-1.5 transition-colors ${
                          sc.afterMarketAlert
                            ? 'text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                        }`}
                      >
                        {sc.afterMarketAlert ? (
                          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>

                      {!sc.isBuiltIn && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustom(sc.id)}
                          aria-label={`Delete custom scanner ${sc.name}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:text-slate-500 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Scanner Rule Details & Matched Stocks Table */}
        <div className="space-y-4 lg:col-span-8">
          {activeScanner && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {activeScanner.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {activeScanner.description}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Universe: {activeScanner.seriesFilter} · Min ₹{activeScanner.minClose} · Min{' '}
                    {activeScanner.minTurnoverCr} Cr
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Rules ({activeScanner.logic}):
                </span>
                {activeScanner.conditions.map((c, idx) => (
                  <span key={c.id} className="text-slate-800 dark:text-slate-200">
                    {idx > 0 && (
                      <span className="mr-2 font-sans text-slate-400 dark:text-slate-500">
                        {activeScanner.logic}
                      </span>
                    )}
                    {formatConditionSummary(c)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filter & Target Watchlist Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <label htmlFor="scanner-result-filter" className="sr-only">
                Filter matched symbols
              </label>
              <Search
                className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="scanner-result-filter"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter matches"
                className="w-56 rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
              />
            </div>

            {watchlists.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="scanner-target-wl"
                  className="text-xs text-slate-600 dark:text-slate-400"
                >
                  Quick-add to:
                </label>
                <select
                  id="scanner-target-wl"
                  value={targetWatchlistId}
                  onChange={(e) => setTargetWatchlistId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-accent-500"
                >
                  {watchlists.map((wl) => (
                    <option key={wl.id} value={wl.id}>
                      {wl.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {errorMsg}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {loadingResults ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  No NSE equities matched this scanner on the latest session.
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Try clearing the symbol filter or adjusting rule thresholds in the Scanner Builder.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                      <th className="whitespace-nowrap px-4 py-2.5 font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('symbol')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Symbol
                          <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('close')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Close
                        </button>
                      </th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('changePct')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          1D %
                        </button>
                      </th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('change5dPct')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          5D %
                        </button>
                      </th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('rsi14')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          RSI 14
                        </button>
                      </th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('relVol')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Rel Vol
                        </button>
                      </th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('turnoverCr')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          Turnover
                        </button>
                      </th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                        Watchlist
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {results.map((s) => {
                      const inWl = watchedSet.has(s.symbol);
                      return (
                        <tr
                          key={s.symbol}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                        >
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => onSelectStock(s.symbol)}
                              className="group text-left"
                            >
                              <div className="font-semibold text-slate-900 group-hover:text-accent-700 dark:text-slate-100 dark:group-hover:text-accent-400">
                                {s.symbol}
                              </div>
                              <div className="max-w-[180px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {s.name}
                              </div>
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-900 tabular-nums dark:text-slate-100">
                            {formatINR(s.close)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums ${
                              s.changePct > 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : s.changePct < 0
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {formatSignedPct(s.changePct)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${
                              (s.change5dPct ?? 0) > 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : (s.change5dPct ?? 0) < 0
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {formatSignedPct(s.change5dPct)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                            {s.rsi14 !== null ? s.rsi14.toFixed(1) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                            {s.relVol !== null ? `${s.relVol.toFixed(2)}x` : '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                            {formatCrores(s.turnoverCr)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={inWl || addingSymbol === s.symbol}
                              onClick={() => handleAddToWatchlist(s.symbol)}
                              aria-label={
                                inWl
                                  ? `${s.symbol} already in watchlist`
                                  : `Add ${s.symbol} to watchlist`
                              }
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-1 text-[11px] font-medium ${
                                inWl
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-accent-300 hover:text-accent-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-accent-500 dark:hover:text-accent-400'
                              }`}
                            >
                              {inWl ? (
                                <>
                                  <Check className="h-3 w-3" aria-hidden="true" />
                                  Saved
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus className="h-3 w-3" aria-hidden="true" />
                                  Add
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
