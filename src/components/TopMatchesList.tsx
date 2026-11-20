import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { IMPLANT_SYSTEMS } from '../data/referenceData';
import type { CoreImplantSystemSpec, ImplantMatch } from '../types/implant';

interface TopMatchesListProps {
  matches: ImplantMatch[];
  selectedIndex: number;
  onSelectMatch: (index: number) => void;
  isAnalyzing: boolean;
  canConfirm: boolean;
  confirmedSystemIds: string[];
  onConfirmMatch: (system: CoreImplantSystemSpec) => void;
}

function resolveImplantSystem(match: ImplantMatch): CoreImplantSystemSpec | null {
  const combined = `${match.manufacturer} ${match.systemName}`.toLowerCase();

  // Exact or close label/system match first
  const direct = IMPLANT_SYSTEMS.find(
    (s) =>
      s.label.toLowerCase() === combined ||
      (s.manufacturer.toLowerCase() === match.manufacturer.toLowerCase() &&
        s.systemName.toLowerCase() === match.systemName.toLowerCase())
  );
  if (direct) return direct;

  // Disambiguated brand matching across all 14 systems
  if (combined.includes('neodent') || combined.includes('helix gm') || combined.includes('grand morse')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'neodent-helix-gm') ?? null;
  }
  if (combined.includes('osstem') || combined.includes('tsiii') || combined.includes('ts iii')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'osstem-tsiii') ?? null;
  }
  if (
    combined.includes('tissue level') ||
    combined.includes('standard plus') ||
    combined.includes('sp/tl') ||
    combined.includes('synocta')
  ) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'straumann-sp-tl') ?? null;
  }
  if (combined.includes('straumann') || combined.includes('blt') || combined.includes('bone level tapered')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'straumann-blt') ?? null;
  }
  if (combined.includes('nobelactive') || combined.includes('nobel active')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'nobel-active') ?? null;
  }
  if (combined.includes('nobelreplace') || combined.includes('nobel replace') || combined.includes('tapered groovy')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'nobel-replace') ?? null;
  }
  if (combined.includes('dentium') || combined.includes('superline')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'dentium-superline') ?? null;
  }
  if (combined.includes('biohorizons') || combined.includes('laser-lok') || combined.includes('laser lok')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'biohorizons-tapered-internal') ?? null;
  }
  if (combined.includes('zimmer') || combined.includes('zimvie') || combined.includes('tsv') || combined.includes('screw-vent')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'zimmer-tsv') ?? null;
  }
  if (combined.includes('alpha-bio') || combined.includes('alpha bio') || combined.includes('spi')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'alpha-bio-spi') ?? null;
  }
  if (combined.includes('astra') || combined.includes('osseospeed') || combined.includes('dentsply')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'astra-tech-ev') ?? null;
  }
  if (combined.includes('bredent') || combined.includes('copasky') || combined.includes('sky')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'bredent-sky') ?? null;
  }
  if (combined.includes('adin') || combined.includes('touareg')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'adin-touareg') ?? null;
  }
  if (combined.includes('noris') || combined.includes('tuff')) {
    return IMPLANT_SYSTEMS.find((s) => s.id === 'noris-tuff') ?? null;
  }
  return null;
}

