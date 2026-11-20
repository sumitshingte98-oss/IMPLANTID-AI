import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, RotateCcw, Contrast, Sun, ZoomIn, RefreshCw, Image as ImageIcon } from 'lucide-react';
import type { BoundingBox2D, SampleRadiograph } from '../types/implant';
import { SAMPLE_RADIOGRAPHS } from '../data/referenceData';

export interface RadiographBoundingBoxOverlay {
  fixtureIndex: number;
  shortLabel: string;
  positionLabel: string;
  box: BoundingBox2D;
  colorHex: string;
  badgeBg: string;
}

interface RadiographUploaderProps {
  previewUrl: string | null;
  fileName: string | null;
  isAnalyzing: boolean;
  activeSampleId: string | null;
  onFileSelected: (file: File) => void;
  onSampleSelected: (sample: SampleRadiograph) => void;
  onClear: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  boundingBoxes?: RadiographBoundingBoxOverlay[];
  activeFixtureIndex?: number;
  onSelectFixture?: (indexZeroBased: number) => void;
  analyzingLabel?: string;
}

export function RadiographUploader({
  previewUrl,
  fileName,
  isAnalyzing,
  activeSampleId,
  onFileSelected,
  onSampleSelected,
  onClear,
  fileInputRef,
  boundingBoxes,
  activeFixtureIndex = 0,
  onSelectFixture,
  analyzingLabel,
}: RadiographUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [inverted, setInverted] = useState(false);
  const [contrast, setContrast] = useState(110);
  const [brightness, setBrightness] = useState(100);
  const [zoom, setZoom] = useState<1 | 1.5 | 2>(1);
  const [failedThumbnails, setFailedThumbnails] = useState<Record<string, boolean>>({});
  const [renderedRect, setRenderedRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const dragDepthRef = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const hasBoundingBoxes = Boolean(boundingBoxes && boundingBoxes.length > 0);

  const computeRenderedImageRect = useCallback(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img || !img.naturalWidth || !img.naturalHeight) {
      setRenderedRect(null);
      return;
    }
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    if (!cw || !ch) return;

    const containerRatio = cw / ch;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    let renderW = cw;
    let renderH = ch;
    let left = 0;
    let top = 0;

    if (imgRatio > containerRatio) {
      renderW = cw;
      renderH = cw / imgRatio;
      left = 0;
      top = (ch - renderH) / 2;
    } else {
      renderH = ch;
      renderW = ch * imgRatio;
      left = (cw - renderW) / 2;
      top = 0;
    }
    setRenderedRect({ left, top, width: renderW, height: renderH });
  }, []);

  useEffect(() => {
    if (!hasBoundingBoxes || !previewUrl) {
      setRenderedRect(null);
      return;
    }
    computeRenderedImageRect();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => computeRenderedImageRect());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [hasBoundingBoxes, previewUrl, computeRenderedImageRect]);

  const validateAndEmit = (file: File) => {
    setDropError(null);
    const validMime = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type.toLowerCase());
    const validExt = /\.(jpe?g|png)$/i.test(file.name);
    if (!validMime && !validExt) {
      setDropError('Unsupported file type. Upload a .jpg or .png dental X-ray image.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setDropError('File exceeds 12 MB limit. Compress or crop the radiograph and retry.');
      return;
    }
    setInverted(false);
    setContrast(110);
    setBrightness(100);
    setZoom(1);
    onFileSelected(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndEmit(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndEmit(file);
    }
    e.target.value = '';
  };

  const cycleZoom = () => {
    setZoom((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  const resetViewerControls = () => {
    setInverted(false);
    setContrast(110);
    setBrightness(100);
    setZoom(1);
  };

  return (
    <section
      aria-label="Radiograph upload and viewer"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        onChange={handleInputChange}
        className="sr-only"
        aria-label="Upload dental implant X-ray image"
      />

      {/* Panel Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 truncate">
            Radiograph Input
          </h2>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {fileName ? fileName : 'Periapical or bitewing X-ray · JPG or PNG'}
          </p>
        </div>

        {previewUrl && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Replace
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={isAnalyzing}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Dropzone OR Active Clinical Radiograph Lightbox */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative"
      >
        {!previewUrl ? (
          <div className="p-5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full min-h-[290px] rounded-md border border-dashed transition-colors duration-150 flex flex-col items-center justify-center text-center px-6 py-8 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isDragging
                  ? 'border-blue-600 bg-blue-50/70'
                  : 'border-slate-300 bg-slate-50/70 hover:border-blue-500 hover:bg-slate-50'
              }`}
            >
              <div className="w-12 h-12 rounded-md bg-white border border-slate-200 flex items-center justify-center text-blue-700 mb-4">
                <Upload className="w-5 h-5" aria-hidden="true" />
              </div>

              <p className="text-sm font-semibold text-slate-900">
                {isDragging ? 'Release to analyze radiograph' : 'Drop dental implant X-ray here'}
              </p>
              <p className="text-xs text-slate-600 mt-1.5 max-w-xs leading-relaxed">
                Click to browse from your PACS export folder or drag a periapical radiograph directly into this lightbox.
              </p>

              <div className="mt-4 flex items-center gap-2 text-xs font-mono text-slate-500">
                <span>JPG / PNG</span>
                <span aria-hidden="true">·</span>
                <span>Up to 12 MB</span>
                <span aria-hidden="true">·</span>
                <span>Auto-analyzes on drop</span>
              </div>
            </button>

            {dropError && (
              <p
                role="alert"
                className="mt-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2"
              >
                {dropError}
              </p>
            )}
          </div>
        ) : (
          <div>
            {/* Obsidian Clinical Radiograph Viewing Stage */}
            <div
              ref={stageRef}
              className="relative bg-[#0B111A] aspect-[4/3] w-full overflow-hidden flex items-center justify-center cursor-crosshair select-none"
            >
              <div
                className="relative w-full h-full flex items-center justify-center transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
              >
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt={fileName ? `Uploaded dental implant radiograph: ${fileName}` : 'Dental implant radiograph'}
                  referrerPolicy="no-referrer"
                  onLoad={computeRenderedImageRect}
                  className="w-full h-full object-contain"
                  style={{
                    filter: `contrast(${contrast}%) brightness(${brightness}%) ${inverted ? 'invert(1)' : ''}`,
                  }}
                />

                {/* Multi-Implant Mode Color-Coded 2D Bounding Box Overlay */}
                {hasBoundingBoxes && renderedRect && (
                  <div
                    aria-label="Detected implant bounding boxes"
                    className="absolute pointer-events-none"
                    style={{
                      left: `${renderedRect.left}px`,
                      top: `${renderedRect.top}px`,
                      width: `${renderedRect.width}px`,
                      height: `${renderedRect.height}px`,
                    }}
                  >
                    {boundingBoxes!.map((item, idx) => {
                      const [ymin, xmin, ymax, xmax] = item.box;
                      const topPct = (ymin / 1000) * 100;
                      const leftPct = (xmin / 1000) * 100;
                      const widthPct = Math.max(2, ((xmax - xmin) / 1000) * 100);
                      const heightPct = Math.max(2, ((ymax - ymin) / 1000) * 100);
                      const isActive = idx === activeFixtureIndex;
                      const labelInside = topPct < 9;

                      return (
                        <button
                          key={`bbox-${item.fixtureIndex}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFixture?.(idx);
                          }}
                          title={`Select ${item.positionLabel}`}
                          aria-label={`Select ${item.positionLabel}`}
                          className="pointer-events-auto absolute transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                          style={{
                            top: `${topPct}%`,
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                            border: `${isActive ? 2.5 : 2}px solid ${item.colorHex}`,
                            backgroundColor: isActive
                              ? `${item.colorHex}22`
                              : `${item.colorHex}0D`,
                            boxShadow: isActive
                              ? `0 0 0 1px rgba(15,23,42,0.7), 0 0 12px ${item.colorHex}66`
                              : '0 0 0 1px rgba(15,23,42,0.55)',
                            borderRadius: '3px',
                          }}
                        >
                          <span
                            className="absolute left-0 px-1.5 py-0.5 text-[10px] font-mono font-semibold leading-none whitespace-nowrap rounded-xs shadow-sm"
                            style={{
                              top: labelInside ? '2px' : '-19px',
                              backgroundColor: item.badgeBg,
                              color: '#FFFFFF',
                            }}
                          >
                            {item.shortLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Subtle diagnostic registration crosshairs at edges */}
              <div className="pointer-events-none absolute inset-3 border border-slate-500/20" aria-hidden="true">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-2.5 bg-slate-300/40" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-2.5 bg-slate-300/40" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-2.5 bg-slate-300/40" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-px w-2.5 bg-slate-300/40" />
              </div>

              {/* Zoom magnification indicator */}
              <div className="pointer-events-none absolute top-3 right-3 px-2 py-0.5 bg-slate-950/75 text-[11px] font-mono tabular-nums text-slate-200 rounded">
                {zoom.toFixed(1)}× {inverted ? '· INV' : ''}
              </div>

              {/* Drag-over overlay when swapping existing radiograph */}
              {isDragging && (
                <div className="absolute inset-0 bg-blue-950/80 border-2 border-dashed border-blue-400 flex items-center justify-center">
                  <p className="text-sm font-semibold text-white">
                    Drop new radiograph to analyze
                  </p>
                </div>
              )}

              {/* Active scanning scrim */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/55 flex flex-col items-center justify-center gap-2.5">
                  <div className="w-7 h-7 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                  <p className="text-xs font-medium text-slate-100">
                    {analyzingLabel || 'Analyzing collar, taper, threads, and apex…'}
                  </p>
                </div>
              )}
            </div>

            {/* Radiographic Contrast / Brightness / Invert / Zoom Diagnostic Bar */}
            <div className="bg-slate-900 text-slate-200 px-4 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <label className="flex items-center gap-2 text-[11px] text-slate-300 flex-1">
                  <Contrast className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Contrast</span>
                  <input
                    type="range"
                    min={75}
                    max={200}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="clinical-slider w-full"
                    aria-label="Radiograph contrast"
                  />
                  <span className="font-mono tabular-nums text-[11px] text-slate-400 w-9 text-right">
                    {contrast}%
                  </span>
                </label>

                <label className="flex items-center gap-2 text-[11px] text-slate-300 flex-1">
                  <Sun className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Brightness</span>
                  <input
                    type="range"
                    min={65}
                    max={150}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="clinical-slider w-full"
                    aria-label="Radiograph brightness"
                  />
                  <span className="font-mono tabular-nums text-[11px] text-slate-400 w-9 text-right">
                    {brightness}%
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setInverted((v) => !v)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 ${
                    inverted
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  Invert
                </button>
                <button
                  type="button"
                  onClick={cycleZoom}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
                  {zoom.toFixed(1)}×
                </button>
                <button
                  type="button"
                  onClick={resetViewerControls}
                  title="Reset image adjustments"
                  aria-label="Reset image adjustments"
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clinical Sample Cases Strip */}
      <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold text-slate-700">
            Clinical Test Radiographs
          </span>
          <span className="text-xs text-slate-500">
            Select to run live analysis
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {SAMPLE_RADIOGRAPHS.map((sample) => {
            const isSelected = activeSampleId === sample.id;
            const imgFailed = failedThumbnails[sample.id];
            return (
              <button
                key={sample.id}
                type="button"
                disabled={isAnalyzing}
                onClick={() => {
                  resetViewerControls();
                  onSampleSelected(sample);
                }}
                className={`group text-left rounded-md overflow-hidden border transition-colors duration-150 cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="aspect-[4/3] w-full bg-[#0B111A] overflow-hidden flex items-center justify-center">
                  {imgFailed ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-2">
                      <ImageIcon className="w-4 h-4 mb-1" aria-hidden="true" />
                      <span className="text-[10px] font-mono">X-RAY</span>
                    </div>
                  ) : (
                    <img
                      src={sample.imageUrl}
                      alt={sample.title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedThumbnails((prev) => ({ ...prev, [sample.id]: true }))
                      }
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                </div>
                <div className="px-2.5 py-2">
                  <p
                    className={`text-xs font-medium truncate ${
                      isSelected ? 'text-blue-700' : 'text-slate-900'
                    }`}
                  >
                    {sample.region}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {sample.briefGeometry}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
