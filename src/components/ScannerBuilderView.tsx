import { Play, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { METRIC_MAP, SCANNER_METRICS } from '../shared/indicators';
import type {
  ScannerCondition,
  ScannerMetric,
  ScannerOperator,
  SeriesFilter,
  StockSnapshot,
} from '../shared/types';
import { formatCrores, formatINR, formatSignedPct } from '../utils/format';

interface ScannerBuilderViewProps {
  onScannerCreated: (scannerId: string) => Promise<void>;
  onSelectStock: (symbol: string) => void;
}

function makeCondition(
  metric: ScannerMetric = 'changePct',
  operator: ScannerOperator = 'gte',
  value = 2,
): ScannerCondition {
  return {
    id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    metric,
    operator,
    compareToType: 'value',
    value,
    compareMetric: 'sma20',
    multiplier: 1,
  };
}

export function ScannerBuilderView({
  onScannerCreated,
  onSelectStock,
}: ScannerBuilderViewProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [seriesFilter, setSeriesFilter] = useState<SeriesFilter>('EQ');
  const [minClose, setMinClose] = useState(50);
  const [minTurnoverCr, setMinTurnoverCr] = useState(5);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [afterMarketAlert, setAfterMarketAlert] = useState(true);
  const [conditions, setConditions] = useState<ScannerCondition[]>([
    makeCondition('changePct', 'gte', 2),
    makeCondition('relVol', 'gte', 1.5),
    {
      id: 'cond-sma',
      metric: 'close',
      operator: 'gt',
      compareToType: 'metric',
      compareMetric: 'sma20',
      multiplier: 1,
    },
  ]);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [totalUniverse, setTotalUniverse] = useState<number>(0);
  const [previewResults, setPreviewResults] = useState<StockSnapshot[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runPreview = async () => {
    setPreviewLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.previewScanner({
        name: name || 'Draft Scanner',
        seriesFilter,
        minClose,
        minTurnoverCr,
        logic,
        conditions,
      });
      setPreviewCount(res.matchCount);
      setTotalUniverse(res.totalUniverse);
      setPreviewResults(res.results);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Preview scan failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void runPreview();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesFilter, minClose, minTurnoverCr, logic, conditions]);

  const updateCondition = (id: string, patch: Partial<ScannerCondition>) => {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.metric && METRIC_MAP.get(patch.metric)?.isBoolean) {
          next.operator = 'eq';
          next.compareToType = 'value';
          next.value = 1;
        }
        return next;
      }),
    );
  };

  const applyTemplate = (preset: 'breakout' | 'oversold' | 'ema') => {
    if (preset === 'breakout') {
      setName('High-Volume 20D Breakout');
      setDescription('Liquid EQ stocks near 20-day highs on 1.8x+ relative volume');
      setSeriesFilter('EQ');
      setMinClose(50);
      setMinTurnoverCr(10);
      setLogic('AND');
      setConditions([
        makeCondition('distFromHigh20dPct', 'gte', -1),
        makeCondition('relVol', 'gte', 1.8),
        makeCondition('changePct', 'gte', 1.5),
      ]);
    } else if (preset === 'oversold') {
      setName('Oversold Reversal Swing');
      setDescription('RSI <= 35 equities turning green on higher turnover');
      setSeriesFilter('EQ');
      setMinClose(40);
      setMinTurnoverCr(5);
      setLogic('AND');
      setConditions([
        makeCondition('rsi14', 'lte', 35),
        makeCondition('changePct', 'gt', 0.5),
      ]);
    } else {
      setName('Trend Pullback Above SMA50');
      setDescription('Stocks above SMA50 with EMA9 > EMA20 and positive 5D momentum');
      setSeriesFilter('EQ');
      setMinClose(100);
      setMinTurnoverCr(10);
      setLogic('AND');
      setConditions([
        {
          id: `c-${Date.now()}-1`,
          metric: 'close',
          operator: 'gt',
          compareToType: 'metric',
          compareMetric: 'sma50',
          multiplier: 1,
        },
        {
          id: `c-${Date.now()}-2`,
          metric: 'ema9',
          operator: 'gt',
          compareToType: 'metric',
          compareMetric: 'ema20',
          multiplier: 1,
        },
        makeCondition('change5dPct', 'gte', 1),
      ]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a scanner name before saving.');
      return;
    }
    if (conditions.length === 0) {
      setErrorMsg('Add at least one technical rule.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.createScanner({
        name: name.trim(),
        description: description.trim(),
        seriesFilter,
        minClose,
        minTurnoverCr,
        logic,
        conditions,
        afterMarketAlert,
      });
      await onScannerCreated(res.scanner.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save scanner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-100">
            Scanner builder
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Combine price, moving average, RSI and volume rules, then run them across{' '}
            {totalUniverse > 0 ? totalUniverse.toLocaleString('en-IN') : 'all'} NSE stocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Start from</span>
          <button
            type="button"
            onClick={() => applyTemplate('breakout')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            20D Breakout
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('oversold')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            RSI Reversal
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('ema')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Trend &amp; EMA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Builder Form */}
        <form
          onSubmit={handleSave}
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="scanner-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Scanner name
              </label>
              <input
                id="scanner-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Midcap Volume Breakout"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="scanner-desc"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Description (optional)
              </label>
              <input
                id="scanner-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the setup"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
              />
            </div>
          </div>

          {/* Universe Filters */}
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Universe filters
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="series-filter"
                  className="block text-[11px] text-slate-600 dark:text-slate-400"
                >
                  NSE Series
                </label>
                <select
                  id="series-filter"
                  value={seriesFilter}
                  onChange={(e) => setSeriesFilter(e.target.value as SeriesFilter)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-accent-500"
                >
                  <option value="EQ">EQ (Main Equity)</option>
                  <option value="ALL">all series (EQ/BE/SM)</option>
                  <option value="SM">SM (SME Emerge)</option>
                  <option value="BE">BE (Trade-to-Trade)</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="min-close"
                  className="block text-[11px] text-slate-600 dark:text-slate-400"
                >
                  Min Price (₹)
                </label>
                <input
                  id="min-close"
                  type="number"
                  min={0}
                  value={minClose}
                  onChange={(e) => setMinClose(Math.max(0, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-accent-500"
                />
              </div>
              <div>
                <label
                  htmlFor="min-turnover"
                  className="block text-[11px] text-slate-600 dark:text-slate-400"
                >
                  Min turnover (Cr)
                </label>
                <input
                  id="min-turnover"
                  type="number"
                  min={0}
                  step="0.5"
                  value={minTurnoverCr}
                  onChange={(e) => setMinTurnoverCr(Math.max(0, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-accent-500"
                />
              </div>
            </div>
          </div>

          {/* Condition Rules */}
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Conditions
              </h2>
              <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setLogic('AND')}
                  className={`rounded px-2 py-0.5 font-medium ${
                    logic === 'AND'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Match ALL (AND)
                </button>
                <button
                  type="button"
                  onClick={() => setLogic('OR')}
                  className={`rounded px-2 py-0.5 font-medium ${
                    logic === 'OR'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Match ANY (OR)
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {conditions.map((c, idx) => {
                const metricMeta = METRIC_MAP.get(c.metric);
                const isBool = metricMeta?.isBoolean;
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <span className="w-5 text-[11px] text-slate-400 dark:text-slate-500">
                      #{idx + 1}
                    </span>
                    <select
                      aria-label={`Rule ${idx + 1} metric`}
                      value={c.metric}
                      onChange={(e) =>
                        updateCondition(c.id, { metric: e.target.value as ScannerMetric })
                      }
                      className="min-w-[155px] flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {SCANNER_METRICS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>

                    {!isBool ? (
                      <>
                        <select
                          aria-label={`Rule ${idx + 1} operator`}
                          value={c.operator}
                          onChange={(e) =>
                            updateCondition(c.id, { operator: e.target.value as ScannerOperator })
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="gt">&gt;</option>
                          <option value="gte">&gt;=</option>
                          <option value="lt">&lt;</option>
                          <option value="lte">&lt;=</option>
                          <option value="eq">=</option>
                        </select>

                        <select
                          aria-label={`Rule ${idx + 1} comparison target`}
                          value={c.compareToType}
                          onChange={(e) =>
                            updateCondition(c.id, {
                              compareToType: e.target.value as 'value' | 'metric',
                            })
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="value">Value</option>
                          <option value="metric">Indicator</option>
                        </select>

                        {c.compareToType === 'value' ? (
                          <input
                            aria-label={`Rule ${idx + 1} value`}
                            type="number"
                            step="any"
                            value={c.value ?? 0}
                            onChange={(e) =>
                              updateCondition(c.id, { value: Number(e.target.value) })
                            }
                            className="w-20 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <select
                              aria-label={`Rule ${idx + 1} compared indicator`}
                              value={c.compareMetric || 'sma20'}
                              onChange={(e) =>
                                updateCondition(c.id, {
                                  compareMetric: e.target.value as ScannerMetric,
                                })
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              {SCANNER_METRICS.filter((m) => !m.isBoolean).map((m) => (
                                <option key={m.key} value={m.key}>
                                  {m.shortLabel}
                                </option>
                              ))}
                            </select>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              ×
                            </span>
                            <input
                              aria-label={`Rule ${idx + 1} multiplier`}
                              type="number"
                              step="0.01"
                              min="0.1"
                              value={c.multiplier ?? 1}
                              onChange={(e) =>
                                updateCondition(c.id, { multiplier: Number(e.target.value) || 1 })
                              }
                              title="Multiplier (e.g. 0.99 or 1.05)"
                              className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="px-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Pattern detected
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setConditions((prev) => prev.filter((item) => item.id !== c.id))
                      }
                      aria-label={`Remove condition ${idx + 1}`}
                      className="ml-auto rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:text-slate-500 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setConditions((prev) => [...prev, makeCondition()])}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-accent-400 hover:text-accent-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-accent-500 dark:hover:text-accent-400"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add condition
            </button>
          </div>

          {/* After-Market Alert Toggle & Submit */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={afterMarketAlert}
                onChange={(e) => setAfterMarketAlert(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-accent-700 focus:ring-accent-600 dark:border-slate-600 dark:bg-slate-950"
              />
              Send after-market EOD notification for hits
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runPreview}
                disabled={previewLoading}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Test scan
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                {saving ? 'Saving' : 'Run & Save Scanner'}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {errorMsg}
            </div>
          )}
        </form>

        {/* Live Whole-NSE Preview Results */}
        <div className="space-y-3 lg:col-span-6">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Live preview
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Evaluated against {totalUniverse.toLocaleString('en-IN')} NSE stocks
              </p>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-lg font-semibold text-accent-700 dark:text-accent-400">
                {previewLoading ? '...' : previewCount ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Matches</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {previewLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : previewResults.length === 0 ? (
              <div className="px-6 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                No stocks match the current draft rules. Loosen a threshold or switch to OR logic to broaden matches.
              </div>
            ) : (
              <div className="max-h-[540px] overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950">
                    <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400">
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Symbol</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">Close</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">1D %</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">RSI 14</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">Rel. volume</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">Turnover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewResults.map((s) => (
                      <tr key={s.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => onSelectStock(s.symbol)}
                            className="text-left font-semibold text-slate-900 hover:text-accent-700 dark:text-slate-100 dark:hover:text-accent-400"
                          >
                            {s.symbol}
                          </button>
                          <div className="max-w-[140px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {s.name}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-slate-900 tabular-nums dark:text-slate-100">
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
                        <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                          {s.rsi14 !== null ? s.rsi14.toFixed(1) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                          {s.relVol !== null ? `${s.relVol.toFixed(2)}x` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                          {formatCrores(s.turnoverCr)}
                        </td>
                      </tr>
                    ))}
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
