import React, { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { IMPLANT_SYSTEMS } from '../data/referenceData';
import type { CoreImplantSystemSpec, ReferenceSampleImage } from '../types/implant';
import { convertImageToCleanBase64 } from '../utils/imageConverter';
import { DriverBitSchematic } from './DriverBitSchematic';

interface ReferenceLibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  samplesBySystem: Record<string, ReferenceSampleImage[]>;
  onAddSamples: (system: CoreImplantSystemSpec, samples: ReferenceSampleImage[]) => void;
  onRemoveSample: (systemId: string, sampleId: string) => void;
  onClearAll: () => void;
  onResetSyncDefaults: () => void;
  storageWarning: string | null;
}

const MAX_SAMPLES_PER_SYSTEM = 6;
const SLOT_HINTS = ['Front-on', 'Angled', 'Alt. Ø', 'Restored', 'Unrestored', 'Extra'];

export function ReferenceLibraryDrawer({
  isOpen,
  onClose,
  samplesBySystem,
  onAddSamples,
  onRemoveSample,
  onClearAll,
  onResetSyncDefaults,
  storageWarning,
}: ReferenceLibraryDrawerProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busySystemId, setBusySystemId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [showCalibratedOnly, setShowCalibratedOnly] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredSystems = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return IMPLANT_SYSTEMS.filter((sys) => {
      const count = (samplesBySystem[sys.id] ?? []).length;
      if (showCalibratedOnly && count === 0) return false;
      if (!q) return true;
      return (
        sys.label.toLowerCase().includes(q) ||
        sys.manufacturer.toLowerCase().includes(q) ||
        sys.driverBit.toLowerCase().includes(q) ||
        sys.scanBodyLabel.toLowerCase().includes(q) ||
        sys.collarFingerprint.toLowerCase().includes(q) ||
        sys.threadFingerprint.toLowerCase().includes(q) ||
        sys.apexFingerprint.toLowerCase().includes(q)
      );
    });
  }, [filterQuery, showCalibratedOnly, samplesBySystem]);

  if (!isOpen) return null;

  const totalSystems = IMPLANT_SYSTEMS.length;
  const totalSamples = Object.values(samplesBySystem).reduce(
    (sum, list) => sum + list.length,
    0
  );
  const calibratedSystemCount = IMPLANT_SYSTEMS.filter(
    (sys) => (samplesBySystem[sys.id]?.length ?? 0) > 0
  ).length;

  const handleSyncClick = () => {
    setFilterQuery('');
    setShowCalibratedOnly(false);
    setUploadError(null);
    onResetSyncDefaults();
    setJustSynced(true);
    window.setTimeout(() => setJustSynced(false), 2200);
  };

  const handleFileChange = async (
    system: CoreImplantSystemSpec,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploadError(null);
    const existing = samplesBySystem[system.id] ?? [];
    const remainingSlots = MAX_SAMPLES_PER_SYSTEM - existing.length;
    if (remainingSlots <= 0) {
      setUploadError(
        `${system.label} already has ${MAX_SAMPLES_PER_SYSTEM} reference X-rays loaded. Delete one to upload another.`
      );
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    setBusySystemId(system.id);
    try {
      const encodedBatch: ReferenceSampleImage[] = [];
      for (const file of filesToProcess) {
        const validMime = ['image/jpeg', 'image/jpg', 'image/png'].includes(
          file.type.toLowerCase()
        );
        const validExt = /\.(jpe?g|png)$/i.test(file.name);
        if (!validMime && !validExt) {
          throw new Error(
            `Unsupported file "${file.name}". Please upload .jpg or .png reference X-rays.`
          );
        }

        // Preserve full native pixel resolution (zero downscaling / zero lossy recompression)
        const converted = await convertImageToCleanBase64(file, file.name);

        encodedBatch.push({
          id: `${system.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          systemId: system.id,
          systemLabel: system.label,
          fileName: file.name,
          mimeType: converted.mimeType,
          base64Data: converted.base64Data,
          dataUrl: converted.dataUrl,
          addedAt: Date.now(),
        });
      }

      if (encodedBatch.length > 0) {
        onAddSamples(system, encodedBatch);
      }
      if (files.length > remainingSlots) {
        setUploadError(
          `Uploaded ${remainingSlots} of ${files.length} selected files (${system.label} limit is ${MAX_SAMPLES_PER_SYSTEM} references).`
        );
      }
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to process reference radiographs.'
      );
    } finally {
      setBusySystemId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45"
      role="dialog"
      aria-modal="true"
      aria-label="Reference Library Few-Shot Calibration"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white h-full border-l border-slate-200 flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 className="text-base font-semibold text-slate-900">
                Reference Library (Few-Shot Calibration)
              </h2>
              <span className="text-xs font-mono font-semibold text-blue-700">
                {totalSystems} Systems Available
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Batch-upload up to {MAX_SAMPLES_PER_SYSTEM} full-resolution reference X-rays per brand (front-on, angled, restored/unrestored, alternate diameters). Stage 2 automatically compares against all references for the Top 4 screened candidates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reference Library"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Summary, Reset/Sync Default Systems, Search, and Filter Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-600">
              <span className="font-semibold text-slate-900">
                {totalSystems} Systems Available
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {totalSamples}
                </span>{' '}
                {totalSamples === 1 ? 'reference loaded' : 'references loaded'} across{' '}
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {calibratedSystemCount}/{totalSystems}
                </span>{' '}
                brands
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSyncClick}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {justSynced ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                    Synced 14 Systems
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    Reset / Sync Default Systems
                  </>
                )}
              </button>

              {totalSamples > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs font-medium text-rose-700 hover:text-rose-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search 14 systems (e.g. Adin, Noris, Neodent, Zimmer)…"
                aria-label="Search Reference Library systems"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div
              role="group"
              aria-label="Filter Reference Library"
              className="inline-flex items-center p-0.5 bg-slate-200/80 rounded-md shrink-0"
            >
              <button
                type="button"
                onClick={() => setShowCalibratedOnly(false)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !showCalibratedOnly
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({totalSystems})
              </button>
              <button
                type="button"
                onClick={() => setShowCalibratedOnly(true)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showCalibratedOnly
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Loaded ({calibratedSystemCount})
              </button>
            </div>
          </div>
        </div>

        {(uploadError || storageWarning) && (
          <div className="px-6 pt-3 space-y-2">
            {uploadError && (
              <p
                role="alert"
                className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2"
              >
                {uploadError}
              </p>
            )}
            {storageWarning && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {storageWarning}
              </p>
            )}
          </div>
        )}

        {/* All 14 Hardcoded Implant Systems List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
          {filteredSystems.map((system, sysIdx) => {
            const samples = samplesBySystem[system.id] ?? [];
            const canAddMore = samples.length < MAX_SAMPLES_PER_SYSTEM;
            const isBusy = busySystemId === system.id;
            const inputId = `ref-upload-${system.id}`;

            return (
              <div key={system.id} className="px-6 py-5">
                <div className="flex items-start gap-3.5 min-w-0">
                  <DriverBitSchematic
                    profile={system.driverGeometry}
                    size={42}
                    className="shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        <span className="font-mono text-xs text-slate-400 mr-1.5">
                          {String(sysIdx + 1).padStart(2, '0')}.
                        </span>
                        {system.label}
                      </h3>
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          samples.length > 0
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-500'
                        }`}
                      >
                        {samples.length}/{MAX_SAMPLES_PER_SYSTEM} References Loaded
                      </span>
                    </div>

                    {/* Verified Restorative Hardware Specs */}
                    <dl className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <div>
                        <dt className="inline text-slate-500">Driver: </dt>
                        <dd className="inline font-medium text-slate-900">
                          {system.driverBit}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-slate-500">Torque: </dt>
                        <dd className="inline font-mono tabular-nums font-medium text-slate-900">
                          {system.torqueDisplayLabel}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="inline text-slate-500">Scan Body: </dt>
                        <dd className="inline font-medium text-slate-800">
                          {system.scanBodyLabel}
                        </dd>
                      </div>
                    </dl>

                    {/* Compact Radiographic Fingerprint */}
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 leading-relaxed">
                      <p>
                        <span className="font-semibold text-slate-700">Collar: </span>
                        {system.collarFingerprint}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Threads: </span>
                        {system.threadFingerprint}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Body: </span>
                        {system.bodyFingerprint}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Apex: </span>
                        {system.apexFingerprint}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Up to 6 Reference X-Ray Slots (Batch Multi-File Upload) */}
                <div className="mt-4 pl-0 sm:pl-[56px] grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {samples.map((sample, idx) => (
                    <div
                      key={sample.id}
                      className="relative group rounded-md border border-slate-200 bg-white overflow-hidden"
                    >
                      <div className="aspect-[4/3] bg-[#0B111A] overflow-hidden relative">
                        <img
                          src={sample.dataUrl}
                          alt={`Reference ${idx + 1} for ${system.label}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveSample(system.id, sample.id)}
                          aria-label={`Remove reference ${idx + 1} for ${system.label}`}
                          title="Delete reference"
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-slate-950/80 text-white hover:bg-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="px-2 py-1 flex items-center justify-between gap-1 bg-white border-t border-slate-200">
                        <span className="text-[11px] font-mono text-slate-600 truncate">
                          #{idx + 1} · {SLOT_HINTS[idx] ?? 'Ref'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveSample(system.id, sample.id)}
                          aria-label={`Delete reference ${idx + 1}`}
                          className="text-slate-400 hover:text-rose-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {canAddMore && (
                    <label
                      htmlFor={inputId}
                      className={`min-h-[96px] rounded-md border border-dashed border-slate-300 bg-slate-50/70 hover:border-blue-600 hover:bg-blue-50/40 transition-colors flex flex-col items-center justify-center text-center px-2.5 py-2 cursor-pointer ${
                        isBusy ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      <input
                        id={inputId}
                        type="file"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        multiple
                        onChange={(e) => handleFileChange(system, e)}
                        className="sr-only"
                      />
                      <Upload className="w-4 h-4 text-blue-700 mb-1" aria-hidden="true" />
                      <span className="text-xs font-medium text-slate-800">
                        {isBusy ? 'Encoding…' : 'Batch Upload X-Rays'}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5">
                        Select up to {MAX_SAMPLES_PER_SYSTEM - samples.length} files
                      </span>
                    </label>
                  )}
                </div>
              </div>
            );
          })}

          {filteredSystems.length === 0 && (
            <div className="px-6 py-12 text-center text-xs text-slate-500">
              No implant systems match the current filter.
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500">
            Stage 1 screens 14 systems → Stage 2 matches Top 4 candidates against all uploaded references.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
