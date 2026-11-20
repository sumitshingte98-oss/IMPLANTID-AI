import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import type {
  AnalysisMode,
  CoreImplantSystemSpec,
  DetectedImplantFixture,
  MultiImplantAnalysisResult,
  RadiographAnalysisResult,
  ReferenceSampleImage,
  ReferenceSamplePayload,
  SampleRadiograph,
  Stage1ScreeningResult,
} from './types/implant';
import { IMPLANT_SYSTEMS } from './data/referenceData';
import {
  RadiographUploader,
  type RadiographBoundingBoxOverlay,
} from './components/RadiographUploader';
import { TopMatchesList } from './components/TopMatchesList';
import {
  ClinicalResultCard,
  type AnalysisStage,
} from './components/ClinicalResultCard';
import {
  MultiImplantTabsBar,
  getFixtureColor,
} from './components/MultiImplantFixtureHeader';
import { ImplantReferenceView, TorqueDriversView } from './components/ReferenceViews';
import { ReferenceLibraryDrawer } from './components/ReferenceLibraryDrawer';
import {
  convertImageToCleanBase64,
  cropRadiographByBoundingBox,
} from './utils/imageConverter';

type ActiveSection = 'analyzer' | 'reference' | 'drivers';

interface PendingPayload {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png';
  dataUrl: string;
  fileName: string;
}

const MAX_REFERENCES_PER_SYSTEM = 6;
const REFERENCE_STORAGE_KEY = 'implantid_fewshot_refs_v2';
const LEGACY_STORAGE_KEYS = [
  'implantid_fewshot_refs_v1',
  'implantid_systems_v1',
  'implant_systems',
  'reference_library_systems',
];

const VALID_SYSTEM_MAP = new Map(IMPLANT_SYSTEMS.map((s) => [s.id, s]));

