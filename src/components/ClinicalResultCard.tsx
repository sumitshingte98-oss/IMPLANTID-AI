import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Printer,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { IMPLANT_SYSTEMS } from '../data/referenceData';
import type {
  ImplantMatch,
  MatchStrength,
  RadiographAnalysisResult,
  ReferenceSampleImage,
  WeightedCriterionScore,
} from '../types/implant';
import { DriverBitSchematic } from './DriverBitSchematic';

export type AnalysisStage = 'idle' | 'stage1' | 'stage2';

interface ClinicalResultCardProps {
  analysis: RadiographAnalysisResult | null;
  selectedMatchIndex: number;
  isAnalyzing: boolean;
  analysisStage: AnalysisStage;
  stage1Candidates: string[];
  stage2RefCount: number;
  errorMessage: string | null;
  fewShotCount: number;
  onRetry: () => void;
  onTriggerUpload: () => void;
  onOpenReferenceLibrary: () => void;
  patientRadiographUrl?: string | null;
  samplesBySystem?: Record<string, ReferenceSampleImage[]>;
}

function resolveMatchedSystemId(match: ImplantMatch): string | null {
  const combined = `${match.manufacturer} ${match.systemName}`.toLowerCase();
  const direct = IMPLANT_SYSTEMS.find(
    (s) =>
      s.label.toLowerCase() === combined ||
      (s.manufacturer.toLowerCase() === match.manufacturer.toLowerCase() &&
        s.systemName.toLowerCase() === match.systemName.toLowerCase())
  );
  if (direct) return direct.id;
  if (combined.includes('neodent') || combined.includes('helix gm') || combined.includes('grand morse')) {
    return 'neodent-helix-gm';
  }
  if (combined.includes('osstem') || combined.includes('tsiii') || combined.includes('ts iii')) {
    return 'osstem-tsiii';
  }
  if (
    combined.includes('tissue level') ||
    combined.includes('standard plus') ||
    combined.includes('sp/tl') ||
    combined.includes('synocta')
  ) {
    return 'straumann-sp-tl';
  }
  if (combined.includes('straumann') || combined.includes('blt') || combined.includes('bone level tapered')) {
    return 'straumann-blt';
  }
  if (combined.includes('nobelactive') || combined.includes('nobel active')) {
    return 'nobel-active';
  }
  if (combined.includes('nobelreplace') || combined.includes('nobel replace') || combined.includes('tapered groovy')) {
    return 'nobel-replace';
  }
  if (combined.includes('dentium') || combined.includes('superline')) {
    return 'dentium-superline';
  }
  if (combined.includes('biohorizons') || combined.includes('laser-lok') || combined.includes('laser lok')) {
    return 'biohorizons-tapered-internal';
  }
  if (combined.includes('zimmer') || combined.includes('zimvie') || combined.includes('tsv') || combined.includes('screw-vent')) {
    return 'zimmer-tsv';
  }
  if (combined.includes('alpha-bio') || combined.includes('alpha bio') || combined.includes('spi')) {
    return 'alpha-bio-spi';
  }
  if (combined.includes('astra') || combined.includes('osseospeed') || combined.includes('dentsply')) {
    return 'astra-tech-ev';
  }
  if (combined.includes('bredent') || combined.includes('copasky') || combined.includes('sky')) {
    return 'bredent-sky';
  }
  if (combined.includes('adin') || combined.includes('touareg')) {
    return 'adin-touareg';
  }
  if (combined.includes('noris') || combined.includes('tuff')) {
    return 'noris-tuff';
  }
  return null;
}

function formatStrengthLabel(strength: MatchStrength): {
  glyph: string;
  label: string;
  toneClass: string;
} {
  if (strength === 'High') {
    return { glyph: '●', label: 'High', toneClass: 'text-emerald-700' };
  }
  if (strength === 'Moderate') {
    return { glyph: '▲', label: 'Moderate', toneClass: 'text-amber-700' };
  }
  return { glyph: '○', label: 'Low', toneClass: 'text-slate-500' };
}

