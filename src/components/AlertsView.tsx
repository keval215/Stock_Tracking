import {
  Bell,
  CheckCheck,
  Clock,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client';
import type { ThemeMode } from '../shared/theme';
import type {
  AlertSettings,
  NotificationItem,
  PriceAlertRule,
} from '../shared/types';
import {
  formatDateShort,
  formatINR,
  formatSignedPct,
  formatTimestamp,
} from '../utils/format';

interface AlertsViewProps {
  notifications: NotificationItem[];
  unreadCount: number;
  priceAlerts: PriceAlertRule[];
  settings: AlertSettings;
  runningEod: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onRunEodScan: () => Promise<void>;
  onRefreshAlerts: () => Promise<void>;
  onSelectStock: (symbol: string) => void;
  onOpenScanner: (scannerId: string) => void;
}

export function AlertsView({
  notifications,
  unreadCount,
  priceAlerts,
  settings,
  runningEod,
  theme,
  onToggleTheme,
  onRunEodScan,
  onRefreshAlerts,
  onSelectStock,
  onOpenScanner,
}: AlertsViewProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [symbol, setSymbol] = useState('');
  const [metric, setMetric] = useState<'close' | 'changePct' | 'rsi14' | 'relVol'>('close');
  const [operator, setOperator] = useState<'gte' | 'lte'>('gte');
  const [targetValue, setTargetValue] = useState('');
  const [submittingRule, setSubmittingRule] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [browserPermission, setBrowserPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission
      : 'unsupported',
  );

  const visibleNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const handleMarkRead = async (id: string) => {
    await api.markNotificationRead(id);
    await onRefreshAlerts();
  };

  const handleClear = async (onlyRead: boolean) => {
    await api.clearNotifications(onlyRead);
    await onRefreshAlerts();
  };

  const handleToggleAutoScan = async () => {
    await api.updateAlertSettings({ autoScanEnabled: !settings.autoScanEnabled });
    await onRefreshAlerts();
  };

  const handleChangeScanTime = async (scanTimeIst: string) => {
    await api.updateAlertSettings({ scanTimeIst });
    await onRefreshAlerts();
  };

  const handleEnableBrowserAlerts = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await window.Notification.requestPermission();
    setBrowserPermission(result);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleError(null);
    const num = Number(targetValue);
    if (!symbol.trim()) {
      setRuleError('Enter an NSE symbol (e.g. RELIANCE).');
      return;
    }
    if (!targetValue || Number.isNaN(num)) {
      setRuleError('Enter a valid numeric target.');
      return;
    }
    setSubmittingRule(true);
    try {
      await api.createPriceAlert({
        symbol: symbol.trim().toUpperCase(),
        metric,
        operator,
        targetValue: num,
      });
      setSymbol('');
      setTargetValue('');
      await onRefreshAlerts();
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : 'Failed to create alert rule');
    } finally {
      setSubmittingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    await api.deletePriceAlert(id);
    await onRefreshAlerts();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-100">
            Alerts
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Notifications from the end-of-day scan, when a stock matches a scanner or crosses a price you set.
          </p>
        </div>

        <button
          type="button"
          onClick={onRunEodScan}
          disabled={runningEod}
          className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          {runningEod ? 'Scanning' : 'Run end-of-day scan'}
        </button>
      </div>

      {/* EOD Schedule & Appearance Settings Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={settings.autoScanEnabled}
              onChange={handleToggleAutoScan}
              className="h-4 w-4 rounded border-slate-300 text-accent-700 dark:border-slate-600 dark:bg-slate-950"
            />
            Run the scan automatically after close
          </label>

          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <label htmlFor="eod-scan-time" className="text-slate-600 dark:text-slate-400">
              Schedule (IST):
            </label>
            <select
              id="eod-scan-time"
              value={settings.scanTimeIst}
              onChange={(e) => handleChangeScanTime(e.target.value)}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="16:30">16:30 IST</option>
              <option value="17:15">17:15 IST</option>
              <option value="18:00">18:00 IST</option>
              <option value="19:30">19:30 IST</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Last scan:{' '}
            <span className="text-slate-800 dark:text-slate-200">
              {settings.lastAutoScanTradeDate
                ? formatDateShort(settings.lastAutoScanTradeDate)
                : 'Not yet run'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {browserPermission === 'default' && (
            <button
              type="button"
              onClick={handleEnableBrowserAlerts}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              Turn on browser notifications
            </button>
          )}
          {browserPermission === 'granted' && (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Browser notifications active
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Notifications Inbox */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    filter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unread')}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    filter === 'unread'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleMarkRead('all')}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleClear(true)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Clear read
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {visibleNotifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {filter === 'unread'
                    ? 'No unread alerts'
                    : 'No alerts yet'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Run the end-of-day scan to check every alert-enabled scanner and price alert against the latest close.
                </p>
              </div>
            ) : (
              visibleNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 transition-colors ${
                    notif.read
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-slate-50 dark:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {notif.type === 'price_alert' ? 'Watchlist Rule' : 'Scanner alert'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">EOD {formatDateShort(notif.tradeDate)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatTimestamp(notif.createdAt)}</span>
                        {!notif.read && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-accent-700 dark:text-accent-400">
                              Unread
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {notif.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {notif.summary}
                      </p>

                      {notif.symbols.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          {notif.symbols.map((sym) => (
                            <button
                              key={sym.symbol}
                              type="button"
                              onClick={() => onSelectStock(sym.symbol)}
                              className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-800 hover:border-accent-300 hover:bg-accent-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-accent-500/60 dark:hover:bg-accent-950/50"
                            >
                              <span className="font-semibold">{sym.symbol}</span>
                              <span>{formatINR(sym.close)}</span>
                              <span
                                className={
                                  sym.changePct >= 0
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-red-700 dark:text-red-400'
                                }
                              >
                                {formatSignedPct(sym.changePct)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {!notif.read && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(notif.id)}
                          className="whitespace-nowrap rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Mark read
                        </button>
                      )}
                      {notif.scannerId && (
                        <button
                          type="button"
                          onClick={() => onOpenScanner(notif.scannerId!)}
                          className="whitespace-nowrap text-[11px] font-medium text-accent-700 hover:underline dark:text-accent-400"
                        >
                          View scanner
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Watchlist Price & Indicator Alert Rules */}
        <div className="space-y-4 lg:col-span-5">
          <form
            onSubmit={handleCreateRule}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              New price alert
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trigger a notification whenever an NSE stock closes above or below your target price, RSI, or relative volume.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="alert-symbol"
                  className="block text-[11px] text-slate-600 dark:text-slate-400"
                >
                  NSE symbol
                </label>
                <input
                  id="alert-symbol"
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. RELIANCE"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
                />
              </div>

              <div>
                <label
                  htmlFor="alert-metric"
                  className="block text-[11px] text-slate-600 dark:text-slate-400"
                >
                  Metric
                </label>
                <select
                  id="alert-metric"
                  value={metric}
                  onChange={(e) =>
                    setMetric(e.target.value as 'close' | 'changePct' | 'rsi14' | 'relVol')
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="close">Close price (INR)</option>
                  <option value="changePct">1D Change %</option>
                  <option value="rsi14">RSI (14)</option>
                  <option value="relVol">Relative volume</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="alert-operator"
                  className="block text-[11px] text-slate-600 dark:text-slate-400"
                >
                  Condition
                </label>
                <select
                  id="alert-operator"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as 'gte' | 'lte')}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="gte">At or Above (&gt;=)</option>
                  <option value="lte">At or Below (&lt;=)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="alert-target"
                  className="block text-[11px] text-slate-600 dark:text-slate-400"
                >
                  Target value
                </label>
                <input
                  id="alert-target"
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g. 1400"
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-accent-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500"
                />
              </div>
            </div>

            {ruleError && (
              <div role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
                {ruleError}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingRule}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {submittingRule ? 'Adding Rule...' : 'Add alert'}
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-200">
              Price alerts ({priceAlerts.length})
            </div>

            {priceAlerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No individual stock alert rules configured.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {priceAlerts.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectStock(rule.symbol)}
                        className="font-semibold text-slate-900 hover:text-accent-700 dark:text-slate-100 dark:hover:text-accent-400"
                      >
                        {rule.symbol}
                      </button>
                      <span className="ml-2 text-slate-600 dark:text-slate-400">
                        {rule.metric === 'close'
                          ? 'Close'
                          : rule.metric === 'changePct'
                            ? '1D %'
                            : rule.metric === 'rsi14'
                              ? 'RSI(14)'
                              : 'Rel Vol'}{' '}
                        {rule.operator === 'gte' ? '>=' : '<='}{' '}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {rule.metric === 'close' ? formatINR(rule.targetValue) : rule.targetValue}
                        </span>
                      </span>
                      {rule.lastTriggeredDate && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          Last triggered: {formatDateShort(rule.lastTriggeredDate)}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      aria-label={`Delete alert rule for ${rule.symbol}`}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 dark:text-slate-500 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
