import {
  BellPlus,
  Check,
  ChevronDown,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Target,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { computeTargetDistancePct, TARGET_GOAL_META } from '../shared/targets';
import type {
  EnrichedWatchlist,
  HistoryRange,
  StockDetailResponse,
  StockHistoryResponse,
  StockResearchResponse,
  TargetMarkerGoal,
  TargetPriceMarker,
} from '../shared/types';
import {
  formatCrores,
  formatDateShort,
  formatINR,
  formatSignedPct,
  formatTimestamp,
  formatVolume,
} from '../utils/format';
import { CandlestickChart } from './CandlestickChart';
import {
  PriceTrendChart,
  TREND_INDICATORS,
  type TrendIndicatorKey,
} from './PriceTrendChart';

interface StockDetailDrawerProps {
  symbol: string | null;
  watchlists: EnrichedWatchlist[];
  onClose: () => void;
  onRefreshWatchlists: () => Promise<void>;
  onRefreshAlerts: () => Promise<void>;
  onOpenScanner: (scannerId: string) => void;
}

export function StockDetailDrawer({
  symbol,
  watchlists,
  onClose,
  onRefreshWatchlists,
  onRefreshAlerts,
  onOpenScanner,
}: StockDetailDrawerProps) {
  const [chartMode, setChartMode] = useState<'trend30d' | 'candlestick'>('trend30d');
  const [activeIndicators, setActiveIndicators] = useState<TrendIndicatorKey[]>(['sma5']);
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
  const indicatorMenuRef = useRef<HTMLDivElement | null>(null);

  const [trendRange, setTrendRange] = useState<HistoryRange>('30d');
  const [candleRange, setCandleRange] = useState<HistoryRange>('1y');
  const [detail, setDetail] = useState<StockDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<StockHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [research, setResearch] = useState<StockResearchResponse | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  const [targetMarkers, setTargetMarkers] = useState<TargetPriceMarker[]>([]);
  const [targetGoal, setTargetGoal] = useState<TargetMarkerGoal>('exit');
  const [targetPriceInput, setTargetPriceInput] = useState('');
  const [targetLabelInput, setTargetLabelInput] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);

  const [alertTarget, setAlertTarget] = useState('');
  const [alertOp, setAlertOp] = useState<'gte' | 'lte'>('gte');
  const [alertSaved, setAlertSaved] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (indicatorMenuOpen) {
          setIndicatorMenuOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [symbol, onClose, indicatorMenuOpen]);

  useEffect(() => {
    if (!indicatorMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        indicatorMenuRef.current &&
        !indicatorMenuRef.current.contains(e.target as Node)
      ) {
        setIndicatorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [indicatorMenuOpen]);

  // Reset symbol-scoped research/target draft & default trend range to 30 trading days on symbol change
  useEffect(() => {
    if (!symbol) {
      setHistory(null);
      setHistoryError(null);
      setResearch(null);
      setResearchError(null);
      setTargetMarkers([]);
      setTargetPriceInput('');
      setTargetLabelInput('');
      setTargetError(null);
      return;
    }
    setTrendRange('30d');
    setResearch(null);
    setResearchError(null);
    setTargetPriceInput('');
    setTargetLabelInput('');
    setTargetError(null);
  }, [symbol]);

  // Fetch historical trend series (defaults to 30D, supports up to 5Y / 10Y / MAX)
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    api
      .getStockHistory(symbol, 30, trendRange)
      .then((res) => {
        if (!cancelled) setHistory(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(
            err instanceof Error ? err.message : 'Failed to load historical price trend',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, trendRange]);

  useEffect(() => {
    if (!symbol) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setAlertSaved(false);
      try {
        const res = await api.getStockDetail(symbol, candleRange);
        if (!cancelled) {
          setDetail(res);
          setTargetMarkers(res.targetMarkers || []);
          setTargetPriceInput((prev) =>
            prev || String(Math.round(res.snapshot.close * 1.05)),
          );
          setAlertTarget(String(Math.round(res.snapshot.close * 1.02)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load stock details');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [symbol, candleRange]);

  if (!symbol) return null;

  const toggleIndicator = (key: TrendIndicatorKey) => {
    setActiveIndicators((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleAddTargetMarker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol) return;
    const num = Number(targetPriceInput);
    if (!Number.isFinite(num) || num <= 0) {
      setTargetError('Enter a valid positive price in ₹.');
      return;
    }
    setTargetSaving(true);
    setTargetError(null);
    try {
      const res = await api.createTargetMarker(symbol, {
        price: num,
        goal: targetGoal,
        label: targetLabelInput.trim(),
      });
      setTargetMarkers(res.targetMarkers);
      setTargetLabelInput('');
    } catch (err) {
      setTargetError(err instanceof Error ? err.message : 'Failed to save target marker.');
    } finally {
      setTargetSaving(false);
    }
  };

  const handleDeleteTargetMarker = async (id: string) => {
    if (!symbol) return;
    setTargetError(null);
    try {
      const res = await api.deleteTargetMarker(symbol, id);
      setTargetMarkers(res.targetMarkers);
    } catch (err) {
      setTargetError(err instanceof Error ? err.message : 'Failed to remove target marker.');
    }
  };

  const handleLoadResearch = async () => {
    if (!symbol) return;
    setResearchLoading(true);
    setResearchError(null);
    try {
      const res = await api.getStockResearch(symbol);
      setResearch(res);
    } catch (err) {
      setResearchError(
        err instanceof Error ? err.message : 'Failed to fetch Google Search market news.',
      );
    } finally {
      setResearchLoading(false);
    }
  };

  const toggleWatchlist = async (wlId: string, isIn: boolean) => {
    if (isIn) {
      await api.removeFromWatchlist(wlId, symbol);
    } else {
      await api.addToWatchlist(wlId, symbol);
    }
    const res = await api.getStockDetail(symbol, candleRange);
    setDetail(res);
    await onRefreshWatchlists();
  };

  const handleCreateQuickAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(alertTarget);
    if (!symbol || Number.isNaN(num)) return;
    await api.createPriceAlert({
      symbol,
      metric: 'close',
      operator: alertOp,
      targetValue: num,
    });
    setAlertSaved(true);
    await onRefreshAlerts();
  };

  const snap = detail?.snapshot;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-[1px] dark:bg-slate-950/70">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${symbol} equity analysis`}
        className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{symbol}</h2>
              {snap && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  NSE · {snap.series} · {formatDateShort(snap.tradeDate)}
                </span>
              )}
            </div>
            {snap && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{snap.name}</p>}
          </div>

          <div className="flex items-center gap-4">
            {snap && (
              <div className="text-right tabular-nums">
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatINR(snap.close)}
                </div>
                <div
                  className={`text-xs font-medium ${
                    snap.changePct > 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : snap.changePct < 0
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {snap.change > 0 ? '+' : ''}
                  {snap.change.toFixed(2)} ({formatSignedPct(snap.changePct)})
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close stock details"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {loading && !detail ? (
            <div className="space-y-4">
              <div className="h-64 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          ) : detail && snap ? (
            <>
              {/* Chart Mode Switcher + Historical Trend / Candlestick */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    role="tablist"
                    aria-label="Chart view mode"
                    className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={chartMode === 'trend30d'}
                      onClick={() => setChartMode('trend30d')}
                      className={`whitespace-nowrap shrink-0 rounded px-2.5 py-1 text-xs font-medium ${
                        chartMode === 'trend30d'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      30D Price Trend
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={chartMode === 'candlestick'}
                      onClick={() => setChartMode('candlestick')}
                      className={`whitespace-nowrap shrink-0 rounded px-2.5 py-1 text-xs font-medium ${
                        chartMode === 'candlestick'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      Candlestick &amp; SMA(20)
                    </button>
                  </div>

                  {chartMode === 'candlestick' ? (
                    <div
                      role="group"
                      aria-label="Candlestick timeframe"
                      className="flex flex-wrap items-center gap-0.5 rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      {(['3mo', '6mo', '1y', '3y', '5y', '10y', 'max'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setCandleRange(r)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase ${
                            candleRange === r
                              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                          }`}
                        >
                          {r === '3mo' ? '3M' : r === '6mo' ? '6M' : r}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        role="group"
                        aria-label="Price trend timeframe"
                        className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        {(['30d', '3mo', '6mo', '1y', '3y', '5y', '10y', 'max'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setTrendRange(r)}
                            className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium uppercase ${
                              trendRange === r
                                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                            }`}
                          >
                            {r === '3mo' ? '3M' : r === '6mo' ? '6M' : r}
                          </button>
                        ))}
                      </div>

                      <div ref={indicatorMenuRef} className="relative">
                        <button
                          type="button"
                          aria-haspopup="true"
                          aria-expanded={indicatorMenuOpen}
                          onClick={() => setIndicatorMenuOpen((open) => !open)}
                          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                          <span>Indicators ({activeIndicators.length})</span>
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                        </button>

                        {indicatorMenuOpen && (
                          <div
                            role="dialog"
                            aria-label="Technical indicator overlays"
                            className="absolute right-0 z-30 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                          >
                            {(['Moving Averages', 'Momentum Oscillator'] as const).map((group) => (
                              <div key={group} className="mb-2 last:mb-0">
                                <div className="px-1.5 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {group}
                                </div>
                                <div className="space-y-0.5">
                                  {TREND_INDICATORS.filter((ind) => ind.group === group).map(
                                    (ind) => {
                                      const checked = activeIndicators.includes(ind.key);
                                      return (
                                        <label
                                          key={ind.key}
                                          className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleIndicator(ind.key)}
                                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-accent-600 focus:ring-accent-500 dark:border-slate-600 dark:bg-slate-950"
                                          />
                                          <span
                                            aria-hidden="true"
                                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                                            style={{ backgroundColor: ind.color }}
                                          />
                                          <span className="min-w-0 flex-1">
                                            <span className="block font-medium text-slate-900 dark:text-slate-100">
                                              {ind.label}
                                            </span>
                                            <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                                              {ind.description}
                                            </span>
                                          </span>
                                        </label>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            ))}

                            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => setActiveIndicators(['sma5'])}
                                className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveIndicators([])}
                                className="font-medium text-slate-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400"
                              >
                                Clear all
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {chartMode === 'trend30d' ? (
                  historyLoading ? (
                    <div className="h-[310px] animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
                  ) : historyError ? (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                    >
                      {historyError}
                    </div>
                  ) : (
                    <PriceTrendChart
                      bars={history?.bars ?? detail.bars.slice(-30)}
                      lookbackBars={history?.lookbackBars ?? detail.bars}
                      rangeLabel={
                        trendRange === '3mo'
                          ? '3M'
                          : trendRange === '6mo'
                            ? '6M'
                            : trendRange.toUpperCase()
                      }
                      activeIndicators={activeIndicators}
                      targetMarkers={targetMarkers}
                      referenceClose={snap.close}
                      onPickTargetPrice={(price) => setTargetPriceInput(price.toFixed(2))}
                    />
                  )
                ) : loading ? (
                  <div className="h-[310px] animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" />
                ) : (
                  <CandlestickChart bars={detail.bars} targetMarkers={targetMarkers} />
                )}

                {/* 5-Year Historical Performance Strip */}
                {(history?.multiYearSummary || detail.multiYearSummary) && (() => {
                  const my = history?.multiYearSummary || detail.multiYearSummary!;
                  const retItems = [
                    { label: '30D', val: my.return30dPct },
                    { label: '1Y', val: my.return1yPct },
                    { label: '3Y', val: my.return3yPct },
                    { label: '5Y Return', val: my.return5yPct },
                    { label: '5Y CAGR', val: my.cagr5yPct },
                  ];
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Multi-Year Historical Performance (5Y+ Data)
                        </span>
                        <span className="tabular-nums">
                          {my.totalBars.toLocaleString('en-IN')} sessions
                          {my.firstDate ? ` since ${formatDateShort(my.firstDate)}` : ''} ·{' '}
                          {(history?.source ?? detail.barSource) === 'yahoo'
                            ? 'NSE / Yahoo Finance'
                            : 'NSE BhavCopy'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {retItems.map((item) => (
                          <div
                            key={item.label}
                            className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900"
                          >
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.label}</div>
                            <div
                              className={`mt-0.5 text-xs font-semibold tabular-nums ${
                                item.val === null
                                  ? 'text-slate-400 dark:text-slate-500'
                                  : item.val > 0
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : item.val < 0
                                      ? 'text-red-700 dark:text-red-400'
                                      : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.val !== null ? formatSignedPct(item.val) : '—'}
                            </div>
                          </div>
                        ))}
                        <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">5Y Low / High</div>
                          <div className="mt-0.5 text-[11px] font-medium text-slate-900 tabular-nums dark:text-slate-100">
                            {my.low5y !== null && my.high5y !== null
                              ? `₹${Math.round(my.low5y).toLocaleString('en-IN')} – ₹${Math.round(my.high5y).toLocaleString('en-IN')}`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Visual Price targets Controls */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/75 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <Target className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" aria-hidden="true" />
                      <span>Price targets ({targetMarkers.length})</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {chartMode === 'trend30d'
                        ? 'Click any point on chart or enter a price goal'
                        : 'Overlaid across trend & candlestick charts'}
                    </span>
                  </div>

                  <form
                    onSubmit={handleAddTargetMarker}
                    className="mt-2.5 flex flex-wrap items-center gap-2"
                  >
                    <select
                      aria-label="Target marker goal"
                      value={targetGoal}
                      onChange={(e) => {
                        const next = e.target.value as TargetMarkerGoal;
                        setTargetGoal(next);
                        if (snap) {
                          const mult = next === 'exit' ? 1.05 : next === 'entry' ? 0.97 : 0.94;
                          setTargetPriceInput(String(Math.round(snap.close * mult)));
                        }
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="exit">Exit target</option>
                      <option value="entry">Entry goal</option>
                      <option value="stop">Stop loss</option>
                    </select>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1.5 text-xs text-slate-400 dark:text-slate-500">
                        ₹
                      </span>
                      <input
                        aria-label="Target marker price"
                        type="number"
                        step="any"
                        min="0.01"
                        value={targetPriceInput}
                        onChange={(e) => setTargetPriceInput(e.target.value)}
                        placeholder="Price"
                        className="w-28 rounded-md border border-slate-300 bg-white py-1.5 pr-2 pl-6 text-xs text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <input
                      aria-label="Target marker label"
                      type="text"
                      maxLength={40}
                      value={targetLabelInput}
                      onChange={(e) => setTargetLabelInput(e.target.value)}
                      placeholder="Label (optional, e.g. Breakout)"
                      className="min-w-[140px] flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />

                    <button
                      type="submit"
                      disabled={targetSaving}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      {targetSaving ? 'Saving…' : 'Add Marker'}
                    </button>
                  </form>

                  {targetError && (
                    <p role="alert" className="mt-1.5 text-[11px] font-medium text-red-700 dark:text-red-400">
                      {targetError}
                    </p>
                  )}

                  {targetMarkers.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {targetMarkers.map((m) => {
                        const meta = TARGET_GOAL_META[m.goal];
                        const distPct = computeTargetDistancePct(m.price, snap.close);
                        return (
                          <div
                            key={m.id}
                            style={{
                              backgroundColor: meta.bgTint,
                              borderColor: meta.borderTint,
                            }}
                            className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs"
                          >
                            <span
                              style={{ color: meta.color }}
                              className="text-[10px] font-semibold tracking-wide"
                            >
                              {meta.shortTag}
                            </span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {formatINR(m.price)}
                            </span>
                            {m.label && (
                              <span className="text-[11px] text-slate-700">· {m.label}</span>
                            )}
                            <span
                              className={`text-[11px] font-medium tabular-nums ${
                                distPct >= 0 ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              ({distPct > 0 ? '+' : ''}
                              {distPct.toFixed(1)}%)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTargetMarker(m.id)}
                              aria-label={`Remove ${meta.label} ${formatINR(m.price)}`}
                              className="rounded p-0.5 text-slate-600 hover:bg-white/70 hover:text-slate-900"
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Indicators Grid */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Technical readout
                </h3>
                <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Open / Prev Close</div>
                    <div className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                      {formatINR(snap.open)} / {formatINR(snap.prevClose)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Day high / low</div>
                    <div className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                      {formatINR(snap.high)} / {formatINR(snap.low)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">RSI (14)</div>
                    <div className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                      {snap.rsi14 !== null ? snap.rsi14.toFixed(2) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Relative volume</div>
                    <div className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                      {snap.relVol !== null ? `${snap.relVol.toFixed(2)}x` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">SMA (20)</div>
                    <div className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                      {formatINR(snap.sma20)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">SMA (50)</div>
                    <div className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                      {formatINR(snap.sma50)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">20D High / Low</div>
                    <div className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                      {formatINR(snap.high20d)} / {formatINR(snap.low20d)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Turnover / Volume</div>
                    <div className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                      {formatCrores(snap.turnoverCr)} ({formatVolume(snap.volume)})
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Scanner Hits */}
              <div>
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Matching Scanners ({detail.matchedScanners.length})
                </h3>
                {detail.matchedScanners.length === 0 ? (
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {symbol} does not currently trigger any saved scanners on the latest EOD close.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.matchedScanners.map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenScanner(sc.id);
                        }}
                        className="rounded border border-accent-200 bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-800 hover:bg-accent-100 dark:border-accent-800/70 dark:bg-accent-950/60 dark:text-accent-300 dark:hover:bg-accent-900/60"
                      >
                        {sc.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Latest News & Catalysts (Google Search Grounding) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
                    <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Latest News &amp; Catalysts (Google Search)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadResearch}
                    disabled={researchLoading}
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${researchLoading ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    {researchLoading
                      ? 'Searching…'
                      : research
                        ? 'Refresh News'
                        : 'Search Latest News'}
                  </button>
                </div>

                {researchLoading && !research ? (
                  <div className="mt-3 space-y-2">
                    <div className="h-3.5 w-11/12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3.5 w-10/12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3.5 w-8/12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                ) : researchError ? (
                  <div
                    role="alert"
                    className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                  >
                    {researchError}
                  </div>
                ) : research ? (
                  <div className="mt-3 space-y-3">
                    <ul className="space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      {research.summary
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line, i) => {
                          const clean = line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '');
                          return (
                            <li key={i} className="flex items-start gap-2">
                              <span
                                aria-hidden="true"
                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500"
                              />
                              <span>{clean}</span>
                            </li>
                          );
                        })}
                    </ul>

                    {research.sources.length > 0 && (
                      <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Sources
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {research.sources.map((src) => (
                            <a
                              key={src.uri}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-xs items-center gap-1 truncate rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-accent-500 dark:hover:bg-accent-950/50 dark:hover:text-accent-300"
                            >
                              <span className="truncate">{src.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      Updated {formatTimestamp(research.generatedAt)}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Fetch recent NSE filings, earnings, and market catalysts for {symbol} grounded
                    in Google Search.
                  </p>
                )}
              </div>

              {/* Watchlists & Quick Price Alert */}
              <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-slate-800">
                <div>
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Save to Watchlist
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {watchlists.map((wl) => {
                      const isIn = detail.inWatchlists.includes(wl.id);
                      return (
                        <button
                          key={wl.id}
                          type="button"
                          onClick={() => toggleWatchlist(wl.id, isIn)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                            isIn
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {isIn ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {wl.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Price alert
                  </h3>
                  <form onSubmit={handleCreateQuickAlert} className="mt-2 flex items-center gap-2">
                    <select
                      aria-label="Alert operator"
                      value={alertOp}
                      onChange={(e) => setAlertOp(e.target.value as 'gte' | 'lte')}
                      className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="gte">&gt;=</option>
                      <option value="lte">&lt;=</option>
                    </select>
                    <input
                      aria-label="Target close price"
                      type="number"
                      step="any"
                      value={alertTarget}
                      onChange={(e) => setAlertTarget(e.target.value)}
                      className="w-24 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      <BellPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      Set alert
                    </button>
                  </form>
                  {alertSaved && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      Alert rule saved for post-market EOD evaluation.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
