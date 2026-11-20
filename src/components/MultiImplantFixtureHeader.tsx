import type { DetectedImplantFixture } from '../types/implant';

export interface FixtureColorPalette {
  name: string;
  hex: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  dotClass: string;
  softBgClass: string;
}

export const FIXTURE_COLORS: FixtureColorPalette[] = [
  {
    name: 'Cyan',
    hex: '#06B6D4',
    badgeBg: '#0891B2',
    badgeText: '#FFFFFF',
    borderClass: 'border-cyan-500',
    dotClass: 'bg-cyan-500',
    softBgClass: 'bg-cyan-50/70',
  },
  {
    name: 'Amber',
    hex: '#F59E0B',
    badgeBg: '#D97706',
    badgeText: '#FFFFFF',
    borderClass: 'border-amber-500',
    dotClass: 'bg-amber-500',
    softBgClass: 'bg-amber-50/70',
  },
  {
    name: 'Emerald',
    hex: '#10B981',
    badgeBg: '#059669',
    badgeText: '#FFFFFF',
    borderClass: 'border-emerald-500',
    dotClass: 'bg-emerald-500',
    softBgClass: 'bg-emerald-50/70',
  },
  {
    name: 'Violet',
    hex: '#8B5CF6',
    badgeBg: '#7C3AED',
    badgeText: '#FFFFFF',
    borderClass: 'border-violet-500',
    dotClass: 'bg-violet-500',
    softBgClass: 'bg-violet-50/70',
  },
  {
    name: 'Rose',
    hex: '#F43F5E',
    badgeBg: '#E11D48',
    badgeText: '#FFFFFF',
    borderClass: 'border-rose-500',
    dotClass: 'bg-rose-500',
    softBgClass: 'bg-rose-50/70',
  },
  {
    name: 'Sky',
    hex: '#0EA5E9',
    badgeBg: '#0284C7',
    badgeText: '#FFFFFF',
    borderClass: 'border-sky-500',
    dotClass: 'bg-sky-500',
    softBgClass: 'bg-sky-50/70',
  },
];

export function getFixtureColor(indexZeroBased: number): FixtureColorPalette {
  return FIXTURE_COLORS[indexZeroBased % FIXTURE_COLORS.length];
}

interface MultiImplantTabsBarProps {
  fixtures: DetectedImplantFixture[];
  activeFixtureIdx: number;
  onSelectFixture: (idx: number) => void;
  viewLayout: 'tabbed' | 'stacked';
  onChangeViewLayout: (layout: 'tabbed' | 'stacked') => void;
}

export function MultiImplantTabsBar({
  fixtures,
  activeFixtureIdx,
  onSelectFixture,
  viewLayout,
  onChangeViewLayout,
}: MultiImplantTabsBarProps) {
  if (fixtures.length === 0) return null;

  return (
    <section
      aria-label="Detected implant fixtures"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Detected Implants ({fixtures.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ordered mesial to distal · click a tab or bounding box on the X-ray to inspect
          </p>
        </div>

        <div
          role="group"
          aria-label="Multi-implant card layout"
          className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200 shrink-0"
        >
          <button
            type="button"
            onClick={() => onChangeViewLayout('tabbed')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              viewLayout === 'tabbed'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tabbed
          </button>
          <button
            type="button"
            onClick={() => onChangeViewLayout('stacked')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              viewLayout === 'stacked'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Stacked ({fixtures.length})
          </button>
        </div>
      </div>

      {/* Color-coded Fixture Selector Tabs */}
      <div
        role="tablist"
        aria-label="Select detected implant fixture"
        className="px-4 py-3 flex flex-wrap gap-2 bg-slate-50/60"
      >
        {fixtures.map((fixture, idx) => {
          const palette = getFixtureColor(idx);
          const isActive = viewLayout === 'tabbed' && idx === activeFixtureIdx;
          const topMatch = fixture.analysis.matches[0];
          const topLabel = topMatch
            ? `${topMatch.manufacturer} ${topMatch.systemName}`
            : 'Pending';

          return (
            <button
              key={`fixture-tab-${fixture.fixtureIndex}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                onSelectFixture(idx);
                if (viewLayout === 'stacked') {
                  const el = document.getElementById(
                    `multi-fixture-card-${fixture.fixtureIndex}`
                  );
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className={`text-left px-3 py-2 rounded-md border transition-colors cursor-pointer min-w-[155px] flex-1 sm:flex-initial ${
                isActive
                  ? `${palette.borderClass} ${palette.softBgClass} ring-1 ring-inset ring-slate-900/5`
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-xs shrink-0 ${palette.dotClass}`}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                  {fixture.positionLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 truncate mt-0.5 max-w-[200px]">
                {topLabel}
                {topMatch ? ` (${Math.round(topMatch.confidencePercent)}%)` : ''}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
