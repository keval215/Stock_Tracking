import type {
  NiftySectorPerformanceItem,
  SectorPerformanceSummary,
} from '../shared/types';
import { formatSignedPct } from '../utils/format';

interface SectorPerformanceWidgetProps {
  performance: SectorPerformanceSummary | null;
  loading: boolean;
  activeSector: string;
  availableWatchlistSectors: Set<string>;
  onSelectSector: (sector: string) => void;
}

function SectorRow({
  item,
  maxAbs,
  variant,
  isActive,
  canFilter,
  onSelect,
}: {
  item: NiftySectorPerformanceItem;
  maxAbs: number;
  variant: 'top' | 'bottom';
  isActive: boolean;
  canFilter: boolean;
  onSelect: () => void;
}) {
  const isPos = item.avgChangePct > 0;
  const isNeg = item.avgChangePct < 0;
  const leadVerb = variant === 'top' ? 'Leader' : 'Laggard';
  const barWidth = maxAbs > 0 ? Math.max(4, (Math.abs(item.avgChangePct) / maxAbs) * 100) : 0;

  const rowBody = (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
          {item.sector}
        </span>
        <span
          className={`shrink-0 text-[13px] font-medium tabular-nums ${
            isPos
              ? 'text-emerald-700 dark:text-emerald-400'
              : isNeg
                ? 'text-red-700 dark:text-red-400'
                : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {formatSignedPct(item.avgChangePct)}
        </span>
      </div>
      <div
        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full ${
            isPos
              ? 'bg-emerald-600 dark:bg-emerald-500'
              : isNeg
                ? 'bg-red-600 dark:bg-red-500'
                : 'bg-slate-400'
          }`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
        {item.stockCount} stocks, {item.advances} up
        {item.leadSymbol && item.leadChangePct !== null
          ? `. ${leadVerb}: ${item.leadSymbol} ${formatSignedPct(item.leadChangePct)}`
          : ''}
      </div>
    </div>
  );

  if (canFilter) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isActive}
        title={isActive ? 'Clear sector filter' : `Filter watchlist to ${item.sector}`}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
          isActive
            ? 'bg-slate-100 shadow-[inset_2px_0_0_0_var(--color-accent-500)] dark:bg-white/[0.06]'
            : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        {rowBody}
      </button>
    );
  }

  return <div className="flex items-center gap-3 px-4 py-3">{rowBody}</div>;
}

export function SectorPerformanceWidget({
  performance,
  loading,
  activeSector,
  availableWatchlistSectors,
  onSelectSector,
}: SectorPerformanceWidgetProps) {
  const all = performance ? [...performance.topSectors, ...performance.bottomSectors] : [];
  const maxAbs = all.reduce((m, i) => Math.max(m, Math.abs(i.avgChangePct)), 0);

  const renderColumn = (
    heading: string,
    items: NiftySectorPerformanceItem[],
    variant: 'top' | 'bottom',
  ) => (
    <div>
      <div className="px-4 pt-3 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        {heading}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((item) => {
          const canFilter = availableWatchlistSectors.has(item.sector);
          const isActive = activeSector === item.sector;
          return (
            <SectorRow
              key={item.sector}
              item={item}
              maxAbs={maxAbs}
              variant={variant}
              isActive={isActive}
              canFilter={canFilter}
              onSelect={() => onSelectSector(isActive ? 'ALL' : item.sector)}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <section
      aria-label="Nifty sector performance"
      data-testid="sector-performance-widget"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sectors today</h2>
        {performance && performance.totalSectors > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Average change across {performance.totalSectors} Nifty sectors. Select one to filter the list.
          </span>
        )}
      </div>

      {loading && !performance ? (
        <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0 dark:divide-slate-800">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-2 p-4">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ))}
        </div>
      ) : !performance ||
        (performance.topSectors.length === 0 && performance.bottomSectors.length === 0) ? (
        <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          Sector performance appears once the latest market data has synced. Use Sync in the sidebar to fetch it.
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0 dark:divide-slate-800">
          {renderColumn('Strongest', performance.topSectors, 'top')}
          {renderColumn('Weakest', performance.bottomSectors, 'bottom')}
        </div>
      )}
    </section>
  );
}
