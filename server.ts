import 'dotenv/config';
import express from 'express';
import path from 'path';
import { evaluateScanner } from './src/shared/indicators';
import { computePortfolioMetrics, validateHoldingInput } from './src/shared/portfolio';
import type { HeatmapUniverse, HistoryRange, ScannerDefinition } from './src/shared/types';
import { researchIndianStock } from './server/geminiSearch';
import { marketData } from './server/marketData';
import {
  handleMcpJsonRpc,
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCES,
  MCP_SERVER_INFO,
  MCP_TOOLS,
} from './server/mcp';
import { userStore } from './server/store';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Warm market data in background on boot and run initial EOD scan if needed
  marketData
    .ensureLoaded()
    .then(() => {
      const latestDate = marketData.getLatestTradeDate();
      const settings = userStore.getSettings();
      if (
        latestDate &&
        settings.lastAutoScanTradeDate !== latestDate &&
        userStore.getNotifications().length === 0
      ) {
        userStore.runAfterMarketSweep(marketData.getSnapshots(), latestDate, false);
      }
    })
    .catch((err) => {
      console.error('Initial market sync error:', err);
    });

  // Periodic after-market check every 5 minutes (NSE BhavCopy publishes post-market ~17:00 IST)
  setInterval(async () => {
    try {
      const settings = userStore.getSettings();
      if (!settings.autoScanEnabled) return;
      const istNow = new Date(Date.now() + 5.5 * 3600 * 1000);
      const hhmm = `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}`;
      if (hhmm < settings.scanTimeIst) return;

      const { latestDate } = await marketData.syncMarketData(true);
      if (latestDate && settings.lastAutoScanTradeDate !== latestDate) {
        userStore.runAfterMarketSweep(marketData.getSnapshots(), latestDate, false);
      }
    } catch {
      // Background polling continues silently
    }
  }, 5 * 60 * 1000);

  // --- Market Data Routes ---
  app.get('/api/market/status', async (_req, res) => {
    await marketData.ensureLoaded();
    res.json(marketData.getMarketStatus());
  });

  app.post('/api/market/sync', async (_req, res) => {
    const syncRes = await marketData.syncMarketData(true);
    res.json({
      ...syncRes,
      status: marketData.getMarketStatus(),
    });
  });

  app.get('/api/market/breadth', async (_req, res) => {
    await marketData.ensureLoaded();
    const snaps = marketData.getSnapshots();
    const liquid = snaps.filter((s) => s.series === 'EQ' && s.turnoverCr >= 5);

    const topGainers = [...liquid]
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 12);
    const topLosers = [...liquid]
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, 12);
    const topTurnover = [...liquid]
      .sort((a, b) => b.turnoverCr - a.turnoverCr)
      .slice(0, 12);
    const volumeShockers = [...liquid]
      .filter((s) => s.relVol !== null && s.relVol >= 1.5)
      .sort((a, b) => (b.relVol ?? 0) - (a.relVol ?? 0))
      .slice(0, 12);

    res.json({
      status: marketData.getMarketStatus(),
      topGainers,
      topLosers,
      topTurnover,
      volumeShockers,
    });
  });

  app.get('/api/market/heatmap', async (req, res) => {
    try {
      const rawUniv = typeof req.query.universe === 'string' ? req.query.universe.toUpperCase() : 'ALL_NSE';
      const universe: HeatmapUniverse =
        rawUniv === 'NIFTY_50' || rawUniv === 'NIFTY_500' ? rawUniv : 'ALL_NSE';
      const heatmap = await marketData.getNifty50Heatmap(universe);
      res.json(heatmap);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load NSE market heatmap.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/market/sectors/performance', async (_req, res) => {
    try {
      const performance = await marketData.getSectorPerformance();
      res.json(performance);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to compute Nifty sector performance.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/market/search', async (req, res) => {
    await marketData.ensureLoaded();
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    res.json({
      results: marketData.searchSymbols(q, limit),
      totalUniverse: marketData.getSnapshots().length,
    });
  });

  // --- Scanner Routes ---
  app.get('/api/scanners', async (_req, res) => {
    await marketData.ensureLoaded();
    const snaps = marketData.getSnapshots();
    const scanners = userStore.getAllScanners().map((scanner) => {
      const matches = evaluateScanner(snaps, scanner);
      return {
        ...scanner,
        matchCount: matches.length,
        topSymbols: matches.slice(0, 5).map((m) => m.symbol),
      };
    });
    res.json({
      scanners,
      totalUniverse: snaps.length,
      tradeDate: marketData.getLatestTradeDate(),
    });
  });

  app.post('/api/scanners/preview', async (req, res) => {
    await marketData.ensureLoaded();
    const body = req.body as Partial<ScannerDefinition>;
    if (!body || !Array.isArray(body.conditions)) {
      res.status(400).json({ error: 'Conditions array is required.' });
      return;
    }
    const draft: ScannerDefinition = {
      id: 'preview',
      name: body.name || 'Preview',
      description: body.description || '',
      category: body.category || 'Custom',
      seriesFilter: body.seriesFilter || 'EQ',
      minClose: Number(body.minClose) || 0,
      minTurnoverCr: Number(body.minTurnoverCr) || 0,
      logic: body.logic === 'OR' ? 'OR' : 'AND',
      conditions: body.conditions,
      afterMarketAlert: Boolean(body.afterMarketAlert),
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };
    const snaps = marketData.getSnapshots();
    const matches = evaluateScanner(snaps, draft);
    res.json({
      matchCount: matches.length,
      totalUniverse: snaps.length,
      tradeDate: marketData.getLatestTradeDate(),
      results: matches.slice(0, 150),
    });
  });

  app.post('/api/scanners', async (req, res) => {
    await marketData.ensureLoaded();
    const body = req.body as Partial<ScannerDefinition>;
    const name = (body.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Scanner name is required.' });
      return;
    }
    if (!Array.isArray(body.conditions) || body.conditions.length === 0) {
      res.status(400).json({ error: 'Add at least one technical condition.' });
      return;
    }
    const created = userStore.createCustomScanner({
      name,
      description: (body.description || '').trim() || `Custom NSE scanner (${body.conditions.length} rules)`,
      category: 'Custom',
      seriesFilter: body.seriesFilter || 'EQ',
      minClose: Math.max(0, Number(body.minClose) || 0),
      minTurnoverCr: Math.max(0, Number(body.minTurnoverCr) || 0),
      logic: body.logic === 'OR' ? 'OR' : 'AND',
      conditions: body.conditions,
      afterMarketAlert: Boolean(body.afterMarketAlert),
    });
    const matches = evaluateScanner(marketData.getSnapshots(), created);
    res.status(201).json({
      scanner: {
        ...created,
        matchCount: matches.length,
        topSymbols: matches.slice(0, 5).map((m) => m.symbol),
      },
    });
  });

  app.patch('/api/scanners/:id', async (req, res) => {
    const updated = userStore.updateScanner(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Scanner not found.' });
      return;
    }
    res.json({ scanner: updated });
  });

  app.delete('/api/scanners/:id', (req, res) => {
    const deleted = userStore.deleteCustomScanner(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Custom scanner not found or cannot delete built-in scanner.' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/scanners/:id/results', async (req, res) => {
    await marketData.ensureLoaded();
    const scanner = userStore.getScannerById(req.params.id);
    if (!scanner) {
      res.status(404).json({ error: 'Scanner not found.' });
      return;
    }
    const snaps = marketData.getSnapshots();
    let matches = evaluateScanner(snaps, scanner);

    const q = typeof req.query.q === 'string' ? req.query.q.trim().toUpperCase() : '';
    if (q) {
      matches = matches.filter(
        (m) => m.symbol.includes(q) || m.name.toUpperCase().includes(q),
      );
    }

    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'turnoverCr';
    const dir = req.query.dir === 'asc' ? 1 : -1;
    matches.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortBy];
      const bv = (b as unknown as Record<string, unknown>)[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return 0;
    });

    res.json({
      scanner,
      totalMatches: matches.length,
      totalUniverse: snaps.length,
      tradeDate: marketData.getLatestTradeDate(),
      results: matches.slice(0, 250),
    });
  });

  // --- Watchlist Routes ---
  app.get('/api/watchlists', async (_req, res) => {
    await Promise.all([marketData.ensureLoaded(), marketData.ensureSectorMapLoaded()]);
    const snaps = marketData.getSnapshots();
    const scanners = userStore.getAllScanners();

    // Precompute scanner membership map for fast lookup across all watchlist symbols
    const symbolToScanners = new Map<string, { id: string; name: string; category: string }[]>();
    for (const sc of scanners) {
      const hits = evaluateScanner(snaps, sc);
      for (const h of hits) {
        const list = symbolToScanners.get(h.symbol) || [];
        list.push({ id: sc.id, name: sc.name, category: sc.category });
        symbolToScanners.set(h.symbol, list);
      }
    }

    const watchlists = userStore.getWatchlists().map((wl) => ({
      id: wl.id,
      name: wl.name,
      createdAt: wl.createdAt,
      items: wl.symbols.map((symbol) => ({
        symbol,
        sector: marketData.getSymbolSector(symbol),
        snapshot: marketData.getSnapshot(symbol),
        matchedScanners: symbolToScanners.get(symbol) || [],
      })),
    }));

    res.json({
      watchlists,
      tradeDate: marketData.getLatestTradeDate(),
    });
  });

  app.post('/api/watchlists', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Watchlist name is required.' });
      return;
    }
    const created = userStore.createWatchlist(name);
    res.status(201).json({ watchlist: created });
  });

  app.delete('/api/watchlists/:id', (req, res) => {
    const ok = userStore.deleteWatchlist(req.params.id);
    if (!ok) {
      res.status(400).json({ error: 'Cannot delete the last watchlist or watchlist not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/watchlists/:id/items', async (req, res) => {
    await marketData.ensureLoaded();
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase() : '';
    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required.' });
      return;
    }
    const snap = marketData.getSnapshot(symbol);
    if (!snap) {
      res.status(404).json({ error: `Symbol "${symbol}" was not found in NSE market data.` });
      return;
    }
    const updated = userStore.addSymbolToWatchlist(req.params.id, symbol);
    if (!updated) {
      res.status(404).json({ error: 'Watchlist not found.' });
      return;
    }
    res.json({ watchlist: updated, snapshot: snap });
  });

  app.delete('/api/watchlists/:id/items/:symbol', (req, res) => {
    const updated = userStore.removeSymbolFromWatchlist(req.params.id, req.params.symbol);
    if (!updated) {
      res.status(404).json({ error: 'Watchlist not found.' });
      return;
    }
    res.json({ watchlist: updated });
  });

  // --- Portfolio Holdings & P&L Routes ---
  const buildPortfolioResponse = () =>
    computePortfolioMetrics(
      userStore.getPortfolioHoldings(),
      (sym) => marketData.getSnapshot(sym),
      (sym) => marketData.getSymbolSector(sym),
      marketData.getLatestTradeDate(),
    );

  app.get('/api/portfolio', async (_req, res) => {
    await Promise.all([marketData.ensureLoaded(), marketData.ensureSectorMapLoaded()]);
    res.json(buildPortfolioResponse());
  });

  app.post('/api/portfolio', async (req, res) => {
    await Promise.all([marketData.ensureLoaded(), marketData.ensureSectorMapLoaded()]);
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase() : '';
    const quantity = Number(req.body?.quantity);
    const avgPrice = Number(req.body?.avgPrice);
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';

    const validationErr = validateHoldingInput(symbol, quantity, avgPrice);
    if (validationErr) {
      res.status(400).json({ error: validationErr });
      return;
    }

    const snap = marketData.getSnapshot(symbol);
    if (!snap) {
      res.status(404).json({ error: `Symbol "${symbol}" was not found in NSE market data.` });
      return;
    }

    userStore.addPortfolioHolding({ symbol, quantity, avgPrice, notes });
    res.status(201).json(buildPortfolioResponse());
  });

  app.patch('/api/portfolio/:id', async (req, res) => {
    await Promise.all([marketData.ensureLoaded(), marketData.ensureSectorMapLoaded()]);
    const quantity = Number(req.body?.quantity);
    const avgPrice = Number(req.body?.avgPrice);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ error: 'Quantity must be a positive number.' });
      return;
    }
    if (!Number.isFinite(avgPrice) || avgPrice <= 0) {
      res.status(400).json({ error: 'Average buy price must be greater than zero.' });
      return;
    }
    const updated = userStore.updatePortfolioHolding(req.params.id, {
      quantity,
      avgPrice,
      notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Portfolio holding not found.' });
      return;
    }
    res.json(buildPortfolioResponse());
  });

  app.delete('/api/portfolio/:id', async (req, res) => {
    await Promise.all([marketData.ensureLoaded(), marketData.ensureSectorMapLoaded()]);
    const ok = userStore.deletePortfolioHolding(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Portfolio holding not found.' });
      return;
    }
    res.json(buildPortfolioResponse());
  });

  const VALID_RANGES = new Set<HistoryRange>([
    '30d',
    '3mo',
    '6mo',
    '1y',
    '3y',
    '5y',
    '10y',
    'max',
  ]);

  // --- Stock Detail & Chart Route ---
  app.get('/api/stock/:symbol', async (req, res) => {
    await marketData.ensureLoaded();
    const symbol = req.params.symbol.trim().toUpperCase();
    const snapshot = marketData.getSnapshot(symbol);
    if (!snapshot) {
      res.status(404).json({ error: `Symbol ${symbol} not found.` });
      return;
    }
    const qRange = typeof req.query.range === 'string' ? (req.query.range as HistoryRange) : '6mo';
    const range: HistoryRange = VALID_RANGES.has(qRange) ? qRange : '6mo';
    const { bars, source, multiYearSummary } = await marketData.fetchStockChartHistory(symbol, range);

    const scanners = userStore.getAllScanners();
    const matchedScanners = scanners
      .filter((sc) => evaluateScanner([snapshot], sc).length > 0)
      .map((sc) => ({ id: sc.id, name: sc.name, category: sc.category }));

    res.json({
      snapshot,
      matchedScanners,
      bars,
      barSource: source,
      inWatchlists: userStore.getWatchlistIdsForSymbol(symbol),
      targetMarkers: userStore.getTargetMarkers(symbol),
      multiYearSummary,
    });
  });

  app.post('/api/stock/:symbol/targets', async (req, res) => {
    await marketData.ensureLoaded();
    const symbol = req.params.symbol.trim().toUpperCase();
    const snapshot = marketData.getSnapshot(symbol);
    if (!snapshot) {
      res.status(404).json({ error: `Symbol ${symbol} not found.` });
      return;
    }
    const price = Number(req.body?.price);
    const goal = req.body?.goal;
    const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 40) : '';

    if (!Number.isFinite(price) || price <= 0) {
      res.status(400).json({ error: 'Valid positive target price is required.' });
      return;
    }
    if (!['entry', 'exit', 'stop'].includes(goal)) {
      res.status(400).json({ error: 'Goal must be entry, exit, or stop.' });
      return;
    }

    const marker = userStore.createTargetMarker({ symbol, price, goal, label });
    res.status(201).json({
      marker,
      targetMarkers: userStore.getTargetMarkers(symbol),
    });
  });

  app.delete('/api/stock/:symbol/targets/:id', (req, res) => {
    const symbol = req.params.symbol.trim().toUpperCase();
    const ok = userStore.deleteTargetMarker(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Target marker not found.' });
      return;
    }
    res.json({
      ok: true,
      targetMarkers: userStore.getTargetMarkers(symbol),
    });
  });

  app.get('/api/stock/:symbol/history', async (req, res) => {
    await marketData.ensureLoaded();
    const symbol = req.params.symbol.trim().toUpperCase();
    const snapshot = marketData.getSnapshot(symbol);
    if (!snapshot) {
      res.status(404).json({ error: `Symbol ${symbol} not found.` });
      return;
    }
    const qRange =
      typeof req.query.range === 'string' && VALID_RANGES.has(req.query.range as HistoryRange)
        ? (req.query.range as HistoryRange)
        : undefined;
    const days = Math.min(2500, Math.max(7, Number(req.query.days) || 30));
    const { bars, lookbackBars, source, multiYearSummary } =
      await marketData.fetchThirtyDayHistory(symbol, days, qRange);
    res.json({
      symbol,
      days: bars.length,
      range: qRange || '30d',
      bars,
      lookbackBars,
      source,
      multiYearSummary,
    });
  });

  app.get('/api/stock/:symbol/research', async (req, res) => {
    await marketData.ensureLoaded();
    const symbol = req.params.symbol.trim().toUpperCase();
    const snapshot = marketData.getSnapshot(symbol);
    if (!snapshot) {
      res.status(404).json({ error: `Symbol ${symbol} not found.` });
      return;
    }
    try {
      const research = await researchIndianStock(
        snapshot.symbol,
        snapshot.name,
        snapshot.close,
        snapshot.changePct,
        snapshot.tradeDate,
      );
      res.json(research);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to fetch market research.';
      res.status(502).json({ error: message });
    }
  });

  // --- After-Market Alerts & Notifications ---
  app.get('/api/alerts', (_req, res) => {
    const notifications = userStore.getNotifications();
    res.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      priceAlerts: userStore.getPriceAlerts(),
      settings: userStore.getSettings(),
    });
  });

  app.post('/api/alerts/price', async (req, res) => {
    await marketData.ensureLoaded();
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase() : '';
    const metric = req.body?.metric;
    const operator = req.body?.operator;
    const targetValue = Number(req.body?.targetValue);

    if (!symbol || !marketData.getSnapshot(symbol)) {
      res.status(400).json({ error: 'Valid NSE symbol is required.' });
      return;
    }
    if (!['close', 'changePct', 'rsi14', 'relVol'].includes(metric)) {
      res.status(400).json({ error: 'Invalid alert metric.' });
      return;
    }
    if (!['gte', 'lte'].includes(operator)) {
      res.status(400).json({ error: 'Invalid operator.' });
      return;
    }
    if (Number.isNaN(targetValue)) {
      res.status(400).json({ error: 'Numeric target value is required.' });
      return;
    }

    const created = userStore.createPriceAlert({
      symbol,
      metric,
      operator,
      targetValue,
      enabled: true,
    });
    res.status(201).json({ priceAlert: created });
  });

  app.delete('/api/alerts/price/:id', (req, res) => {
    const ok = userStore.deletePriceAlert(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Alert rule not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/alerts/run-eod', async (req, res) => {
    const syncLatest = req.body?.syncLatest !== false;
    if (syncLatest) {
      await marketData.syncMarketData(true);
    } else {
      await marketData.ensureLoaded();
    }
    const tradeDate = marketData.getLatestTradeDate();
    if (!tradeDate) {
      res.status(503).json({ error: 'Market data unavailable.' });
      return;
    }
    const created = userStore.runAfterMarketSweep(
      marketData.getSnapshots(),
      tradeDate,
      true,
    );
    const notifications = userStore.getNotifications();
    res.json({
      tradeDate,
      createdCount: created.length,
      created,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      settings: userStore.getSettings(),
    });
  });

  app.patch('/api/alerts/notifications/:id/read', (req, res) => {
    userStore.markNotificationRead(req.params.id);
    const notifications = userStore.getNotifications();
    res.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  });

  app.delete('/api/alerts/notifications', (req, res) => {
    const onlyRead = req.query.onlyRead === 'true';
    userStore.clearNotifications(onlyRead);
    const notifications = userStore.getNotifications();
    res.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  });

  app.patch('/api/alerts/settings', (req, res) => {
    const settings = userStore.updateSettings({
      ...(typeof req.body?.autoScanEnabled === 'boolean'
        ? { autoScanEnabled: req.body.autoScanEnabled }
        : {}),
      ...(typeof req.body?.scanTimeIst === 'string' ? { scanTimeIst: req.body.scanTimeIst } : {}),
    });
    res.json({ settings });
  });

  // --- Model Context Protocol (MCP) Streamable HTTP Endpoint ---
  const mcpDeps = {
    ensureMarketLoaded: () => marketData.ensureLoaded(),
    ensureSectorsLoaded: () => marketData.ensureSectorMapLoaded(),
    getMarketStatus: () => marketData.getMarketStatus(),
    getSnapshots: () => marketData.getSnapshots(),
    getSnapshot: (symbol: string) => marketData.getSnapshot(symbol),
    getSymbolSector: (symbol: string) => marketData.getSymbolSector(symbol),
    searchSymbols: (query: string, limit: number) => marketData.searchSymbols(query, limit),
    fetchStockHistory: (symbol: string, range: HistoryRange) =>
      marketData.fetchStockChartHistory(symbol, range),
    getHeatmap: (universe: HeatmapUniverse) => marketData.getNifty50Heatmap(universe),
    getScanners: () => userStore.getAllScanners(),
    getScannerById: (id: string) => userStore.getScannerById(id),
    getWatchlists: () => userStore.getWatchlists(),
    getPortfolioHoldings: () => userStore.getPortfolioHoldings(),
    getLatestTradeDate: () => marketData.getLatestTradeDate(),
  };

  app.options('/api/mcp', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
    res.status(204).end();
  });

  app.get('/api/mcp', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      protocol: 'Model Context Protocol (JSON-RPC 2.0 Streamable HTTP)',
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: MCP_SERVER_INFO,
      endpoint: '/api/mcp',
      methods: ['initialize', 'ping', 'tools/list', 'tools/call', 'resources/list', 'resources/read'],
      toolCount: MCP_TOOLS.length,
      resourceCount: MCP_RESOURCES.length,
      tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
      resources: MCP_RESOURCES,
    });
  });

  app.post('/api/mcp', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
    try {
      const response = await handleMcpJsonRpc(req.body, mcpDeps);
      if (response === null) {
        res.status(202).end();
        return;
      }
      res.json(response);
    } catch (err) {
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Internal MCP server error.',
        },
      });
    }
  });

  // --- Vite / Static Frontend ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NSE Pulse server running on http://localhost:${PORT}`);
  });
}

startServer();