export function TopMatchesList({
  matches,
  selectedIndex,
  onSelectMatch,
  isAnalyzing,
  canConfirm,
  confirmedSystemIds,
  onConfirmMatch,
}: TopMatchesListProps) {
  const [fallbackSystemId, setFallbackSystemId] = useState<string>('');

  useEffect(() => {
    if (isAnalyzing || matches.length === 0) {
      setFallbackSystemId('');
    }
  }, [isAnalyzing, matches.length]);

  if (isAnalyzing) {
    return (
      <section
        aria-label="Top 3 implant matches loading"
        className="bg-white border border-slate-200 rounded-lg p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Top 3 Implant Matches</h2>
          <span className="text-xs font-mono text-slate-400">Computing…</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="py-3 border-t border-slate-100 first:border-t-0 animate-pulse"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="h-3.5 w-44 bg-slate-200 rounded" />
                <div className="h-3.5 w-10 bg-slate-200 rounded" />
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  const selectedFallbackSystem =
    IMPLANT_SYSTEMS.find((s) => s.id === fallbackSystemId) ?? null;
  const isFallbackConfirmed = Boolean(
    selectedFallbackSystem && confirmedSystemIds.includes(selectedFallbackSystem.id)
  );

  return (
    <section
      aria-label="Top 3 matching implant systems"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-900">Top 3 Matching Systems</h2>
        <span className="text-xs text-slate-500">Select to inspect protocol</span>
      </div>

      <div
        className="divide-y divide-slate-200"
        role="listbox"
        aria-label="Matched implant candidates"
      >
        {matches.slice(0, 3).map((match, idx) => {
          const isSelected = idx === selectedIndex;
          const clampedConfidence = Math.max(
            0,
            Math.min(100, Math.round(match.confidencePercent))
          );
          const resolvedSystem = resolveImplantSystem(match);
          const isConfirmed = Boolean(
            resolvedSystem && confirmedSystemIds.includes(resolvedSystem.id)
          );
          const brandDisplayName =
            resolvedSystem?.label ?? `${match.manufacturer} ${match.systemName}`;

          return (
            <div
              key={`${match.manufacturer}-${match.systemName}-${idx}`}
              className={`transition-colors duration-150 ${
                isSelected ? 'bg-blue-50/60' : 'bg-white hover:bg-slate-50'
              }`}
            >
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelectMatch(idx)}
                className="w-full text-left px-5 pt-4 pb-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums font-medium text-slate-600">
                        0{idx + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{match.manufacturer}</span>
                      {idx === 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-700 font-medium whitespace-nowrap">
                            Primary match
                          </span>
                        </>
                      )}
                    </div>
                    <p
                      className={`text-sm font-semibold mt-1 truncate ${
                        isSelected ? 'text-blue-950' : 'text-slate-900'
                      }`}
                    >
                      {match.systemName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {match.platformLine}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono tabular-nums text-lg font-semibold ${
                        isSelected ? 'text-blue-700' : 'text-slate-900'
                      }`}
                    >
                      {clampedConfidence}%
                    </span>
                  </div>
                </div>

                {/* Calibrated Confidence Bar */}
                <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isSelected ? 'bg-blue-600' : 'bg-slate-400'
                    }`}
                    style={{ width: `${clampedConfidence}%` }}
                  />
                </div>
              </button>

              {/* Clinical Confirmation & Continuous Learning Action */}
              {resolvedSystem && (
                <div className="px-5 pb-3.5">
                  <button
                    type="button"
                    disabled={!canConfirm || isConfirmed}
                    onClick={() => onConfirmMatch(resolvedSystem)}
                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      isConfirmed
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    <Check
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isConfirmed ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {isConfirmed
                        ? `Verified & Added to ${brandDisplayName} References ✓`
                        : 'Confirm Match & Add to Reference Library'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fallback Manual System Confirmation (if none of Top 3 matched) */}
      <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 space-y-2">
        <label
          htmlFor="fallback-implant-system"
          className="block text-xs font-medium text-slate-600"
        >
          None of the Top 3 correct? Select Different System
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select
            id="fallback-implant-system"
            value={fallbackSystemId}
            onChange={(e) => setFallbackSystemId(e.target.value)}
            disabled={!canConfirm}
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-blue-600 disabled:opacity-50"
          >
            <option value="">Choose from 14 implant systems…</option>
            {IMPLANT_SYSTEMS.map((sys) => (
              <option key={sys.id} value={sys.id}>
                {sys.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!canConfirm || !selectedFallbackSystem || isFallbackConfirmed}
            onClick={() => {
              if (selectedFallbackSystem) {
                onConfirmMatch(selectedFallbackSystem);
              }
            }}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              isFallbackConfirmed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default'
                : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <Check
              className={`w-3.5 h-3.5 shrink-0 ${
                isFallbackConfirmed ? 'text-emerald-700' : 'text-slate-500'
              }`}
              aria-hidden="true"
            />
            {isFallbackConfirmed && selectedFallbackSystem
              ? `Verified & Added ✓`
              : 'Save to Library'}
          </button>
        </div>
        {isFallbackConfirmed && selectedFallbackSystem && (
          <p className="text-[11px] font-medium text-emerald-700">
            Verified &amp; Added to {selectedFallbackSystem.label} References ✓
          </p>
        )}
      </div>
    </section>
  );
}

