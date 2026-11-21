import { Check, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { validateHoldingInput } from '../shared/portfolio';
import type {
  EnrichedPortfolioHolding,
  PortfolioResponse,
  StockSnapshot,
} from '../shared/types';
import {
  formatDateShort,
  formatINR,
  formatSignedINR,
  formatSignedPct,
} from '../utils/format';

interface PortfolioViewProps {
  onSelectStock: (symbol: string) => void;
  marketSyncVersion?: number;
}

export function PortfolioView({ onSelectStock, marketSyncVersion = 0 }: PortfolioViewProps) {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add holding form state
  const [symbolInput, setSymbolInput] = useState('');
  const [searchResults, setSearchResults] = useState<StockSnapshot[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [qtyInput, setQtyInput] = useState('');
  const [avgPriceInput, setAvgPriceInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inline Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editAvgPrice, setEditAvgPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadPortfolio = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await api.getPortfolio();
      setPortfolio(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio, marketSyncVersion]);

  useEffect(() => {
    const q = symbolInput.trim();
    if (!q || !dropdownOpen) {
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
    }, 160);
    return () => clearTimeout(timer);
  }, [symbolInput, dropdownOpen]);

  const handleSelectSuggestion = (snap: StockSnapshot) => {
    setSymbolInput(snap.symbol);
    if (!avgPriceInput.trim()) {
      setAvgPriceInput(String(snap.close));
    }
    setDropdownOpen(false);
    setSearchResults([]);
    setFormError(null);
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbolInput.trim().toUpperCase();
    const qty = Number(qtyInput);
    const avg = Number(avgPriceInput);
    const validationErr = validateHoldingInput(sym, qty, avg);
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const updated = await api.addHolding({
        symbol: sym,
        quantity: qty,
        avgPrice: avg,
      });
      setPortfolio(updated);
      setSymbolInput('');
      setQtyInput('');
      setAvgPriceInput('');
      setDropdownOpen(false);
      setSearchResults([]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add holding');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (h: EnrichedPortfolioHolding) => {
    setEditingId(h.id);
    setEditQty(String(h.quantity));
    setEditAvgPrice(String(h.avgPrice));
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQty('');
    setEditAvgPrice('');
  };

  const handleSaveEdit = async (id: string) => {
    const qty = Number(editQty);
    const avg = Number(editAvgPrice);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Quantity must be a positive number.');
      return;
    }
    if (!Number.isFinite(avg) || avg <= 0) {
      setFormError('Average buy price must be greater than zero.');
      return;
    }
    setSavingEdit(true);
    setFormError(null);
    try {
      const updated = await api.updateHolding(id, { quantity: qty, avgPrice: avg });
      setPortfolio(updated);
      cancelEdit();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update holding');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteHolding = async (id: string) => {
    setFormError(null);
    try {
      const updated = await api.deleteHolding(id);
      setPortfolio(updated);
      if (editingId === id) cancelEdit();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete holding');
    }
  };

  const summary = portfolio?.summary;
  const holdings = portfolio?.holdings || [];
  const totalPnlPos = (summary?.totalPnl ?? 0) > 0;
  const totalPnlNeg = (summary?.totalPnl ?? 0) < 0;
  const dayPnlPos = (summary?.dayPnl ?? 0) > 0;
  const dayPnlNeg = (summary?.dayPnl ?? 0) < 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-100">
            Portfolio
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Holdings, cost basis and profit or loss
            {summary?.tradeDate ? ` at the ${formatDateShort(summary.tradeDate)} close` : ' at the latest close'}.
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
        <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Invested</div>
          <div className="mt-1 whitespace-nowrap text-xl font-medium text-slate-900 tabular-nums sm:text-2xl dark:text-slate-100">
            {summary ? formatINR(summary.totalInvested) : '—'}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
            {summary ? `${summary.holdingsCount} holding${summary.holdingsCount === 1 ? '' : 's'}` : 'Loading'}
          </div>
        </div>

        <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Current value</div>
          <div className="mt-1 whitespace-nowrap text-xl font-medium text-slate-900 tabular-nums sm:text-2xl dark:text-slate-100">
            {summary ? formatINR(summary.totalCurrentValue) : '—'}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">At last close</div>
        </div>

        <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Overall P&amp;L</div>
          <div
            className={`mt-1 flex items-center gap-1 text-xl font-medium tabular-nums sm:gap-1.5 sm:text-2xl ${
              totalPnlPos
                ? 'text-emerald-700 dark:text-emerald-400'
                : totalPnlNeg
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {totalPnlPos && <TrendingUp className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />}
            {totalPnlNeg && <TrendingDown className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />}
            <span className="whitespace-nowrap">{summary ? formatSignedINR(summary.totalPnl) : '—'}</span>
          </div>
          <div
            className={`mt-0.5 text-[11px] font-medium tabular-nums ${
              totalPnlPos
                ? 'text-emerald-700 dark:text-emerald-400'
                : totalPnlNeg
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {summary ? `${formatSignedPct(summary.totalPnlPct)} net return` : '—'}
          </div>
        </div>

        <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Day&apos;s P&amp;L</div>
          <div
            className={`mt-1 flex items-center gap-1 text-xl font-medium tabular-nums sm:gap-1.5 sm:text-2xl ${
              dayPnlPos
                ? 'text-emerald-700 dark:text-emerald-400'
                : dayPnlNeg
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {dayPnlPos && <TrendingUp className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />}
            {dayPnlNeg && <TrendingDown className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />}
            <span className="whitespace-nowrap">{summary ? formatSignedINR(summary.dayPnl) : '—'}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
            {summary
              ? `${formatSignedPct(summary.dayPnlPct)} · ${summary.gainersCount} green / ${summary.losersCount} red`
              : '—'}
          </div>
        </div>
      </div>

      {/* Add holding Form */}
      <form
        noValidate
        onSubmit={handleAddHolding}
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        aria-label="Add portfolio holding"
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="shrink-0 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-slate-100">
            Add holding
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Enter NSE symbol, share quantity, and average buy price
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
          <div className="relative sm:col-span-5">
            <label
              htmlFor="portfolio-symbol-input"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              NSE symbol
            </label>
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="portfolio-symbol-input"
                type="text"
                value={symbolInput}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 160)}
                onChange={(e) => {
                  setSymbolInput(e.target.value.toUpperCase());
                  setDropdownOpen(true);
                  setFormError(null);
                }}
                placeholder="Search symbol, e.g. RELIANCE"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-8 text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
              />
            </div>

            {dropdownOpen && symbolInput.trim() && (
              <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {searching ? (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    Searching NSE symbols...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    No matching NSE symbol
                  </div>
                ) : (
                  <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {searchResults.map((s) => (
                      <li key={s.symbol}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSuggestion(s);
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {s.symbol}
                            </div>
                            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {s.name}
                            </div>
                          </div>
                          <div className="shrink-0 text-right tabular-nums">
                            <div className="text-slate-900 dark:text-slate-100">{formatINR(s.close)}</div>
                            <div
                              className={
                                s.changePct >= 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-700 dark:text-red-400'
                              }
                            >
                              {formatSignedPct(s.changePct)}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="portfolio-qty-input"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Quantity
            </label>
            <input
              id="portfolio-qty-input"
              type="number"
              step="any"
              min="0.0001"
              value={qtyInput}
              onChange={(e) => {
                setQtyInput(e.target.value);
                setFormError(null);
              }}
              placeholder="e.g. 25"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="portfolio-avg-price-input"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Average buy price (₹)
            </label>
            <input
              id="portfolio-avg-price-input"
              type="number"
              step="0.01"
              min="0.01"
              value={avgPriceInput}
              onChange={(e) => {
                setAvgPriceInput(e.target.value);
                setFormError(null);
              }}
              placeholder="e.g. 1245.50"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {submitting ? 'Adding' : 'Add holding'}
            </button>
          </div>
        </div>

        {(formError || loadError) && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {formError || loadError}
          </div>
        )}
      </form>

      {/* Holdings Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : holdings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              No holdings yet
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Add a symbol, quantity and average buy price above to see profit and loss at the last close.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Symbol / Company</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Qty</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Avg. price</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Current</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">1D %</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Invested</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Value</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Net P&amp;L</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Day P&amp;L</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Weight</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {holdings.map((h) => {
                  const isEditing = editingId === h.id;
                  const pnlPos = (h.pnl ?? 0) > 0;
                  const pnlNeg = (h.pnl ?? 0) < 0;
                  const dayPos = (h.dayPnl ?? 0) > 0;
                  const dayNeg = (h.dayPnl ?? 0) < 0;
                  const chgPos = (h.changePct ?? 0) > 0;
                  const chgNeg = (h.changePct ?? 0) < 0;

                  return (
                    <tr
                      key={h.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => onSelectStock(h.symbol)}
                          className="group text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 group-hover:text-accent-700 dark:text-slate-100 dark:group-hover:text-accent-400">
                              {h.symbol}
                            </span>
                            {h.sector && (
                              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {h.sector}
                              </span>
                            )}
                          </div>
                          <div className="max-w-[200px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {h.name}
                          </div>
                        </button>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-900 tabular-nums dark:text-slate-100">
                        {isEditing ? (
                          <input
                            type="number"
                            step="any"
                            min="0.0001"
                            aria-label={`Edit quantity for ${h.symbol}`}
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            className="w-20 rounded border border-accent-400 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:outline-none dark:border-accent-500 dark:bg-slate-950 dark:text-slate-100"
                          />
                        ) : (
                          h.quantity.toLocaleString('en-IN')
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-700 tabular-nums dark:text-slate-300">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            aria-label={`Edit average buy price for ${h.symbol}`}
                            value={editAvgPrice}
                            onChange={(e) => setEditAvgPrice(e.target.value)}
                            className="w-24 rounded border border-accent-400 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:outline-none dark:border-accent-500 dark:bg-slate-950 dark:text-slate-100"
                          />
                        ) : (
                          formatINR(h.avgPrice)
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-slate-900 tabular-nums dark:text-slate-100">
                        {h.currentPrice !== null ? formatINR(h.currentPrice) : '—'}
                      </td>

                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                          chgPos
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : chgNeg
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {h.changePct !== null ? formatSignedPct(h.changePct) : '—'}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-700 tabular-nums dark:text-slate-300">
                        {formatINR(h.investedValue)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-slate-900 tabular-nums dark:text-slate-100">
                        {h.currentValue !== null ? formatINR(h.currentValue) : '—'}
                      </td>

                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums ${
                          pnlPos
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : pnlNeg
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {h.pnl !== null ? (
                          <div>
                            <div>{formatSignedINR(h.pnl)}</div>
                            <div className="text-[11px] font-medium">
                              {formatSignedPct(h.pnlPct)}
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                          dayPos
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : dayNeg
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {h.dayPnl !== null ? formatSignedINR(h.dayPnl) : '—'}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600 tabular-nums dark:text-slate-400">
                        {h.weightPct !== null ? `${h.weightPct.toFixed(1)}%` : '—'}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => handleSaveEdit(h.id)}
                              aria-label={`Save changes for ${h.symbol}`}
                              className="rounded border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 dark:hover:bg-emerald-900/60"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              aria-label={`Cancel editing ${h.symbol}`}
                              className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(h)}
                              aria-label={`Edit ${h.symbol} holding`}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteHolding(h.id)}
                              aria-label={`Delete ${h.symbol} holding`}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:text-slate-500 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
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