function normalizeReferenceMap(
  rawMap: unknown
): Record<string, ReferenceSampleImage[]> {
  const normalized: Record<string, ReferenceSampleImage[]> = {};
  if (!rawMap || typeof rawMap !== 'object') return normalized;

  for (const [key, value] of Object.entries(rawMap as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const validSystem = VALID_SYSTEM_MAP.get(key);
    const cleanedSamples: ReferenceSampleImage[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const sample = item as Partial<ReferenceSampleImage>;
      if (!sample.base64Data || !sample.dataUrl) continue;
      const targetSpec =
        validSystem ??
        (sample.systemId ? VALID_SYSTEM_MAP.get(sample.systemId) : undefined);
      const targetId = targetSpec?.id ?? key;
      if (!VALID_SYSTEM_MAP.has(targetId)) continue;
      if (cleanedSamples.length >= MAX_REFERENCES_PER_SYSTEM) break;
      cleanedSamples.push({
        id:
          sample.id ||
          `${targetId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        systemId: targetId,
        systemLabel: targetSpec?.label ?? sample.systemLabel ?? targetId,
        fileName: sample.fileName || 'reference.jpg',
        mimeType: sample.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
        base64Data: sample.base64Data,
        dataUrl: sample.dataUrl,
        addedAt: typeof sample.addedAt === 'number' ? sample.addedAt : Date.now(),
      });
    }
    if (cleanedSamples.length > 0) {
      normalized[key] = cleanedSamples;
    }
  }
  return normalized;
}

function loadStoredReferences(): Record<string, ReferenceSampleImage[]> {
  try {
    const rawV2 = window.localStorage.getItem(REFERENCE_STORAGE_KEY);
    if (rawV2) {
      return normalizeReferenceMap(JSON.parse(rawV2));
    }
    // Migrate uploaded user images seamlessly from v1 key while never caching system definitions
    const rawV1 = window.localStorage.getItem('implantid_fewshot_refs_v1');
    if (rawV1) {
      const migrated = normalizeReferenceMap(JSON.parse(rawV1));
      try {
        window.localStorage.setItem(REFERENCE_STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        // Ignore quota error during migration
      }
      return migrated;
    }
  } catch {
    // Ignore storage access or parse errors
  }
  return {};
}

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('analyzer');
  const [isRefDrawerOpen, setIsRefDrawerOpen] = useState(false);
  const [samplesBySystem, setSamplesBySystem] = useState<
    Record<string, ReferenceSampleImage[]>
  >(() => loadStoredReferences());
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('idle');
  const [stage1Candidates, setStage1Candidates] = useState<string[]>([]);
  const [stage2RefCount, setStage2RefCount] = useState(0);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('single');
  const [multiAnalysis, setMultiAnalysis] = useState<MultiImplantAnalysisResult | null>(null);
  const [activeFixtureIndex, setActiveFixtureIndex] = useState(0);
  const [multiViewLayout, setMultiViewLayout] = useState<'tabbed' | 'stacked'>('tabbed');
  const [multiSelectedMatchByFixture, setMultiSelectedMatchByFixture] = useState<
    Record<number, number>
  >({});
  const [multiConfirmedByFixture, setMultiConfirmedByFixture] = useState<
    Record<number, string[]>
  >({});

  const [analysis, setAnalysis] = useState<RadiographAnalysisResult | null>(null);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedSystemIds, setConfirmedSystemIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const lastPayloadRef = useRef<PendingPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Persist ONLY uploaded user reference images (never the hardcoded 14-system catalog)
  useEffect(() => {
    try {
      window.localStorage.setItem(
        REFERENCE_STORAGE_KEY,
        JSON.stringify(samplesBySystem)
      );
      setStorageWarning(null);
    } catch {
      setStorageWarning(
        'Browser localStorage capacity reached; extra reference X-rays remain active in session memory.'
      );
    }
  }, [samplesBySystem]);

  const totalReferenceCount = useMemo(() => {
    return Object.values(samplesBySystem).reduce(
      (sum, list) => sum + list.length,
      0
    );
  }, [samplesBySystem]);

  const handleAddReferenceSamples = useCallback(
    (system: CoreImplantSystemSpec, newSamples: ReferenceSampleImage[]) => {
      setSamplesBySystem((prev) => {
        const current = prev[system.id] ?? [];
        const remaining = MAX_REFERENCES_PER_SYSTEM - current.length;
        if (remaining <= 0) return prev;
        return {
          ...prev,
          [system.id]: [...current, ...newSamples.slice(0, remaining)],
        };
      });
    },
    []
  );

  const handleRemoveReferenceSample = useCallback(
    (systemId: string, sampleId: string) => {
      setSamplesBySystem((prev) => {
        const next = (prev[systemId] ?? []).filter((s) => s.id !== sampleId);
        return {
          ...prev,
          [systemId]: next,
        };
      });
    },
    []
  );

  const handleClearAllReferences = useCallback(() => {
    setSamplesBySystem({});
  }, []);

  /**
   * Clinical Confirmation & Continuous Learning:
   * Automatically saves the currently analyzed full-resolution radiograph into the confirmed
   * implant system's Reference Library state & localStorage (replacing the oldest slot if full).
   */
  const handleConfirmMatchToLibrary = useCallback((system: CoreImplantSystemSpec) => {
    const payload = lastPayloadRef.current;
    if (!payload) return;

    const confirmedSample: ReferenceSampleImage = {
      id: `${system.id}-confirmed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      systemId: system.id,
      systemLabel: system.label,
      fileName: payload.fileName || 'confirmed-radiograph.jpg',
      mimeType: payload.mimeType,
      base64Data: payload.base64,
      dataUrl: payload.dataUrl,
      addedAt: Date.now(),
    };

    setSamplesBySystem((prev) => {
      const current = prev[system.id] ?? [];
      // Prevent duplicate insertion of the exact same radiograph into the same brand
      if (current.some((item) => item.base64Data === payload.base64)) {
        return prev;
      }
      const nextList =
        current.length >= MAX_REFERENCES_PER_SYSTEM
          ? [...current.slice(1), confirmedSample]
          : [...current, confirmedSample];
      return {
        ...prev,
        [system.id]: nextList,
      };
    });

    setConfirmedSystemIds((prev) =>
      prev.includes(system.id) ? prev : [...prev, system.id]
    );

    setToastMessage(
      `Saved to ${system.label} Reference Library — future analyses will use this radiograph for calibration.`
    );
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 5200);
  }, []);

  /**
   * Multi-Implant Clinical Confirmation & Continuous Learning:
   * Crops the confirmed fixture's specific 2D bounding box at native resolution before
   * saving it into that implant system's Reference Library state & localStorage.
   */
  const handleConfirmMultiFixtureToLibrary = useCallback(
    async (fixture: DetectedImplantFixture, system: CoreImplantSystemSpec) => {
      const payload = lastPayloadRef.current;
      if (!payload) return;

      try {
        const cropped = await cropRadiographByBoundingBox(
          payload.dataUrl,
          payload.mimeType,
          fixture.boundingBox
        );

        const baseName = (payload.fileName || 'quadrant-radiograph').replace(
          /\.(jpe?g|png)$/i,
          ''
        );
        const ext = cropped.mimeType === 'image/png' ? 'png' : 'jpg';
        const confirmedSample: ReferenceSampleImage = {
          id: `${system.id}-fixture${fixture.fixtureIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          systemId: system.id,
          systemLabel: system.label,
          fileName: `${baseName}_implant_${fixture.fixtureIndex}.${ext}`,
          mimeType: cropped.mimeType,
          base64Data: cropped.base64Data,
          dataUrl: cropped.dataUrl,
          addedAt: Date.now(),
        };

        setSamplesBySystem((prev) => {
          const current = prev[system.id] ?? [];
          if (current.some((item) => item.base64Data === cropped.base64Data)) {
            return prev;
          }
          const nextList =
            current.length >= MAX_REFERENCES_PER_SYSTEM
              ? [...current.slice(1), confirmedSample]
              : [...current, confirmedSample];
          return {
            ...prev,
            [system.id]: nextList,
          };
        });

        setMultiConfirmedByFixture((prev) => {
          const existing = prev[fixture.fixtureIndex] ?? [];
          if (existing.includes(system.id)) return prev;
          return {
            ...prev,
            [fixture.fixtureIndex]: [...existing, system.id],
          };
        });

        setToastMessage(
          `Saved to ${system.label} Reference Library — future analyses will use this radiograph for calibration.`
        );
        if (toastTimerRef.current !== null) {
          window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => {
          setToastMessage(null);
          toastTimerRef.current = null;
        }, 5200);
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to crop the detected implant fixture for Reference Library saving.'
        );
      }
    },
    []
  );

  /**
   * Clears stale/legacy localStorage keys and re-syncs all 14 hardcoded IMPLANT_SYSTEMS
   * immediately WITHOUT losing any uploaded reference X-ray images.
   */
  const handleResetSyncDefaults = useCallback(() => {
    try {
      for (const staleKey of LEGACY_STORAGE_KEYS) {
        window.localStorage.removeItem(staleKey);
      }
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (key && key !== REFERENCE_STORAGE_KEY && /implant|reference/i.test(key)) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore storage access errors
    }

    setSamplesBySystem((prev) => {
      const preserved = normalizeReferenceMap(prev);
      try {
        window.localStorage.setItem(REFERENCE_STORAGE_KEY, JSON.stringify(preserved));
        setStorageWarning(null);
      } catch {
        setStorageWarning(
          'Synced 14 default systems. Browser storage is full; uploaded images stay active in session memory.'
        );
      }
      return preserved;
    });
  }, []);

  const runAnalysis = useCallback(
    async (
      payload: PendingPayload,
      currentSamplesBySystem: Record<string, ReferenceSampleImage[]>
    ) => {
      lastPayloadRef.current = payload;
      setIsAnalyzing(true);
      setAnalysisStage('stage1');
      setStage1Candidates([]);
      setStage2RefCount(0);
      setErrorMessage(null);
      setAnalysis(null);
      setConfirmedSystemIds([]);
      setSelectedMatchIndex(0);

      try {
        // STAGE 1: Fast 14-System Morphological Screening -> Top 4 candidate IDs
        const stage1Response = await fetch('/api/analyze-stage1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: payload.base64,
            mimeType: payload.mimeType,
          }),
        });

        const stage1Data = (await stage1Response.json().catch(() => null)) as
          | (Stage1ScreeningResult & { error?: string })
          | null;

        if (!stage1Response.ok || !stage1Data) {
          throw new Error(
            stage1Data?.error ||
              `Stage 1 screening returned status ${stage1Response.status}.`
          );
        }

        const top4Ids = Array.isArray(stage1Data.top4CandidateIds)
          ? stage1Data.top4CandidateIds
          : [];
        const top4Labels = Array.isArray(stage1Data.top4CandidateLabels)
          ? stage1Data.top4CandidateLabels
          : [];

        // Gather ALL uploaded reference X-rays (up to 6 each) belonging to the Top 4 screened candidates
        const matchedRefs: ReferenceSamplePayload[] = [];
        for (const candidateId of top4Ids) {
          const brandSamples = (currentSamplesBySystem[candidateId] ?? []).slice(
            0,
            MAX_REFERENCES_PER_SYSTEM
          );
          brandSamples.forEach((sample, idx) => {
            matchedRefs.push({
              systemId: sample.systemId,
              systemLabel: sample.systemLabel,
              sampleIndex: idx + 1,
              mimeType: sample.mimeType,
              imageBase64: sample.base64Data,
            });
          });
        }

        // Transition live on-screen indicator to Stage 2
        setStage1Candidates(top4Labels);
        setStage2RefCount(matchedRefs.length);
        setAnalysisStage('stage2');

        // STAGE 2: Head-to-Head Few-Shot Visual Match against Top 4 candidate references
        const stage2Response = await fetch('/api/analyze-stage2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: payload.base64,
            mimeType: payload.mimeType,
            stage1CandidateIds: top4Ids,
            stage1CandidateLabels: top4Labels,
            referenceSamples: matchedRefs,
          }),
        });

        const stage2Data = await stage2Response.json().catch(() => null);
        if (!stage2Response.ok) {
          throw new Error(
            stage2Data?.error ||
              `Stage 2 visual match returned status ${stage2Response.status}.`
          );
        }

        if (!stage2Data || !Array.isArray(stage2Data.matches)) {
          throw new Error(
            'Unexpected response format received from radiographic analysis engine.'
          );
        }

        const sortedMatches = [...stage2Data.matches].sort(
          (a, b) =>
            (b.weightedTotalScore ?? b.confidencePercent ?? 0) -
              (a.weightedTotalScore ?? a.confidencePercent ?? 0) ||
            (b.confidencePercent ?? 0) - (a.confidencePercent ?? 0)
        );

        setAnalysis({
          ...stage2Data,
          stage1CandidateLabels: top4Labels,
          matches: sortedMatches.slice(0, 3),
        });
        setSelectedMatchIndex(0);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to reach the radiographic analysis API. Please try again.';
        setErrorMessage(msg);
      } finally {
        setIsAnalyzing(false);
        setAnalysisStage('idle');
      }
    },
    []
  );

  // Isolated Multi-Implant Mode Analysis Pipeline (Quadrant / Full-Arch)
  const runMultiImplantAnalysis = useCallback(
    async (
      payload: PendingPayload,
      currentSamplesBySystem: Record<string, ReferenceSampleImage[]>
    ) => {
      lastPayloadRef.current = payload;
      setIsAnalyzing(true);
      setAnalysisStage('stage1');
      setErrorMessage(null);
      setMultiAnalysis(null);
      setActiveFixtureIndex(0);
      setMultiSelectedMatchByFixture({});
      setMultiConfirmedByFixture({});

      try {
        // Attach up to 24 available reference images (up to 2 per loaded brand, prioritizing coverage)
        const refsToAttach: ReferenceSamplePayload[] = [];
        for (const sys of IMPLANT_SYSTEMS) {
          const list = currentSamplesBySystem[sys.id] ?? [];
          list.slice(0, 2).forEach((sample, idx) => {
            if (refsToAttach.length < 24) {
              refsToAttach.push({
                systemId: sample.systemId,
                systemLabel: sample.systemLabel,
                sampleIndex: idx + 1,
                mimeType: sample.mimeType,
                imageBase64: sample.base64Data,
              });
            }
          });
        }

        const response = await fetch('/api/analyze-multi-implant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: payload.base64,
            mimeType: payload.mimeType,
            referenceSamples: refsToAttach,
          }),
        });

        const data = (await response.json().catch(() => null)) as
          | (MultiImplantAnalysisResult & { error?: string })
          | null;

        if (!response.ok || !data) {
          throw new Error(
            data?.error ||
              `Multi-implant analysis returned status ${response.status}.`
          );
        }

        if (!Array.isArray(data.fixtures)) {
          throw new Error(
            'Unexpected response format received from multi-implant analysis engine.'
          );
        }

        setMultiAnalysis(data);
        setActiveFixtureIndex(0);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to reach the multi-implant analysis API. Please try again.';
        setErrorMessage(msg);
      } finally {
        setIsAnalyzing(false);
        setAnalysisStage('idle');
      }
    },
    []
  );

  const handleModeChange = useCallback(
    (nextMode: AnalysisMode) => {
      if (nextMode === analysisMode || isAnalyzing) return;
      setAnalysisMode(nextMode);
      setErrorMessage(null);
      if (lastPayloadRef.current) {
        if (nextMode === 'multi' && !multiAnalysis) {
          void runMultiImplantAnalysis(lastPayloadRef.current, samplesBySystem);
        } else if (nextMode === 'single' && !analysis) {
          void runAnalysis(lastPayloadRef.current, samplesBySystem);
        }
      }
    },
    [
      analysisMode,
      isAnalyzing,
      multiAnalysis,
      analysis,
      samplesBySystem,
      runMultiImplantAnalysis,
      runAnalysis,
    ]
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      setActiveSection('analyzer');
      setActiveSampleId(null);
      setFileName(file.name);
      setAnalysis(null);
      setMultiAnalysis(null);
      try {
        const converted = await convertImageToCleanBase64(file, file.name);
        setPreviewUrl(converted.dataUrl);
        const payload: PendingPayload = {
          base64: converted.base64Data,
          mimeType: converted.mimeType,
          dataUrl: converted.dataUrl,
          fileName: file.name,
        };
        if (analysisMode === 'multi') {
          await runMultiImplantAnalysis(payload, samplesBySystem);
        } else {
          await runAnalysis(payload, samplesBySystem);
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to convert uploaded radiograph.'
        );
      }
    },
    [analysisMode, samplesBySystem, runAnalysis, runMultiImplantAnalysis]
  );

  const handleSampleSelected = useCallback(
    async (sample: SampleRadiograph) => {
      setActiveSection('analyzer');
      setActiveSampleId(sample.id);
      setFileName(`${sample.title}.jpg`);
      setPreviewUrl(sample.imageUrl);
      setErrorMessage(null);
      setAnalysis(null);
      setMultiAnalysis(null);

      try {
        const res = await fetch(sample.imageUrl);
        if (!res.ok) {
          throw new Error('Unable to load clinical test radiograph.');
        }
        const blob = await res.blob();
        const converted = await convertImageToCleanBase64(blob, `${sample.title}.jpg`);
        const payload: PendingPayload = {
          base64: converted.base64Data,
          mimeType: converted.mimeType,
          dataUrl: converted.dataUrl,
          fileName: `${sample.title}.jpg`,
        };
        if (analysisMode === 'multi') {
          await runMultiImplantAnalysis(payload, samplesBySystem);
        } else {
          await runAnalysis(payload, samplesBySystem);
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load sample radiograph.'
        );
      }
    },
    [analysisMode, samplesBySystem, runAnalysis, runMultiImplantAnalysis]
  );

  const handleResetCase = useCallback(() => {
    setActiveSection('analyzer');
    setPreviewUrl(null);
    setFileName(null);
    setActiveSampleId(null);
    setAnalysis(null);
    setMultiAnalysis(null);
    setActiveFixtureIndex(0);
    setMultiSelectedMatchByFixture({});
    setMultiConfirmedByFixture({});
    setConfirmedSystemIds([]);
    setStage1Candidates([]);
    setStage2RefCount(0);
    setAnalysisStage('idle');
    setSelectedMatchIndex(0);
    setErrorMessage(null);
    lastPayloadRef.current = null;
  }, []);

  const handleRetry = useCallback(() => {
    if (!lastPayloadRef.current) return;
    if (analysisMode === 'multi') {
      void runMultiImplantAnalysis(lastPayloadRef.current, samplesBySystem);
    } else {
      void runAnalysis(lastPayloadRef.current, samplesBySystem);
    }
  }, [analysisMode, samplesBySystem, runAnalysis, runMultiImplantAnalysis]);

  const multiBoundingBoxes = useMemo<RadiographBoundingBoxOverlay[] | undefined>(() => {
    if (analysisMode !== 'multi' || !multiAnalysis || multiAnalysis.fixtures.length === 0) {
      return undefined;
    }
    return multiAnalysis.fixtures.map((fixture, idx) => {
      const palette = getFixtureColor(idx);
      return {
        fixtureIndex: fixture.fixtureIndex,
        shortLabel: `Implant #${fixture.fixtureIndex}`,
        positionLabel: fixture.positionLabel,
        box: fixture.boundingBox,
        colorHex: palette.hex,
        badgeBg: palette.badgeBg,
      };
    });
  }, [analysisMode, multiAnalysis]);

  const activeMultiFixture: DetectedImplantFixture | null =
    analysisMode === 'multi' && multiAnalysis && multiAnalysis.fixtures.length > 0
      ? multiAnalysis.fixtures[activeFixtureIndex] ?? multiAnalysis.fixtures[0]
      : null;

  const handleTriggerUpload = useCallback(() => {
    setActiveSection('analyzer');
    window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Clinical Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveSection('analyzer')}
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            ImplantID AI
          </button>

          {/* Zone 2: Clean single-line navigation links + Reference Library (Few-Shot) Drawer Trigger */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveSection('analyzer')}
              className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'analyzer'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Radiograph Analyzer
            </button>

            <button
              type="button"
              onClick={() => setIsRefDrawerOpen(true)}
              className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isRefDrawerOpen
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-700 hover:text-blue-700'
              }`}
            >
              Reference Library (Few-Shot)
              {totalReferenceCount > 0 && (
                <span className="ml-1.5 font-mono tabular-nums text-xs text-blue-700">
                  ({totalReferenceCount})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('reference')}
              className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'reference'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Implant Specs
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('drivers')}
              className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'drivers'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Torque & Drivers
            </button>
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={previewUrl ? handleResetCase : handleTriggerUpload}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {previewUrl ? 'New Case' : 'Upload X-Ray'}
            </button>
          </div>
        </div>

        {/* Compact mobile navigation row */}
        <div className="md:hidden border-t border-slate-100 px-4 flex items-center gap-5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('analyzer')}
            className={`py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'analyzer'
                ? 'border-blue-700 text-slate-900'
                : 'border-transparent text-slate-500'
            }`}
          >
            Radiograph Analyzer
          </button>
          <button
            type="button"
            onClick={() => setIsRefDrawerOpen(true)}
            className="py-2.5 text-xs font-medium border-b-2 border-transparent text-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reference Library (Few-Shot)
            {totalReferenceCount > 0 ? ` (${totalReferenceCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('reference')}
            className={`py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'reference'
                ? 'border-blue-700 text-slate-900'
                : 'border-transparent text-slate-500'
            }`}
          >
            Implant Specs
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('drivers')}
            className={`py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'drivers'
                ? 'border-blue-700 text-slate-900'
                : 'border-transparent text-slate-500'
            }`}
          >
            Torque & Drivers
          </button>
        </div>
      </header>

      {/* Main Clinical Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {activeSection === 'analyzer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Mode Toggle + Drag-and-Drop Radiograph Upload Box + Calibration Strip + Top 3 Matches */}
            <div className="lg:col-span-5 space-y-5">
              {/* Segmented Detection Mode Toggle directly above the Radiograph Uploader */}
              <div
                role="group"
                aria-label="Implant detection mode"
                className="bg-white border border-slate-200 rounded-lg p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5"
              >
                <button
                  type="button"
                  disabled={isAnalyzing}
                  aria-pressed={analysisMode === 'single'}
                  onClick={() => handleModeChange('single')}
                  className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors text-center cursor-pointer disabled:opacity-60 ${
                    analysisMode === 'single'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Single Implant Mode (Default)
                </button>
                <button
                  type="button"
                  disabled={isAnalyzing}
                  aria-pressed={analysisMode === 'multi'}
                  onClick={() => handleModeChange('multi')}
                  className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors text-center cursor-pointer disabled:opacity-60 ${
                    analysisMode === 'multi'
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Multi-Implant Mode (Quadrant / Full-Arch)
                </button>
              </div>

              <RadiographUploader
                previewUrl={previewUrl}
                fileName={fileName}
                isAnalyzing={isAnalyzing}
                activeSampleId={activeSampleId}
                onFileSelected={handleFileSelected}
                onSampleSelected={handleSampleSelected}
                onClear={handleResetCase}
                fileInputRef={fileInputRef}
                boundingBoxes={multiBoundingBoxes}
                activeFixtureIndex={activeFixtureIndex}
                onSelectFixture={(idx) => {
                  setActiveFixtureIndex(idx);
                  if (multiViewLayout === 'stacked' && multiAnalysis?.fixtures[idx]) {
                    const el = document.getElementById(
                      `multi-fixture-card-${multiAnalysis.fixtures[idx].fixtureIndex}`
                    );
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                analyzingLabel={
                  analysisMode === 'multi'
                    ? 'Detecting all implants & localizing bounding boxes…'
                    : undefined
                }
              />

              {/* Live 2-Stage Pipeline & Few-Shot Grounding Confirmation Strip */}
              <div className="bg-white border border-slate-200 rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {isAnalyzing ? (
                      <span className="font-mono tabular-nums text-blue-700">
                        {analysisMode === 'multi'
                          ? 'Multi-Implant Detection: Locating all fixtures & scoring each independently…'
                          : analysisStage === 'stage2'
                            ? `Stage 1: Morphological Screening → Stage 2: Comparing against ${stage2RefCount} Reference Radiograph${stage2RefCount === 1 ? '' : 's'}`
                            : 'Stage 1: Morphological Screening (14 Systems)…'}
                      </span>
                    ) : (
                      <>
                        <span className="font-mono tabular-nums text-blue-700">
                          {IMPLANT_SYSTEMS.length} Systems Available
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span
                          className={`font-mono tabular-nums ${
                            totalReferenceCount > 0 ? 'text-emerald-700' : 'text-slate-700'
                          }`}
                        >
                          Comparing against {totalReferenceCount} Reference X-ray
                          {totalReferenceCount === 1 ? '' : 's'}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {analysisMode === 'multi'
                      ? 'Quadrant / Full-Arch mode: detects every fixture, draws color-coded boxes, and crops confirmed fixtures on save'
                      : totalReferenceCount > 0
                        ? 'Up to 6 full-resolution references/brand attached automatically for Top 4 screened candidates'
                        : 'Open Reference Library (Few-Shot) to batch-upload up to 6 X-rays per brand'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {previewUrl && !isAnalyzing && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      Re-Analyze
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsRefDrawerOpen(true)}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100/70 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {totalReferenceCount > 0 ? 'Manage Refs' : 'Calibrate'}
                  </button>
                </div>
              </div>

              {/* Left Column Match List: Single Mode (Unchanged) OR Active Multi-Implant Fixture */}
              {analysisMode === 'single' ? (
                <TopMatchesList
                  matches={analysis?.matches ?? []}
                  selectedIndex={selectedMatchIndex}
                  onSelectMatch={setSelectedMatchIndex}
                  isAnalyzing={isAnalyzing}
                  canConfirm={Boolean(lastPayloadRef.current && !isAnalyzing)}
                  confirmedSystemIds={confirmedSystemIds}
                  onConfirmMatch={handleConfirmMatchToLibrary}
                />
              ) : (
                <>
                  {multiAnalysis && multiAnalysis.fixtures.length > 0 && (
                    <MultiImplantTabsBar
                      fixtures={multiAnalysis.fixtures}
                      activeFixtureIdx={activeFixtureIndex}
                      onSelectFixture={setActiveFixtureIndex}
                      viewLayout={multiViewLayout}
                      onChangeViewLayout={setMultiViewLayout}
                    />
                  )}
                  {multiViewLayout === 'tabbed' && activeMultiFixture && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span
                          className={`w-2.5 h-2.5 rounded-xs shrink-0 ${getFixtureColor(activeFixtureIndex).dotClass}`}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold text-slate-800">
                          {activeMultiFixture.positionLabel} · Top 3 Matches &amp; Cropped Reference Save
                        </span>
                      </div>
                      <TopMatchesList
                        matches={activeMultiFixture.analysis.matches}
                        selectedIndex={
                          multiSelectedMatchByFixture[activeMultiFixture.fixtureIndex] ?? 0
                        }
                        onSelectMatch={(matchIdx) =>
                          setMultiSelectedMatchByFixture((prev) => ({
                            ...prev,
                            [activeMultiFixture.fixtureIndex]: matchIdx,
                          }))
                        }
                        isAnalyzing={isAnalyzing}
                        canConfirm={Boolean(lastPayloadRef.current && !isAnalyzing)}
                        confirmedSystemIds={
                          multiConfirmedByFixture[activeMultiFixture.fixtureIndex] ?? []
                        }
                        onConfirmMatch={(sys) =>
                          void handleConfirmMultiFixtureToLibrary(activeMultiFixture, sys)
                        }
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Column: Single Mode Clinical Card (Unchanged) OR Per-Fixture Restorative Cards */}
            <div className="lg:col-span-7 space-y-6">
              {analysisMode === 'single' ? (
                <ClinicalResultCard
                  analysis={analysis}
                  selectedMatchIndex={selectedMatchIndex}
                  isAnalyzing={isAnalyzing}
                  analysisStage={analysisStage}
                  stage1Candidates={stage1Candidates}
                  stage2RefCount={stage2RefCount}
                  errorMessage={errorMessage}
                  fewShotCount={totalReferenceCount}
                  onRetry={handleRetry}
                  onTriggerUpload={handleTriggerUpload}
                  onOpenReferenceLibrary={() => setIsRefDrawerOpen(true)}
                  patientRadiographUrl={previewUrl}
                  samplesBySystem={samplesBySystem}
                />
              ) : isAnalyzing || errorMessage || !multiAnalysis ? (
                <ClinicalResultCard
                  analysis={null}
                  selectedMatchIndex={0}
                  isAnalyzing={isAnalyzing}
                  analysisStage={analysisStage}
                  stage1Candidates={[]}
                  stage2RefCount={totalReferenceCount}
                  errorMessage={errorMessage}
                  fewShotCount={totalReferenceCount}
                  onRetry={handleRetry}
                  onTriggerUpload={handleTriggerUpload}
                  onOpenReferenceLibrary={() => setIsRefDrawerOpen(true)}
                  patientRadiographUrl={previewUrl}
                  samplesBySystem={samplesBySystem}
                />
              ) : multiAnalysis.fixtures.length === 0 ? (
                <section className="bg-white border border-slate-200 rounded-lg p-8">
                  <h2 className="text-lg font-semibold text-slate-900">
                    No endosseous implants detected in this radiograph
                  </h2>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    {multiAnalysis.validationMessage ||
                      'Upload a quadrant, periapical, or panoramic radiograph containing visible titanium dental implants.'}
                  </p>
                </section>
              ) : multiViewLayout === 'tabbed' && activeMultiFixture ? (
                <div className="space-y-4">
                  {/* Active Fixture Color Banner */}
                  <div
                    className={`bg-white border-l-4 ${getFixtureColor(activeFixtureIndex).borderClass} border border-slate-200 rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-3`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="px-2 py-0.5 text-xs font-mono font-semibold text-white rounded-xs"
                        style={{
                          backgroundColor: getFixtureColor(activeFixtureIndex).badgeBg,
                        }}
                      >
                        Implant #{activeMultiFixture.fixtureIndex}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {activeMultiFixture.positionLabel}
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      Fixture {activeFixtureIndex + 1} of {multiAnalysis.fixtures.length} · Box [{activeMultiFixture.boundingBox.join(', ')}]
                    </span>
                  </div>

                  <ClinicalResultCard
                    analysis={activeMultiFixture.analysis}
                    selectedMatchIndex={
                      multiSelectedMatchByFixture[activeMultiFixture.fixtureIndex] ?? 0
                    }
                    isAnalyzing={false}
                    analysisStage="idle"
                    stage1Candidates={[]}
                    stage2RefCount={multiAnalysis.fewShotSamplesUsed ?? 0}
                    errorMessage={null}
                    fewShotCount={totalReferenceCount}
                    onRetry={handleRetry}
                    onTriggerUpload={handleTriggerUpload}
                    onOpenReferenceLibrary={() => setIsRefDrawerOpen(true)}
                    patientRadiographUrl={previewUrl}
                    samplesBySystem={samplesBySystem}
                  />
                </div>
              ) : (
                /* All Detected Implants Stacked View */
                <div className="space-y-8">
                  {multiAnalysis.fixtures.map((fixture, idx) => {
                    const palette = getFixtureColor(idx);
                    const selMatchIdx =
                      multiSelectedMatchByFixture[fixture.fixtureIndex] ?? 0;
                    return (
                      <div
                        key={`stacked-fixture-${fixture.fixtureIndex}`}
                        id={`multi-fixture-card-${fixture.fixtureIndex}`}
                        className="space-y-4 scroll-mt-20"
                      >
                        <div
                          className={`bg-white border-l-4 ${palette.borderClass} border border-slate-200 rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-3`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="px-2 py-0.5 text-xs font-mono font-semibold text-white rounded-xs"
                              style={{ backgroundColor: palette.badgeBg }}
                            >
                              Implant #{fixture.fixtureIndex}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {fixture.positionLabel}
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-500">
                            Fixture {idx + 1} of {multiAnalysis.fixtures.length}
                          </span>
                        </div>

                        <TopMatchesList
                          matches={fixture.analysis.matches}
                          selectedIndex={selMatchIdx}
                          onSelectMatch={(matchIdx) =>
                            setMultiSelectedMatchByFixture((prev) => ({
                              ...prev,
                              [fixture.fixtureIndex]: matchIdx,
                            }))
                          }
                          isAnalyzing={false}
                          canConfirm={Boolean(lastPayloadRef.current)}
                          confirmedSystemIds={
                            multiConfirmedByFixture[fixture.fixtureIndex] ?? []
                          }
                          onConfirmMatch={(sys) =>
                            void handleConfirmMultiFixtureToLibrary(fixture, sys)
                          }
                        />

                        <ClinicalResultCard
                          analysis={fixture.analysis}
                          selectedMatchIndex={selMatchIdx}
                          isAnalyzing={false}
                          analysisStage="idle"
                          stage1Candidates={[]}
                          stage2RefCount={multiAnalysis.fewShotSamplesUsed ?? 0}
                          errorMessage={null}
                          fewShotCount={totalReferenceCount}
                          onRetry={handleRetry}
                          onTriggerUpload={handleTriggerUpload}
                          onOpenReferenceLibrary={() => setIsRefDrawerOpen(true)}
                          patientRadiographUrl={previewUrl}
                          samplesBySystem={samplesBySystem}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'reference' && <ImplantReferenceView />}
        {activeSection === 'drivers' && <TorqueDriversView />}
      </main>

      {/* Collapsible Few-Shot Reference Library Drawer (14 Hardcoded Systems · Up to 6 X-Rays Each) */}
      <ReferenceLibraryDrawer
        isOpen={isRefDrawerOpen}
        onClose={() => setIsRefDrawerOpen(false)}
        samplesBySystem={samplesBySystem}
        onAddSamples={handleAddReferenceSamples}
        onRemoveSample={handleRemoveReferenceSample}
        onClearAll={handleClearAllReferences}
        onResetSyncDefaults={handleResetSyncDefaults}
        storageWarning={storageWarning}
      />

      {/* Clinical Confirmation Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white border border-slate-700 rounded-lg px-4 py-3 shadow-lg flex items-start gap-2.5"
        >
          <Check
            className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-slate-100 flex-1">
            {toastMessage}
          </p>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Quiet Clinical Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            ImplantID AI · 14-System 2-Stage Radiographic Identification for Dentists & Dental Laboratories
          </span>
          <span>
            Decision-support software · Verify prosthetic fit clinically before final torque
          </span>
        </div>
      </footer>
    </div>
  );
}
