import { scaleLinear } from 'd3';
import type { MultiYearReturnSummary, NiftyHeatmapStock, OHLCVBar } from './types';

export interface SectorSummary {
  sector: string;
  stockCount: number;
  advances: number;
  declines: number;
  unchanged: number;
  totalMarketCapCr: number;
  weightPct: number;
  weightedChangePct: number;
  avgChangePct?: number;
}

export interface CategoryHeatmapGroup extends SectorSummary {
  avgChangePct: number;
  topGainer: NiftyHeatmapStock | null;
  topLoser: NiftyHeatmapStock | null;
  stocks: NiftyHeatmapStock[];
}

export interface HeatmapAggregates {
  totalMarketCapCr: number;
  advances: number;
  declines: number;
  unchanged: number;
  avgChangePct: number;
  weightedChangePct: number;
}

const negativeScale = scaleLinear<string>()
  .domain([-3.5, -1.5, -0.05])
  .range(['#991b1b', '#dc2626', '#fecaca'])
  .clamp(true);

const positiveScale = scaleLinear<string>()
  .domain([0.05, 1.5, 3.5])
  .range(['#bbf7d0', '#10b981', '#047857'])
  .clamp(true);

export function getHeatmapTileColors(changePct: number): {
  bg: string;
  text: string;
  subText: string;
  border: string;
} {
  if (Math.abs(changePct) < 0.05) {
    return {
      bg: '#e2e8f0',
      text: '#0f172a',
      subText: '#334155',
      border: '#cbd5e1',
    };
  }
  if (changePct < 0) {
    const bg = negativeScale(changePct);
    const darkText = changePct > -0.75;
    return {
      bg,
      text: darkText ? '#7f1d1d' : '#ffffff',
      subText: darkText ? '#991b1b' : 'rgba(255,255,255,0.88)',
      border: darkText ? '#fca5a5' : 'rgba(255,255,255,0.22)',
    };
  }
  const bg = positiveScale(changePct);
  const darkText = changePct < 0.75;
  return {
    bg,
    text: darkText ? '#064e3b' : '#ffffff',
    subText: darkText ? '#065f46' : 'rgba(255,255,255,0.88)',
    border: darkText ? '#86efac' : 'rgba(255,255,255,0.22)',
  };
}

export function computeHeatmapAggregates(constituents: NiftyHeatmapStock[]): HeatmapAggregates {
  let totalMarketCapCr = 0;
  let advances = 0;
  let declines = 0;
  let unchanged = 0;
  let sumChangePct = 0;
  let weightedSum = 0;

  for (const stock of constituents) {
    const cap = stock.marketCapCr > 0 ? stock.marketCapCr : 0;
    totalMarketCapCr += cap;
    sumChangePct += stock.changePct;
    weightedSum += stock.changePct * cap;

    if (stock.changePct > 0) advances++;
    else if (stock.changePct < 0) declines++;
    else unchanged++;
  }

  const count = constituents.length;
  return {
    totalMarketCapCr: Math.round(totalMarketCapCr),
    advances,
    declines,
    unchanged,
    avgChangePct: count > 0 ? Number((sumChangePct / count).toFixed(2)) : 0,
    weightedChangePct:
      totalMarketCapCr > 0 ? Number((weightedSum / totalMarketCapCr).toFixed(2)) : 0,
  };
}

export function computeSectorSummaries(constituents: NiftyHeatmapStock[]): SectorSummary[] {
  const totalCap = constituents.reduce(
    (sum, s) => sum + (s.marketCapCr > 0 ? s.marketCapCr : 0),
    0,
  );
  const bySector = new Map<string, NiftyHeatmapStock[]>();

  for (const stock of constituents) {
    const key = stock.sector || 'Other';
    const arr = bySector.get(key) || [];
    arr.push(stock);
    bySector.set(key, arr);
  }

  const summaries: SectorSummary[] = [];
  for (const [sector, items] of bySector.entries()) {
    const agg = computeHeatmapAggregates(items);
    summaries.push({
      sector,
      stockCount: items.length,
      advances: agg.advances,
      declines: agg.declines,
      unchanged: agg.unchanged,
      totalMarketCapCr: agg.totalMarketCapCr,
      weightPct: totalCap > 0 ? Number(((agg.totalMarketCapCr / totalCap) * 100).toFixed(1)) : 0,
      weightedChangePct: agg.weightedChangePct,
      avgChangePct: agg.avgChangePct,
    });
  }

  summaries.sort((a, b) => b.totalMarketCapCr - a.totalMarketCapCr);
  return summaries;
}

