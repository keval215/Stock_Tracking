import { evaluateScanner } from '../src/shared/indicators';
import { computePortfolioMetrics } from '../src/shared/portfolio';
import type {
  HeatmapUniverse,
  HistoryRange,
  MarketStatus,
  MultiYearReturnSummary,
  NiftyHeatmapResponse,
  OHLCVBar,
  PortfolioHolding,
  ScannerDefinition,
  StockSnapshot,
  Watchlist,
} from '../src/shared/types';

export const MCP_PROTOCOL_VERSION = '2025-03-26';
export const MCP_SERVER_INFO = {
  name: 'nse-pulse-mcp',
  version: '1.0.0',
  title: 'NSE Pulse Indian Equities MCP Server',
};

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
  };
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpServerDeps {
  ensureMarketLoaded: () => Promise<void>;
  ensureSectorsLoaded: () => Promise<void>;
  getMarketStatus: () => MarketStatus;
  getSnapshots: () => StockSnapshot[];
  getSnapshot: (symbol: string) => StockSnapshot | null;
  getSymbolSector: (symbol: string) => string | null;
  searchSymbols: (query: string, limit: number) => StockSnapshot[];
  fetchStockHistory: (
    symbol: string,
    range: HistoryRange,
  ) => Promise<{
    bars: OHLCVBar[];
    source: 'yahoo' | 'nse-bhavcopy';
    multiYearSummary?: MultiYearReturnSummary;
  }>;
  getHeatmap: (universe: HeatmapUniverse) => Promise<NiftyHeatmapResponse>;
  getScanners: () => ScannerDefinition[];
  getScannerById: (id: string) => ScannerDefinition | null | undefined;
  getWatchlists: () => Watchlist[];
  getPortfolioHoldings: () => PortfolioHolding[];
  getLatestTradeDate: () => string | null;
}

const VALID_HISTORY_RANGES = new Set<HistoryRange>([
  '30d',
  '3mo',
  '6mo',
  '1y',
  '3y',
  '5y',
  '10y',
  'max',
]);

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'get_market_status',
    description:
      'Returns the latest NSE end-of-day BhavCopy trading date, total indexed symbols, advances, declines, unchanged count, and cash market turnover in Crores.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_stock_quote',
    description:
      'Returns the full NSE end-of-day OHLCV quote, sector, RSI(14), SMA(20/50), EMA(9/20), MACD, ATR(14), relative volume, candlestick patterns, and matched scanners for an NSE stock symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'NSE equity ticker symbol (e.g. RELIANCE, TCS, HDFCBANK, SBIN).',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_stock_history',
    description:
      'Fetches historical OHLCV bars for an NSE stock (30d up to 10y/max) along with multi-year performance metrics (30D, 1Y, 3Y, 5Y return, 5Y CAGR, and 5Y high/low).',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'NSE equity ticker symbol (e.g. RELIANCE, INFY).',
        },
        range: {
          type: 'string',
          enum: ['30d', '3mo', '6mo', '1y', '3y', '5y', '10y', 'max'],
          description: 'Historical range to fetch (defaults to 30d).',
        },
        limitBars: {
          type: 'number',
          description: 'Optional maximum number of trailing OHLCV bars to include in the output (defaults to 60).',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'search_nse_stocks',
    description:
      'Searches across all indexed NSE equities (~3,500 symbols) by ticker prefix or company name and returns matching end-of-day quotes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Symbol or company name search query (e.g. TATA, BANK, PHARMA).',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (1–50, default 15).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_scanners',
    description:
      'Lists all built-in (including StockEdge technical screeners) and user-created NSE scanners with their live EOD match counts and top matching symbols.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional scanner category filter (e.g. Breakout, Momentum, Volume, Moving Averages, Candlesticks, Custom).',
        },
      },
    },
  },
  {
    name: 'run_scanner',
    description:
      'Executes a specific NSE technical scanner by ID across the entire NSE market and returns matching equities sorted by turnover, 1D change, RSI, or relative volume.',
    inputSchema: {
      type: 'object',
      properties: {
        scannerId: {
          type: 'string',
          description: 'Scanner ID from list_scanners (e.g. se-prev-day-high, liquid-momentum, breakout-20d).',
        },
        sortBy: {
          type: 'string',
          enum: ['turnoverCr', 'changePct', 'change5dPct', 'relVol', 'rsi14', 'close'],
          description: 'Metric to sort results descending by (default: turnoverCr).',
        },
        limit: {
          type: 'number',
          description: 'Maximum matching stocks to return (1–100, default 20).',
        },
      },
      required: ['scannerId'],
    },
  },
  {
    name: 'get_sector_heatmap',
    description:
      'Returns live NSE category/sector heatmap breadth, cap-weighted daily return, equal-weight return, market cap, and top movers across All NSE, Nifty 500, or Nifty 50.',
    inputSchema: {
      type: 'object',
      properties: {
        universe: {
          type: 'string',
          enum: ['ALL_NSE', 'NIFTY_500', 'NIFTY_50'],
          description: 'Stock universe to aggregate (default: ALL_NSE).',
        },
        category: {
          type: 'string',
          description: 'Optional sector/category filter (e.g. Bank, IT, Energy, Pharma) to inspect its top constituent stocks.',
        },
      },
    },
  },
  {
    name: 'get_watchlists',
    description:
      'Returns all saved user watchlists enriched with live NSE closing prices, 1D % change, RSI(14), sector, and active scanner triggers.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_portfolio',
    description:
      'Returns personal NSE equity portfolio holdings, total invested cost, current EOD valuation, overall P&L, day P&L, and per-holding weights.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export const MCP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: 'nse://market/status',
    name: 'NSE EOD Market Status',
    description: 'Latest synced NSE BhavCopy session summary, market breadth, and turnover.',
    mimeType: 'application/json',
  },
  {
    uri: 'nse://watchlists',
    name: 'Saved Watchlists',
    description: 'User watchlists with live NSE closing prices and scanner matches.',
    mimeType: 'application/json',
  },
  {
    uri: 'nse://portfolio',
    name: 'Personal Equity Portfolio',
    description: 'Tracked NSE holdings with live mark-to-market P&L and allocation weights.',
    mimeType: 'application/json',
  },
];

function rpcResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: data !== undefined ? { code, message, data } : { code, message },
  };
}

function toolSuccess(payload: unknown) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
    isError: false,
  };
}

function toolFailure(message: string) {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

export async function handleMcpJsonRpc(
  body: unknown,
  deps: McpServerDeps,
): Promise<JsonRpcResponse | null> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return rpcError(null, -32600, 'Invalid Request: expected JSON-RPC 2.0 object.');
  }

  const req = body as JsonRpcRequest;
  const id = req.id !== undefined ? req.id : null;
  const method = req.method;

  if (req.jsonrpc !== '2.0' || typeof method !== 'string') {
    return rpcError(id, -32600, 'Invalid Request: jsonrpc must be "2.0" and method must be a string.');
  }

  // Notifications have no id and expect no JSON-RPC response body
  if (method.startsWith('notifications/')) {
    return null;
  }

  if (method === 'initialize') {
    const requestedVersion =
      typeof req.params?.protocolVersion === 'string'
        ? req.params.protocolVersion
        : MCP_PROTOCOL_VERSION;
    return rpcResult(id, {
      protocolVersion: requestedVersion,
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
      },
      serverInfo: MCP_SERVER_INFO,
      instructions:
        'Use NSE Pulse MCP tools to inspect real Indian NSE equity EOD quotes, 5Y+ historical OHLCV bars, technical scanners, all-NSE category heatmaps, watchlists, and portfolio P&L.',
    });
  }

  if (method === 'ping') {
    return rpcResult(id, {});
  }

  if (method === 'tools/list') {
    return rpcResult(id, { tools: MCP_TOOLS });
  }

  if (method === 'resources/list') {
    return rpcResult(id, { resources: MCP_RESOURCES });
  }

  if (method === 'resources/read') {
    const uri = typeof req.params?.uri === 'string' ? req.params.uri : '';
    if (!uri) {
      return rpcError(id, -32602, 'Invalid params: "uri" string is required.');
    }
    try {
      await Promise.all([deps.ensureMarketLoaded(), deps.ensureSectorsLoaded()]);
      if (uri === 'nse://market/status') {
        const status = deps.getMarketStatus();
        return rpcResult(id, {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(status, null, 2),
            },
          ],
        });
      }
      if (uri === 'nse://watchlists') {
        const data = buildWatchlistsPayload(deps);
        return rpcResult(id, {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        });
      }
      if (uri === 'nse://portfolio') {
        const portfolio = computePortfolioMetrics(
          deps.getPortfolioHoldings(),
          (sym) => deps.getSnapshot(sym),
          (sym) => deps.getSymbolSector(sym),
          deps.getLatestTradeDate(),
        );
        return rpcResult(id, {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(portfolio, null, 2),
            },
          ],
        });
      }
      return rpcError(id, -32602, `Unknown resource URI: ${uri}`);
    } catch (err) {
      return rpcError(
        id,
        -32603,
        err instanceof Error ? err.message : 'Failed to read MCP resource.',
      );
    }
  }

  if (method === 'tools/call') {
    const name = typeof req.params?.name === 'string' ? req.params.name : '';
    const args =
      req.params?.arguments && typeof req.params.arguments === 'object'
        ? (req.params.arguments as Record<string, unknown>)
        : {};

    if (!name) {
      return rpcError(id, -32602, 'Invalid params: tool "name" is required.');
    }

    try {
      const result = await executeMcpTool(name, args, deps);
      return rpcResult(id, result);
    } catch (err) {
      return rpcError(
        id,
        -32603,
        err instanceof Error ? err.message : 'Internal error executing MCP tool.',
      );
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}

function buildWatchlistsPayload(deps: McpServerDeps) {
  const snaps = deps.getSnapshots();
  const scanners = deps.getScanners();
  const symbolToScanners = new Map<string, string[]>();
  for (const sc of scanners) {
    const hits = evaluateScanner(snaps, sc);
    for (const h of hits) {
      const list = symbolToScanners.get(h.symbol) || [];
      list.push(sc.name);
      symbolToScanners.set(h.symbol, list);
    }
  }

  return {
    tradeDate: deps.getLatestTradeDate(),
    watchlists: deps.getWatchlists().map((wl) => ({
      id: wl.id,
      name: wl.name,
      symbolCount: wl.symbols.length,
      items: wl.symbols.map((sym) => {
        const snap = deps.getSnapshot(sym);
        return {
          symbol: sym,
          sector: deps.getSymbolSector(sym),
          close: snap?.close ?? null,
          changePct: snap?.changePct ?? null,
          rsi14: snap?.rsi14 ?? null,
          relVol: snap?.relVol ?? null,
          matchedScanners: symbolToScanners.get(sym) || [],
        };
      }),
    })),
  };
}

async function executeMcpTool(
  name: string,
  args: Record<string, unknown>,
  deps: McpServerDeps,
) {
  switch (name) {
    case 'get_market_status': {
      await deps.ensureMarketLoaded();
      return toolSuccess(deps.getMarketStatus());
    }

    case 'get_stock_quote': {
      await Promise.all([deps.ensureMarketLoaded(), deps.ensureSectorsLoaded()]);
      const symbol = typeof args.symbol === 'string' ? args.symbol.trim().toUpperCase() : '';
      if (!symbol) return toolFailure('Parameter "symbol" is required (e.g. RELIANCE).');
      const snap = deps.getSnapshot(symbol);
      if (!snap) return toolFailure(`NSE symbol "${symbol}" was not found in BhavCopy data.`);
      const matchedScanners = deps
        .getScanners()
        .filter((sc) => evaluateScanner([snap], sc).length > 0)
        .map((sc) => ({ id: sc.id, name: sc.name, category: sc.category }));
      return toolSuccess({
        symbol: snap.symbol,
        name: snap.name,
        sector: deps.getSymbolSector(symbol),
        tradeDate: snap.tradeDate,
        series: snap.series,
        ohlcv: {
          open: snap.open,
          high: snap.high,
          low: snap.low,
          close: snap.close,
          prevClose: snap.prevClose,
          change: snap.change,
          changePct: snap.changePct,
          volume: snap.volume,
          turnoverCr: snap.turnoverCr,
        },
        technicals: {
          change5dPct: snap.change5dPct,
          change20dPct: snap.change20dPct,
          sma20: snap.sma20,
          sma50: snap.sma50,
          ema9: snap.ema9,
          ema20: snap.ema20,
          rsi14: snap.rsi14,
          relVol: snap.relVol,
          atr14: snap.atr14,
          macd: snap.macd,
          macdSignal: snap.macdSignal,
          high20d: snap.high20d,
          low20d: snap.low20d,
        },
        patterns: snap.patterns,
        matchedScanners,
      });
    }

    case 'get_stock_history': {
      await deps.ensureMarketLoaded();
      const symbol = typeof args.symbol === 'string' ? args.symbol.trim().toUpperCase() : '';
      if (!symbol) return toolFailure('Parameter "symbol" is required (e.g. RELIANCE).');
      if (!deps.getSnapshot(symbol)) {
        return toolFailure(`NSE symbol "${symbol}" was not found in BhavCopy data.`);
      }
      const rawRange = typeof args.range === 'string' ? (args.range as HistoryRange) : '30d';
      const range: HistoryRange = VALID_HISTORY_RANGES.has(rawRange) ? rawRange : '30d';
      const limitBars = Math.min(
        500,
        Math.max(5, typeof args.limitBars === 'number' ? Math.floor(args.limitBars) : 60),
      );
      const { bars, source, multiYearSummary } = await deps.fetchStockHistory(symbol, range);
      const sliced = bars.slice(-limitBars);
      return toolSuccess({
        symbol,
        range,
        source,
        totalBarsInRange: bars.length,
        returnedBars: sliced.length,
        multiYearSummary: multiYearSummary ?? null,
        bars: sliced,
      });
    }

    case 'search_nse_stocks': {
      await deps.ensureMarketLoaded();
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      if (!query) return toolFailure('Parameter "query" is required.');
      const limit = Math.min(
        50,
        Math.max(1, typeof args.limit === 'number' ? Math.floor(args.limit) : 15),
      );
      const results = deps.searchSymbols(query, limit).map((s) => ({
        symbol: s.symbol,
        name: s.name,
        series: s.series,
        close: s.close,
        changePct: s.changePct,
        turnoverCr: s.turnoverCr,
        rsi14: s.rsi14,
      }));
      return toolSuccess({ query, count: results.length, results });
    }

    case 'list_scanners': {
      await deps.ensureMarketLoaded();
      const snaps = deps.getSnapshots();
      const categoryFilter =
        typeof args.category === 'string' ? args.category.trim().toLowerCase() : '';
      const scanners = deps
        .getScanners()
        .filter((sc) =>
          categoryFilter ? sc.category.toLowerCase().includes(categoryFilter) : true,
        )
        .map((sc) => {
          const matches = evaluateScanner(snaps, sc);
          return {
            id: sc.id,
            name: sc.name,
            category: sc.category,
            description: sc.description,
            matchCount: matches.length,
            topSymbols: matches.slice(0, 5).map((m) => m.symbol),
          };
        });
      return toolSuccess({
        tradeDate: deps.getLatestTradeDate(),
        scannerCount: scanners.length,
        scanners,
      });
    }

    case 'run_scanner': {
      await deps.ensureMarketLoaded();
      const scannerId = typeof args.scannerId === 'string' ? args.scannerId.trim() : '';
      if (!scannerId) return toolFailure('Parameter "scannerId" is required.');
      const scanner = deps.getScannerById(scannerId);
      if (!scanner) {
        return toolFailure(`Scanner "${scannerId}" was not found. Call list_scanners for valid IDs.`);
      }
      const sortBy = typeof args.sortBy === 'string' ? args.sortBy : 'turnoverCr';
      const limit = Math.min(
        100,
        Math.max(1, typeof args.limit === 'number' ? Math.floor(args.limit) : 20),
      );
      const matches = evaluateScanner(deps.getSnapshots(), scanner);
      matches.sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[sortBy];
        const bv = (b as unknown as Record<string, unknown>)[sortBy];
        if (typeof av === 'number' && typeof bv === 'number') return bv - av;
        return b.turnoverCr - a.turnoverCr;
      });
      return toolSuccess({
        scanner: {
          id: scanner.id,
          name: scanner.name,
          category: scanner.category,
          description: scanner.description,
        },
        tradeDate: deps.getLatestTradeDate(),
        totalMatches: matches.length,
        results: matches.slice(0, limit).map((m) => ({
          symbol: m.symbol,
          name: m.name,
          close: m.close,
          changePct: m.changePct,
          change5dPct: m.change5dPct,
          rsi14: m.rsi14,
          relVol: m.relVol,
          turnoverCr: m.turnoverCr,
        })),
      });
    }

    case 'get_sector_heatmap': {
      const rawUniv =
        typeof args.universe === 'string' ? args.universe.trim().toUpperCase() : 'ALL_NSE';
      const universe: HeatmapUniverse =
        rawUniv === 'NIFTY_50' || rawUniv === 'NIFTY_500' ? rawUniv : 'ALL_NSE';
      const categoryQuery =
        typeof args.category === 'string' ? args.category.trim().toLowerCase() : '';
      const heatmap = await deps.getHeatmap(universe);

      const byCat = new Map<
        string,
        {
          category: string;
          stocks: typeof heatmap.constituents;
          totalCap: number;
          weightedSum: number;
          sumChange: number;
          advances: number;
          declines: number;
        }
      >();
      for (const st of heatmap.constituents) {
        const cat = st.sector || 'Diversified';
        const bucket = byCat.get(cat) || {
          category: cat,
          stocks: [],
          totalCap: 0,
          weightedSum: 0,
          sumChange: 0,
          advances: 0,
          declines: 0,
        };
        bucket.stocks.push(st);
        bucket.totalCap += st.marketCapCr;
        bucket.weightedSum += st.changePct * st.marketCapCr;
        bucket.sumChange += st.changePct;
        if (st.changePct > 0) bucket.advances++;
        else if (st.changePct < 0) bucket.declines++;
        byCat.set(cat, bucket);
      }

      const categories = Array.from(byCat.values())
        .filter((b) => (categoryQuery ? b.category.toLowerCase().includes(categoryQuery) : true))
        .sort((a, b) => b.totalCap - a.totalCap)
        .map((b) => {
          const sorted = [...b.stocks].sort((x, y) => y.marketCapCr - x.marketCapCr);
          return {
            category: b.category,
            stockCount: b.stocks.length,
            advances: b.advances,
            declines: b.declines,
            marketCapCr: Math.round(b.totalCap),
            capWeightedChangePct:
              b.totalCap > 0 ? Number((b.weightedSum / b.totalCap).toFixed(2)) : 0,
            equalWeightChangePct:
              b.stocks.length > 0 ? Number((b.sumChange / b.stocks.length).toFixed(2)) : 0,
            topConstituents: sorted.slice(0, categoryQuery ? 25 : 5).map((s) => ({
              symbol: s.symbol,
              close: s.close,
              changePct: s.changePct,
              marketCapCr: s.marketCapCr,
            })),
          };
        });

      return toolSuccess({
        universe: heatmap.universe,
        tradeDate: heatmap.tradeDate,
        totalStocks: heatmap.constituents.length,
        totalMarketCapCr: heatmap.totalMarketCapCr,
        categoryCount: categories.length,
        categories,
      });
    }

    case 'get_watchlists': {
      await Promise.all([deps.ensureMarketLoaded(), deps.ensureSectorsLoaded()]);
      return toolSuccess(buildWatchlistsPayload(deps));
    }

    case 'get_portfolio': {
      await Promise.all([deps.ensureMarketLoaded(), deps.ensureSectorsLoaded()]);
      const portfolio = computePortfolioMetrics(
        deps.getPortfolioHoldings(),
        (sym) => deps.getSnapshot(sym),
        (sym) => deps.getSymbolSector(sym),
        deps.getLatestTradeDate(),
      );
      return toolSuccess(portfolio);
    }

    default:
      return toolFailure(`Unknown MCP tool "${name}". Call tools/list to see available tools.`);
  }
}
