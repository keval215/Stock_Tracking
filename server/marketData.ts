import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import {
  computeHeatmapAggregates,
  computeMultiYearSummary,
  normalizeStockCategory,
} from '../src/shared/heatmap';
import { buildStockSnapshot } from '../src/shared/indicators';
import {
  computeTopBottomSectorPerformance,
  normalizeNiftyIndustry,
} from '../src/shared/sectors';
import type {
  HeatmapUniverse,
  HistoryRange,
  MarketStatus,
  MultiYearReturnSummary,
  NiftyHeatmapResponse,
  NiftyHeatmapStock,
  OHLCVBar,
  SectorPerformanceSummary,
  StockSnapshot,
} from '../src/shared/types';

interface SymbolRecord {
  symbol: string;
  name: string;
  series: string;
  isin: string;
  bars: OHLCVBar[];
}

interface DiskCache {
  version: number;
  datesLoaded: string[];
  lastSyncedAt: string;
  symbols: Record<string, SymbolRecord>;
}

const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'nse_market_cache.json');
const NIFTY_CACHE_FILE = path.join(CACHE_DIR, 'nifty50_meta.json');
const SECTOR_CACHE_FILE = path.join(CACHE_DIR, 'nse_sectors_v2.json');
const EQUITY_SERIES = new Set(['EQ', 'BE', 'SM', 'BZ', 'ST']);
const TARGET_TRADING_DAYS = 55;
const LOOKBACK_CALENDAR_DAYS = 90;

interface NiftyConstituentMeta {
  symbol: string;
  name: string;
  sector: string;
  marketCapCr: number;
}

interface NiftyDiskCache {
  updatedAt: string;
  constituents: NiftyConstituentMeta[];
}

interface SectorDiskCache {
  version?: number;
  updatedAt: string;
  sectors: Record<string, string>;
  marketCapsCr?: Record<string, number>;
  nifty50?: string[];
  nifty500?: string[];
}

const NIFTY_SECTOR_INDEX_FEEDS: Array<{ url: string; label: string }> = [
  { url: 'https://nsearchives.nseindia.com/content/indices/ind_niftybanklist.csv', label: 'Bank' },
  { url: 'https://nsearchives.nseindia.com/content/indices/ind_niftyitlist.csv', label: 'IT' },
  { url: 'https://nsearchives.nseindia.com/content/indices/ind_niftypharmalist.csv', label: 'Pharma' },
  { url: 'https://nsearchives.nseindia.com/content/indices/ind_niftyautolist.csv', label: 'Auto' },
  { url: 'https://nsearchives.nseindia.com/content/indices/ind_niftyfmcglist.csv', label: 'FMCG' },
  { url: 'https://nsearchives.nseindia.com/content/indices/ind_niftymetallist.csv', label: 'Metal' },
  { url: 'https://nsearchives.nseindia.com/content/indices/ind_niftyrealtylist.csv', label: 'Realty' },
  {
    url: 'https://nsearchives.nseindia.com/content/indices/ind_niftyfinancelist.csv',
    label: 'Financial Services',
  },
  { url: 'https://nsearchives.nseindia.com/content/indices/ind_niftyenergylist.csv', label: 'Energy' },
];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function formatDateCompact(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function getCandidateDates(maxCalendarDays = LOOKBACK_CALENDAR_DAYS): string[] {
  // Compute today's date in IST (+05:30)
  const nowUtc = Date.now();
  const istNow = new Date(nowUtc + 5.5 * 3600 * 1000);
  const dates: string[] = [];
  for (let i = 0; i < maxCalendarDays; i++) {
    const dt = new Date(istNow.getTime() - i * 86400000);
    const day = dt.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(formatDateCompact(dt));
    }
  }
  return dates;
}

