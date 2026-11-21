import fs from 'fs';
import path from 'path';
import { BUILT_IN_SCANNERS, evaluateScanner } from '../src/shared/indicators';
import type {
  AlertSettings,
  NotificationItem,
  PortfolioHolding,
  PriceAlertRule,
  ScannerDefinition,
  StockSnapshot,
  TargetMarkerGoal,
  TargetPriceMarker,
  Watchlist,
} from '../src/shared/types';

export interface PersistedUserState {
  watchlists: Watchlist[];
  customScanners: ScannerDefinition[];
  scannerAlertOverrides: Record<string, boolean>;
  priceAlerts: PriceAlertRule[];
  targetMarkers?: TargetPriceMarker[];
  portfolioHoldings?: PortfolioHolding[];
  notifications: NotificationItem[];
  settings: AlertSettings;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'user_state.json');

function createDefaultState(): PersistedUserState {
  return {
    watchlists: [
      {
        id: 'wl-core-swing',
        name: 'Core Large Caps',
        symbols: [
          'RELIANCE',
          'TCS',
          'HDFCBANK',
          'INFY',
          'ICICIBANK',
          'BHARTIARTL',
          'SBIN',
          'LT',
          'ITC',
          'TMPV',
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'wl-breakout-radar',
        name: 'Momentum Radar',
        symbols: ['BEL', 'HAL', 'TRENT', 'BAJFINANCE', 'ADANIPORTS'],
        createdAt: new Date().toISOString(),
      },
    ],
    customScanners: [
      {
        id: 'custom-liquid-movers',
        name: 'Liquid High-Momentum Movers',
        description: 'Custom scanner: EQ stocks above INR 100 with >= 3% gain and 1.5x+ relative volume.',
        category: 'Custom',
        seriesFilter: 'EQ',
        minClose: 100,
        minTurnoverCr: 10,
        logic: 'AND',
        conditions: [
          { id: 'lm-1', metric: 'changePct', operator: 'gte', compareToType: 'value', value: 3 },
          { id: 'lm-2', metric: 'relVol', operator: 'gte', compareToType: 'value', value: 1.5 },
          { id: 'lm-3', metric: 'close', operator: 'gt', compareToType: 'metric', compareMetric: 'sma20', multiplier: 1 },
        ],
        afterMarketAlert: true,
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
      },
    ],
    scannerAlertOverrides: {},
    priceAlerts: [
      {
        id: 'pa-reliance-high',
        symbol: 'RELIANCE',
        metric: 'close',
        operator: 'gte',
        targetValue: 1335,
        enabled: true,
        createdAt: new Date().toISOString(),
        lastTriggeredDate: null,
      },
      {
        id: 'pa-tcs-rsi',
        symbol: 'TCS',
        metric: 'rsi14',
        operator: 'lte',
        targetValue: 45,
        enabled: true,
        createdAt: new Date().toISOString(),
        lastTriggeredDate: null,
      },
    ],
    targetMarkers: [],
    portfolioHoldings: [],
    notifications: [],
    settings: {
      autoScanEnabled: true,
      scanTimeIst: '16:30',
      lastAutoScanTradeDate: null,
      lastRunAt: null,
    },
  };
}

class UserStore {
  private state: PersistedUserState;

  constructor() {
    this.state = this.load();
  }

  private load(): PersistedUserState {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw) as PersistedUserState;
        if (parsed && Array.isArray(parsed.watchlists)) {
          if (!Array.isArray(parsed.targetMarkers)) {
            parsed.targetMarkers = [];
          }
          if (!Array.isArray(parsed.portfolioHoldings)) {
            parsed.portfolioHoldings = [];
          }
          return parsed;
        }
      }
    } catch {
      // Fallback to default state
    }
    const def = createDefaultState();
    this.save(def);
    return def;
  }

  private save(next = this.state): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
    } catch (err) {
      console.error('Failed to persist user state:', err);
    }
  }

  getAllScanners(): ScannerDefinition[] {
    const builtIns = BUILT_IN_SCANNERS.map((s) => ({
      ...s,
      afterMarketAlert:
        s.id in this.state.scannerAlertOverrides
          ? this.state.scannerAlertOverrides[s.id]
          : s.afterMarketAlert,
    }));
    return [...this.state.customScanners, ...builtIns];
  }

  getScannerById(id: string): ScannerDefinition | null {
    return this.getAllScanners().find((s) => s.id === id) || null;
  }

  createCustomScanner(
    input: Omit<ScannerDefinition, 'id' | 'isBuiltIn' | 'createdAt'>,
  ): ScannerDefinition {
    const created: ScannerDefinition = {
      ...input,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };
    this.state.customScanners.unshift(created);
    this.save();
    return created;
  }

  updateScanner(
    id: string,
    patch: Partial<Omit<ScannerDefinition, 'id' | 'isBuiltIn' | 'createdAt'>>,
  ): ScannerDefinition | null {
    const builtIn = BUILT_IN_SCANNERS.find((s) => s.id === id);
    if (builtIn) {
      if (typeof patch.afterMarketAlert === 'boolean') {
        this.state.scannerAlertOverrides[id] = patch.afterMarketAlert;
        this.save();
      }
      return this.getScannerById(id);
    }
    const idx = this.state.customScanners.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    this.state.customScanners[idx] = {
      ...this.state.customScanners[idx],
      ...patch,
    };
    this.save();
    return this.state.customScanners[idx];
  }

  deleteCustomScanner(id: string): boolean {
    const before = this.state.customScanners.length;
    this.state.customScanners = this.state.customScanners.filter((s) => s.id !== id);
    if (this.state.customScanners.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  getWatchlists(): Watchlist[] {
    return this.state.watchlists;
  }

  createWatchlist(name: string): Watchlist {
    const wl: Watchlist = {
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: name.trim(),
      symbols: [],
      createdAt: new Date().toISOString(),
    };
    this.state.watchlists.push(wl);
    this.save();
    return wl;
  }

  deleteWatchlist(id: string): boolean {
    if (this.state.watchlists.length <= 1) return false;
    const before = this.state.watchlists.length;
    this.state.watchlists = this.state.watchlists.filter((w) => w.id !== id);
    if (this.state.watchlists.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  addSymbolToWatchlist(watchlistId: string, symbol: string): Watchlist | null {
    const wl = this.state.watchlists.find((w) => w.id === watchlistId);
    if (!wl) return null;
    const clean = symbol.trim().toUpperCase();
    if (!wl.symbols.includes(clean)) {
      wl.symbols.unshift(clean);
      this.save();
    }
    return wl;
  }

  removeSymbolFromWatchlist(watchlistId: string, symbol: string): Watchlist | null {
    const wl = this.state.watchlists.find((w) => w.id === watchlistId);
    if (!wl) return null;
    const clean = symbol.trim().toUpperCase();
    wl.symbols = wl.symbols.filter((s) => s !== clean);
    this.save();
    return wl;
  }

  getWatchlistIdsForSymbol(symbol: string): string[] {
    const clean = symbol.toUpperCase();
    return this.state.watchlists.filter((w) => w.symbols.includes(clean)).map((w) => w.id);
  }

  getPriceAlerts(): PriceAlertRule[] {
    return this.state.priceAlerts;
  }

  createPriceAlert(
    rule: Omit<PriceAlertRule, 'id' | 'createdAt' | 'lastTriggeredDate'>,
  ): PriceAlertRule {
    const created: PriceAlertRule = {
      ...rule,
      symbol: rule.symbol.trim().toUpperCase(),
      id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      lastTriggeredDate: null,
    };
    this.state.priceAlerts.unshift(created);
    this.save();
    return created;
  }

  deletePriceAlert(id: string): boolean {
    const before = this.state.priceAlerts.length;
    this.state.priceAlerts = this.state.priceAlerts.filter((p) => p.id !== id);
    if (this.state.priceAlerts.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  getTargetMarkers(symbol?: string): TargetPriceMarker[] {
    const list = this.state.targetMarkers || [];
    if (!symbol) return list;
    const clean = symbol.trim().toUpperCase();
    return list.filter((m) => m.symbol === clean);
  }

  createTargetMarker(input: {
    symbol: string;
    price: number;
    goal: TargetMarkerGoal;
    label?: string;
  }): TargetPriceMarker {
    if (!Array.isArray(this.state.targetMarkers)) {
      this.state.targetMarkers = [];
    }
    const created: TargetPriceMarker = {
      id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: input.symbol.trim().toUpperCase(),
      price: Number(input.price.toFixed(2)),
      goal: input.goal,
      label: (input.label || '').trim(),
      createdAt: new Date().toISOString(),
    };
    this.state.targetMarkers.unshift(created);
    this.save();
    return created;
  }

  deleteTargetMarker(id: string): boolean {
    const list = this.state.targetMarkers || [];
    const before = list.length;
    this.state.targetMarkers = list.filter((m) => m.id !== id);
    if (this.state.targetMarkers.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  getPortfolioHoldings(): PortfolioHolding[] {
    return this.state.portfolioHoldings || [];
  }

  addPortfolioHolding(input: {
    symbol: string;
    quantity: number;
    avgPrice: number;
    notes?: string;
  }): PortfolioHolding {
    if (!Array.isArray(this.state.portfolioHoldings)) {
      this.state.portfolioHoldings = [];
    }
    const now = new Date().toISOString();
    const created: PortfolioHolding = {
      id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: input.symbol.trim().toUpperCase(),
      quantity: Math.round(input.quantity * 10000) / 10000,
      avgPrice: Math.round(input.avgPrice * 100) / 100,
      notes: (input.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
    this.state.portfolioHoldings.unshift(created);
    this.save();
    return created;
  }

  updatePortfolioHolding(
    id: string,
    patch: { quantity?: number; avgPrice?: number; notes?: string },
  ): PortfolioHolding | null {
    const list = this.state.portfolioHoldings || [];
    const idx = list.findIndex((h) => h.id === id);
    if (idx < 0) return null;
    const prev = list[idx];
    const updated: PortfolioHolding = {
      ...prev,
      quantity:
        typeof patch.quantity === 'number'
          ? Math.round(patch.quantity * 10000) / 10000
          : prev.quantity,
      avgPrice:
        typeof patch.avgPrice === 'number'
          ? Math.round(patch.avgPrice * 100) / 100
          : prev.avgPrice,
      notes: typeof patch.notes === 'string' ? patch.notes.trim() : prev.notes,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    this.save();
    return updated;
  }

  deletePortfolioHolding(id: string): boolean {
    const list = this.state.portfolioHoldings || [];
    const before = list.length;
    this.state.portfolioHoldings = list.filter((h) => h.id !== id);
    if (this.state.portfolioHoldings.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  getNotifications(): NotificationItem[] {
    return this.state.notifications;
  }

  markNotificationRead(id: string): void {
    if (id === 'all') {
      for (const n of this.state.notifications) n.read = true;
    } else {
      const target = this.state.notifications.find((n) => n.id === id);
      if (target) target.read = true;
    }
    this.save();
  }

  clearNotifications(onlyRead = false): void {
    if (onlyRead) {
      this.state.notifications = this.state.notifications.filter((n) => !n.read);
    } else {
      this.state.notifications = [];
    }
    this.save();
  }

  getSettings(): AlertSettings {
    return this.state.settings;
  }

  updateSettings(patch: Partial<AlertSettings>): AlertSettings {
    this.state.settings = {
      ...this.state.settings,
      ...patch,
    };
    this.save();
    return this.state.settings;
  }

  runAfterMarketSweep(
    snapshots: StockSnapshot[],
    tradeDate: string,
    forceEmit = false,
  ): NotificationItem[] {
    if (snapshots.length === 0) return [];
    const snapMap = new Map(snapshots.map((s) => [s.symbol, s]));
    const newNotifications: NotificationItem[] = [];
    const nowIso = new Date().toISOString();

    const watchedSet = new Set<string>();
    for (const wl of this.state.watchlists) {
      for (const sym of wl.symbols) watchedSet.add(sym);
    }

    // 1. Evaluate all after-market-alert-enabled scanners
    const alertScanners = this.getAllScanners().filter((s) => s.afterMarketAlert);
    for (const scanner of alertScanners) {
      const matches = evaluateScanner(snapshots, scanner);
      if (matches.length === 0) continue;

      // Avoid duplicate notification for same scanner & tradeDate unless forced
      const alreadySent =
        !forceEmit &&
        this.state.notifications.some(
          (n) => n.type === 'scanner' && n.scannerId === scanner.id && n.tradeDate === tradeDate,
        );
      if (alreadySent) continue;

      const watchlistMatches = matches.filter((m) => watchedSet.has(m.symbol));
      const summaryParts = [
        `${matches.length} NSE equities matched after-market (${tradeDate}).`,
      ];
      if (watchlistMatches.length > 0) {
        summaryParts.push(
          `In your watchlists: ${watchlistMatches.map((m) => m.symbol).join(', ')}.`,
        );
      }

      newNotifications.push({
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: nowIso,
        tradeDate,
        type: 'scanner',
        title: `${scanner.name} (${matches.length} hits)`,
        summary: summaryParts.join(' '),
        scannerId: scanner.id,
        symbols: matches.slice(0, 8).map((m) => ({
          symbol: m.symbol,
          close: m.close,
          changePct: m.changePct,
        })),
        read: false,
      });
    }

    // 2. Evaluate Watchlist / Price Alert Rules
    for (const rule of this.state.priceAlerts) {
      if (!rule.enabled) continue;
      if (!forceEmit && rule.lastTriggeredDate === tradeDate) continue;
      const snap = snapMap.get(rule.symbol);
      if (!snap) continue;

      const val =
        rule.metric === 'close'
          ? snap.close
          : rule.metric === 'changePct'
            ? snap.changePct
            : rule.metric === 'rsi14'
              ? snap.rsi14
              : snap.relVol;

      if (val === null) continue;
      const triggered =
        rule.operator === 'gte' ? val >= rule.targetValue : val <= rule.targetValue;
      if (!triggered) continue;

      rule.lastTriggeredDate = tradeDate;
      const metricLabel =
        rule.metric === 'close'
          ? 'Close'
          : rule.metric === 'changePct'
            ? '1D Change %'
            : rule.metric === 'rsi14'
              ? 'RSI(14)'
              : 'Rel Volume';
      const opLabel = rule.operator === 'gte' ? '>=' : '<=';

      newNotifications.push({
        id: `notif-pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: nowIso,
        tradeDate,
        type: 'price_alert',
        title: `Alert Triggered: ${snap.symbol} ${metricLabel} ${opLabel} ${rule.targetValue}`,
        summary: `${snap.symbol} closed at ₹${snap.close.toFixed(2)} (${snap.changePct >= 0 ? '+' : ''}${snap.changePct.toFixed(2)}%), current ${metricLabel}: ${val}.`,
        symbols: [{ symbol: snap.symbol, close: snap.close, changePct: snap.changePct }],
        read: false,
      });
    }

    if (newNotifications.length > 0) {
      this.state.notifications = [...newNotifications, ...this.state.notifications].slice(0, 100);
    }

    this.state.settings.lastAutoScanTradeDate = tradeDate;
    this.state.settings.lastRunAt = nowIso;
    this.save();
    return newNotifications;
  }
}

export const userStore = new UserStore();
