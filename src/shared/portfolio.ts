import type {
  EnrichedPortfolioHolding,
  PortfolioHolding,
  PortfolioResponse,
  PortfolioSummary,
  StockSnapshot,
} from './types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validateHoldingInput(
  symbol: string,
  quantity: number,
  avgPrice: number,
): string | null {
  const clean = symbol.trim().toUpperCase();
  if (!clean) {
    return 'NSE symbol is required.';
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 'Quantity must be a positive number.';
  }
  if (!Number.isFinite(avgPrice) || avgPrice <= 0) {
    return 'Average buy price must be greater than zero.';
  }
  return null;
}

export function computePortfolioMetrics(
  holdings: PortfolioHolding[],
  getSnapshot: (symbol: string) => StockSnapshot | null,
  getSector: (symbol: string) => string | null,
  tradeDate: string | null,
): PortfolioResponse {
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalPnl = 0;
  let pricedInvested = 0;
  let dayPnl = 0;
  let gainersCount = 0;
  let losersCount = 0;

  const baseRows = holdings.map((h) => {
    const snap = getSnapshot(h.symbol);
    const sector = getSector(h.symbol);
    const investedValue = round2(h.quantity * h.avgPrice);
    totalInvested += investedValue;

    if (!snap) {
      totalCurrentValue += investedValue;
      return {
        ...h,
        name: h.symbol,
        sector,
        currentPrice: null,
        prevClose: null,
        changePct: null,
        investedValue,
        currentValue: null,
        pnl: null,
        pnlPct: null,
        dayPnl: null,
        weightPct: null,
      };
    }

    const currentValue = round2(h.quantity * snap.close);
    const pnl = round2(currentValue - investedValue);
    const pnlPct = investedValue > 0 ? round2((pnl / investedValue) * 100) : 0;
    const holdingDayPnl = round2(h.quantity * (snap.close - snap.prevClose));

    totalCurrentValue += currentValue;
    totalPnl += pnl;
    pricedInvested += investedValue;
    dayPnl += holdingDayPnl;

    if (pnl > 0) gainersCount += 1;
    else if (pnl < 0) losersCount += 1;

    return {
      ...h,
      name: snap.name,
      sector,
      currentPrice: snap.close,
      prevClose: snap.prevClose,
      changePct: snap.changePct,
      investedValue,
      currentValue,
      pnl,
      pnlPct,
      dayPnl: holdingDayPnl,
      weightPct: null as number | null,
    };
  });

  const roundedCurrentTotal = round2(totalCurrentValue);
  const roundedInvestedTotal = round2(totalInvested);
  const roundedPnl = round2(totalPnl);
  const roundedDayPnl = round2(dayPnl);

  const enriched: EnrichedPortfolioHolding[] = baseRows.map((row) => ({
    ...row,
    weightPct:
      roundedCurrentTotal > 0 && row.currentValue !== null
        ? round2((row.currentValue / roundedCurrentTotal) * 100)
        : null,
  }));

  const prevTotalValue = roundedCurrentTotal - roundedDayPnl;
  const summary: PortfolioSummary = {
    tradeDate,
    totalInvested: roundedInvestedTotal,
    totalCurrentValue: roundedCurrentTotal,
    totalPnl: roundedPnl,
    totalPnlPct: pricedInvested > 0 ? round2((roundedPnl / pricedInvested) * 100) : 0,
    dayPnl: roundedDayPnl,
    dayPnlPct: prevTotalValue > 0 ? round2((roundedDayPnl / prevTotalValue) * 100) : 0,
    holdingsCount: holdings.length,
    gainersCount,
    losersCount,
  };

  return { holdings: enriched, summary };
}