async function fetchSingleBhavCopy(dateCompact: string): Promise<{
  dateIso: string;
  rows: Array<{
    symbol: string;
    name: string;
    series: string;
    isin: string;
    bar: OHLCVBar;
  }>;
} | null> {
  const url = `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${dateCompact}_F_0000.csv.zip`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        Accept: '*/*',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const arrayBuf = await res.arrayBuffer();
    const zip = new AdmZip(Buffer.from(arrayBuf));
    const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('.csv'));
    if (!entry) return null;

    const csvText = entry.getData().toString('utf8');
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return null;

    const header = parseCsvLine(lines[0]);
    const idx = {
      tradDt: header.indexOf('TradDt'),
      finInstrmTp: header.indexOf('FinInstrmTp'),
      isin: header.indexOf('ISIN'),
      symbol: header.indexOf('TckrSymb'),
      series: header.indexOf('SctySrs'),
      name: header.indexOf('FinInstrmNm'),
      open: header.indexOf('OpnPric'),
      high: header.indexOf('HghPric'),
      low: header.indexOf('LwPric'),
      close: header.indexOf('ClsPric'),
      prevClose: header.indexOf('PrvsClsgPric'),
      volume: header.indexOf('TtlTradgVol'),
      turnover: header.indexOf('TtlTrfVal'),
      trades: header.indexOf('TtlNbOfTxsExctd'),
    };

    if (idx.symbol < 0 || idx.close < 0) return null;

    const dateIso = `${dateCompact.slice(0, 4)}-${dateCompact.slice(4, 6)}-${dateCompact.slice(6, 8)}`;
    const rows: Array<{
      symbol: string;
      name: string;
      series: string;
      isin: string;
      bar: OHLCVBar;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const cols = parseCsvLine(line);
      if (cols.length < 15) continue;

      const instType = idx.finInstrmTp >= 0 ? cols[idx.finInstrmTp] : 'STK';
      const series = cols[idx.series] || '';
      if (instType !== 'STK' || !EQUITY_SERIES.has(series)) continue;

      const symbol = cols[idx.symbol];
      const close = parseFloat(cols[idx.close]);
      const open = parseFloat(cols[idx.open]);
      const high = parseFloat(cols[idx.high]);
      const low = parseFloat(cols[idx.low]);
      const prevClose = parseFloat(cols[idx.prevClose]);
      const volume = parseInt(cols[idx.volume], 10) || 0;
      const turnover = parseFloat(cols[idx.turnover]) || 0;
      const trades = parseInt(cols[idx.trades], 10) || 0;

      if (!symbol || Number.isNaN(close) || close <= 0) continue;

      rows.push({
        symbol,
        name: cols[idx.name] || symbol,
        series,
        isin: cols[idx.isin] || '',
        bar: {
          date: cols[idx.tradDt] || dateIso,
          open: Number.isNaN(open) ? close : open,
          high: Number.isNaN(high) ? close : high,
          low: Number.isNaN(low) ? close : low,
          close,
          prevClose: Number.isNaN(prevClose) ? close : prevClose,
          volume,
          turnover,
          trades,
        },
      });
    }

    return { dateIso, rows };
  } catch {
    return null;
  }
}

