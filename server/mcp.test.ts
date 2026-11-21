import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleMcpJsonRpc,
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCES,
  MCP_TOOLS,
  type McpServerDeps,
} from './mcp';
import type { ScannerDefinition, StockSnapshot } from '../src/shared/types';

const SAMPLE_SNAP: StockSnapshot = {
  symbol: 'RELIANCE',
  name: 'RELIANCE INDUSTRIES LTD',
  series: 'EQ',
  isin: 'INE002A01018',
  tradeDate: '2026-11-18',
  open: 1370,
  high: 1376.5,
  low: 1354,
  close: 1363,
  prevClose: 1367,
  change: -4,
  changePct: -0.29,
  volume: 18228940,
  turnoverCr: 2485,
  trades: 120000,
  avgVol20: 15000000,
  relVol: 1.22,
  sma20: 1271.9,
  sma50: 1242.5,
  ema9: 1330,
  ema20: 1290,
  rsi14: 64.5,
  atr14: 24.2,
  macd: 18.4,
  macdSignal: 12.1,
  change5dPct: 2.07,
  change20dPct: 10.5,
  high20d: 1376.5,
  low20d: 1152.2,
  distFromHigh20dPct: -0.98,
  gapPct: 0.22,
  dayRangePct: 1.66,
  historyDays: 30,
  patterns: {
    bullishEngulfing: false,
    bearishEngulfing: false,
    hammer: false,
    insideBar: false,
    nr7: false,
    emaCross: false,
    prevDayHighBreak: false,
    prevDayLowBreak: false,
    weeklyBreakout: false,
    sma20CrossUp: false,
    sma50CrossUp: false,
    macdBullCross: false,
    rsiCrossAbove50: false,
    rsiCrossAbove70: false,
    whiteMarubozu: false,
    blackMarubozu: false,
    doji: false,
    morningStar: false,
  },
};

const SAMPLE_SCANNER: ScannerDefinition = {
  id: 'high-rel-vol',
  name: 'High Rel Vol',
  description: 'Stocks with RelVol >= 1.1',
  category: 'Volume',
  seriesFilter: 'EQ',
  minClose: 10,
  minTurnoverCr: 1,
  logic: 'AND',
  conditions: [
    {
      id: 'c1',
      metric: 'relVol',
      operator: 'gte',
      compareToType: 'value',
      value: 1.1,
    },
  ],
  afterMarketAlert: false,
  isBuiltIn: true,
  createdAt: '2026-01-01T00:00:00Z',
};

