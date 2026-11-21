import {
  Bell,
  Bookmark,
  Briefcase,
  LayoutGrid,
  Menu,
  Moon,
  Play,
  Plug,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client';
import { AlertsView } from './components/AlertsView';
import { MarketHeatmapView } from './components/MarketHeatmapView';
import { McpView } from './components/McpView';
import { PortfolioView } from './components/PortfolioView';
import { ScannerBuilderView } from './components/ScannerBuilderView';
import { ScannersView } from './components/ScannersView';
import { StockDetailDrawer } from './components/StockDetailDrawer';
import { WatchlistView } from './components/WatchlistView';
import {
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  toggleThemeMode,
  type ThemeMode,
} from './shared/theme';
import type {
  AlertSettings,
  EnrichedWatchlist,
  MarketStatus,
  NotificationItem,
  PriceAlertRule,
  ScannerSummary,
  SectorPerformanceSummary,
  StockSnapshot,
} from './shared/types';
import { formatDateShort, formatINR, formatSignedPct } from './utils/format';

type ActiveTab = 'watchlist' | 'portfolio' | 'heatmap' | 'scanners' | 'builder' | 'alerts' | 'mcp';

const TAB_IDS: ActiveTab[] = ['watchlist', 'portfolio', 'heatmap', 'scanners', 'builder', 'alerts', 'mcp'];

function readInitialTab(): ActiveTab {
  if (typeof window === 'undefined') return 'watchlist';
  const id = window.location.hash.replace(/^#\/?/, '') as ActiveTab;
  return TAB_IDS.includes(id) ? id : 'watchlist';
}

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return resolveInitialTheme(stored, prefersDark);
  } catch {
    return 'light';
  }
}