class MarketDataService {
  private symbolsMap = new Map<string, SymbolRecord>();
  private datesLoaded: string[] = [];
  private snapshots: StockSnapshot[] = [];
  private snapshotBySymbol = new Map<string, StockSnapshot>();
  private syncing = false;
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.loadFromDiskCache();
  }

  private loadFromDiskCache(): void {
    try {
      if (!fs.existsSync(CACHE_FILE)) return;
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as DiskCache;
      if (parsed.version !== 1 || !parsed.symbols) return;
      this.symbolsMap = new Map(Object.entries(parsed.symbols));
      this.datesLoaded = parsed.datesLoaded || [];
      this.lastSyncedAt = parsed.lastSyncedAt || null;
      this.rebuildSnapshots();
    } catch {
      // Ignore corrupt cache
    }
  }

  private saveToDiskCache(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const payload: DiskCache = {
        version: 1,
        datesLoaded: this.datesLoaded,
        lastSyncedAt: this.lastSyncedAt || new Date().toISOString(),
        symbols: Object.fromEntries(this.symbolsMap.entries()),
      };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to save NSE market cache:', err);
    }
  }

  private rebuildSnapshots(): void {
    const latestDate = this.datesLoaded[this.datesLoaded.length - 1];
    const snaps: StockSnapshot[] = [];
    const bySym = new Map<string, StockSnapshot>();

    for (const rec of this.symbolsMap.values()) {
      if (rec.bars.length === 0) continue;
      // Only include stocks active on the most recent trading day (or previous day if suspended)
      const lastBarDate = rec.bars[rec.bars.length - 1].date;
      if (latestDate && lastBarDate < this.datesLoaded[Math.max(0, this.datesLoaded.length - 3)]) {
        continue;
      }
      const snap = buildStockSnapshot(rec.symbol, rec.name, rec.series, rec.isin, rec.bars);
      if (snap) {
        snaps.push(snap);
        bySym.set(snap.symbol, snap);
      }
    }

    snaps.sort((a, b) => b.turnoverCr - a.turnoverCr);
    this.snapshots = snaps;
    this.snapshotBySymbol = bySym;
  }

  async ensureLoaded(): Promise<void> {
    if (this.snapshots.length > 0) return;
    if (!this.initPromise) {
      this.initPromise = this.syncMarketData(false)
        .then(() => undefined)
        .finally(() => {
          this.initPromise = null;
        });
    }
    await this.initPromise;
  }

  async syncMarketData(forceCheckLatest = false): Promise<{ newDateFound: boolean; latestDate: string | null }> {
    if (this.syncing) {
      return { newDateFound: false, latestDate: this.getLatestTradeDate() };
    }
    this.syncing = true;
    this.lastError = null;
    const previousLatest = this.getLatestTradeDate();

    try {
      const candidates = getCandidateDates(
        this.datesLoaded.length >= TARGET_TRADING_DAYS && !forceCheckLatest ? 10 : LOOKBACK_CALENDAR_DAYS,
      );
      const loadedSet = new Set(this.datesLoaded);
      const fetchedDays: Array<{
        dateIso: string;
        rows: Array<{ symbol: string; name: string; series: string; isin: string; bar: OHLCVBar }>;
      }> = [];

      const batchSize = 12;
      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const batchToFetch = batch.filter((c) => {
          const iso = `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;
          return !loadedSet.has(iso);
        });
        if (batchToFetch.length === 0) {
          if (this.datesLoaded.length >= TARGET_TRADING_DAYS) break;
          continue;
        }
        const results = await Promise.all(batchToFetch.map((d) => fetchSingleBhavCopy(d)));
        for (const res of results) {
          if (res && res.rows.length > 100) {
            fetchedDays.push(res);
          }
        }
        if (this.datesLoaded.length + fetchedDays.length >= TARGET_TRADING_DAYS) {
          break;
        }
      }

      if (fetchedDays.length > 0) {
        const dateSet = new Set(this.datesLoaded);
        for (const day of fetchedDays) {
          dateSet.add(day.dateIso);
          for (const row of day.rows) {
            const key = row.symbol;
            let rec = this.symbolsMap.get(key);
            if (!rec) {
              rec = {
                symbol: row.symbol,
                name: row.name,
                series: row.series,
                isin: row.isin,
                bars: [],
              };
              this.symbolsMap.set(key, rec);
            } else {
              rec.name = row.name;
              rec.series = row.series;
            }
            // Replace or insert bar for date
            const existingIdx = rec.bars.findIndex((b) => b.date === row.bar.date);
            if (existingIdx >= 0) {
              rec.bars[existingIdx] = row.bar;
            } else {
              rec.bars.push(row.bar);
            }
          }
        }

        const sortedDates = Array.from(dateSet).sort();
        // Keep trailing 65 trading days max to keep memory & disk compact
        const cutoffDate =
          sortedDates.length > 65 ? sortedDates[sortedDates.length - 65] : sortedDates[0];
        this.datesLoaded = sortedDates.filter((d) => d >= cutoffDate);

        for (const rec of this.symbolsMap.values()) {
          rec.bars = rec.bars
            .filter((b) => b.date >= cutoffDate)
            .sort((a, b) => a.date.localeCompare(b.date));
        }

        this.lastSyncedAt = new Date().toISOString();
        this.rebuildSnapshots();
        this.saveToDiskCache();
      } else if (this.snapshots.length === 0) {
        this.lastError = 'Unable to retrieve NSE BhavCopy files at this time.';
      } else {
        this.lastSyncedAt = new Date().toISOString();
      }

      const newLatest = this.getLatestTradeDate();
      return {
        newDateFound: Boolean(newLatest && newLatest !== previousLatest),
        latestDate: newLatest,
      };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Market sync failed';
      return { newDateFound: false, latestDate: this.getLatestTradeDate() };
    } finally {
      this.syncing = false;
    }
  }

  getLatestTradeDate(): string | null {
    return this.datesLoaded.length > 0 ? this.datesLoaded[this.datesLoaded.length - 1] : null;
  }

  getSnapshots(): StockSnapshot[] {
    return this.snapshots;
  }

  getSnapshot(symbol: string): StockSnapshot | null {
    return this.snapshotBySymbol.get(symbol.toUpperCase()) || null;
  }

  getBhavCopyBars(symbol: string): OHLCVBar[] {
    return this.symbolsMap.get(symbol.toUpperCase())?.bars || [];
  }

  searchSymbols(query: string, limit = 25): StockSnapshot[] {
    const q = query.trim().toUpperCase();
    if (!q) return this.snapshots.slice(0, limit);

    const exact: StockSnapshot[] = [];
    const prefix: StockSnapshot[] = [];
    const contains: StockSnapshot[] = [];

    for (const s of this.snapshots) {
      if (s.symbol === q) {
        exact.push(s);
      } else if (s.symbol.startsWith(q)) {
        prefix.push(s);
      } else if (s.symbol.includes(q) || s.name.toUpperCase().includes(q)) {
        contains.push(s);
      }
    }
    return [...exact, ...prefix, ...contains].slice(0, limit);
  }

  getMarketStatus(): MarketStatus {
    let advances = 0;
    let declines = 0;
    let unchanged = 0;
    let totalTurnoverCr = 0;
    let eqSymbols = 0;

    for (const s of this.snapshots) {
      if (s.series === 'EQ') eqSymbols++;
      if (s.changePct > 0) advances++;
      else if (s.changePct < 0) declines++;
      else unchanged++;
      totalTurnoverCr += s.turnoverCr;
    }

    return {
      tradeDate: this.getLatestTradeDate(),
      historyDaysLoaded: this.datesLoaded.length,
      totalSymbols: this.snapshots.length,
      eqSymbols,
      advances,
      declines,
      unchanged,
      totalTurnoverCr: Math.round(totalTurnoverCr),
      syncing: this.syncing,
      lastSyncedAt: this.lastSyncedAt,
      error: this.lastError,
    };
  }

  private chartHistoryCache = new Map<
    string,
    { expiresAt: number; bars: OHLCVBar[]; source: 'yahoo' | 'nse-bhavcopy' }
  >();

  private async fetchYahooChartSeries(
    symbol: string,
    yahooRange: '5y' | '10y' | 'max',
    interval: '1d' | '1wk' = '1d',
  ): Promise<{ bars: OHLCVBar[]; source: 'yahoo' | 'nse-bhavcopy' }> {
    const clean = symbol.trim().toUpperCase();
    const cacheKey = `${clean}:${yahooRange}:${interval}`;
    const cached = this.chartHistoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { bars: cached.bars, source: cached.source };
    }

    const localBars = this.getBhavCopyBars(clean);
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}.NS?range=${yahooRange}&interval=${interval}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as {
          chart?: {
            result?: Array<{
              timestamp?: number[];
              indicators?: {
                quote?: Array<{
                  open?: Array<number | null>;
                  high?: Array<number | null>;
                  low?: Array<number | null>;
                  close?: Array<number | null>;
                  volume?: Array<number | null>;
                }>;
              };
            }>;
          };
        };
        const r = data.chart?.result?.[0];
        const ts = r?.timestamp || [];
        const q = r?.indicators?.quote?.[0];
        if (ts.length > 0 && q) {
          const byDate = new Map<string, OHLCVBar>();
          let lastClose = 0;
          for (let i = 0; i < ts.length; i++) {
            const c = q.close?.[i];
            const o = q.open?.[i];
            const h = q.high?.[i];
            const l = q.low?.[i];
            const v = q.volume?.[i];
            if (c == null || o == null || h == null || l == null || c <= 0) continue;
            const date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
            const prevClose = lastClose > 0 ? lastClose : Math.round(o * 100) / 100;
            const closeRounded = Math.round(c * 100) / 100;
            lastClose = closeRounded;
            byDate.set(date, {
              date,
              open: Math.round(o * 100) / 100,
              high: Math.round(h * 100) / 100,
              low: Math.round(l * 100) / 100,
              close: closeRounded,
              prevClose,
              volume: v ?? 0,
              turnover: (v ?? 0) * c,
              trades: 0,
            });
          }
          const bars = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
          if (bars.length >= 5) {
            this.chartHistoryCache.set(cacheKey, {
              expiresAt: Date.now() + 30 * 60 * 1000,
              bars,
              source: 'yahoo',
            });
            return { bars, source: 'yahoo' };
          }
        }
      }
    } catch {
      // Fallback to BhavCopy bars
    }

    return { bars: localBars, source: 'nse-bhavcopy' };
  }

  async fetchStockChartHistory(
    symbol: string,
    range: HistoryRange | '1mo' = '6mo',
  ): Promise<{
    bars: OHLCVBar[];
    lookbackBars: OHLCVBar[];
    source: 'yahoo' | 'nse-bhavcopy';
    multiYearSummary: MultiYearReturnSummary;
  }> {
    const clean = symbol.trim().toUpperCase();

    if (range === '10y') {
      const { bars, source } = await this.fetchYahooChartSeries(clean, '10y', '1d');
      return {
        bars,
        lookbackBars: bars,
        source,
        multiYearSummary: computeMultiYearSummary(bars),
      };
    }

    if (range === 'max') {
      const { bars, source } = await this.fetchYahooChartSeries(clean, 'max', '1wk');
      const { bars: bars5y } = await this.fetchYahooChartSeries(clean, '5y', '1d');
      return {
        bars,
        lookbackBars: bars,
        source,
        multiYearSummary: computeMultiYearSummary(bars5y.length >= 50 ? bars5y : bars),
      };
    }

    // Fetch 5Y daily series once (covers 30D, 3M, 6M, 1Y, 3Y, 5Y + full 5Y summary)
    const { bars: fullBars, source } = await this.fetchYahooChartSeries(clean, '5y', '1d');
    const multiYearSummary = computeMultiYearSummary(fullBars);

    const sliceCountMap: Record<string, number> = {
      '1mo': 30,
      '30d': 30,
      '3mo': 64,
      '6mo': 126,
      '1y': 252,
      '3y': 756,
      '5y': fullBars.length,
    };
    const count = sliceCountMap[range] ?? 126;
    const sliced = fullBars.length > count ? fullBars.slice(fullBars.length - count) : fullBars;

    return {
      bars: sliced,
      lookbackBars: fullBars,
      source,
      multiYearSummary,
    };
  }

  async fetchThirtyDayHistory(
    symbol: string,
    days = 30,
    range?: HistoryRange,
  ): Promise<{
    bars: OHLCVBar[];
    lookbackBars: OHLCVBar[];
    source: 'yahoo' | 'nse-bhavcopy';
    multiYearSummary: MultiYearReturnSummary;
  }> {
    if (range && range !== '30d') {
      return this.fetchStockChartHistory(symbol, range);
    }
    const { lookbackBars, source, multiYearSummary } = await this.fetchStockChartHistory(
      symbol,
      '5y',
    );
    const sliceLen = Math.min(2500, Math.max(7, days));
    const bars =
      lookbackBars.length > sliceLen
        ? lookbackBars.slice(lookbackBars.length - sliceLen)
        : lookbackBars;
    return { bars, lookbackBars, source, multiYearSummary };
  }

  private sectorMap = new Map<string, string>();
  private marketCapMap = new Map<string, number>();
  private nifty50Set = new Set<string>();
  private nifty500Set = new Set<string>();
  private sectorLoadedAt = 0;
  private sectorLoadPromise: Promise<void> | null = null;

  async ensureSectorMapLoaded(): Promise<void> {
    if (
      this.sectorMap.size >= 1500 &&
      this.marketCapMap.size >= 1000 &&
      Date.now() - this.sectorLoadedAt < 12 * 3600 * 1000
    ) {
      return;
    }
    if (this.sectorLoadPromise) {
      return this.sectorLoadPromise;
    }
    this.sectorLoadPromise = this.loadSectorMap().finally(() => {
      this.sectorLoadPromise = null;
    });
    return this.sectorLoadPromise;
  }

  private async loadSectorMap(): Promise<void> {
    try {
      if (fs.existsSync(SECTOR_CACHE_FILE)) {
        const raw = JSON.parse(fs.readFileSync(SECTOR_CACHE_FILE, 'utf8')) as SectorDiskCache;
        const ageMs = Date.now() - new Date(raw.updatedAt).getTime();
        if (
          raw.version === 2 &&
          raw.sectors &&
          Object.keys(raw.sectors).length >= 1500 &&
          raw.marketCapsCr &&
          Object.keys(raw.marketCapsCr).length >= 1000 &&
          ageMs < 12 * 3600 * 1000
        ) {
          this.sectorMap = new Map(Object.entries(raw.sectors));
          this.marketCapMap = new Map(Object.entries(raw.marketCapsCr));
          this.nifty50Set = new Set(raw.nifty50 || []);
          this.nifty500Set = new Set(raw.nifty500 || []);
          this.sectorLoadedAt = new Date(raw.updatedAt).getTime();
          return;
        }
      }
    } catch {
      // Ignore corrupt cache and refetch
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      Accept: 'text/csv,*/*',
    };

    const nextSectorMap = new Map<string, string>();
    const nextCapMap = new Map<string, number>();
    const nextNifty50 = new Set<string>();
    const nextNifty500 = new Set<string>();

    const [sectorResults, nifty50Text, nifty500Text, tvData] = await Promise.all([
      Promise.allSettled(
        NIFTY_SECTOR_INDEX_FEEDS.map(async (feed) => {
          const r = await fetch(feed.url, { headers });
          if (!r.ok) return { label: feed.label, symbols: [] as string[] };
          const text = await r.text();
          const lines = text.trim().split(/\r?\n/).slice(1);
          const symbols: string[] = [];
          for (const line of lines) {
            if (!line.trim()) continue;
            const cols = parseCsvLine(line);
            const sym = cols[2]?.trim().toUpperCase();
            if (sym) symbols.push(sym);
          }
          return { label: feed.label, symbols };
        }),
      ),
      fetch('https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv', { headers })
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
      fetch('https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv', { headers })
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
      fetch('https://scanner.tradingview.com/india/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          filter: [{ left: 'exchange', operation: 'equal', right: 'NSE' }],
          options: { lang: 'en' },
          markets: ['india'],
          symbols: { query: { types: ['stock', 'dr'] }, tickers: [] },
          columns: ['name', 'description', 'sector', 'industry', 'market_cap_basic'],
          sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
          range: [0, 4000],
        }),
      })
        .then(async (r) => {
          if (!r.ok) return [];
          const j = (await r.json()) as {
            data?: Array<{
              s: string;
              d: [string, string, string | null, string | null, number | null];
            }>;
          };
          return j.data || [];
        })
        .catch(() => []),
    ]);

    // 1. Official Nifty Sectoral Indices (Bank, IT, Pharma, Auto, FMCG, Metal, Realty, Financial Services, Energy)
    for (const res of sectorResults) {
      if (res.status !== 'fulfilled') continue;
      for (const sym of res.value.symbols) {
        if (!nextSectorMap.has(sym)) {
          nextSectorMap.set(sym, res.value.label);
        }
      }
    }

    // 2. Official Nifty 50 list
    if (nifty50Text) {
      const lines = nifty50Text.trim().split(/\r?\n/).slice(1);
      for (const line of lines) {
        if (!line.trim()) continue;
        const cols = parseCsvLine(line);
        const rawInd = cols[1] || '';
        const sym = cols[2]?.trim().toUpperCase();
        if (sym) {
          nextNifty50.add(sym);
          nextNifty500.add(sym);
          if (!nextSectorMap.has(sym) && rawInd) {
            nextSectorMap.set(sym, normalizeNiftyIndustry(rawInd));
          }
        }
      }
    }

    // 3. Official Nifty 500 list
    if (nifty500Text) {
      const lines = nifty500Text.trim().split(/\r?\n/).slice(1);
      for (const line of lines) {
        if (!line.trim()) continue;
        const cols = parseCsvLine(line);
        const rawIndustry = cols[1] || '';
        const sym = cols[2]?.trim().toUpperCase();
        if (sym) {
          nextNifty500.add(sym);
          if (!nextSectorMap.has(sym) && rawIndustry) {
            nextSectorMap.set(sym, normalizeNiftyIndustry(rawIndustry));
          }
        }
      }
    }

    // 4. Broad NSE Universe from TradingView India Scanner (3,200+ NSE stocks with Market Cap & Sector/Industry)
    for (const row of tvData) {
      const sym = row.s.replace(/^NSE:/, '').replace(/_/g, '-').toUpperCase();
      const desc = row.d?.[1] || '';
      const tvSec = row.d?.[2] || '';
      const tvInd = row.d?.[3] || '';
      const capInr = row.d?.[4];

      if (typeof capInr === 'number' && capInr > 0) {
        nextCapMap.set(sym, Math.max(1, Math.round(capInr / 1e7)));
      }
      const tvCategory = normalizeStockCategory(tvSec, tvInd, desc);
      const existingCategory = nextSectorMap.get(sym);
      if (!existingCategory) {
        nextSectorMap.set(sym, tvCategory);
      } else if (existingCategory === 'Financial Services' && tvCategory === 'Bank') {
        nextSectorMap.set(sym, 'Bank');
      }
    }

    // 5. Fallback for any remaining BhavCopy snapshots using company name heuristics
    for (const snap of this.snapshots) {
      const sym = snap.symbol.toUpperCase();
      if (!nextSectorMap.has(sym)) {
        nextSectorMap.set(sym, normalizeStockCategory('', '', snap.name));
      }
    }

    if (nextSectorMap.size > 0) {
      this.sectorMap = nextSectorMap;
      this.marketCapMap = nextCapMap;
      this.nifty50Set = nextNifty50;
      this.nifty500Set = nextNifty500;
      this.sectorLoadedAt = Date.now();
      try {
        if (!fs.existsSync(CACHE_DIR)) {
          fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        const payload: SectorDiskCache = {
          version: 2,
          updatedAt: new Date(this.sectorLoadedAt).toISOString(),
          sectors: Object.fromEntries(nextSectorMap.entries()),
          marketCapsCr: Object.fromEntries(nextCapMap.entries()),
          nifty50: Array.from(nextNifty50),
          nifty500: Array.from(nextNifty500),
        };
        fs.writeFileSync(SECTOR_CACHE_FILE, JSON.stringify(payload));
      } catch {
        // Non-fatal cache write error
      }
    }
  }

  getSymbolSector(symbol: string): string | null {
    const clean = symbol.trim().toUpperCase();
    const mapped = this.sectorMap.get(clean);
    if (mapped) return mapped;
    const snap = this.getSnapshot(clean);
    if (snap) {
      return normalizeStockCategory('', '', snap.name);
    }
    return null;
  }

  async getNifty50Heatmap(universe: HeatmapUniverse = 'ALL_NSE'): Promise<NiftyHeatmapResponse> {
    await Promise.all([this.ensureLoaded(), this.ensureSectorMapLoaded()]);
    const constituents: NiftyHeatmapStock[] = [];
    const sectorSet = new Set<string>();

    for (const snap of this.snapshots) {
      const sym = snap.symbol.toUpperCase();
      const in50 = this.nifty50Set.has(sym);
      const in500 = in50 || this.nifty500Set.has(sym);

      if (universe === 'NIFTY_50' && !in50) continue;
      if (universe === 'NIFTY_500' && !in500) continue;
      if (universe === 'ALL_NSE' && snap.series !== 'EQ' && !in500) continue;

      const sector =
        this.sectorMap.get(sym) || normalizeStockCategory('', '', snap.name) || 'Diversified';
      const rawCap = this.marketCapMap.get(sym);
      const marketCapCr =
        rawCap && rawCap > 0
          ? rawCap
          : Math.max(25, Math.round(snap.turnoverCr * 75));

      sectorSet.add(sector);
      constituents.push({
        symbol: sym,
        name: snap.name,
        sector,
        close: snap.close,
        change: snap.change,
        changePct: snap.changePct,
        marketCapCr,
        turnoverCr: snap.turnoverCr,
        volume: snap.volume,
        rsi14: snap.rsi14,
        relVol: snap.relVol,
        inNifty50: in50,
        inNifty500: in500,
      });
    }

    constituents.sort((a, b) => b.marketCapCr - a.marketCapCr);
    const agg = computeHeatmapAggregates(constituents);

    const indexName =
      universe === 'NIFTY_50'
        ? 'NIFTY 50'
        : universe === 'NIFTY_500'
          ? 'NIFTY 500'
          : 'ALL NSE EQUITIES';

    return {
      indexName,
      universe,
      tradeDate: this.getLatestTradeDate(),
      totalMarketCapCr: agg.totalMarketCapCr,
      advances: agg.advances,
      declines: agg.declines,
      unchanged: agg.unchanged,
      avgChangePct: agg.avgChangePct,
      weightedChangePct: agg.weightedChangePct,
      sectors: Array.from(sectorSet).sort(),
      constituents,
    };
  }

  async getSectorPerformance(): Promise<SectorPerformanceSummary> {
    await Promise.all([this.ensureLoaded(), this.ensureSectorMapLoaded()]);
    const entries: Array<{ sector: string; snapshot: StockSnapshot }> = [];

    for (const snap of this.snapshots) {
      if (snap.series !== 'EQ') continue;
      const sym = snap.symbol.toUpperCase();
      const sector = this.sectorMap.get(sym) || normalizeStockCategory('', '', snap.name);
      if (sector) {
        entries.push({ sector, snapshot: snap });
      }
    }

    const summary = computeTopBottomSectorPerformance(entries, 3, 3);
    return {
      tradeDate: this.getLatestTradeDate(),
      ...summary,
    };
  }
}

export const marketData = new MarketDataService();