function makeDeps(): McpServerDeps {
  return {
    ensureMarketLoaded: async () => {},
    ensureSectorsLoaded: async () => {},
    getMarketStatus: () => ({
      tradeDate: '2026-11-18',
      totalSymbols: 3534,
      eqSymbols: 2696,
      advances: 1400,
      declines: 2050,
      unchanged: 84,
      totalTurnoverCr: 98500,
      historyDaysLoaded: 30,
      lastSyncedAt: '2026-11-18T12:00:00Z',
      source: 'nse-bhavcopy',
      availableDates: ['2026-11-18'],
      syncing: false,
      error: null,
    }),
    getSnapshots: () => [SAMPLE_SNAP],
    getSnapshot: (sym) => (sym === 'RELIANCE' ? SAMPLE_SNAP : null),
    getSymbolSector: (sym) => (sym === 'RELIANCE' ? 'Energy' : null),
    searchSymbols: (q) => (q.toUpperCase().includes('REL') ? [SAMPLE_SNAP] : []),
    fetchStockHistory: async () => ({
      bars: [
        {
          date: '2026-11-18',
          open: 1370,
          high: 1376.5,
          low: 1354,
          close: 1363,
          prevClose: 1367,
          volume: 18228940,
          turnover: 24850000000,
          trades: 120000,
        },
      ],
      source: 'yahoo',
      multiYearSummary: {
        return30dPct: 12.66,
        return1yPct: -10.42,
        return3yPct: 15.52,
        return5yPct: 24.73,
        cagr5yPct: 4.53,
        high5y: 1611.8,
        low5y: 1006.07,
        firstDate: '2021-11-22',
        lastDate: '2026-11-18',
        totalBars: 1236,
      },
    }),
    getHeatmap: async (universe) => ({
      indexName: universe === 'NIFTY_50' ? 'Nifty 50' : 'All NSE Equities',
      universe,
      tradeDate: '2026-11-18',
      totalMarketCapCr: 1843000,
      advances: 0,
      declines: 1,
      unchanged: 0,
      avgChangePct: -0.29,
      weightedChangePct: -0.29,
      sectors: ['Energy'],
      constituents: [
        {
          symbol: 'RELIANCE',
          name: 'RELIANCE INDUSTRIES LTD',
          sector: 'Energy',
          close: 1363,
          change: -4,
          changePct: -0.29,
          marketCapCr: 1843000,
          turnoverCr: 2485,
          volume: 18228940,
          rsi14: 64.5,
          relVol: 1.22,
          inNifty50: true,
          inNifty500: true,
        },
      ],
    }),
    getScanners: () => [SAMPLE_SCANNER],
    getScannerById: (id) => (id === SAMPLE_SCANNER.id ? SAMPLE_SCANNER : undefined),
    getWatchlists: () => [
      { id: 'wl-1', name: 'Core Large Caps', symbols: ['RELIANCE'], createdAt: '2026-01-01T00:00:00Z' },
    ],
    getPortfolioHoldings: () => [
      { id: 'h-1', symbol: 'RELIANCE', quantity: 10, avgPrice: 1250, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ],
    getLatestTradeDate: () => '2026-11-18',
  };
}

test('MCP initialize, ping, tools/list, and resources/list conform to JSON-RPC 2.0', async () => {
  const deps = makeDeps();

  const initRes = await handleMcpJsonRpc(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: MCP_PROTOCOL_VERSION } },
    deps,
  );
  assert.ok(initRes && !initRes.error);
  const initResult = initRes.result as { protocolVersion: string; serverInfo: { name: string } };
  assert.equal(initResult.protocolVersion, MCP_PROTOCOL_VERSION);
  assert.equal(initResult.serverInfo.name, 'nse-pulse-mcp');

  const notifRes = await handleMcpJsonRpc(
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    deps,
  );
  assert.equal(notifRes, null);

  const toolsRes = await handleMcpJsonRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, deps);
  const tools = (toolsRes?.result as { tools: typeof MCP_TOOLS }).tools;
  assert.equal(tools.length, MCP_TOOLS.length);

  const resourcesRes = await handleMcpJsonRpc(
    { jsonrpc: '2.0', id: 3, method: 'resources/list' },
    deps,
  );
  const resources = (resourcesRes?.result as { resources: typeof MCP_RESOURCES }).resources;
  assert.equal(resources.length, MCP_RESOURCES.length);
});

test('MCP tools/call executes get_stock_quote, run_scanner, and get_portfolio', async () => {
  const deps = makeDeps();

  const quoteRes = await handleMcpJsonRpc(
    {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: { name: 'get_stock_quote', arguments: { symbol: 'reliance' } },
    },
    deps,
  );
  const quotePayload = (quoteRes?.result as { isError: boolean; structuredContent: { symbol: string; sector: string } });
  assert.equal(quotePayload.isError, false);
  assert.equal(quotePayload.structuredContent.symbol, 'RELIANCE');
  assert.equal(quotePayload.structuredContent.sector, 'Energy');

  const scanRes = await handleMcpJsonRpc(
    {
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: { name: 'run_scanner', arguments: { scannerId: 'high-rel-vol' } },
    },
    deps,
  );
  const scanPayload = (scanRes?.result as { structuredContent: { totalMatches: number } });
  assert.equal(scanPayload.structuredContent.totalMatches, 1);

  const portRes = await handleMcpJsonRpc(
    {
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: { name: 'get_portfolio', arguments: {} },
    },
    deps,
  );
  const portPayload = (portRes?.result as { structuredContent: { summary: { totalPnl: number } } });
  assert.equal(portPayload.structuredContent.summary.totalPnl, 1130);
});

test('MCP rejects unknown methods and unknown resource URIs cleanly', async () => {
  const deps = makeDeps();
  const badMethod = await handleMcpJsonRpc(
    { jsonrpc: '2.0', id: 99, method: 'does/not/exist' },
    deps,
  );
  assert.equal(badMethod?.error?.code, -32601);

  const badUri = await handleMcpJsonRpc(
    { jsonrpc: '2.0', id: 100, method: 'resources/read', params: { uri: 'nse://invalid' } },
    deps,
  );
  assert.equal(badUri?.error?.code, -32602);
});
