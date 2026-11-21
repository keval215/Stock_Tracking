import type {
  AlertSettings,
  EnrichedWatchlist,
  HeatmapUniverse,
  HistoryRange,
  MarketBreadthResponse,
  MarketStatus,
  NiftyHeatmapResponse,
  NotificationItem,
  PortfolioResponse,
  PriceAlertRule,
  ScannerDefinition,
  ScannerSummary,
  SectorPerformanceSummary,
  StockDetailResponse,
  StockHistoryResponse,
  StockResearchResponse,
  StockSnapshot,
  TargetMarkerGoal,
  TargetPriceMarker,
} from '../shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getMarketStatus: () => request<MarketStatus>('/api/market/status'),
  syncMarket: () =>
    request<{ newDateFound: boolean; latestDate: string | null; status: MarketStatus }>(
      '/api/market/sync',
      { method: 'POST' },
    ),
  getMarketBreadth: () => request<MarketBreadthResponse>('/api/market/breadth'),
  getMarketHeatmap: (universe: HeatmapUniverse = 'ALL_NSE') =>
    request<NiftyHeatmapResponse>(`/api/market/heatmap?universe=${universe}`),
  getSectorPerformance: () =>
    request<SectorPerformanceSummary>('/api/market/sectors/performance'),
  searchMarket: (q: string, limit = 15) =>
    request<{ results: StockSnapshot[]; totalUniverse: number }>(
      `/api/market/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),

  getScanners: () =>
    request<{ scanners: ScannerSummary[]; totalUniverse: number; tradeDate: string | null }>(
      '/api/scanners',
    ),
  getScannerResults: (id: string, q = '', sortBy = 'turnoverCr', dir: 'asc' | 'desc' = 'desc') =>
    request<{
      scanner: ScannerDefinition;
      totalMatches: number;
      totalUniverse: number;
      tradeDate: string | null;
      results: StockSnapshot[];
    }>(
      `/api/scanners/${encodeURIComponent(id)}/results?q=${encodeURIComponent(q)}&sortBy=${encodeURIComponent(sortBy)}&dir=${dir}`,
    ),
  previewScanner: (draft: Partial<ScannerDefinition>) =>
    request<{
      matchCount: number;
      totalUniverse: number;
      tradeDate: string | null;
      results: StockSnapshot[];
    }>('/api/scanners/preview', {
      method: 'POST',
      body: JSON.stringify(draft),
    }),
  createScanner: (draft: Partial<ScannerDefinition>) =>
    request<{ scanner: ScannerSummary }>('/api/scanners', {
      method: 'POST',
      body: JSON.stringify(draft),
    }),
  updateScanner: (id: string, patch: Partial<ScannerDefinition>) =>
    request<{ scanner: ScannerDefinition }>(`/api/scanners/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteScanner: (id: string) =>
    request<{ ok: boolean }>(`/api/scanners/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getWatchlists: () =>
    request<{ watchlists: EnrichedWatchlist[]; tradeDate: string | null }>('/api/watchlists'),
  createWatchlist: (name: string) =>
    request<{ watchlist: { id: string; name: string } }>('/api/watchlists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  deleteWatchlist: (id: string) =>
    request<{ ok: boolean }>(`/api/watchlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  addToWatchlist: (watchlistId: string, symbol: string) =>
    request<{ ok: boolean }>(`/api/watchlists/${encodeURIComponent(watchlistId)}/items`, {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    }),
  removeFromWatchlist: (watchlistId: string, symbol: string) =>
    request<{ ok: boolean }>(
      `/api/watchlists/${encodeURIComponent(watchlistId)}/items/${encodeURIComponent(symbol)}`,
      { method: 'DELETE' },
    ),

  getPortfolio: () => request<PortfolioResponse>('/api/portfolio'),
  addHolding: (payload: { symbol: string; quantity: number; avgPrice: number; notes?: string }) =>
    request<PortfolioResponse>('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateHolding: (
    id: string,
    payload: { quantity: number; avgPrice: number; notes?: string },
  ) =>
    request<PortfolioResponse>(`/api/portfolio/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteHolding: (id: string) =>
    request<PortfolioResponse>(`/api/portfolio/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getStockDetail: (symbol: string, range: HistoryRange = '6mo') =>
    request<StockDetailResponse>(
      `/api/stock/${encodeURIComponent(symbol)}?range=${range}`,
    ),
  getStockHistory: (symbol: string, days = 30, range: HistoryRange = '30d') =>
    request<StockHistoryResponse>(
      `/api/stock/${encodeURIComponent(symbol)}/history?days=${days}&range=${range}`,
    ),
  getStockResearch: (symbol: string) =>
    request<StockResearchResponse>(
      `/api/stock/${encodeURIComponent(symbol)}/research`,
    ),
  createTargetMarker: (
    symbol: string,
    payload: { price: number; goal: TargetMarkerGoal; label?: string },
  ) =>
    request<{ marker: TargetPriceMarker; targetMarkers: TargetPriceMarker[] }>(
      `/api/stock/${encodeURIComponent(symbol)}/targets`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  deleteTargetMarker: (symbol: string, id: string) =>
    request<{ ok: boolean; targetMarkers: TargetPriceMarker[] }>(
      `/api/stock/${encodeURIComponent(symbol)}/targets/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  getAlerts: () =>
    request<{
      notifications: NotificationItem[];
      unreadCount: number;
      priceAlerts: PriceAlertRule[];
      settings: AlertSettings;
    }>('/api/alerts'),
  createPriceAlert: (payload: {
    symbol: string;
    metric: 'close' | 'changePct' | 'rsi14' | 'relVol';
    operator: 'gte' | 'lte';
    targetValue: number;
  }) =>
    request<{ priceAlert: PriceAlertRule }>('/api/alerts/price', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deletePriceAlert: (id: string) =>
    request<{ ok: boolean }>(`/api/alerts/price/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  runEodScan: (syncLatest = true) =>
    request<{
      tradeDate: string;
      createdCount: number;
      created: NotificationItem[];
      notifications: NotificationItem[];
      unreadCount: number;
      settings: AlertSettings;
    }>('/api/alerts/run-eod', {
      method: 'POST',
      body: JSON.stringify({ syncLatest }),
    }),
  markNotificationRead: (id: string) =>
    request<{ notifications: NotificationItem[]; unreadCount: number }>(
      `/api/alerts/notifications/${encodeURIComponent(id)}/read`,
      { method: 'PATCH' },
    ),
  clearNotifications: (onlyRead = false) =>
    request<{ notifications: NotificationItem[]; unreadCount: number }>(
      `/api/alerts/notifications?onlyRead=${onlyRead}`,
      { method: 'DELETE' },
    ),
  updateAlertSettings: (patch: Partial<AlertSettings>) =>
    request<{ settings: AlertSettings }>('/api/alerts/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  mcpRpc: <T = unknown>(method: string, params?: Record<string, unknown>) =>
    request<{
      jsonrpc: '2.0';
      id: number;
      result?: T;
      error?: { code: number; message: string; data?: unknown };
    }>('/api/mcp', {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        ...(params ? { params } : {}),
      }),
    }),
};
