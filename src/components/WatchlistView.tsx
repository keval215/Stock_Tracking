import { Plus, Search, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { filterWatchlistItems, getWatchlistSectorOptions } from '../shared/sectors';
import type {
  EnrichedWatchlist,
  SectorPerformanceSummary,
  StockSnapshot,
} from '../shared/types';
import {
  formatCrores,
  formatDateShort,
  formatINR,
  formatSignedPct,
} from '../utils/format';
import { SectorPerformanceWidget } from './SectorPerformanceWidget';

interface WatchlistViewProps {
  watchlists: EnrichedWatchlist[];
  sectorPerformance: SectorPerformanceSummary | null;
  tradeDate: string | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onSelectStock: (symbol: string) => void;
  onOpenScanner: (scannerId: string) => void;
}

export function WatchlistView({
  watchlists,
  sectorPerformance,
  tradeDate,
  loading,
  onRefresh,
  onSelectStock,
  onOpenScanner,
}: WatchlistViewProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [showNewListInput, setShowNewListInput] = useState(false);

  const [symbolQuery, setSymbolQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSnapshot[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filterScannerId, setFilterScannerId] = useState<string>('ALL');
  const [filterSector, setFilterSector] = useState<string>('ALL');

  useEffect(() => {
    if (watchlists.length > 0 && !watchlists.some((w) => w.id === activeId)) {
      setActiveId(watchlists[0].id);
    }
  }, [watchlists, activeId]);

  useEffect(() => {
    const q = symbolQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchMarket(q, 8);
        setSearchResults(res.results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [symbolQuery]);

  const activeWatchlist = watchlists.find((w) => w.id === activeId) || watchlists[0];

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newListName.trim();
    if (!trimmed) return;
    setCreatingList(true);
    setActionError(null);
    try {
      const res = await api.createWatchlist(trimmed);
      setNewListName('');
      setShowNewListInput(false);
      await onRefresh();
      setActiveId(res.watchlist.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create watchlist');
    } finally {
      setCreatingList(false);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    setActionError(null);
    try {
      await api.deleteWatchlist(id);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete watchlist');
    }
  };

  const handleAddSymbol = async (symbol: string) => {
    if (!activeWatchlist) return;
    setActionError(null);
    try {
      await api.addToWatchlist(activeWatchlist.id, symbol);
      setSymbolQuery('');
      setSearchResults([]);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not add symbol');
    }
  };

  const handleRemoveSymbol = async (symbol: string) => {
    if (!activeWatchlist) return;
    setActionError(null);
    try {
      await api.removeFromWatchlist(activeWatchlist.id, symbol);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove symbol');
    }
  };

  const scannerOptions = new Map<string, string>();
  if (activeWatchlist) {
    for (const item of activeWatchlist.items) {
      for (const sc of item.matchedScanners) {
        scannerOptions.set(sc.id, sc.name);
      }
    }
  }

  const sectorOptions = getWatchlistSectorOptions(activeWatchlist?.items || []);
  const effectiveFilterSector =
    filterSector === 'ALL' || sectorOptions.some((opt) => opt.sector === filterSector)
      ? filterSector
      : 'ALL';

  const visibleItems = filterWatchlistItems(
    activeWatchlist?.items || [],
    filterScannerId,
    effectiveFilterSector,
  );

  const gainersCount = (activeWatchlist?.items || []).filter(
    (i) => i.snapshot && i.snapshot.changePct > 0,
  ).length;
  const losersCount = (activeWatchlist?.items || []).filter(
    (i) => i.snapshot && i.snapshot.changePct < 0,
  ).length;
  const flatCount = (activeWatchlist?.items || []).filter(
    (i) => i.snapshot && i.snapshot.changePct === 0,
  ).length;
  const scannerHitCount = (activeWatchlist?.items || []).filter(
    (i) => i.matchedScanners.length > 0,
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Intro & Watchlist Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-100">
            Watchlist
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Your NSE stocks with the scanners they match
            {tradeDate ? `, as of the ${formatDateShort(tradeDate)} close` : ''}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
            {watchlists.map((wl) => (
              <button
                key={wl.id}
                type="button"
                onClick={() => {
                  setActiveId(wl.id);
                  setFilterScannerId('ALL');
                  setFilterSector('ALL');
                }}
                className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeWatchlist?.id === wl.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {wl.name} ({wl.items.length})
              </button>
            ))}
          </div>

          {!showNewListInput ? (
            <button
              type="button"
              onClick={() => setShowNewListInput(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New watchlist
            </button>
          ) : (
            <form onSubmit={handleCreateWatchlist} className="flex items-center gap-2">
              <label htmlFor="new-watchlist-name" className="sr-only">
                Watchlist name
              </label>
              <input
                id="new-watchlist-name"
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name"
                className="w-36 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={creatingList || !newListName.trim()}
                className="whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewListInput(false);
                  setNewListName('');
                }}
                className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Sector Performance Widget (Top 3 & Bottom 3 Nifty Sectors) */}
      <SectorPerformanceWidget
        performance={sectorPerformance}
        loading={loading}
        activeSector={effectiveFilterSector}
        availableWatchlistSectors={new Set(sectorOptions.map((o) => o.sector))}
        onSelectSector={setFilterSector}
      />

      {/* Summary Strip + Add Symbol Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Stocks tracked</span>
            <p className="text-xl font-medium text-slate-900 tabular-nums dark:text-slate-100">
              {activeWatchlist?.items.length ?? 0}
            </p>
          </div>
          <div className="hidden h-8 w-px bg-slate-200 sm:block dark:bg-slate-800" aria-hidden="true" />
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Adv / Dec{flatCount > 0 ? ' / Flat' : ''}
            </span>
            <p className="text-xl font-medium tabular-nums">
              <span className="text-emerald-700 dark:text-emerald-400">{gainersCount}</span>
              <span className="mx-1 text-slate-400 dark:text-slate-600">/</span>
              <span className="text-red-700 dark:text-red-400">{losersCount}</span>
              {flatCount > 0 && (
                <>
                  <span className="mx-1 text-slate-400 dark:text-slate-600">/</span>
                  <span className="text-slate-600 dark:text-slate-400">{flatCount}</span>
                </>
              )}
            </p>
          </div>
          <div className="hidden h-8 w-px bg-slate-200 sm:block dark:bg-slate-800" aria-hidden="true" />
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Scanner matches</span>
            <p className="text-xl font-medium text-accent-700 tabular-nums dark:text-accent-400">
              {scannerHitCount}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {sectorOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="wl-sector-filter"
                className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Sector
              </label>
              <select
                id="wl-sector-filter"
                value={effectiveFilterSector}
                onChange={(e) => setFilterSector(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-accent-500"
              >
                <option value="ALL">All sectors ({activeWatchlist?.items.length ?? 0})</option>
                {sectorOptions.map((opt) => (
                  <option key={opt.sector} value={opt.sector}>
                    {opt.label} ({opt.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {scannerOptions.size > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="wl-scanner-filter"
                className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Scanner
              </label>
              <select
                id="wl-scanner-filter"
                value={filterScannerId}
                onChange={(e) => setFilterScannerId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-accent-500"
              >
                <option value="ALL">All symbols</option>
                <option value="ANY_HIT">Any scanner match ({scannerHitCount})</option>
                {Array.from(scannerOptions.entries()).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Add NSE symbol Search */}
          <div className="relative">
            <label htmlFor="watchlist-add-symbol" className="sr-only">
              Add NSE stock to watchlist
            </label>
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="watchlist-add-symbol"
                type="text"
                value={symbolQuery}
                onChange={(e) => setSymbolQuery(e.target.value)}
                placeholder="Add a symbol, e.g. ZOMATO"
                className="w-64 rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
              />
            </div>

            {symbolQuery.trim() && (
              <div className="absolute right-0 z-30 mt-1 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {searching ? (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    Searching NSE symbols...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    No matching NSE equity found.
                  </div>
                ) : (
                  <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {searchResults.map((s) => {
                      const alreadyIn = activeWatchlist?.items.some((i) => i.symbol === s.symbol);
                      return (
                        <li key={s.symbol}>
                          <button
                            type="button"
                            disabled={alreadyIn}
                            onClick={() => handleAddSymbol(s.symbol)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {s.symbol}{' '}
                                <span className="font-sans font-normal text-slate-500 dark:text-slate-400">
                                  · {s.series}
                                </span>
                              </div>
                              <div className="truncate text-slate-500 dark:text-slate-400">{s.name}</div>
                            </div>
                            <div className="shrink-0 text-right tabular-nums">
                              <div className="text-slate-900 dark:text-slate-100">{formatINR(s.close)}</div>
                              <div className="text-accent-700 dark:text-accent-400">
                                {alreadyIn ? 'Added' : '+ Add'}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {watchlists.length > 1 && activeWatchlist && (
            <button
              type="button"
              onClick={() => handleDeleteWatchlist(activeWatchlist.id)}
              aria-label={`Delete watchlist ${activeWatchlist.name}`}
              className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-red-900/60 dark:hover:bg-red-950/50 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete list
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {actionError}
        </div>
      )}

      {/* Watchlist Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {activeWatchlist?.items.length === 0
                ? 'This watchlist has no stocks yet.'
                : 'No watchlist stocks match the selected filters.'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {activeWatchlist?.items.length === 0
                ? 'Use the search box above to add any NSE stock, or add symbols directly from Market Scanners.'
                : 'Adjust the Sector or Scanner filter above to view all tracked symbols.'}
            </p>
            {(effectiveFilterSector !== 'ALL' || filterScannerId !== 'ALL') &&
              (activeWatchlist?.items.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterSector('ALL');
                    setFilterScannerId('ALL');
                  }}
                  className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Clear filters
                </button>
              )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Symbol / Company</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Close</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">1D %</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">5D %</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">RSI (14)</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Rel. volume</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Turnover</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Scanner matches</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleItems.map((item) => {
                  const s = item.snapshot;
                  const pct = s?.changePct ?? 0;
                  const isPos = pct > 0;
                  const isNeg = pct < 0;
                  return (
                    <tr
                      key={item.symbol}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => onSelectStock(item.symbol)}
                          className="group text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 group-hover:text-accent-700 dark:text-slate-100 dark:group-hover:text-accent-400">
                              {item.symbol}
                            </span>
                            {item.sector && (
                              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {item.sector}
                              </span>
                            )}
                          </div>
                          <div className="max-w-[210px] truncate text-slate-500 dark:text-slate-400">
                            {s ? s.name : 'Pending NSE BhavCopy sync'}
                          </div>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-slate-900 tabular-nums dark:text-slate-100">
                        {s ? formatINR(s.close) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">
                        {s ? (
                          <span
                            className={`inline-flex items-center justify-end gap-1 ${
                              isPos
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : isNeg
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isPos && <TrendingUp className="h-3 w-3" aria-hidden="true" />}
                            {isNeg && <TrendingDown className="h-3 w-3" aria-hidden="true" />}
                            {formatSignedPct(s.changePct)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                          (s?.change5dPct ?? 0) > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : (s?.change5dPct ?? 0) < 0
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {s ? formatSignedPct(s.change5dPct) : '—'}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                          s?.rsi14 !== null && s?.rsi14 !== undefined && s.rsi14 >= 70
                            ? 'font-medium text-amber-700 dark:text-amber-400'
                            : s?.rsi14 !== null && s?.rsi14 !== undefined && s.rsi14 <= 35
                              ? 'font-medium text-slate-900 dark:text-white'
                              : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {s?.rsi14 !== null && s?.rsi14 !== undefined ? s.rsi14.toFixed(1) : '—'}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                          (s?.relVol ?? 0) >= 2
                            ? 'font-medium text-slate-900 dark:text-white'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {s?.relVol !== null && s?.relVol !== undefined ? `${s.relVol.toFixed(2)}x` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-700 tabular-nums dark:text-slate-300">
                        {s ? formatCrores(s.turnoverCr) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {item.matchedScanners.length === 0 ? (
                          <span className="text-slate-400 dark:text-slate-500">No active triggers</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.matchedScanners.slice(0, 2).map((sc) => (
                              <button
                                key={sc.id}
                                type="button"
                                onClick={() => onOpenScanner(sc.id)}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                              >
                                {sc.name}
                              </button>
                            ))}
                            {item.matchedScanners.length > 2 && (
                              <span
                                className="text-[11px] text-slate-500 dark:text-slate-400"
                                title={item.matchedScanners.slice(2).map((sc) => sc.name).join(', ')}
                              >
                                +{item.matchedScanners.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectStock(item.symbol)}
                            className="whitespace-nowrap rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Chart
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSymbol(item.symbol)}
                            aria-label={`Remove ${item.symbol} from ${activeWatchlist?.name}`}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:text-slate-500 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
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
  );
}