export function groupStocksByCategory(
  constituents: NiftyHeatmapStock[],
): CategoryHeatmapGroup[] {
  const totalCap = constituents.reduce(
    (sum, s) => sum + (s.marketCapCr > 0 ? s.marketCapCr : 0),
    0,
  );
  const bySector = new Map<string, NiftyHeatmapStock[]>();

  for (const stock of constituents) {
    const key = stock.sector || 'Other';
    const arr = bySector.get(key) || [];
    arr.push(stock);
    bySector.set(key, arr);
  }

  const groups: CategoryHeatmapGroup[] = [];
  for (const [sector, items] of bySector.entries()) {
    const sortedByCap = [...items].sort((a, b) => b.marketCapCr - a.marketCapCr);
    const sortedByChange = [...items].sort((a, b) => b.changePct - a.changePct);
    const agg = computeHeatmapAggregates(items);

    groups.push({
      sector,
      stockCount: items.length,
      advances: agg.advances,
      declines: agg.declines,
      unchanged: agg.unchanged,
      totalMarketCapCr: agg.totalMarketCapCr,
      weightPct: totalCap > 0 ? Number(((agg.totalMarketCapCr / totalCap) * 100).toFixed(1)) : 0,
      weightedChangePct: agg.weightedChangePct,
      avgChangePct: agg.avgChangePct,
      topGainer: sortedByChange[0] || null,
      topLoser: sortedByChange[sortedByChange.length - 1] || null,
      stocks: sortedByCap,
    });
  }

  groups.sort((a, b) => {
    if (b.totalMarketCapCr !== a.totalMarketCapCr) return b.totalMarketCapCr - a.totalMarketCapCr;
    return b.stockCount - a.stockCount;
  });

  return groups;
}

const TV_SECTOR_MAP: Record<string, string> = {
  finance: 'Financial Services',
  'technology services': 'IT',
  'electronic technology': 'IT',
  'health technology': 'Pharma',
  'health services': 'Pharma',
  'energy minerals': 'Energy',
  utilities: 'Power',
  'consumer non-durables': 'FMCG',
  'consumer durables': 'Consumer Durables',
  'consumer services': 'Consumer Services',
  'process industries': 'Chemicals',
  'non-energy minerals': 'Metal',
  'producer manufacturing': 'Capital Goods',
  'industrial services': 'Construction',
  transportation: 'Services',
  communications: 'Telecom',
  'retail trade': 'Consumer Services',
  'distribution services': 'Services',
  'commercial services': 'Services',
};

export function normalizeStockCategory(
  rawSector?: string | null,
  rawIndustry?: string | null,
  companyName?: string | null,
): string {
  const sec = (rawSector || '').trim().toLowerCase();
  const ind = (rawIndustry || '').trim().toLowerCase();
  const name = (companyName || '').trim().toLowerCase();

  // Check industry overrides first for Bank, Auto, Realty, Media, Textiles
  if (ind.includes('bank')) return 'Bank';
  if (ind.includes('motor') || ind.includes('auto') || ind.includes('tire') || ind.includes('tyre')) {
    return 'Auto';
  }
  if (ind.includes('real estate') || ind.includes('homebuilding')) return 'Realty';
  if (ind.includes('textile') || ind.includes('apparel')) return 'Textiles';
  if (ind.includes('steel') || ind.includes('aluminum') || ind.includes('metal') || ind.includes('mining')) {
    return 'Metal';
  }
  if (ind.includes('cement') || ind.includes('construction material')) return 'Construction Materials';
  if (ind.includes('broadcasting') || ind.includes('publishing') || ind.includes('movies')) return 'Media';

  if (sec && TV_SECTOR_MAP[sec]) {
    return TV_SECTOR_MAP[sec];
  }

  // Name fallback for NSE stocks without TradingView metadata
  if (/\bbank\b/.test(name)) return 'Bank';
  if (/finan|capital|invest|credit|fincorp|securities|leasing|housing fin|mutho|bajaj fin/i.test(name)) {
    return 'Financial Services';
  }
  if (/pharma|drug|medic|health|biotech|hospital|lifescience|remedies|labs|laborator/i.test(name)) {
    return 'Pharma';
  }
  if (/tech|infotech|software|digital|cyber|comput|syst|data|cloud/i.test(name)) {
    return 'IT';
  }
  if (/auto|motor|tyre|mobility|axle|forging|gears/i.test(name)) {
    return 'Auto';
  }
  if (/chem|fertiliz|agrochem|alkali|pesticid|polymer|plast|pigment|organics/i.test(name)) {
    return 'Chemicals';
  }
  if (/steel|metal|alloy|iron|alumin|copper|zinc|mining|mineral|ferro/i.test(name)) {
    return 'Metal';
  }
  if (/power|energy|solar|wind|hydro|gas|petro|oil|refin|coal/i.test(name)) {
    return 'Energy';
  }
  if (/infra|construct|build|realty|estates|housing|epc|projects/i.test(name)) {
    return 'Construction';
  }
  if (/cement|ceram|granite|tile|sanitary/i.test(name)) {
    return 'Construction Materials';
  }
  if (/textil|spin|cotspin|mills|garment|apparel|weave|fabric|yarn|denim/i.test(name)) {
    return 'Textiles';
  }
  if (/food|sugar|tea|coffee|dairy|agro|beverag|distill|brew|fmcg|consumer/i.test(name)) {
    return 'FMCG';
  }
  if (/hotel|hospitality|resort|tour|travel|retail|mart|entertain|media|film|network|tele/i.test(name)) {
    return 'Consumer Services';
  }
  if (/eng|indus|machin|equip|electr|cable|wire|pump|valve|heavy|forge|cast|bearing/i.test(name)) {
    return 'Capital Goods';
  }

  return 'Diversified';
}

