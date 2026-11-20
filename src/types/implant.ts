export type MatchStrength = 'High' | 'Moderate' | 'Low';

export type DriverGeometryProfile = 'torx' | 'hex' | 'unigrip' | 'square' | 'slot';

export interface WeightedCriterionScore {
  score: number;
  maxWeight: number;
  classification: string;
  radiographicObservation: string;
  matchStrength: MatchStrength;
}

export interface SixPointAnatomicalBreakdown {
  neckCollar: WeightedCriterionScore;          // 25%
  internalConnection: WeightedCriterionScore;  // 25%
  threadPitchShape: WeightedCriterionScore;    // 20%
  bodyTaper: WeightedCriterionScore;           // 10%
  apexVentDesign: WeightedCriterionScore;      // 10%
  platformCrestalProfile: WeightedCriterionScore; // 10%
}

export interface ScanBodyInfo {
  libraryId: string;
  displayName: string;
  exocadFilename: string;
  threeShapeFilename: string;
  compatibleSuites: string;
  scanBodyHeightMm: number;
  platformDiameterMm: number;
}

export interface ProstheticSpecs {
  screwdriverBit: string;
  screwdriverGeometry: DriverGeometryProfile;
  screwdriverSizeNote: string;
  recommendedTorqueNcm: number;
  torqueDisplayLabel: string;
  torqueGuidance: string;
  connectionType: string;
  scanBody: ScanBodyInfo;
}

export interface ImplantMatch {
  rank: number;
  manufacturer: string;
  systemName: string;
  platformLine: string;
  confidencePercent: number;
  weightedTotalScore: number;
  diagnosticRationale: string;
  anatomicalBreakdown: SixPointAnatomicalBreakdown;
  prostheticSpecs: ProstheticSpecs;
}

export interface ObservedFeatures {
  collar_shape: string;
  internal_connection_silhouette: string;
  thread_spacing: string;
  body_contour: string;
  apex_shape: string;
  platform_crestal_profile: string;
  estimated_envelope: string;
  image_quality_note: string;
}

export interface EliminatedBrand {
  brand_name: string;
  elimination_reason: string;
}

export interface Stage1ScreeningResult {
  isDentalRadiograph: boolean;
  validationMessage: string;
  top4CandidateIds: string[];
  top4CandidateLabels: string[];
  screeningSummary: string;
}

export interface RadiographAnalysisResult {
  isDentalRadiograph: boolean;
  validationMessage: string;
  visualComparisonNote?: string;
  stage1CandidateLabels?: string[];
  fewShotSamplesUsed?: number;
  fewShotReferenceLabels?: string[];
  observed_features: ObservedFeatures;
  eliminated_brands: EliminatedBrand[];
  top_match: string;
  matches: ImplantMatch[];
}

export interface SampleRadiograph {
  id: string;
  title: string;
  region: string;
  briefGeometry: string;
  imageUrl: string;
}

export interface CoreImplantSystemSpec {
  id: string;
  label: string;
  manufacturer: string;
  systemName: string;
  driverBit: string;
  driverGeometry: DriverGeometryProfile;
  driverSizeNote: string;
  torqueDisplayLabel: string;
  primaryTorqueNcm: number;
  torqueGuidance: string;
  scanBodyLabel: string;
  scanBodyLibraryId: string;
  scanBodySuites: string;
  platformDiameterMm: number;
  scanBodyHeightMm: number;
  connectionType: string;
  collarFingerprint: string;
  bodyFingerprint: string;
  threadFingerprint: string;
  apexFingerprint: string;
}

export interface ReferenceSampleImage {
  id: string;
  systemId: string;
  systemLabel: string;
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png';
  base64Data: string;
  dataUrl: string;
  addedAt: number;
}

export interface ReferenceSamplePayload {
  systemId: string;
  systemLabel: string;
  sampleIndex?: number;
  mimeType: 'image/jpeg' | 'image/png';
  imageBase64: string;
}

export interface ReferenceSystemRow {
  id: string;
  manufacturer: string;
  system: string;
  collarType: string;
  bodyGeometry: string;
  threadGeometry: string;
  apicalForm: string;
  connection: string;
  driverBit: string;
  driverProfile: DriverGeometryProfile;
  torqueNcm: number;
  torqueLabel: string;
  scanBody: string;
}

export type AnalysisMode = 'single' | 'multi';

/** Normalized 2D bounding box [ymin, xmin, ymax, xmax] scaled 0–1000 */
export type BoundingBox2D = [number, number, number, number];

export interface DetectedImplantFixture {
  fixtureIndex: number;
  positionLabel: string;
  boundingBox: BoundingBox2D;
  analysis: RadiographAnalysisResult;
}

export interface MultiImplantAnalysisResult {
  isDentalRadiograph: boolean;
  validationMessage: string;
  totalImplantsDetected: number;
  fewShotSamplesUsed?: number;
  fixtures: DetectedImplantFixture[];
}

