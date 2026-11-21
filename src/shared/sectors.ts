import type {
  EnrichedWatchlistItem,
  NiftySectorPerformanceItem,
  StockSnapshot,
} from './types';

const INDUSTRY_LABEL_MAP: Record<string, string> = {
  'information technology': 'IT',
  'automobile and auto components': 'Auto',
  'fast moving consumer goods': 'FMCG',
  'oil gas & consumable fuels': 'Energy',
  'metals & mining': 'Metal',
  telecommunication: 'Telecom',
  healthcare: 'Pharma',
  realty: 'Realty',
  'financial services': 'Financial Services',
  'capital goods': 'Capital Goods',
  'consumer services': 'Consumer Services',
  'consumer durables': 'Consumer Durables',
  construction: 'Construction',
  'construction materials': 'Construction Materials',
  chemicals: 'Chemicals',
  power: 'Power',
  services: 'Services',
  textiles: 'Textiles',
  'media entertainment & publication': 'Media',
  'forest materials': 'Forest Materials',
  diversified: 'Diversified',
};

export function normalizeNiftyIndustry(rawIndustry: string): string {
  const cleaned = rawIndustry.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Other';
  const mapped = INDUSTRY_LABEL_MAP[cleaned.toLowerCase()];
  return mapped || cleaned;
}

export interface SectorFilterOption {
  sector: string;
  label: string;
  count: number;
}

export function getWatchlistSectorOptions(
  items: EnrichedWatchlistItem[],
): SectorFilterOption[] {
  const counts = new Map<string, number>();
  let unclassifiedCount = 0;

  for (const item of items) {
    if (item.sector && item.sector.trim()) {
      const key = item.sector.trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    } else {
      unclassifiedCount += 1;
    }
  }

  const options: SectorFilterOption[] = Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([sector, count]) => ({
      sector,
      label: sector,
      count,
    }));

  if (unclassifiedCount > 0) {
    options.push({
      sector: 'UNCLASSIFIED',
      label: 'Other / Unclassified',
      count: unclassifiedCount,
    });
  }

  return options;
}

export function filterWatchlistItems(
  items: EnrichedWatchlistItem[],
  filterScannerId: string,
  filterSector: string,
): EnrichedWatchlistItem[] {
  return items.filter((item) => {
    if (filterSector !== 'ALL') {
      if (filterSector === 'UNCLASSIFIED') {
        if (item.sector && item.sector.trim()) return false;
      } else if (item.sector !== filterSector) {
        return false;
      }
    }

    if (filterScannerId === 'ALL') return true;
    if (filterScannerId === 'ANY_HIT') return item.matchedScanners.length > 0;
    return item.matchedScanners.some((sc) => sc.id === filterScannerId);
  });
}

export function computeTopBottomSectorPerformance(
  entries: Array<{ sector: string; snapshot: StockSnapshot }>,
  limit = 3,
  minConstituents = 3,
): {
  totalSectors: number;
  topSectors: NiftySectorPerformanceItem[];
  bottomSectors: NiftySectorPerformanceItem[];
} {
  const grouped = new Map<string, StockSnapshot[]>();

  for (const entry of entries) {
    const sec = entry.sector.trim();
    if (!sec) continue;
    const list = grouped.get(sec) || [];
    list.push(entry.snapshot);
    grouped.set(sec, list);
  }

  const allStats = Array.from(grouped.entries()).map(([sector, snaps]) => {
    let sum = 0;
    let advances = 0;
    let declines = 0;
    let bestSnap = snaps[0];
    let worstSnap = snaps[0];

    for (const s of snaps) {
      sum += s.changePct;
      if (s.changePct > 0) advances += 1;
      else if (s.changePct < 0) declines += 1;
      if (s.changePct > bestSnap.changePct) bestSnap = s;
      if (s.changePct < worstSnap.changePct) worstSnap = s;
    }

    const avgChangePct = Math.round((sum / snaps.length) * 100) / 100;
    return {
      sector,
      avgChangePct,
      stockCount: snaps.length,
      advances,
      declines,
      bestSnap,
      worstSnap,
    };
  });

  const eligible = allStats.filter((s) => s.stockCount >= minConstituents);
  const pool = eligible.length >= limit * 2 ? eligible : allStats;

  if (pool.length === 0) {
    return { totalSectors: 0, topSectors: [], bottomSectors: [] };
  }

  const sortedDesc = [...pool].sort((a, b) => {
    if (b.avgChangePct !== a.avgChangePct) return b.avgChangePct - a.avgChangePct;
    if (b.stockCount !== a.stockCount) return b.stockCount - a.stockCount;
    return a.sector.localeCompare(b.sector);
  });

  const topSlice = sortedDesc.slice(0, limit);
  const topSet = new Set(topSlice.map((s) => s.sector));

  const remainingWorstFirst = [...sortedDesc]
    .reverse()
    .filter((s) => !topSet.has(s.sector));
  const bottomSlice = remainingWorstFirst.slice(0, limit);

  return {
    totalSectors: pool.length,
    topSectors: topSlice.map((s) => ({
      sector: s.sector,
      avgChangePct: s.avgChangePct,
      stockCount: s.stockCount,
      advances: s.advances,
      declines: s.declines,
      leadSymbol: s.bestSnap?.symbol ?? null,
      leadChangePct: s.bestSnap ? Math.round(s.bestSnap.changePct * 100) / 100 : null,
    })),
    bottomSectors: bottomSlice.map((s) => ({
      sector: s.sector,
      avgChangePct: s.avgChangePct,
      stockCount: s.stockCount,
      advances: s.advances,
      declines: s.declines,
      leadSymbol: s.worstSnap?.symbol ?? null,
      leadChangePct: s.worstSnap ? Math.round(s.worstSnap.changePct * 100) / 100 : null,
    })),
  };
}