interface WeightedCriterionRowProps {
  indexLabel: string;
  criterionTitle: string;
  weightPercent: number;
  observedTarget: string;
  detail: WeightedCriterionScore;
}

function WeightedCriterionRow({
  indexLabel,
  criterionTitle,
  weightPercent,
  observedTarget,
  detail,
}: WeightedCriterionRowProps) {
  const indicator = formatStrengthLabel(detail.matchStrength);
  const clampedScore = Math.max(0, Math.min(weightPercent, detail.score));
  const fillPct = Math.round((clampedScore / weightPercent) * 100);

  return (
    <div className="px-6 py-4 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-xs text-slate-400">{indexLabel}</span>
          <h3 className="text-sm font-semibold text-slate-900">{criterionTitle}</h3>
          <span className="text-xs font-mono text-slate-500">({weightPercent}% wt)</span>
        </div>

        <div className="flex items-baseline gap-3 shrink-0">
          <span className={`text-xs font-medium whitespace-nowrap ${indicator.toneClass}`}>
            <span aria-hidden="true" className="mr-1">
              {indicator.glyph}
            </span>
            {indicator.label}
          </span>
          <span className="font-mono tabular-nums text-sm font-semibold text-slate-900">
            {clampedScore}
            <span className="text-xs font-normal text-slate-400"> / {weightPercent}</span>
          </span>
        </div>
      </div>

      {/* Weighted Score Fill Bar */}
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            fillPct >= 80
              ? 'bg-blue-700'
              : fillPct >= 55
                ? 'bg-amber-500'
                : 'bg-slate-400'
          }`}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-x-5 gap-y-1.5 pt-0.5 text-xs">
        <div className="md:col-span-7">
          <p className="font-semibold text-slate-800">{detail.classification}</p>
          <p className="text-slate-600 mt-0.5 leading-relaxed">
            {detail.radiographicObservation}
          </p>
        </div>
        {observedTarget && (
          <div className="md:col-span-5 text-[11px] text-slate-500 md:border-l md:border-slate-100 md:pl-4 leading-relaxed">
            <span className="font-semibold text-slate-600 block mb-0.5">
              Target X-Ray Observation
            </span>
            {observedTarget}
          </div>
        )}
      </div>
    </div>
  );
}

export function ClinicalResultCard({
  analysis,
  selectedMatchIndex,
  isAnalyzing,
  analysisStage,
  stage1Candidates,
  stage2RefCount,
  errorMessage,
  fewShotCount,
  onRetry,
  onTriggerUpload,
  onOpenReferenceLibrary,
  patientRadiographUrl,
  samplesBySystem,
}: ClinicalResultCardProps) {
  const [cadFormat, setCadFormat] = useState<'exocad' | '3shape'>('exocad');
  const [downloadedFormat, setDownloadedFormat] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedPrescription, setCopiedPrescription] = useState(false);
  const [activeRefPreviewIdx, setActiveRefPreviewIdx] = useState(0);

  if (errorMessage) {
    return (
      <section
        aria-label="Analysis error"
        className="bg-white border border-slate-200 rounded-lg p-8 flex flex-col justify-center min-h-[540px]"
      >
        <div className="max-w-lg">
          <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold mb-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Radiographic analysis failed</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Unable to complete geometric identification
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {errorMessage}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Retry Analysis
            </button>
            <button
              type="button"
              onClick={onTriggerUpload}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Upload Different X-Ray
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (isAnalyzing) {
    const isStage2 = analysisStage === 'stage2';
    return (
      <section
        aria-label="Analyzing radiograph"
        className="bg-white border border-slate-200 rounded-lg p-8 min-h-[540px] flex flex-col justify-between"
      >
        <div>
          <p className="text-xs font-semibold text-blue-700 font-mono tabular-nums">
            {isStage2
              ? `Stage 1: Morphological Screening → Stage 2: Comparing against ${stage2RefCount} Reference Radiograph${stage2RefCount === 1 ? '' : 's'}`
              : 'Stage 1: Morphological Screening (14 Systems Available)'}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 mt-1.5">
            {isStage2
              ? 'Head-to-Head Visual Match & 6-Point Anatomical Breakdown…'
              : 'Screening 14 Implant Systems to Narrow Top 4 Candidates…'}
          </h2>
          <p className="text-sm text-slate-600 mt-2 max-w-xl leading-relaxed">
            {isStage2
              ? 'Inspecting full native-resolution microthreads, internal hex/conical silhouettes, thread leads, and apical vents against labeled Top 4 candidate reference radiographs.'
              : 'Evaluating neck/collar geometry, internal connection silhouette, thread pitch, body taper, apical flutes, and crestal platform profile at maximum pixel density.'}
          </p>

          {isStage2 && stage1Candidates.length > 0 && (
            <div className="mt-5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-md">
              <span className="block text-[11px] font-semibold text-slate-500">
                Stage 1 Screened Top 4 Candidates
              </span>
              <p className="text-xs font-medium text-slate-900 mt-1">
                {stage1Candidates.join(' · ')}
              </p>
            </div>
          )}

          <div className="mt-6 border-t border-slate-200 divide-y divide-slate-100">
            {[
              {
                label: 'Stage 1 · 14-System Morphological Screening (Top 4 narrowing)',
                state: isStage2 ? 'Complete' : 'Active',
              },
              {
                label: `Stage 2 · Comparing against ${isStage2 ? stage2RefCount : fewShotCount} Reference Radiograph${(isStage2 ? stage2RefCount : fewShotCount) === 1 ? '' : 's'}`,
                state: isStage2 ? 'Active' : 'Queued',
              },
              {
                label: '6-Point Weighted Scoring (Collar 25% · Connection 25% · Threads 20% · Taper 10% · Apex 10% · Platform 10%)',
                state: isStage2 ? 'Scoring' : 'Queued',
              },
            ].map((step) => (
              <div key={step.label} className="py-3.5 flex items-center justify-between gap-4">
                <span className="text-sm text-slate-700">{step.label}</span>
                <span
                  className={`text-xs font-mono shrink-0 ${
                    step.state === 'Complete'
                      ? 'text-emerald-700 font-semibold'
                      : step.state === 'Active' || step.state === 'Scoring'
                        ? 'text-blue-700 font-semibold'
                        : 'text-slate-400'
                  }`}
                >
                  {step.state}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-6 animate-pulse">
          <div className="space-y-2">
            <div className="h-3 w-28 bg-slate-200 rounded" />
            <div className="h-6 w-44 bg-slate-200 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-28 bg-slate-200 rounded" />
            <div className="h-6 w-24 bg-slate-200 rounded" />
          </div>
        </div>
      </section>
    );
  }

  if (!analysis || analysis.matches.length === 0) {
    return (
      <section
        aria-label="Clinical readout standby"
        className="bg-white border border-slate-200 rounded-lg min-h-[540px] flex flex-col justify-between"
      >
        <div className="p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">
              2-Stage Visual Grounding · 14 Systems Available
            </p>
            <span className="text-xs font-mono tabular-nums font-semibold text-blue-700">
              Comparing against {fewShotCount} Reference X-ray{fewShotCount === 1 ? '' : 's'}
            </span>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900 mt-2 text-balance max-w-xl">
            Upload an unknown radiograph for 2-stage screening & 6-point anatomical scoring
          </h2>
          <p className="text-sm text-slate-600 mt-3 max-w-xl leading-relaxed">
            Covers 14 major implant systems including Neodent Helix GM, Osstem TSIII, Straumann BLT & SP/TL, NobelActive & NobelReplace, Dentium SuperLine, BioHorizons Laser-Lok, Zimmer TSV, Alpha-Bio SPI, Astra Tech EV, Bredent SKY, Adin Touareg-S/OS, and Noris Medical Tuff — with up to 6 reference radiographs per brand.
          </p>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="text-xs font-semibold text-slate-900 mb-4">
              6-Point Anatomical Breakdown (100 Points Total)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-xs">
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-2.5">
                <span className="font-semibold text-slate-900">01. Neck / Collar</span>
                <span className="font-mono tabular-nums font-semibold text-blue-700">25%</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-2.5">
                <span className="font-semibold text-slate-900">02. Internal Connection Silhouette</span>
                <span className="font-mono tabular-nums font-semibold text-blue-700">25%</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-2.5">
                <span className="font-semibold text-slate-900">03. Thread Pitch & Shape</span>
                <span className="font-mono tabular-nums font-semibold text-blue-700">20%</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-2.5">
                <span className="font-semibold text-slate-900">04. Body Taper</span>
                <span className="font-mono tabular-nums font-semibold text-slate-700">10%</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-2.5">
                <span className="font-semibold text-slate-900">05. Apex / Vent Design</span>
                <span className="font-mono tabular-nums font-semibold text-slate-700">10%</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-2.5">
                <span className="font-semibold text-slate-900">06. Platform Switch & Crestal Profile</span>
                <span className="font-mono tabular-nums font-semibold text-slate-700">10%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-4 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenReferenceLibrary}
            className="text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
          >
            Open Reference Library (14 Systems Available · {fewShotCount} X-rays)
          </button>
          <button
            type="button"
            onClick={onTriggerUpload}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Select Radiograph
          </button>
        </div>
      </section>
    );
  }

  const activeMatch: ImplantMatch =
    analysis.matches[selectedMatchIndex] ?? analysis.matches[0];
  const confidence = Math.max(0, Math.min(100, Math.round(activeMatch.confidencePercent)));
  const weightedTotal = activeMatch.weightedTotalScore ?? confidence;
  const torqueNcm = Math.max(
    10,
    Math.min(50, Math.round(activeMatch.prostheticSpecs.recommendedTorqueNcm))
  );
  const torquePercent = Math.min(100, Math.round((torqueNcm / 50) * 100));
  const torqueDisplayLabel =
    activeMatch.prostheticSpecs.torqueDisplayLabel || `${torqueNcm} Ncm`;
  const scanBodyDisplayName =
    activeMatch.prostheticSpecs.scanBody.displayName ||
    `${activeMatch.manufacturer} ${activeMatch.systemName} Scan Body`;
  const samplesUsed = analysis.fewShotSamplesUsed ?? 0;
  const observed = analysis.observed_features;
  const eliminatedBrands = Array.isArray(analysis.eliminated_brands)
    ? analysis.eliminated_brands
    : [];
  const screenedLabels = Array.isArray(analysis.stage1CandidateLabels)
    ? analysis.stage1CandidateLabels
    : [];
  const ab = activeMatch.anatomicalBreakdown;
  const matchedSystemId = resolveMatchedSystemId(activeMatch);
  const matchedReferenceImages =
    matchedSystemId && samplesBySystem ? samplesBySystem[matchedSystemId] ?? [] : [];
  const safeRefIdx =
    matchedReferenceImages.length > 0
      ? activeRefPreviewIdx % matchedReferenceImages.length
      : 0;
  const activeReferenceImage = matchedReferenceImages[safeRefIdx] ?? null;

  const handleCopyLabPrescription = async () => {
    const prescriptionLine = `IMPLANTID AI — PROSTHODONTIC LAB ORDER | Identified System: ${activeMatch.manufacturer} ${activeMatch.systemName} | Confidence: ${confidence}% | Connection: ${activeMatch.prostheticSpecs.connectionType} | Required Driver: ${activeMatch.prostheticSpecs.screwdriverBit} | Verified Torque: ${torqueDisplayLabel} | CAD Library: ${scanBodyDisplayName}`;
    try {
      await navigator.clipboard.writeText(prescriptionLine);
      setCopiedPrescription(true);
      window.setTimeout(() => setCopiedPrescription(false), 2600);
    } catch {
      // Fallback copy via temporary textarea if Clipboard API is restricted
      const area = document.createElement('textarea');
      area.value = prescriptionLine;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        setCopiedPrescription(true);
        window.setTimeout(() => setCopiedPrescription(false), 2600);
      } finally {
        document.body.removeChild(area);
      }
    }
  };

  const handlePrintClinicalReport = () => {
    window.print();
  };

  const handleDownloadScanBody = () => {
    const params = new URLSearchParams({
      format: cadFormat,
      manufacturer: activeMatch.manufacturer,
      systemName: activeMatch.systemName,
      platformLine: activeMatch.platformLine,
      libraryId: activeMatch.prostheticSpecs.scanBody.libraryId,
      scanBodyName: scanBodyDisplayName,
      connectionType: activeMatch.prostheticSpecs.connectionType,
      screwdriverBit: activeMatch.prostheticSpecs.screwdriverBit,
      torqueNcm: String(activeMatch.prostheticSpecs.recommendedTorqueNcm),
      torqueLabel: torqueDisplayLabel,
      diameterMm: String(activeMatch.prostheticSpecs.scanBody.platformDiameterMm),
      heightMm: String(activeMatch.prostheticSpecs.scanBody.scanBodyHeightMm),
    });

    const url = `/api/scan-body/download?${params.toString()}`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      cadFormat === 'exocad'
        ? activeMatch.prostheticSpecs.scanBody.exocadFilename
        : activeMatch.prostheticSpecs.scanBody.threeShapeFilename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setDownloadedFormat(cadFormat === 'exocad' ? 'STL' : '3Shape XML');
    window.setTimeout(() => setDownloadedFormat(null), 2600);
  };

  const handleCopyClinicalSummary = async () => {
    const eliminatedLines = eliminatedBrands.map(
      (b) => `- Eliminated ${b.brand_name}: ${b.elimination_reason}`
    );
    const summaryText = [
      `ImplantID AI — 14-System 2-Stage Radiographic Report`,
      `Stage 1 Screened Top 4: ${screenedLabels.join(', ') || 'All 14 Systems'}`,
      `Stage 2 Compared against ${samplesUsed} Reference Radiographs`,
      `Top Match: ${activeMatch.manufacturer} ${activeMatch.systemName} (Weighted Score: ${weightedTotal}/100 · Confidence: ${confidence}%)`,
      `Platform: ${activeMatch.platformLine} | Connection: ${activeMatch.prostheticSpecs.connectionType}`,
      `Driver Bit: ${activeMatch.prostheticSpecs.screwdriverBit}`,
      `Torque Limit: ${torqueDisplayLabel}`,
      `CAD Scan Body: ${scanBodyDisplayName} (${activeMatch.prostheticSpecs.scanBody.libraryId})`,
      `---`,
      `6-Point Anatomical Breakdown:`,
      `- 01. Neck / Collar (25%): ${ab.neckCollar.score}/25 — ${ab.neckCollar.classification}`,
      `- 02. Internal Connection (25%): ${ab.internalConnection.score}/25 — ${ab.internalConnection.classification}`,
      `- 03. Thread Pitch & Shape (20%): ${ab.threadPitchShape.score}/20 — ${ab.threadPitchShape.classification}`,
      `- 04. Body Taper (10%): ${ab.bodyTaper.score}/10 — ${ab.bodyTaper.classification}`,
      `- 05. Apex / Vent Design (10%): ${ab.apexVentDesign.score}/10 — ${ab.apexVentDesign.classification}`,
      `- 06. Platform Switch & Crestal Profile (10%): ${ab.platformCrestalProfile.score}/10 — ${ab.platformCrestalProfile.classification}`,
      ...(eliminatedLines.length > 0
        ? [`---`, `Geometric Eliminations:`, ...eliminatedLines]
        : []),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2200);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <article
      aria-label="Structured clinical identification card"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Non-radiograph validation notice */}
      {!analysis.isDentalRadiograph && (
        <div
          role="alert"
          className="px-6 py-3.5 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5 text-amber-900"
        >
          <AlertTriangle
            className="w-4 h-4 mt-0.5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold">Non-diagnostic image detected: </span>
            {analysis.validationMessage ||
              'The uploaded image does not appear to be a dental implant X-ray radiograph.'}
          </div>
        </div>
      )}

      {/* TOP HEADER: System Identity + Weighted Score + Active Reference Confirmation */}
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className="font-semibold text-blue-700">
                {selectedMatchIndex === 0
                  ? 'Top Match #1'
                  : `Candidate Match #${selectedMatchIndex + 1}`}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeMatch.manufacturer}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-600">
                {observed?.estimated_envelope}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  samplesUsed > 0 ? 'text-emerald-700' : 'text-slate-600'
                }`}
              >
                Comparing against {samplesUsed} Reference X-ray{samplesUsed === 1 ? '' : 's'}
              </span>
            </div>

            <h1 className="text-2xl font-semibold text-slate-900 mt-1 tracking-tight text-balance">
              {activeMatch.manufacturer} {activeMatch.systemName}
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              {activeMatch.platformLine}
              <span aria-hidden="true" className="mx-2 text-slate-300">|</span>
              <span>{activeMatch.prostheticSpecs.connectionType}</span>
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span className="block text-[11px] font-medium text-slate-500">
              Weighted Score · Confidence
            </span>
            <div className="flex items-baseline sm:justify-end gap-2 mt-0.5">
              <span className="font-mono tabular-nums text-3xl font-semibold text-slate-900">
                {weightedTotal}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </span>
              <span className="text-xs font-mono tabular-nums text-blue-700 font-semibold">
                ({confidence}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PROMINENT TOP RESTORATIVE HARDWARE BLOCK: Driver Bit, Torque Limit (Ncm), Download Scan Body (.STL) */}
      <div className="border-b border-slate-200 bg-slate-50/50">
        {/* Restorative Specs Header + Deterministic Verification Badge */}
        <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Verified Restorative Hardware Specs
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Verified Manufacturer Lookup • Zero-Hallucination Deterministic Specs</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200">
          {/* Verified Driver Bit */}
          <div className="p-5 flex items-start gap-4">
            <div className="shrink-0">
              <DriverBitSchematic
                profile={activeMatch.prostheticSpecs.screwdriverGeometry}
                size={56}
              />
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold text-slate-500">
                Driver Bit Required
              </span>
              <p className="text-base font-semibold text-slate-900 mt-0.5 leading-snug">
                {activeMatch.prostheticSpecs.screwdriverBit}
              </p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {activeMatch.prostheticSpecs.screwdriverSizeNote}
              </p>
            </div>
          </div>

          {/* Verified Torque Limit (Ncm) */}
          <div className="p-5 flex flex-col justify-between gap-2.5">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500">
                Torque Limit (Ncm)
              </span>
              <div className="mt-0.5 flex items-baseline gap-2 flex-wrap">
                <span className="font-mono tabular-nums text-3xl font-semibold text-slate-900 tracking-tight">
                  {torqueNcm}
                </span>
                <span className="font-mono text-xs uppercase text-slate-500">Ncm</span>
                <span className="text-xs font-mono text-slate-600">
                  · {torqueDisplayLabel}
                </span>
              </div>
            </div>

            <div aria-hidden="true">
              <div className="relative h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-700 rounded-full transition-all duration-300"
                  style={{ width: `${torquePercent}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between font-mono tabular-nums text-[10px] text-slate-400">
                <span>0</span>
                <span>20</span>
                <span>30</span>
                <span>35</span>
                <span>50 Ncm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Prominent Download Scan Body (.STL) Action Bar */}
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200">
          <div className="min-w-0">
            <span className="block text-[11px] font-semibold text-slate-500">
              Verified CAD Scan Body Library
            </span>
            <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
              {scanBodyDisplayName}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span className="font-mono text-slate-700">
                {activeMatch.prostheticSpecs.scanBody.libraryId}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Ø {activeMatch.prostheticSpecs.scanBody.platformDiameterMm.toFixed(1)} mm × H{' '}
                {activeMatch.prostheticSpecs.scanBody.scanBodyHeightMm.toFixed(1)} mm
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div
              role="group"
              aria-label="Scan body CAD file format"
              className="inline-flex items-center p-0.5 bg-slate-200/80 rounded-md"
            >
              <button
                type="button"
                onClick={() => setCadFormat('exocad')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cadFormat === 'exocad'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Exocad (.stl)
              </button>
              <button
                type="button"
                onClick={() => setCadFormat('3shape')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cadFormat === '3shape'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3Shape (.xml)
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadScanBody}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {downloadedFormat ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Downloaded {downloadedFormat}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Download Scan Body (.STL)
                </>
              )}
            </button>
          </div>
        </div>

        {/* 1-Click Dental Lab Prescription & Print / Save Clinical Report Bar */}
        <div className="px-5 py-3 bg-white flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <span className="text-xs text-slate-500">
            Prosthodontic Lab Order &amp; Clinical Documentation
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLabPrescription}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
                copiedPrescription
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {copiedPrescription ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  Copied to Clipboard ✓
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  Copy Lab Prescription
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintClinicalReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
              Print / Save Clinical Report
            </button>
          </div>
        </div>
      </div>

      {/* EXPLAINABLE AI SIDE-BY-SIDE COMPARISON CARD */}
      {patientRadiographUrl && (
        <div className="px-6 py-5 border-b border-slate-200 bg-white space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Explainable AI Side-by-Side Comparison
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Direct visual verification comparing the uploaded patient film against the matched Reference Library system
              </p>
            </div>
            {matchedReferenceImages.length > 1 && (
              <div className="flex items-center gap-1 text-[11px] font-mono">
                {matchedReferenceImages.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveRefPreviewIdx(idx)}
                    className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                      idx === (activeRefPreviewIdx % matchedReferenceImages.length)
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Ref #{idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Patient Uploaded Radiograph */}
            <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
              <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Patient&apos;s Uploaded Radiograph
                </span>
                <span className="text-[11px] font-mono text-slate-500">Target</span>
              </div>
              <div className="aspect-[4/3] bg-[#0B111A] flex items-center justify-center overflow-hidden">
                <img
                  src={patientRadiographUrl}
                  alt="Patient uploaded dental implant radiograph"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Matched Reference Library Radiograph */}
            <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50">
              <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 truncate">
                  Matched Reference Library Radiograph
                </span>
                <span className="text-[11px] font-mono text-blue-700 shrink-0">
                  {activeReferenceImage
                    ? `${activeMatch.manufacturer} · #${(activeRefPreviewIdx % matchedReferenceImages.length) + 1}`
                    : 'No Ref Yet'}
                </span>
              </div>
              {activeReferenceImage ? (
                <div className="aspect-[4/3] bg-[#0B111A] flex items-center justify-center overflow-hidden">
                  <img
                    src={activeReferenceImage.dataUrl}
                    alt={`Matched Reference Library radiograph for ${activeMatch.manufacturer} ${activeMatch.systemName}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-slate-100/80 flex flex-col items-center justify-center text-center px-5 py-4">
                  <p className="text-xs font-medium text-slate-700">
                    No reference X-ray uploaded yet for {activeMatch.manufacturer} {activeMatch.systemName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Confirm this match or upload a known reference film to enable side-by-side visual verification.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenReferenceLibrary}
                    className="mt-3 px-3 py-1 text-xs font-semibold text-blue-700 bg-white border border-slate-200 hover:border-blue-300 rounded-md transition-colors cursor-pointer print:hidden"
                  >
                    Open Reference Library
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Clinical Reasoning & Elimination Log Callout Box */}
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-900">
                Clinical Reasoning &amp; Elimination Log
              </h3>
              <span className="text-[11px] font-mono text-blue-700 font-semibold">
                {activeMatch.manufacturer} {activeMatch.systemName} · {confidence}% Match
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-900">Morphological Match Rationale: </span>
              {activeMatch.diagnosticRationale}
              {analysis.visualComparisonNote ? ` ${analysis.visualComparisonNote}` : ''}
            </p>
            {eliminatedBrands.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80 space-y-1">
                <p className="text-[11px] font-semibold text-slate-700">
                  Eliminated Look-Alike Brands ({eliminatedBrands.length}):
                </p>
                <ul className="space-y-1 text-xs text-slate-600">
                  {eliminatedBrands.slice(0, 4).map((item, idx) => (
                    <li key={`callout-elim-${item.brand_name}-${idx}`} className="leading-relaxed">
                      <span className="font-semibold text-slate-800">{item.brand_name}:</span>{' '}
                      {item.elimination_reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISUAL MATCH RATIONALE: 6-Point Anatomical Breakdown (25/25/20/10/10/10) + Stage 1 Trace + Eliminations */}
      <div>
        <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Visual Match Rationale · 6-Point Anatomical Breakdown
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-2xl">
              {activeMatch.diagnosticRationale}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyClinicalSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                Copy Chart Note
              </>
            )}
          </button>
        </div>

        {(screenedLabels.length > 0 || analysis.visualComparisonNote) && (
          <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-200 text-xs text-slate-600 space-y-1">
            {screenedLabels.length > 0 && (
              <p>
                <span className="font-semibold text-slate-800">
                  Stage 1 Screened Top 4:{' '}
                </span>
                <span>{screenedLabels.join(' · ')}</span>
              </p>
            )}
            {analysis.visualComparisonNote && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-semibold text-slate-800">Stage 2 Visual Comparison: </span>
                  {analysis.visualComparisonNote}
                </span>
                <span className="text-slate-500 font-mono text-[11px] shrink-0">
                  {observed?.image_quality_note}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 6 Weighted Anatomical Landmark Rows */}
        <div className="divide-y divide-slate-200 border-b border-slate-200">
          <WeightedCriterionRow
            indexLabel="01."
            criterionTitle="Neck / Collar"
            weightPercent={25}
            observedTarget={observed?.collar_shape ?? ''}
            detail={ab.neckCollar}
          />
          <WeightedCriterionRow
            indexLabel="02."
            criterionTitle="Internal Connection Silhouette"
            weightPercent={25}
            observedTarget={observed?.internal_connection_silhouette ?? ''}
            detail={ab.internalConnection}
          />
          <WeightedCriterionRow
            indexLabel="03."
            criterionTitle="Thread Pitch & Shape"
            weightPercent={20}
            observedTarget={observed?.thread_spacing ?? ''}
            detail={ab.threadPitchShape}
          />
          <WeightedCriterionRow
            indexLabel="04."
            criterionTitle="Body Taper"
            weightPercent={10}
            observedTarget={observed?.body_contour ?? ''}
            detail={ab.bodyTaper}
          />
          <WeightedCriterionRow
            indexLabel="05."
            criterionTitle="Apex / Vent Design"
            weightPercent={10}
            observedTarget={observed?.apex_shape ?? ''}
            detail={ab.apexVentDesign}
          />
          <WeightedCriterionRow
            indexLabel="06."
            criterionTitle="Platform Switch & Crestal Profile"
            weightPercent={10}
            observedTarget={observed?.platform_crestal_profile ?? ''}
            detail={ab.platformCrestalProfile}
          />
        </div>

        {/* Geometric Elimination Log */}
        {eliminatedBrands.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/40">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h3 className="text-xs font-semibold text-slate-900">
                Geometric Differences · Eliminated Reference Library Systems
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                Top match: {analysis.top_match || `${activeMatch.manufacturer} ${activeMatch.systemName}`}
              </span>
            </div>
            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {eliminatedBrands.map((item, idx) => (
                <div
                  key={`${item.brand_name}-${idx}`}
                  className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-x-4 gap-y-1 text-xs"
                >
                  <div className="sm:col-span-4 font-medium text-slate-800">
                    <span aria-hidden="true" className="text-rose-600 mr-1.5">
                      ×
                    </span>
                    {item.brand_name}
                  </div>
                  <div className="sm:col-span-8 text-slate-600 leading-relaxed">
                    {item.elimination_reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Verification Notice */}
      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/50 text-[11px] text-slate-500 leading-relaxed">
        Clinical verification notice: Radiographic matching provides decision support for restorative identification. Confirm prosthetic connection seating tactually and radiographically prior to applying definitive abutment torque.
      </div>
    </article>
  );
}