function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect width="26" height="26" rx="6" className="fill-accent-400" />
      <path
        d="M5 17.5 9.5 12l3.5 3.5L21 7.5"
        stroke="#0f0f10"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(readInitialTab);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);

  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [watchlists, setWatchlists] = useState<EnrichedWatchlist[]>([]);
  const [tradeDate, setTradeDate] = useState<string | null>(null);
  const [marketSyncVersion, setMarketSyncVersion] = useState(0);
  const [scanners, setScanners] = useState<ScannerSummary[]>([]);
  const [sectorPerformance, setSectorPerformance] = useState<SectorPerformanceSummary | null>(
    null,
  );
  const [selectedScannerId, setSelectedScannerId] = useState<string>('');

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlertRule[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    autoScanEnabled: true,
    scanTimeIst: '16:30',
    lastAutoScanTradeDate: null,
    lastRunAt: null,
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [runningEod, setRunningEod] = useState(false);
  const [syncingMarket, setSyncingMarket] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<StockSnapshot[]>([]);

  useEffect(() => {
    if (window.location.hash !== `#${activeTab}`) {
      window.history.replaceState(null, '', `#${activeTab}`);
    }
  }, [activeTab]);

  useEffect(() => {
    const onHashChange = () => setActiveTab(readInitialTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota errors
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => toggleThemeMode(prev));
  };

  const loadMarketAndWatchlists = useCallback(async () => {
    const [status, wlRes, scRes, sectorRes] = await Promise.all([
      api.getMarketStatus(),
      api.getWatchlists(),
      api.getScanners(),
      api.getSectorPerformance().catch(() => null),
    ]);
    setMarketStatus(status);
    setWatchlists(wlRes.watchlists);
    setTradeDate(wlRes.tradeDate || status.tradeDate);
    setScanners(scRes.scanners);
    setSectorPerformance(sectorRes);
    setMarketSyncVersion((v) => v + 1);
    setSelectedScannerId((prev) => prev || scRes.scanners[0]?.id || '');
  }, []);

  const loadAlerts = useCallback(async () => {
    const res = await api.getAlerts();
    setNotifications(res.notifications);
    setUnreadCount(res.unreadCount);
    setPriceAlerts(res.priceAlerts);
    setAlertSettings(res.settings);
  }, []);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      await Promise.all([loadMarketAndWatchlists(), loadAlerts()]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load NSE market data');
    } finally {
      setInitialLoading(false);
    }
  }, [loadMarketAndWatchlists, loadAlerts]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const q = globalQuery.trim();
    if (!q) {
      setGlobalResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.searchMarket(q, 8);
        setGlobalResults(res.results);
      } catch {
        setGlobalResults([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [globalQuery]);

  const handleRunEodScan = async () => {
    setRunningEod(true);
    setBannerMessage(null);
    try {
      const res = await api.runEodScan(true);
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
      setAlertSettings(res.settings);
      await loadMarketAndWatchlists();
      setBannerMessage(
        `Scan finished for ${formatDateShort(res.tradeDate)}. ${res.createdCount} new alert${res.createdCount === 1 ? '' : 's'} logged.`,
      );
      if (
        res.createdCount > 0 &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        new window.Notification('NSE Pulse scan finished', {
          body: `${res.createdCount} scanner/price alert(s) triggered on EOD ${res.tradeDate}.`,
        });
      }
    } catch (err) {
      setBannerMessage(err instanceof Error ? err.message : 'After-market scan failed');
    } finally {
      setRunningEod(false);
    }
  };

  const handleSyncMarket = async () => {
    setSyncingMarket(true);
    try {
      await api.syncMarket();
      await loadAll();
    } finally {
      setSyncingMarket(false);
    }
  };

  const handleOpenScanner = (scannerId: string) => {
    setSelectedScannerId(scannerId);
    setActiveTab('scanners');
    setMobileNavOpen(false);
  };

  const handleScannerCreated = async (scannerId: string) => {
    await loadMarketAndWatchlists();
    setSelectedScannerId(scannerId);
    setActiveTab('scanners');
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof Bookmark;
    count?: number;
  }> = [
    { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'heatmap', label: 'Market heatmap', icon: LayoutGrid },
    { id: 'scanners', label: 'Scanners', icon: TrendingUp },
    { id: 'builder', label: 'Scanner builder', icon: SlidersHorizontal },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: Bell,
      count: unreadCount > 0 ? unreadCount : undefined,
    },
    { id: 'mcp', label: 'MCP server', icon: Plug },
  ];

  const tabTitles: Record<ActiveTab, string> = {
    watchlist: 'Watchlist',
    portfolio: 'Portfolio',
    heatmap: 'Market heatmap',
    scanners: 'Scanners',
    builder: 'Scanner builder',
    alerts: 'Alerts',
    mcp: 'MCP server',
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-ink text-slate-300 lg:flex">
        <div className="flex h-14 items-center border-b border-white/10 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('watchlist')}
            className="flex items-center gap-2.5 text-left"
            aria-label="NSE Pulse home"
          >
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-tight text-white">NSE Pulse</span>
          </button>
        </div>

        <nav aria-label="Primary" className="space-y-0.5 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span className="text-[11px] text-accent-400 tabular-nums">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick scanners */}
        <div className="mt-1 flex-1 overflow-y-auto border-t border-white/10 p-3">
          <div className="mb-1.5 flex items-center justify-between px-3 text-xs font-medium text-slate-500">
            <span>Scanners</span>
            <span>Matches</span>
          </div>
          <div className="space-y-0.5">
            {scanners.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleOpenScanner(sc.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                  activeTab === 'scanners' && selectedScannerId === sc.id
                    ? 'bg-white/[0.07] font-medium text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
              >
                <span className="truncate">{sc.name}</span>
                <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                  {sc.matchCount}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 p-4 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-300">Market data</span>
            <button
              type="button"
              onClick={handleSyncMarket}
              disabled={syncingMarket}
              aria-label="Sync NSE market data"
              className="inline-flex items-center gap-1 rounded font-medium text-slate-300 hover:text-white disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3 w-3 ${syncingMarket ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {syncingMarket ? 'Syncing' : 'Sync'}
            </button>
          </div>
          <div className="mt-1 text-slate-500">
            {tradeDate ? `Close of ${formatDateShort(tradeDate)}` : 'Loading…'}
            {marketStatus ? (
              <span className="block tabular-nums">
                {marketStatus.totalSymbols.toLocaleString('en-IN')} NSE stocks
              </span>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Nav */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-64 flex-col bg-ink p-4 text-slate-300 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
                <BrandMark />
                NSE Pulse
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <nav className="mt-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium ${
                      activeTab === item.id
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </span>
                    {item.count !== undefined && (
                      <span className="text-xs text-accent-400 tabular-nums">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {marketStatus ? (
                <>
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500 dark:bg-accent-400"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    Market close{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatDateShort(marketStatus.tradeDate)}
                    </span>
                  </span>
                </>
              ) : (
                <span>Loading market data</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {/* Global NSE symbol Lookup */}
            <div className="relative hidden sm:block">
              <label htmlFor="global-nse-search" className="sr-only">
                Lookup any NSE stock symbol
              </label>
              <Search
                className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="global-nse-search"
                type="text"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Find a stock"
                className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-accent-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-500 dark:focus:bg-slate-900"
              />
              {globalQuery.trim() && (
                <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {globalResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                      No NSE equity match
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {globalResults.map((s) => (
                        <li key={s.symbol}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSymbol(s.symbol);
                              setGlobalQuery('');
                              setGlobalResults([]);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {s.symbol}
                              </div>
                              <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {s.name}
                              </div>
                            </div>
                            <div className="shrink-0 text-right tabular-nums">
                              <div className="text-slate-900 dark:text-slate-100">
                                {formatINR(s.close)}
                              </div>
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

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              title={
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={handleRunEodScan}
              disabled={runningEod}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Play className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">
                {runningEod ? 'Scanning…' : 'Run end-of-day scan'}
              </span>
              <span className="sm:hidden">{runningEod ? 'Scanning…' : 'Run scan'}</span>
            </button>
          </div>
        </header>

        {/* Feedback / Error Banners */}
        {bannerMessage && (
          <div className="border-b border-accent-200 bg-accent-50 px-4 py-2 text-xs text-accent-900 dark:border-accent-900/60 dark:bg-accent-950/40 dark:text-accent-200 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <span>{bannerMessage}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('alerts')}
                  className="font-semibold text-accent-800 underline dark:text-accent-300"
                >
                  Open alerts
                </button>
                <button
                  type="button"
                  onClick={() => setBannerMessage(null)}
                  aria-label="Dismiss notification banner"
                  className="text-accent-700 dark:text-accent-300"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 lg:px-8"
          >
            <div className="flex items-center justify-between">
              <span>{loadError}</span>
              <button type="button" onClick={loadAll} className="font-semibold underline">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Active View Viewport */}
        <main className="mx-auto w-full max-w-[1320px] flex-1 p-4 lg:p-8">
          {activeTab === 'watchlist' && (
            <WatchlistView
              watchlists={watchlists}
              sectorPerformance={sectorPerformance}
              tradeDate={tradeDate}
              loading={initialLoading}
              onRefresh={loadMarketAndWatchlists}
              onSelectStock={setSelectedSymbol}
              onOpenScanner={handleOpenScanner}
            />
          )}

          {activeTab === 'portfolio' && (
            <PortfolioView
              onSelectStock={setSelectedSymbol}
              marketSyncVersion={marketSyncVersion}
            />
          )}

          {activeTab === 'heatmap' && (
            <MarketHeatmapView onSelectStock={setSelectedSymbol} />
          )}

          {activeTab === 'scanners' && (
            <ScannersView
              scanners={scanners}
              selectedScannerId={selectedScannerId}
              onSelectScannerId={setSelectedScannerId}
              marketStatus={marketStatus}
              watchlists={watchlists}
              onRefreshAll={loadMarketAndWatchlists}
              onSelectStock={setSelectedSymbol}
              onOpenBuilder={() => setActiveTab('builder')}
            />
          )}

          {activeTab === 'builder' && (
            <ScannerBuilderView
              onScannerCreated={handleScannerCreated}
              onSelectStock={setSelectedSymbol}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              notifications={notifications}
              unreadCount={unreadCount}
              priceAlerts={priceAlerts}
              settings={alertSettings}
              runningEod={runningEod}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onRunEodScan={handleRunEodScan}
              onRefreshAlerts={loadAlerts}
              onSelectStock={setSelectedSymbol}
              onOpenScanner={handleOpenScanner}
            />
          )}

          {activeTab === 'mcp' && <McpView />}
        </main>
      </div>

      {/* Stock Detail Slide-Over */}
      <StockDetailDrawer
        symbol={selectedSymbol}
        watchlists={watchlists}
        onClose={() => setSelectedSymbol(null)}
        onRefreshWatchlists={loadMarketAndWatchlists}
        onRefreshAlerts={loadAlerts}
        onOpenScanner={handleOpenScanner}
      />
    </div>
  );
}