export function computeMultiYearSummary(bars: OHLCVBar[]): MultiYearReturnSummary {
  if (!bars || bars.length === 0) {
    return {
      return30dPct: null,
      return1yPct: null,
      return3yPct: null,
      return5yPct: null,
      cagr5yPct: null,
      high5y: null,
      low5y: null,
      firstDate: null,
      lastDate: null,
      totalBars: 0,
    };
  }

  const lastBar = bars[bars.length - 1];
  const lastClose = lastBar.close;
  const lastMs = new Date(`${lastBar.date}T00:00:00Z`).getTime();

  const findBarAtOffsetDays = (targetCalendarDays: number, minBarsRequired: number): OHLCVBar | null => {
    if (bars.length < minBarsRequired) return null;
    const cutoffMs = lastMs - targetCalendarDays * 86400000;
    for (let i = bars.length - 1; i >= 0; i--) {
      const t = new Date(`${bars[i].date}T00:00:00Z`).getTime();
      if (t <= cutoffMs) {
        return bars[i];
      }
    }
    return bars[0];
  };

  const pctFrom = (ref: OHLCVBar | null): number | null => {
    if (!ref || ref.close <= 0) return null;
    return Number((((lastClose - ref.close) / ref.close) * 100).toFixed(2));
  };

  const bar30d = bars.length >= 2 ? bars[Math.max(0, bars.length - 30)] : null;
  const bar1y = findBarAtOffsetDays(365, 180);
  const bar3y = findBarAtOffsetDays(Math.round(365.25 * 3), 500);
  const bar5y = findBarAtOffsetDays(Math.round(365.25 * 5), 850);

  let cagr5yPct: number | null = null;
  if (bar5y && bar5y.close > 0) {
    const startMs = new Date(`${bar5y.date}T00:00:00Z`).getTime();
    const years = Math.max(1, (lastMs - startMs) / (365.25 * 86400000));
    cagr5yPct = Number(((Math.pow(lastClose / bar5y.close, 1 / years) - 1) * 100).toFixed(2));
  }

  let high5y = -Infinity;
  let low5y = Infinity;
  for (const b of bars) {
    if (b.high > high5y) high5y = b.high;
    if (b.low < low5y) low5y = b.low;
  }

  return {
    return30dPct: pctFrom(bar30d),
    return1yPct: pctFrom(bar1y),
    return3yPct: pctFrom(bar3y),
    return5yPct: pctFrom(bar5y),
    cagr5yPct,
    high5y: Number.isFinite(high5y) ? high5y : null,
    low5y: Number.isFinite(low5y) ? low5y : null,
    firstDate: bars[0].date,
    lastDate: lastBar.date,
    totalBars: bars.length,
  };
}

export function formatMarketCapCr(capCr: number | null | undefined): string {
  if (capCr === null || capCr === undefined || Number.isNaN(capCr) || capCr <= 0) return '—';
  if (capCr >= 100000) {
    return `₹${(capCr / 100000).toFixed(2)}L Cr`;
  }
  return `₹${Math.round(capCr).toLocaleString('en-IN')} Cr`;
}

