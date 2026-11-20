import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  MediaResolution,
  ThinkingLevel,
  Type,
} from '@google/genai';

const MEDICAL_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

interface VerifiedBrandSpec {
  id: string;
  label: string;
  matcher: (text: string) => boolean;
  manufacturer: string;
  systemName: string;
  driverBit: string;
  driverGeometry: 'torx' | 'hex' | 'unigrip' | 'square' | 'slot';
  driverSizeNote: string;
  recommendedTorqueNcm: number;
  torqueDisplayLabel: string;
  torqueGuidance: string;
  connectionType: string;
  scanBodyDisplayName: string;
  scanBodyLibraryId: string;
  scanBodySuites: string;
  platformDiameterMm: number;
  scanBodyHeightMm: number;
}

const VERIFIED_CORE_SPECS: VerifiedBrandSpec[] = [
  {
    id: 'neodent-helix-gm',
    label: 'Neodent Helix GM (Grand Morse)',
    matcher: (t) => t.includes('neodent') || t.includes('helix gm') || t.includes('grand morse'),
    manufacturer: 'Neodent',
    systemName: 'Helix GM (Grand Morse)',
    driverBit: 'Neo Screwdriver (Torx)',
    driverGeometry: 'torx',
    driverSizeNote: 'Neo hexalobular Torx driver · single Grand Morse platform (3.5–5.0 mm)',
    recommendedTorqueNcm: 32,
    torqueDisplayLabel: '32 Ncm (abutment) / 20 Ncm (prosthetic screw)',
    torqueGuidance: '32 Ncm (abutment) / 20 Ncm (prosthetic screw)',
    connectionType: 'Platform-switched 16° internal Morse taper (Grand Morse)',
    scanBodyDisplayName: 'Neodent GM Scanbody (Exocad / 3Shape / inLab)',
    scanBodyLibraryId: 'NEO-HELIX-GM-SB',
    scanBodySuites: 'Exocad / 3Shape / inLab',
    platformDiameterMm: 4.0,
    scanBodyHeightMm: 8.0,
  },
  {
    id: 'osstem-tsiii',
    label: 'Osstem TSIII',
    matcher: (t) =>
      t.includes('osstem') || t.includes('tsiii') || t.includes('ts iii') || t.includes('ts3'),
    manufacturer: 'Osstem',
    systemName: 'TSIII',
    driverBit: '1.2 mm Hex Driver',
    driverGeometry: 'hex',
    driverSizeNote: '1.2 mm internal hex driver · Mini vs. Regular TS platform',
    recommendedTorqueNcm: 30,
    torqueDisplayLabel: '30 Ncm (Regular) / 20 Ncm (Mini)',
    torqueGuidance: '30 Ncm (Regular) / 20 Ncm (Mini)',
    connectionType: '11° Internal Morse taper + octagon/hex index',
    scanBodyDisplayName: 'Osstem TS Scan Body (Exocad / 3Shape)',
    scanBodyLibraryId: 'OSS-TSIII-REG-SB',
    scanBodySuites: 'Exocad / 3Shape',
    platformDiameterMm: 4.0,
    scanBodyHeightMm: 7.5,
  },
  {
    id: 'straumann-sp-tl',
    label: 'Straumann Standard Plus / Tissue Level (SP/TL)',
    matcher: (t) =>
      (t.includes('straumann') &&
        (t.includes('tissue') ||
          t.includes('standard plus') ||
          t.includes('sp/tl') ||
          t.includes('synocta'))) ||
      t.includes('standard plus / tissue level'),
    manufacturer: 'Straumann',
    systemName: 'Standard Plus / Tissue Level (SP/TL)',
    driverBit: 'Straumann SCS Screwdriver (Torx)',
    driverGeometry: 'torx',
    driverSizeNote: 'Straumann SCS Torx driver · 8° synOcta RN/WN internal octagon',
    recommendedTorqueNcm: 35,
    torqueDisplayLabel: '35 Ncm',
    torqueGuidance: '35 Ncm definitive abutment torque',
    connectionType: '8° synOcta internal octagon (RN / WN)',
    scanBodyDisplayName: 'Straumann CARES synOcta / RN-WN Scanbody',
    scanBodyLibraryId: 'STR-SPTL-RN-SYNOCTA',
    scanBodySuites: 'Exocad / 3Shape (CARES synOcta)',
    platformDiameterMm: 4.8,
    scanBodyHeightMm: 7.0,
  },
  {
    id: 'straumann-blt',
    label: 'Straumann BLT (Bone Level Tapered)',
    matcher: (t) =>
      t.includes('blt') ||
      t.includes('bone level tapered') ||
      (t.includes('straumann') && !t.includes('tissue') && !t.includes('standard plus')),
    manufacturer: 'Straumann',
    systemName: 'BLT (Bone Level Tapered)',
    driverBit: 'Straumann SCS Screwdriver (Torx)',
    driverGeometry: 'torx',
    driverSizeNote: 'Straumann SCS hexalobular Torx driver · 15° CrossFit interface',
    recommendedTorqueNcm: 35,
    torqueDisplayLabel: '35 Ncm',
    torqueGuidance: '35 Ncm definitive abutment torque',
    connectionType: '15° CrossFit internal conical-four-groove',
    scanBodyDisplayName: 'Straumann CARES Mono Scanbody (CrossFit)',
    scanBodyLibraryId: 'STR-BLT-RC-CARES',
    scanBodySuites: 'Exocad / 3Shape (CARES CrossFit)',
    platformDiameterMm: 4.1,
    scanBodyHeightMm: 7.0,
  },
  {
    id: 'nobel-active',
    label: 'NobelActive (Nobel Biocare)',
    matcher: (t) => t.includes('nobelactive') || t.includes('nobel active'),
    manufacturer: 'Nobel Biocare',
    systemName: 'NobelActive',
    driverBit: 'Unigrip Screwdriver',
    driverGeometry: 'unigrip',
    driverSizeNote: 'Nobel Biocare Unigrip driver · Internal Conical Connection with hex',
    recommendedTorqueNcm: 35,
    torqueDisplayLabel: '35 Ncm',
    torqueGuidance: '35 Ncm definitive abutment torque',
    connectionType: 'Internal Conical Connection (CC) with hexagonal interlocking',
    scanBodyDisplayName: 'NobelProcera Position Locator (CC)',
    scanBodyLibraryId: 'NOB-ACT-CC-PL',
    scanBodySuites: 'Exocad / 3Shape / NobelProcera',
    platformDiameterMm: 4.3,
    scanBodyHeightMm: 8.5,
  },
  {
    id: 'nobel-replace',
    label: 'NobelReplace Conical Connection / Tapered Groovy',
    matcher: (t) =>
      t.includes('nobelreplace') ||
      t.includes('nobel replace') ||
      t.includes('tapered groovy'),
    manufacturer: 'Nobel Biocare',
    systemName: 'NobelReplace CC / Tapered Groovy',
    driverBit: 'Unigrip Screwdriver',
    driverGeometry: 'unigrip',
    driverSizeNote: 'Nobel Biocare Unigrip driver · Tri-Channel or Conical Connection',
    recommendedTorqueNcm: 35,
    torqueDisplayLabel: '35 Ncm',
    torqueGuidance: '35 Ncm definitive abutment torque',
    connectionType: 'Internal Tri-Channel (lobed) or Conical Connection',
    scanBodyDisplayName: 'NobelProcera Scan Body (Tri-Channel / CC)',
    scanBodyLibraryId: 'NOB-REP-CC-SB',
    scanBodySuites: 'Exocad / 3Shape / NobelProcera',
    platformDiameterMm: 4.3,
    scanBodyHeightMm: 8.0,
  },
  {
    id: 'dentium-superline',
    label: 'Dentium SuperLine',
    matcher: (t) => t.includes('dentium') || t.includes('superline'),
    manufacturer: 'Dentium',
    systemName: 'SuperLine',
    driverBit: '1.25 mm Hex Driver',
    driverGeometry: 'hex',
    driverSizeNote: '1.25 mm internal hex driver · 11° internal conical hex',
    recommendedTorqueNcm: 30,
    torqueDisplayLabel: '30 Ncm',
    torqueGuidance: '30 Ncm definitive abutment torque',
    connectionType: '11° Internal conical hex (single hex size)',
    scanBodyDisplayName: 'Dentium Scan Body (Exocad / 3Shape)',
    scanBodyLibraryId: 'DEN-SL-REG-SB',
    scanBodySuites: 'Exocad / 3Shape',
    platformDiameterMm: 4.0,
    scanBodyHeightMm: 7.0,
  },
  {
    id: 'biohorizons-tapered-internal',
    label: 'BioHorizons Tapered Internal (Laser-Lok)',
    matcher: (t) =>
      t.includes('biohorizons') || t.includes('laser-lok') || t.includes('laser lok'),
    manufacturer: 'BioHorizons',
    systemName: 'Tapered Internal (Laser-Lok)',
    driverBit: '1.25 mm Hex Driver',
    driverGeometry: 'hex',
    driverSizeNote: '1.25 mm internal hex driver · 45° internal hex bevel',
    recommendedTorqueNcm: 30,
    torqueDisplayLabel: '30 Ncm',
    torqueGuidance: '30 Ncm definitive abutment torque',
    connectionType: '45° Internal hex bevel',
    scanBodyDisplayName: 'BioHorizons Internal Scan Body',
    scanBodyLibraryId: 'BIO-TI-LL-SB',
    scanBodySuites: 'Exocad / 3Shape',
    platformDiameterMm: 3.8,
    scanBodyHeightMm: 7.5,
  },
  {
    id: 'zimmer-tsv',
    label: 'Zimmer Biomet TSV (Tapered Screw-Vent)',
    matcher: (t) =>
      t.includes('zimmer') ||
      t.includes('zimvie') ||
      t.includes('tsv') ||
      t.includes('screw-vent'),
    manufacturer: 'Zimmer Biomet',
    systemName: 'TSV (Tapered Screw-Vent)',
    driverBit: '1.25 mm Hex Driver',
    driverGeometry: 'hex',
    driverSizeNote: '1.25 mm internal hex driver · 1.5 mm friction-fit hex lead-in bevel',
    recommendedTorqueNcm: 30,
    torqueDisplayLabel: '30 Ncm',
    torqueGuidance: '30 Ncm definitive abutment torque',
    connectionType: 'Internal friction-fit hex (1.5 mm lead-in bevel)',
    scanBodyDisplayName: 'ZimVie Encode / TSV Scan Body',
    scanBodyLibraryId: 'ZIM-TSV-37-SB',
    scanBodySuites: 'Exocad / 3Shape (ZimVie)',
    platformDiameterMm: 3.7,
    scanBodyHeightMm: 7.5,
  },
  {
    id: 'alpha-bio-spi',
    label: 'Alpha-Bio Tec SPI (Spiral)',
    matcher: (t) =>
      t.includes('alpha-bio') || t.includes('alpha bio') || t.includes('spi (spiral)'),
    manufacturer: 'Alpha-Bio Tec',
    systemName: 'SPI (Spiral)',
    driverBit: '1.25 mm Hex Driver',
    driverGeometry: 'hex',
    driverSizeNote: '1.25 mm internal hex driver · 2.5 mm internal hex connection',
    recommendedTorqueNcm: 32,
    torqueDisplayLabel: '30–35 Ncm',
    torqueGuidance: '30–35 Ncm definitive abutment torque',
    connectionType: '2.5 mm Internal Hex Connection',
    scanBodyDisplayName: 'Alpha-Bio Internal Hex Scan Body',
    scanBodyLibraryId: 'ABT-SPI-IH-SB',
    scanBodySuites: 'Exocad / 3Shape',
    platformDiameterMm: 3.75,
    scanBodyHeightMm: 8.0,
  },
  {
    id: 'astra-tech-ev',
    label: 'Dentsply Sirona Astra Tech EV (OsseoSpeed EV)',
    matcher: (t) =>
      t.includes('astra') || t.includes('osseospeed') || t.includes('dentsply'),
    manufacturer: 'Dentsply Sirona',
    systemName: 'Astra Tech EV (OsseoSpeed EV)',
    driverBit: 'Astra Tech EV Hex Driver',
    driverGeometry: 'hex',
    driverSizeNote: 'Astra Tech EV proprietary hex driver · Conical Seal Design',
    recommendedTorqueNcm: 25,
    torqueDisplayLabel: '25 Ncm',
    torqueGuidance: '25 Ncm definitive abutment torque',
    connectionType: 'Conical Seal Design (deep internal conical connection)',
    scanBodyDisplayName: 'Atlantis / Dentsply Sirona EV Scan Body',
    scanBodyLibraryId: 'DST-ASTRA-EV-SB',
    scanBodySuites: 'Exocad / 3Shape / Atlantis',
    platformDiameterMm: 4.2,
    scanBodyHeightMm: 7.0,
  },
  {
    id: 'bredent-sky',
    label: 'Bredent SKY / copaSKY',
    matcher: (t) =>
      t.includes('bredent') || t.includes('copasky') || t.includes('sky /'),
    manufacturer: 'Bredent',
    systemName: 'SKY / copaSKY',
    driverBit: 'Bredent Torx Driver',
    driverGeometry: 'torx',
    driverSizeNote: 'Bredent Torx driver · internal Torx/cone-hex hybrid connection',
    recommendedTorqueNcm: 28,
    torqueDisplayLabel: '25–30 Ncm',
    torqueGuidance: '25–30 Ncm definitive abutment torque',
    connectionType: 'Internal Torx / cone-hex hybrid connection',
    scanBodyDisplayName: 'Bredent SKY Scan Abutment',
    scanBodyLibraryId: 'BRE-SKY-TORX-SB',
    scanBodySuites: 'Exocad / 3Shape',
    platformDiameterMm: 4.0,
    scanBodyHeightMm: 7.5,
  },
  {
    id: 'adin-touareg',
    label: 'Adin Touareg-S / Touareg-OS',
    matcher: (t) => t.includes('adin') || t.includes('touareg'),
    manufacturer: 'Adin',
    systemName: 'Touareg-S / Touareg-OS',
    driverBit: '1.25 mm / 1.27 mm Hex Driver',
    driverGeometry: 'hex',
    driverSizeNote: '1.25 mm / 1.27 mm internal hex driver · 2.42 mm / 3.5 mm single platform',
    recommendedTorqueNcm: 30,
    torqueDisplayLabel: '30 Ncm (abutment) / 15–20 Ncm (prosthetic/scan body screw)',
    torqueGuidance: '30 Ncm (abutment) / 15–20 Ncm (prosthetic/scan body screw)',
    connectionType: 'Standard 2.42 mm / 3.5 mm Internal Hex with built-in platform switching',
    scanBodyDisplayName: 'Adin Internal Hex 3.5 Scan Body (Exocad / 3Shape)',
    scanBodyLibraryId: 'ADN-TOUAREG-35-SB',
    scanBodySuites: 'Exocad / 3Shape',
    platformDiameterMm: 3.5,
    scanBodyHeightMm: 7.5,
  },
  {
    id: 'noris-tuff',
    label: 'Noris Medical Tuff',
    matcher: (t) => t.includes('noris') || t.includes('tuff'),
    manufacturer: 'Noris Medical',
    systemName: 'Tuff',
    driverBit: '1.25 mm Hex Driver',
    driverGeometry: 'hex',
    driverSizeNote: '1.25 mm internal hex driver · standard 2.42 mm Internal Hex RP platform',
    recommendedTorqueNcm: 30,
    torqueDisplayLabel: '30 Ncm (abutment) / 20 Ncm (prosthetic/scan body screw)',
    torqueGuidance: '30 Ncm (abutment) / 20 Ncm (prosthetic/scan body screw)',
    connectionType: 'Standard 2.42 mm Internal Hex prosthetic platform',
    scanBodyDisplayName: 'Noris Medical Internal Hex RP Scan Body (Exocad / 3Shape)',
    scanBodyLibraryId: 'NOR-TUFF-RP-SB',
    scanBodySuites: 'Exocad / 3Shape',
    platformDiameterMm: 3.75,
    scanBodyHeightMm: 8.0,
  },
];

const VALID_SYSTEM_IDS = VERIFIED_CORE_SPECS.map((s) => s.id);
const SPEC_BY_ID = new Map(VERIFIED_CORE_SPECS.map((s) => [s.id, s]));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const FOURTEEN_SYSTEM_FINGERPRINTS = `1. **Neodent Helix GM (Grand Morse)** [id: \`neodent-helix-gm\`]:
   - Collar & Platform: Platform-switched 16° internal Morse taper; smooth/micro-grooved coronal bevel; single prosthetic platform across all diameters (3.5 to 5.0 mm).
   - Body Contour: Hybrid dual-contour — cylindrical coronal third transitioning into a conical apical two-thirds.
   - Thread Profile: Dynamic progressive double-lead threads — compressing trapezoidal threads coronally shifting to sharp, self-tapping V-threads apically.
   - Apex & Vents: Soft rounded apex with shallow helicoidal apical flutes; NO through-and-through apical perforation hole.
   - Restorative Specs: Driver = \`Neo Screwdriver (Torx)\` | Torque = \`32 Ncm (abutment) / 20 Ncm (prosthetic screw)\` | Scan Body = \`Neodent GM Scanbody (Exocad / 3Shape / inLab)\`.

2. **Osstem TSIII** [id: \`osstem-tsiii\`]:
   - Collar & Platform: Straight/slightly tapered coronal neck with fine microthreads; 11° internal Morse taper + octagon/hex index (Mini vs. Regular platform).
   - Body Contour: 1.5° straight-tapered conical body from neck to apex.
   - Thread Profile: Prominent open-pitch corkscrew double threads with wide inter-thread valleys.
   - Apex & Vents: Deep, long spiral/helical cutting flutes extending up the apical third, terminating in a flat-to-slightly-rounded apex.
   - Restorative Specs: Driver = \`1.2 mm Hex Driver\` | Torque = \`30 Ncm (Regular) / 20 Ncm (Mini)\` | Scan Body = \`Osstem TS Scan Body (Exocad / 3Shape)\`.

3. **Straumann BLT (Bone Level Tapered)** [id: \`straumann-blt\`]:
   - Collar & Platform: Bone-level neck with 0.8 mm fine thread pitch extending all the way to the top margin; 15° CrossFit internal conical-four-groove silhouette.
   - Body Contour: Parallel-walled cylindrical coronal half tapering sharply in the apical half.
   - Thread Profile: Shallow, uniform, tightly spaced 0.8 mm pitch V-threads (much finer spacing than Osstem or Dentium).
   - Apex & Vents: Distinctively rounded dome apex featuring 3 longitudinal milling/cutting grooves.
   - Restorative Specs: Driver = \`Straumann SCS Screwdriver (Torx)\` | Torque = \`35 Ncm\` | Scan Body = \`Straumann CARES Mono Scanbody (CrossFit)\`.

4. **Straumann Standard Plus / Tissue Level (SP/TL)** [id: \`straumann-sp-tl\`]:
   - Collar & Platform: Unmistakable flared smooth machined transgingival tulip/trumpet neck (1.8 mm or 2.8 mm tall) sitting ABOVE the bone crest; 8° synOcta internal octagon.
   - Body Contour: Straight cylindrical walls (Standard Plus) or tapered apical half (TE).
   - Thread Profile: Wide, uniform buttress/V-threads starting strictly BELOW the smooth machined neck.
   - Apex & Vents: Smooth rounded dome apex without aggressive apical flutes.
   - Restorative Specs: Driver = \`Straumann SCS Screwdriver (Torx)\` | Torque = \`35 Ncm\` | Scan Body = \`Straumann CARES synOcta / RN-WN Scanbody\`.

5. **NobelActive (Nobel Biocare)** [id: \`nobel-active\`]:
   - Collar & Platform: Signature reverse-tapered coronal collar (the neck narrows inward at the very crest before meeting the abutment); internal conical connection with hexagonal interlocking.
   - Body Contour: Expanding tapered core with wide, aggressive thread fins.
   - Thread Profile: Deep, razor-sharp, double-lead variable-thickness threads that widen toward the mid-body.
   - Apex & Vents: Flat apex with prominent apical drilling blades/notches.
   - Restorative Specs: Driver = \`Unigrip Screwdriver\` | Torque = \`35 Ncm\` | Scan Body = \`NobelProcera Position Locator (CC)\`.

6. **NobelReplace Conical Connection / Tapered Groovy** [id: \`nobel-replace\`]:
   - Collar & Platform: Straight machined collar band (0.75 mm–1.5 mm) at the platform; internal tri-channel (lobed) or conical connection silhouette.
   - Body Contour: Root-form anatomical taper mimicking a natural tooth root.
   - Thread Profile: Broad, shallow threads featuring characteristic circumferential micro-grooves visible on the thread flanks at high contrast.
   - Apex & Vents: Rounded root-form apex with 3 longitudinal self-tapping grooves.
   - Restorative Specs: Driver = \`Unigrip Screwdriver\` | Torque = \`35 Ncm\` | Scan Body = \`NobelProcera Scan Body (Tri-Channel / CC)\`.

7. **Dentium SuperLine** [id: \`dentium-superline\`]:
   - Collar & Platform: Straight bone-level collar with fine coronal microthreads; 11° internal conical hex connection (single hex size across diameters).
   - Body Contour: Uniformly tapered conical body.
   - Thread Profile: Wide-spaced, deep double-lead threads with rounded thread crests (wider valley spacing than Straumann BLT).
   - Apex & Vents: Flat/chamfered apex with three deep longitudinal cutting flutes extending one-third up the body.
   - Restorative Specs: Driver = \`1.25 mm Hex Driver\` | Torque = \`30 Ncm\` | Scan Body = \`Dentium Scan Body (Exocad / 3Shape)\`.

8. **BioHorizons Tapered Internal (Laser-Lok)** [id: \`biohorizons-tapered-internal\`]:
   - Collar & Platform: Parallel-walled coronal collar featuring microscopic horizontal Laser-Lok microchannels (appears as a flat, threadless dark/smooth zone at the crest); 45° internal hex bevel.
   - Body Contour: Anatomical root-form tapered body.
   - Thread Profile: Signature reverse-buttress threads (flat coronal flank, angled apical flank) designed for compressive load distribution.
   - Apex & Vents: Blunt, rounded apex with shallow longitudinal flutes.
   - Restorative Specs: Driver = \`1.25 mm Hex Driver\` | Torque = \`30 Ncm\` | Scan Body = \`BioHorizons Internal Scan Body\`.

9. **Zimmer Biomet TSV (Tapered Screw-Vent)** [id: \`zimmer-tsv\`]:
   - Collar & Platform: Smooth machined vertical collar band (0.5 mm–1.0 mm) with an internal friction-fit hex connection (1.5 mm deep lead-in bevel).
   - Body Contour: Triple-stage selective taper (cylindrical crest, gentle mid-taper, steeper apical taper).
   - Thread Profile: Triple-lead V-threads with medium pitch.
   - Apex & Vents: Distinctive round/oval through-and-through apical vent hole visible as a radiolucent dark circle near the tip, plus longitudinal cutting grooves.
   - Restorative Specs: Driver = \`1.25 mm Hex Driver\` | Torque = \`30 Ncm\` | Scan Body = \`ZimVie Encode / TSV Scan Body\`.

10. **Alpha-Bio Tec SPI (Spiral)** [id: \`alpha-bio-spi\`]:
    - Collar & Platform: Narrowed/beveled coronal platform with fine coronal microthreads; 2.5 mm internal hex connection.
    - Body Contour: Conical core with wide outer thread envelope.
    - Thread Profile: Aggressive, deep, wide-pitched spiral self-tapping threads with sharp edges (similar to NobelActive but without the pronounced reverse-tapered neck).
    - Apex & Vents: Narrow, sharp cutting apex with deep spiral flutes.
    - Restorative Specs: Driver = \`1.25 mm Hex Driver\` | Torque = \`30–35 Ncm\` | Scan Body = \`Alpha-Bio Internal Hex Scan Body\`.

11. **Dentsply Sirona Astra Tech EV (OsseoSpeed EV)** [id: \`astra-tech-ev\`]:
    - Collar & Platform: Conical Seal Design (deep internal conical connection) with signature MicroThread zone covering the entire coronal neck.
    - Body Contour: Cylindrical straight body or apically tapered profile.
    - Thread Profile: Two distinct thread zones — ultra-fine microthreads in the upper third transitioning abruptly into macro-threads in the lower two-thirds.
    - Apex & Vents: Rounded apex with self-tapping cutting flutes.
    - Restorative Specs: Driver = \`Astra Tech EV Hex Driver\` | Torque = \`25 Ncm\` | Scan Body = \`Atlantis / Dentsply Sirona EV Scan Body\`.

12. **Bredent SKY / copaSKY** [id: \`bredent-sky\`]:
    - Collar & Platform: Back-tapered/beveled platform-switched crest with micro-grooved neck; internal Torx/cone-hex hybrid connection.
    - Body Contour: Cylindrical-conical compression profile.
    - Thread Profile: Double-lead compression threads (rounded crest profile that thickens toward the core).
    - Apex & Vents: Rounded, blunt apex with short apical cutting notches.
    - Restorative Specs: Driver = \`Bredent Torx Driver\` | Torque = \`25–30 Ncm\` | Scan Body = \`Bredent SKY Scan Abutment\`.

13. **Adin Touareg-S / Touareg-OS** [id: \`adin-touareg\`]:
    - Connection: Standard 2.42 mm / 3.5 mm Internal Hex connection with built-in platform switching (single restorative platform across diameters).
    - Collar: Fine coronal microthreads at the crestal neck.
    - Body: Tapered conical body.
    - Threads: Double-lead spiral self-tapping threads (2 × 1.2 mm step = 2.4 mm lead) with wide cutting profile.
    - Apex: Rounded dome apex with self-tapping cutting flutes.
    - Restorative Specs: Driver = \`1.25 mm / 1.27 mm Hex Driver\` | Torque = \`30 Ncm (abutment) / 15–20 Ncm (prosthetic/scan body screw)\` | Scan Body = \`Adin Internal Hex 3.5 Scan Body (Exocad / 3Shape)\`.

14. **Noris Medical Tuff** [id: \`noris-tuff\`]:
    - Connection: Standard 2.42 mm Internal Hex prosthetic platform.
    - Collar: Straight/micro-grooved coronal neck with platform-switched step.
    - Body: Moderate tapered body and tapered core.
    - Threads: Condensing variable-geometry double threads with a large step (transitioning from V-threads apically to square/condensing threads coronally).
    - Apex: Tapered self-tapping apex with double cutting flutes.
    - Restorative Specs: Driver = \`1.25 mm Hex Driver\` | Torque = \`30 Ncm (abutment) / 20 Ncm (prosthetic/scan body screw)\` | Scan Body = \`Noris Medical Internal Hex RP Scan Body (Exocad / 3Shape)\`.`;

const STAGE1_SYSTEM_PROMPT = `You are Stage 1 (Morphological Screening) of a 2-stage dental CAD/CAM radiographic implant identification engine.
Inspect the TARGET UNKNOWN RADIOGRAPH at maximum pixel density across the 14 implant systems below and narrow down the **Top 4** most geometrically compatible candidate system IDs for Stage 2 head-to-head reference comparison.

${FOURTEEN_SYSTEM_FINGERPRINTS}

SCREENING RULES:
- Evaluate neck/collar silhouette, internal connection silhouette, thread pitch/shape, body taper, apex/vent design, and platform switch/crestal profile.
- Return EXACTLY 4 distinct system IDs from the 14 IDs above in \`top4CandidateIds\`, ordered from most plausible (#1) to fourth most plausible (#4).
- Be careful to distinguish Israeli Internal Hex tapered spiral designs (\`adin-touareg\`, \`noris-tuff\`, \`alpha-bio-spi\`) from conical Morse designs (\`neodent-helix-gm\`, \`osstem-tsiii\`, \`dentium-superline\`, \`straumann-blt\`) and flared tissue-level collars (\`straumann-sp-tl\`).`;

const STAGE2_SYSTEM_PROMPT = `You are Stage 2 (Head-to-Head Few-Shot Visual Grounding) of a dental CAD/CAM hardware classification engine specializing in prosthodontic radiographic implant identification.
Compare the TARGET UNKNOWN RADIOGRAPH visually against ALL provided labeled REFERENCE radiographs (accounting for clinical X-ray beam angulation, magnification, and fixture diameter) at maximum pixel density across the 14 dental implant systems below:

${FOURTEEN_SYSTEM_FINGERPRINTS}

STRICT 2-STEP CHAIN-OF-THOUGHT & 6-POINT ANATOMICAL BREAKDOWN PROTOCOL:
- **Anti-Anchoring Calibration Rule:** Provided REFERENCE images act as both positive matches AND negative counterexamples. The TARGET UNKNOWN RADIOGRAPH may belong to ANY of the 14 systems—including screened candidates that have zero uploaded reference images. If the target visibly contradicts an uploaded REFERENCE image (e.g., bone-level vs. flared transgingival tulip neck, absent vs. present apical vent hole, variable condensing threads vs. uniform fine 0.8 mm threads), explicitly cite that geometric contrast to ELIMINATE that reference brand rather than forcing a match.
1. **Step 1 (Observe & Eliminate FIRST):**
   - Populate \`observed_features\` with exact radiographic observations for \`collar_shape\`, \`internal_connection_silhouette\`, \`thread_spacing\`, \`body_contour\`, \`apex_shape\`, and \`platform_crestal_profile\`.
   - Populate \`eliminated_brands\` citing specific geometric differences explaining why non-matching systems from the 14-brand Reference Library (at least 6–10 most relevant confusable brands) do NOT match \`observed_features\`.
2. **Step 2 (Score & Rank Top 3 Across 6 Anatomical Landmarks summing to 100 pts):**
   - Score each of the Top 3 candidate brands strictly across 6 weighted anatomical landmarks summing to \`weightedTotalScore\` (0–100):
     * **01. Neck / Collar:** max \`25\` pts (25%)
     * **02. Internal Connection Silhouette:** max \`25\` pts (25%)
     * **03. Thread Pitch & Shape:** max \`20\` pts (20%)
     * **04. Body Taper:** max \`10\` pts (10%)
     * **05. Apex / Vent Design:** max \`10\` pts (10%)
     * **06. Platform Switch & Crestal Profile:** max \`10\` pts (10%)
   - Set \`top_match\` strictly to the highest-scoring non-eliminated candidate (\`matches[0]\`), and pull Driver Bit, Torque Limit (Ncm), and CAD Scan Body library strictly from the verified brand specifications above without inventing numbers.`;

const stage1ResponseSchema = {
  type: Type.OBJECT,
  properties: {
    isDentalRadiograph: {
      type: Type.BOOLEAN,
      description:
        'True if the image is a dental X-ray radiograph showing a dental implant fixture, false otherwise.',
    },
    validationMessage: {
      type: Type.STRING,
      description: 'Short clinical validation note regarding radiograph quality and angulation.',
    },
    top4CandidateIds: {
      type: Type.ARRAY,
      description:
        'Exactly 4 distinct candidate system IDs from the 14-system catalog ordered from highest to fourth highest morphological compatibility.',
      items: {
        type: Type.STRING,
        enum: VALID_SYSTEM_IDS,
      },
    },
    screeningSummary: {
      type: Type.STRING,
      description:
        'Concise morphological rationale explaining why these 4 candidate systems were selected for Stage 2 head-to-head comparison.',
    },
  },
  required: [
    'isDentalRadiograph',
    'validationMessage',
    'top4CandidateIds',
    'screeningSummary',
  ],
  propertyOrdering: [
    'isDentalRadiograph',
    'validationMessage',
    'top4CandidateIds',
    'screeningSummary',
  ],
};

function makeWeightedCriterionSchema(maxWeight: number, criterionLabel: string) {
  return {
    type: Type.OBJECT,
    properties: {
      score: {
        type: Type.INTEGER,
        description: `Integer points awarded for ${criterionLabel} from 0 to ${maxWeight}.`,
      },
      maxWeight: {
        type: Type.INTEGER,
        description: `Maximum weight for ${criterionLabel} (must be ${maxWeight}).`,
      },
      classification: {
        type: Type.STRING,
        description: `Concise clinical classification for ${criterionLabel}.`,
      },
      radiographicObservation: {
        type: Type.STRING,
        description: `Specific geometric evidence observed on the TARGET UNKNOWN RADIOGRAPH for ${criterionLabel}.`,
      },
      matchStrength: {
        type: Type.STRING,
        enum: ['High', 'Moderate', 'Low'],
      },
    },
    required: [
      'score',
      'maxWeight',
      'classification',
      'radiographicObservation',
      'matchStrength',
    ],
    propertyOrdering: [
      'score',
      'maxWeight',
      'classification',
      'radiographicObservation',
      'matchStrength',
    ],
  };
}

const stage2ResponseSchema = {
  type: Type.OBJECT,
  properties: {
    isDentalRadiograph: {
      type: Type.BOOLEAN,
      description:
        'True if the target image is a dental X-ray radiograph showing a dental implant fixture, false otherwise.',
    },
    validationMessage: {
      type: Type.STRING,
      description: 'Short clinical validation note regarding radiograph quality and angulation.',
    },
    observed_features: {
      type: Type.OBJECT,
      description:
        'STEP 1A: Exact visual features observed directly on the TARGET UNKNOWN RADIOGRAPH across all 6 anatomical landmarks before selecting a brand.',
      properties: {
        collar_shape: {
          type: Type.STRING,
          description:
            'Exact coronal neck/collar silhouette (flared tulip neck, reverse-tapered crest, Laser-Lok threadless zone, fine coronal microthreads, platform-switched bevel).',
        },
        internal_connection_silhouette: {
          type: Type.STRING,
          description:
            'Exact internal prosthetic connection silhouette visible inside the coronal body (16° Morse taper, 15° CrossFit, 8° synOcta octagon, tri-channel, 2.42 mm Internal Hex, deep Conical Seal).',
        },
        thread_spacing: {
          type: Type.STRING,
          description:
            'Exact thread pitch, double/triple-lead profile, and zone transitions (e.g. 0.8 mm fine pitch, 2.4 mm spiral double-lead, condensing V-to-square variable threads, reverse-buttress).',
        },
        body_contour: {
          type: Type.STRING,
          description:
            'Exact fixture body taper contour (hybrid cylindrical-to-conical, 1.5° straight taper, moderate tapered core, triple-stage taper, parallel walls).',
        },
        apex_shape: {
          type: Type.STRING,
          description:
            'Exact apex contour, cutting flutes (single/double/triple), and presence or absence of an apical vent perforation hole.',
        },
        platform_crestal_profile: {
          type: Type.STRING,
          description:
            'Exact platform-switching step, crestal bone relationship (bone-level vs. tissue-level), and abutment-to-fixture shoulder transition.',
        },
        estimated_envelope: {
          type: Type.STRING,
          description: 'Estimated fixture dimensions such as Ø 4.0 mm × 10.0 mm.',
        },
        image_quality_note: {
          type: Type.STRING,
          description: 'Brief radiographic projection, beam angulation, and contrast note.',
        },
      },
      required: [
        'collar_shape',
        'internal_connection_silhouette',
        'thread_spacing',
        'body_contour',
        'apex_shape',
        'platform_crestal_profile',
        'estimated_envelope',
        'image_quality_note',
      ],
      propertyOrdering: [
        'collar_shape',
        'internal_connection_silhouette',
        'thread_spacing',
        'body_contour',
        'apex_shape',
        'platform_crestal_profile',
        'estimated_envelope',
        'image_quality_note',
      ],
    },
    eliminated_brands: {
      type: Type.ARRAY,
      description:
        'STEP 1B: Explicitly list eliminated Reference Library brands (at least 6–10 most relevant confusable non-matching systems from the 14-brand library) citing exact geometric differences that disqualify each one.',
      items: {
        type: Type.OBJECT,
        properties: {
          brand_name: {
            type: Type.STRING,
            description: 'Exact name of the eliminated Reference Library system.',
          },
          elimination_reason: {
            type: Type.STRING,
            description:
              'Specific geometric difference(s) in neck/collar, internal connection, thread pitch, body taper, apex/vent, or crestal platform that rule out this brand.',
          },
        },
        required: ['brand_name', 'elimination_reason'],
        propertyOrdering: ['brand_name', 'elimination_reason'],
      },
    },
    visualComparisonNote: {
      type: Type.STRING,
      description:
        'Summary comparing the TARGET UNKNOWN RADIOGRAPH visually against the provided Stage 2 REFERENCE images across clinical beam angulations.',
    },
    top_match: {
      type: Type.STRING,
      description:
        'STEP 2: The top-scoring non-eliminated implant system from the 14-brand Reference Library.',
    },
    matches: {
      type: Type.ARRAY,
      description:
        'Top 3 ranked implant system matches from the 14-brand Reference Library ordered highest to lowest weightedTotalScore, where rank 1 MUST equal top_match.',
      items: {
        type: Type.OBJECT,
        properties: {
          rank: { type: Type.INTEGER },
          manufacturer: { type: Type.STRING },
          systemName: { type: Type.STRING },
          platformLine: { type: Type.STRING },
          confidencePercent: {
            type: Type.INTEGER,
            description:
              'Calibrated integer confidence percentage (0 to 99) aligned with weightedTotalScore.',
          },
          weightedTotalScore: {
            type: Type.INTEGER,
            description:
              'Sum of the 6 anatomical breakdown criterion scores (neckCollar + internalConnection + threadPitchShape + bodyTaper + apexVentDesign + platformCrestalProfile, max 100).',
          },
          diagnosticRationale: { type: Type.STRING },
          anatomicalBreakdown: {
            type: Type.OBJECT,
            properties: {
              neckCollar: makeWeightedCriterionSchema(25, 'Neck / Collar (25%)'),
              internalConnection: makeWeightedCriterionSchema(
                25,
                'Internal Connection Silhouette (25%)'
              ),
              threadPitchShape: makeWeightedCriterionSchema(
                20,
                'Thread Pitch & Shape (20%)'
              ),
              bodyTaper: makeWeightedCriterionSchema(10, 'Body Taper (10%)'),
              apexVentDesign: makeWeightedCriterionSchema(
                10,
                'Apex / Vent Design (10%)'
              ),
              platformCrestalProfile: makeWeightedCriterionSchema(
                10,
                'Platform Switch & Crestal Profile (10%)'
              ),
            },
            required: [
              'neckCollar',
              'internalConnection',
              'threadPitchShape',
              'bodyTaper',
              'apexVentDesign',
              'platformCrestalProfile',
            ],
            propertyOrdering: [
              'neckCollar',
              'internalConnection',
              'threadPitchShape',
              'bodyTaper',
              'apexVentDesign',
              'platformCrestalProfile',
            ],
          },
          prostheticSpecs: {
            type: Type.OBJECT,
            properties: {
              screwdriverBit: { type: Type.STRING },
              screwdriverGeometry: {
                type: Type.STRING,
                enum: ['torx', 'hex', 'unigrip', 'square', 'slot'],
              },
              screwdriverSizeNote: { type: Type.STRING },
              recommendedTorqueNcm: { type: Type.INTEGER },
              torqueDisplayLabel: { type: Type.STRING },
              torqueGuidance: { type: Type.STRING },
              connectionType: { type: Type.STRING },
              scanBody: {
                type: Type.OBJECT,
                properties: {
                  libraryId: { type: Type.STRING },
                  displayName: { type: Type.STRING },
                  exocadFilename: { type: Type.STRING },
                  threeShapeFilename: { type: Type.STRING },
                  compatibleSuites: { type: Type.STRING },
                  scanBodyHeightMm: { type: Type.NUMBER },
                  platformDiameterMm: { type: Type.NUMBER },
                },
                required: [
                  'libraryId',
                  'displayName',
                  'exocadFilename',
                  'threeShapeFilename',
                  'compatibleSuites',
                  'scanBodyHeightMm',
                  'platformDiameterMm',
                ],
              },
            },
            required: [
              'screwdriverBit',
              'screwdriverGeometry',
              'screwdriverSizeNote',
              'recommendedTorqueNcm',
              'torqueDisplayLabel',
              'torqueGuidance',
              'connectionType',
              'scanBody',
            ],
          },
        },
        required: [
          'rank',
          'manufacturer',
          'systemName',
          'platformLine',
          'confidencePercent',
          'weightedTotalScore',
          'diagnosticRationale',
          'anatomicalBreakdown',
          'prostheticSpecs',
        ],
      },
    },
  },
  required: [
    'isDentalRadiograph',
    'validationMessage',
    'observed_features',
    'eliminated_brands',
    'visualComparisonNote',
    'top_match',
    'matches',
  ],
  propertyOrdering: [
    'isDentalRadiograph',
    'validationMessage',
    'observed_features',
    'eliminated_brands',
    'visualComparisonNote',
    'top_match',
    'matches',
  ],
};

function sanitizeSlug(input: string): string {
  return (
    input
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'implant_scan_body'
  );
}

function findVerifiedCoreSpec(
  manufacturer: string,
  systemName: string
): VerifiedBrandSpec | null {
  const combined = `${manufacturer} ${systemName}`.toLowerCase();
  for (const spec of VERIFIED_CORE_SPECS) {
    if (spec.matcher(combined)) {
      return spec;
    }
  }
  return null;
}

function clampCriterionScore(
  raw: Record<string, unknown> | undefined,
  maxWeight: number
) {
  const score = Math.max(0, Math.min(maxWeight, Math.round(Number(raw?.score) || 0)));
  const ratio = score / maxWeight;
  const fallbackStrength = ratio >= 0.8 ? 'High' : ratio >= 0.55 ? 'Moderate' : 'Low';
  const rawStrength = String(raw?.matchStrength || '');
  const matchStrength =
    rawStrength === 'High' || rawStrength === 'Moderate' || rawStrength === 'Low'
      ? rawStrength
      : fallbackStrength;

  return {
    score,
    maxWeight,
    classification: String(raw?.classification || 'Evaluated'),
    radiographicObservation: String(raw?.radiographicObservation || ''),
    matchStrength,
  };
}

function normalizeStage1Result(parsed: Record<string, unknown>) {
  const rawIds = Array.isArray(parsed.top4CandidateIds)
    ? parsed.top4CandidateIds.map((v) => String(v || '').trim())
    : [];

  const uniqueIds: string[] = [];
  for (const id of rawIds) {
    if (SPEC_BY_ID.has(id) && !uniqueIds.includes(id)) {
      uniqueIds.push(id);
    } else if (id) {
      const matched = findVerifiedCoreSpec(id, '');
      if (matched && !uniqueIds.includes(matched.id)) {
        uniqueIds.push(matched.id);
      }
    }
    if (uniqueIds.length === 4) break;
  }

  for (const fallbackId of VALID_SYSTEM_IDS) {
    if (uniqueIds.length >= 4) break;
    if (!uniqueIds.includes(fallbackId)) {
      uniqueIds.push(fallbackId);
    }
  }

  const top4CandidateIds = uniqueIds.slice(0, 4);
  const top4CandidateLabels = top4CandidateIds.map(
    (id) => SPEC_BY_ID.get(id)?.label ?? id
  );

  return {
    isDentalRadiograph: Boolean(parsed.isDentalRadiograph ?? true),
    validationMessage: String(parsed.validationMessage || ''),
    top4CandidateIds,
    top4CandidateLabels,
    screeningSummary: String(parsed.screeningSummary || ''),
  };
}

function hydrateVerifiedSpecs(
  parsed: Record<string, unknown>,
  fewShotInlineCount: number,
  fewShotReferenceLabels: string[],
  stage1CandidateLabels: string[]
) {
  const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
  const hydratedMatches = matches.map((rawMatch: Record<string, unknown>, index: number) => {
    const manufacturer = String(rawMatch.manufacturer ?? '');
    const systemName = String(rawMatch.systemName ?? '');
    const verified = findVerifiedCoreSpec(manufacturer, systemName);
    const rawSpecs = (rawMatch.prostheticSpecs ?? {}) as Record<string, unknown>;
    const rawScanBody = (rawSpecs.scanBody ?? {}) as Record<string, unknown>;
    const rawBreakdown = (rawMatch.anatomicalBreakdown ?? {}) as Record<
      string,
      Record<string, unknown>
    >;

    const neckCollar = clampCriterionScore(rawBreakdown.neckCollar, 25);
    const internalConnection = clampCriterionScore(rawBreakdown.internalConnection, 25);
    const threadPitchShape = clampCriterionScore(rawBreakdown.threadPitchShape, 20);
    const bodyTaper = clampCriterionScore(rawBreakdown.bodyTaper, 10);
    const apexVentDesign = clampCriterionScore(rawBreakdown.apexVentDesign, 10);
    const platformCrestalProfile = clampCriterionScore(
      rawBreakdown.platformCrestalProfile,
      10
    );

    const computedWeightedTotal =
      neckCollar.score +
      internalConnection.score +
      threadPitchShape.score +
      bodyTaper.score +
      apexVentDesign.score +
      platformCrestalProfile.score;

    const anatomicalBreakdown = {
      neckCollar,
      internalConnection,
      threadPitchShape,
      bodyTaper,
      apexVentDesign,
      platformCrestalProfile,
    };

    const confidencePercent = Math.max(
      1,
      Math.min(
        99,
        Math.round(Number(rawMatch.confidencePercent) || computedWeightedTotal)
      )
    );

    if (!verified) {
      return {
        ...rawMatch,
        rank: index + 1,
        manufacturer,
        systemName,
        confidencePercent,
        weightedTotalScore: computedWeightedTotal,
        anatomicalBreakdown,
        prostheticSpecs: {
          ...rawSpecs,
          torqueDisplayLabel:
            String(rawSpecs.torqueDisplayLabel || '') ||
            `${Number(rawSpecs.recommendedTorqueNcm) || 30} Ncm`,
          scanBody: {
            ...rawScanBody,
            displayName:
              String(rawScanBody.displayName || '') ||
              `${manufacturer} ${systemName} Scan Body`,
          },
        },
      };
    }

    const slug = sanitizeSlug(`${verified.manufacturer}_${verified.systemName}`);
    return {
      ...rawMatch,
      rank: index + 1,
      manufacturer: verified.manufacturer,
      systemName: verified.systemName,
      confidencePercent,
      weightedTotalScore: computedWeightedTotal,
      anatomicalBreakdown,
      prostheticSpecs: {
        ...rawSpecs,
        screwdriverBit: verified.driverBit,
        screwdriverGeometry: verified.driverGeometry,
        screwdriverSizeNote: verified.driverSizeNote,
        recommendedTorqueNcm: verified.recommendedTorqueNcm,
        torqueDisplayLabel: verified.torqueDisplayLabel,
        torqueGuidance: verified.torqueGuidance,
        connectionType: verified.connectionType,
        scanBody: {
          libraryId: verified.scanBodyLibraryId,
          displayName: verified.scanBodyDisplayName,
          exocadFilename: `${slug}_ScanBody.stl`,
          threeShapeFilename: `${slug}_3Shape_ScanBody.xml`,
          compatibleSuites: verified.scanBodySuites,
          scanBodyHeightMm: verified.scanBodyHeightMm,
          platformDiameterMm: verified.platformDiameterMm,
        },
      },
    };
  });

  hydratedMatches.sort(
    (a, b) =>
      b.weightedTotalScore - a.weightedTotalScore ||
      b.confidencePercent - a.confidencePercent
  );
  hydratedMatches.forEach((m, idx) => {
    m.rank = idx + 1;
  });

  const topMatches = hydratedMatches.slice(0, 3);
  const normalizedTopMatch =
    topMatches.length > 0
      ? `${topMatches[0].manufacturer} ${topMatches[0].systemName}`.trim()
      : String(parsed.top_match || '');

  return {
    ...parsed,
    top_match: normalizedTopMatch,
    stage1CandidateLabels,
    fewShotSamplesUsed: fewShotInlineCount,
    fewShotReferenceLabels,
    matches: topMatches,
  };
}

function buildParametricScanBodySTL(params: {
  libraryId: string;
  diameterMm: number;
  heightMm: number;
}): string {
  const radius = Math.max(1.5, Math.min(3.5, params.diameterMm / 2));
  const height = Math.max(5.0, Math.min(12.0, params.heightMm));
  const bevelStartZ = height * 0.55;
  const bevelPlaneX = radius * 0.68;
  const segments = 32;

  const ringPoints = (z: number, applyBevel: boolean): Array<[number, number, number]> => {
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < segments; i++) {
      const theta = (2 * Math.PI * i) / segments;
      let x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);
      if (applyBevel && x > bevelPlaneX) {
        x = bevelPlaneX;
      }
      pts.push([Number(x.toFixed(4)), Number(y.toFixed(4)), Number(z.toFixed(4))]);
    }
    return pts;
  };

  const facet = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number]
  ): string => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    return [
      `  facet normal ${nx.toFixed(5)} ${ny.toFixed(5)} ${nz.toFixed(5)}`,
      '    outer loop',
      `      vertex ${a[0]} ${a[1]} ${a[2]}`,
      `      vertex ${b[0]} ${b[1]} ${b[2]}`,
      `      vertex ${c[0]} ${c[1]} ${c[2]}`,
      '    endloop',
      '  endfacet',
    ].join('\n');
  };

  const bottomRing = ringPoints(0, false);
  const midRing = ringPoints(bevelStartZ, false);
  const topRing = ringPoints(height, true);
  const bottomCenter: [number, number, number] = [0, 0, 0];
  const topCenter: [number, number, number] = [0, 0, Number(height.toFixed(4))];

  const lines: string[] = [`solid ${sanitizeSlug(params.libraryId)}`];

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    lines.push(facet(bottomCenter, bottomRing[next], bottomRing[i]));
    lines.push(facet(bottomRing[i], bottomRing[next], midRing[next]));
    lines.push(facet(bottomRing[i], midRing[next], midRing[i]));
    lines.push(facet(midRing[i], midRing[next], topRing[next]));
    lines.push(facet(midRing[i], topRing[next], topRing[i]));
    lines.push(facet(topCenter, topRing[i], topRing[next]));
  }

  lines.push(`endsolid ${sanitizeSlug(params.libraryId)}`);
  return lines.join('\n') + '\n';
}

function buildThreeShapeXml(params: {
  manufacturer: string;
  systemName: string;
  platformLine: string;
  libraryId: string;
  scanBodyName: string;
  connectionType: string;
  screwdriverBit: string;
  torqueLabel: string;
  diameterMm: number;
  heightMm: number;
}): string {
  const esc = (val: string) =>
    val
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ScanBodyLibraryFormat version="2.0" generator="ImplantID AI Clinical CAD Export">
  <Compatibility>
    <Suite name="3Shape Dental System" minVersion="2023.1" />
    <Suite name="Exocad DentalCAD" minVersion="3.1" />
  </Compatibility>
  <ImplantSystem>
    <LibraryID>${esc(params.libraryId)}</LibraryID>
    <ScanBodyLibrary>${esc(params.scanBodyName)}</ScanBodyLibrary>
    <Manufacturer>${esc(params.manufacturer)}</Manufacturer>
    <SystemName>${esc(params.systemName)}</SystemName>
    <Platform>${esc(params.platformLine)}</Platform>
    <ConnectionGeometry>${esc(params.connectionType)}</ConnectionGeometry>
  </ImplantSystem>
  <ScanBodyGeometry units="mm">
    <PlatformDiameter>${params.diameterMm.toFixed(2)}</PlatformDiameter>
    <TotalHeight>${params.heightMm.toFixed(2)}</TotalHeight>
    <IndexFacetType>FlatBevelDirectional</IndexFacetType>
    <SeatingOrigin x="0.000" y="0.000" z="0.000" />
    <InsertionAxis x="0.000" y="0.000" z="1.000" />
  </ScanBodyGeometry>
  <RestorativeProtocol>
    <ScrewdriverBit>${esc(params.screwdriverBit)}</ScrewdriverBit>
    <RecommendedTorque>${esc(params.torqueLabel)}</RecommendedTorque>
  </RestorativeProtocol>
</ScanBodyLibraryFormat>
`;
}

function detectImageMimeFromBytes(buffer: Buffer): 'image/jpeg' | 'image/png' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

function validateAndCanonicalizeBase64(
  rawBase64: string,
  hintMime?: string
): { base64: string; mimeType: 'image/jpeg' | 'image/png'; byteLength: number } | null {
  const cleaned = rawBase64
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, '')
    .replace(/\s+/g, '');
  if (!cleaned) return null;

  const buffer = Buffer.from(cleaned, 'base64');
  if (buffer.length === 0) return null;

  const detectedMime = detectImageMimeFromBytes(buffer);
  const requestedMime =
    hintMime === 'image/png'
      ? 'image/png'
      : hintMime === 'image/jpeg' || hintMime === 'image/jpg'
        ? 'image/jpeg'
        : null;

  const finalMime = detectedMime ?? requestedMime;
  if (!finalMime) return null;

  return {
    base64: buffer.toString('base64'),
    mimeType: finalMime,
    byteLength: buffer.length,
  };
}

function parseStructuredJson(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  const unfenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    : trimmed;
  return JSON.parse(unfenced) as Record<string, unknown>;
}

interface IncomingReferenceSample {
  systemId?: string;
  systemLabel?: string;
  sampleIndex?: number;
  imageBase64?: string;
  mimeType?: string;
}

interface ValidatedReferenceSample {
  systemId: string;
  systemLabel: string;
  sampleIndex?: number;
  base64: string;
  mimeType: 'image/jpeg' | 'image/png';
  byteLength: number;
}

type MultimodalPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

async function callGeminiStructuredWithRetry(params: {
  ai: GoogleGenAI;
  stageLabel: string;
  systemInstruction: string;
  parts: MultimodalPart[];
  responseSchema: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  let lastError: unknown;
  const modelQueue: Array<{ model: string; thinkingLevel?: ThinkingLevel }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite' },
  ];

  for (const candidate of modelQueue) {
    let includeTemp = true;
    const attemptsForModel = candidate.model === 'gemini-4-hydrogen' ? 2 : 2;

    for (let attempt = 1; attempt <= attemptsForModel; attempt++) {
      const t0 = Date.now();
      try {
        const response = await params.ai.models.generateContent({
          model: candidate.model,
          contents: { parts: params.parts },
          config: {
            systemInstruction: params.systemInstruction,
            safetySettings: MEDICAL_SAFETY_SETTINGS,
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
            seed: 42,
            ...(includeTemp ? { temperature: 0 } : {}),
            ...(candidate.thinkingLevel
              ? { thinkingConfig: { thinkingLevel: candidate.thinkingLevel } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
          },
        });

        const rawText = response.text?.trim();
        console.log(
          `[ImplantID AI] ${params.stageLabel} completed with ${candidate.model} in ${Date.now() - t0}ms`
        );
        if (!rawText) {
          const finishReason = response.candidates?.[0]?.finishReason;
          throw new Error(
            finishReason
              ? `Empty response received from Gemini model (finishReason: ${finishReason}).`
              : 'Empty response received from Gemini model.'
          );
        }
        return parseStructuredJson(rawText);
      } catch (err: unknown) {
        lastError = err;
        const status =
          typeof err === 'object' && err !== null && 'status' in err
            ? Number((err as { status?: number }).status)
            : undefined;
        const msg = err instanceof Error ? err.message : '';

        if (status === 400 && includeTemp && /temperature/i.test(msg)) {
          includeTemp = false;
          continue;
        }

        const retryable =
          status === 429 || status === 503 || (status !== undefined && status >= 500);
        if (!retryable) {
          throw err;
        }
        if (attempt < attemptsForModel) {
          await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
        }
      }
    }
  }

  throw lastError;
}

async function runStage1Screening(
  ai: GoogleGenAI,
  targetImage: { base64: string; mimeType: 'image/jpeg' | 'image/png'; byteLength: number }
) {
  const parts: MultimodalPart[] = [
    {
      text: 'TARGET UNKNOWN RADIOGRAPH FOR STAGE 1 MORPHOLOGICAL SCREENING. Inspect microthreads, coronal neck/collar, internal connection silhouette, body taper, apical flutes/vents, and crestal platform profile at high resolution, then return the Top 4 most geometrically compatible candidate system IDs from the 14-system catalog.',
    },
    {
      inlineData: {
        mimeType: targetImage.mimeType,
        data: targetImage.base64,
      },
    },
  ];

  const parsed = await callGeminiStructuredWithRetry({
    ai,
    stageLabel: 'Stage 1 (14-System Morphological Screening)',
    systemInstruction: STAGE1_SYSTEM_PROMPT,
    parts,
    responseSchema: stage1ResponseSchema,
  });

  return normalizeStage1Result(parsed);
}

async function runStage2VisualMatch(
  ai: GoogleGenAI,
  targetImage: { base64: string; mimeType: 'image/jpeg' | 'image/png'; byteLength: number },
  referenceSamples: ValidatedReferenceSample[],
  stage1CandidateLabels: string[]
) {
  const parts: MultimodalPart[] = [];
  const attachedRefLabels: string[] = [];
  const brandCounters = new Map<string, number>();
  let attachedRefInlineParts = 0;

  if (stage1CandidateLabels.length > 0) {
    parts.push({
      text: `STAGE 1 TOP 4 MORPHOLOGICALLY SCREENED CANDIDATES: ${stage1CandidateLabels.join(' | ')}. Compare the TARGET UNKNOWN RADIOGRAPH carefully against all labeled reference radiographs below (accounting for X-ray beam angulation, magnification, and restored vs. unrestored projections), while retaining the Anti-Anchoring rule across all 14 systems.`,
    });
  }

  // Attach every matched reference image labeled "REFERENCE [Brand Name] #1", "#2", etc. right before the target X-ray
  for (const ref of referenceSamples) {
    const nextIdx = (brandCounters.get(ref.systemLabel) ?? 0) + 1;
    brandCounters.set(ref.systemLabel, nextIdx);
    const displayNum = ref.sampleIndex && ref.sampleIndex > 0 ? ref.sampleIndex : nextIdx;
    const labelText = `REFERENCE ${ref.systemLabel} #${displayNum}`;

    parts.push({ text: labelText });
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.base64,
      },
    });
    attachedRefInlineParts += 1;
    attachedRefLabels.push(labelText);
  }

  parts.push({
    text:
      attachedRefInlineParts > 0
        ? `TARGET UNKNOWN RADIOGRAPH TO IDENTIFY. Compare this unknown radiograph head-to-head against the ${attachedRefInlineParts} labeled REFERENCE radiograph(s) immediately above (both as positive matches and negative counterexamples). First output observed_features (all 6 landmarks) and eliminated_brands, then score the Top 3 candidates across the 6-point anatomical breakdown (25/25/20/10/10/10 = 100 pts) and select top_match.`
        : `TARGET UNKNOWN RADIOGRAPH TO IDENTIFY. No reference radiographs were uploaded for the Top 4 screened candidates. Perform strict 14-system morphological fingerprinting: first output observed_features (all 6 landmarks) and eliminated_brands, then score the Top 3 candidates across the 6-point anatomical breakdown (25/25/20/10/10/10 = 100 pts) and select top_match.`,
  });

  parts.push({
    inlineData: {
      mimeType: targetImage.mimeType,
      data: targetImage.base64,
    },
  });

  const parsed = await callGeminiStructuredWithRetry({
    ai,
    stageLabel: `Stage 2 (Head-to-Head Match · refInlineParts=${attachedRefInlineParts})`,
    systemInstruction: STAGE2_SYSTEM_PROMPT,
    parts,
    responseSchema: stage2ResponseSchema,
  });

  return hydrateVerifiedSpecs(
    parsed,
    attachedRefInlineParts,
    attachedRefLabels,
    stage1CandidateLabels
  );
}

const MULTI_IMPLANT_SYSTEM_PROMPT = `You are a Multi-Implant Quadrant & Full-Arch Dental Radiographic Identification Engine.
Analyze the uploaded dental radiograph (periapical, bitewing, panoramic, or quadrant film) at maximum pixel density to detect EVERY endosseous dental implant fixture visible in the image and classify EACH fixture independently across these 14 dental implant systems:

${FOURTEEN_SYSTEM_FINGERPRINTS}

MULTI-IMPLANT DETECTION & PER-FIXTURE CLASSIFICATION PROTOCOL:
1. **Detect Every Endosseous Implant Fixture:**
   - Locate ALL endosseous dental implants visible in the radiograph (do NOT confuse natural tooth roots, root canal gutta-percha cones, or prosthetic pontics with titanium implant fixtures).
   - Order detected fixtures clinically from **mesial to distal** (or **left to right** across the radiograph when arch orientation is symmetric) as \`Implant #1 (Mesial)\`, \`Implant #2 (Middle)\`, \`Implant #3 (Distal)\` (for 2 fixtures use \`Implant #1 (Mesial)\` and \`Implant #2 (Distal)\`; for 1 fixture use \`Implant #1\`; for 4+ fixtures number sequentially \`Implant #1\` through \`Implant #N\` with clear mesial/middle/distal or left/right anatomical cue).
2. **Tight 2D Bounding Box Localization (\`0–1000\` Normalized Coordinates):**
   - For each detected fixture, return \`boundingBox\` as an array of 4 integers \`[ymin, xmin, ymax, xmax]\` scaled \`0–1000\` where \`0\` is the top/left edge and \`1000\` is the bottom/right edge of the full radiograph.
   - The bounding box MUST tightly enclose the entire implant fixture body from coronal collar/platform margin down to the apical tip (including its lateral threads).
3. **Independent 6-Point Identification Per Fixture:**
   - Treat each implant fixture completely independently—adjacent implants in the same arch frequently belong to DIFFERENT implant systems or platforms.
   - If labeled REFERENCE radiographs are provided above the target image, apply the Anti-Anchoring Calibration Rule (use references as both positive matches and negative counterexamples).
   - For EACH fixture, output:
     * \`observed_features\` (all 6 landmarks for that specific fixture)
     * \`eliminated_brands\` (at least 4–6 most confusable eliminated systems citing exact geometric differences)
     * \`top_match\` and Top 3 ranked \`matches\` scored across the 6-point \`anatomicalBreakdown\` summing to \`weightedTotalScore\` (0–100):
       - \`neckCollar\` (max 25)
       - \`internalConnection\` (max 25)
       - \`threadPitchShape\` (max 20)
       - \`bodyTaper\` (max 10)
       - \`apexVentDesign\` (max 10)
       - \`platformCrestalProfile\` (max 10)
     * Pull verified Driver Bit, Torque Limit (Ncm), and CAD Scan Body strictly from the 14 verified system specs above.`;

const multiImplantResponseSchema = {
  type: Type.OBJECT,
  properties: {
    isDentalRadiograph: {
      type: Type.BOOLEAN,
      description:
        'True if the uploaded image is a dental X-ray radiograph showing one or more endosseous dental implants.',
    },
    validationMessage: {
      type: Type.STRING,
      description: 'Brief clinical note summarizing radiograph type, angulation, and number of fixtures detected.',
    },
    fixtures: {
      type: Type.ARRAY,
      description:
        'Every detected endosseous dental implant ordered clinically mesial-to-distal (or left-to-right).',
      items: {
        type: Type.OBJECT,
        properties: {
          fixtureIndex: {
            type: Type.INTEGER,
            description: '1-based sequential fixture number (1, 2, 3, ...).',
          },
          positionLabel: {
            type: Type.STRING,
            description:
              'Clinical spatial label such as "Implant #1 (Mesial)", "Implant #2 (Middle)", "Implant #3 (Distal)".',
          },
          boundingBox: {
            type: Type.ARRAY,
            description:
              'Tight normalized 2D bounding box [ymin, xmin, ymax, xmax] with integer coordinates scaled 0–1000.',
            items: { type: Type.INTEGER },
          },
          observed_features: stage2ResponseSchema.properties.observed_features,
          eliminated_brands: stage2ResponseSchema.properties.eliminated_brands,
          visualComparisonNote: stage2ResponseSchema.properties.visualComparisonNote,
          top_match: stage2ResponseSchema.properties.top_match,
          matches: stage2ResponseSchema.properties.matches,
        },
        required: [
          'fixtureIndex',
          'positionLabel',
          'boundingBox',
          'observed_features',
          'eliminated_brands',
          'visualComparisonNote',
          'top_match',
          'matches',
        ],
        propertyOrdering: [
          'fixtureIndex',
          'positionLabel',
          'boundingBox',
          'observed_features',
          'eliminated_brands',
          'visualComparisonNote',
          'top_match',
          'matches',
        ],
      },
    },
  },
  required: ['isDentalRadiograph', 'validationMessage', 'fixtures'],
  propertyOrdering: ['isDentalRadiograph', 'validationMessage', 'fixtures'],
};

function normalizeBoundingBox(raw: unknown): [number, number, number, number] {
  if (!Array.isArray(raw) || raw.length < 4) {
    return [150, 250, 850, 750];
  }
  let ymin = Math.max(0, Math.min(990, Math.round(Number(raw[0]) || 0)));
  let xmin = Math.max(0, Math.min(990, Math.round(Number(raw[1]) || 0)));
  let ymax = Math.max(10, Math.min(1000, Math.round(Number(raw[2]) || 1000)));
  let xmax = Math.max(10, Math.min(1000, Math.round(Number(raw[3]) || 1000)));
  if (ymax <= ymin + 10) ymax = Math.min(1000, ymin + 100);
  if (xmax <= xmin + 10) xmax = Math.min(1000, xmin + 100);
  return [ymin, xmin, ymax, xmax];
}

async function runMultiImplantAnalysis(
  ai: GoogleGenAI,
  targetImage: { base64: string; mimeType: 'image/jpeg' | 'image/png'; byteLength: number },
  referenceSamples: ValidatedReferenceSample[]
) {
  const parts: MultimodalPart[] = [];
  const attachedRefLabels: string[] = [];
  const brandCounters = new Map<string, number>();
  let attachedRefInlineParts = 0;

  for (const ref of referenceSamples) {
    const nextIdx = (brandCounters.get(ref.systemLabel) ?? 0) + 1;
    brandCounters.set(ref.systemLabel, nextIdx);
    const displayNum = ref.sampleIndex && ref.sampleIndex > 0 ? ref.sampleIndex : nextIdx;
    const labelText = `REFERENCE ${ref.systemLabel} #${displayNum}`;

    parts.push({ text: labelText });
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.base64,
      },
    });
    attachedRefInlineParts += 1;
    attachedRefLabels.push(labelText);
  }

  parts.push({
    text:
      attachedRefInlineParts > 0
        ? `TARGET MULTI-IMPLANT QUADRANT / FULL-ARCH RADIOGRAPH TO ANALYZE. Detect EVERY visible endosseous dental implant fixture, order them mesial-to-distal (or left-to-right), return tight normalized 2D bounding boxes [ymin, xmin, ymax, xmax] (0–1000) for each fixture, and independently classify each fixture across the 14-system catalog using the ${attachedRefInlineParts} labeled REFERENCE radiograph(s) above for visual calibration.`
        : `TARGET MULTI-IMPLANT QUADRANT / FULL-ARCH RADIOGRAPH TO ANALYZE. Detect EVERY visible endosseous dental implant fixture, order them mesial-to-distal (or left-to-right), return tight normalized 2D bounding boxes [ymin, xmin, ymax, xmax] (0–1000) for each fixture, and independently classify each fixture across the 14-system catalog with a full 6-point anatomical breakdown and Top 3 ranked matches.`,
  });

  parts.push({
    inlineData: {
      mimeType: targetImage.mimeType,
      data: targetImage.base64,
    },
  });

  const parsed = await callGeminiStructuredWithRetry({
    ai,
    stageLabel: `Multi-Implant Detection (refInlineParts=${attachedRefInlineParts})`,
    systemInstruction: MULTI_IMPLANT_SYSTEM_PROMPT,
    parts,
    responseSchema: multiImplantResponseSchema,
  });

  const rawFixtures = Array.isArray(parsed.fixtures) ? parsed.fixtures : [];
  const isDentalRadiograph = Boolean(parsed.isDentalRadiograph ?? true);
  const validationMessage = String(parsed.validationMessage || '');

  const hydratedFixtures = rawFixtures.map((rawFixture: Record<string, unknown>, idx: number) => {
    const fixtureIndex = idx + 1;
    const boundingBox = normalizeBoundingBox(rawFixture.boundingBox);
    const rawPosLabel = String(rawFixture.positionLabel || '').trim();
    const positionLabel = rawPosLabel || `Implant #${fixtureIndex}`;

    const hydratedAnalysis = hydrateVerifiedSpecs(
      {
        isDentalRadiograph,
        validationMessage,
        observed_features: rawFixture.observed_features,
        eliminated_brands: rawFixture.eliminated_brands,
        visualComparisonNote: rawFixture.visualComparisonNote,
        top_match: rawFixture.top_match,
        matches: rawFixture.matches,
      },
      attachedRefInlineParts,
      attachedRefLabels,
      []
    );

    return {
      fixtureIndex,
      positionLabel,
      boundingBox,
      analysis: hydratedAnalysis,
    };
  });

  return {
    isDentalRadiograph,
    validationMessage,
    totalImplantsDetected: hydratedFixtures.length,
    fewShotSamplesUsed: attachedRefInlineParts,
    fixtures: hydratedFixtures,
  };
}

function validateIncomingReferences(
  referenceSamples: unknown,
  maxItems: number
): ValidatedReferenceSample[] {
  const validated: ValidatedReferenceSample[] = [];
  if (!Array.isArray(referenceSamples)) return validated;

  for (const rawItem of referenceSamples.slice(0, maxItems)) {
    const item = rawItem as IncomingReferenceSample;
    if (!item?.imageBase64 || !item?.systemLabel) continue;
    const cleanRef = validateAndCanonicalizeBase64(item.imageBase64, item.mimeType);
    if (cleanRef) {
      const inferredSpec =
        (item.systemId && SPEC_BY_ID.get(item.systemId)) ||
        findVerifiedCoreSpec(String(item.systemLabel), '');
      validated.push({
        systemId: inferredSpec?.id ?? String(item.systemId || ''),
        systemLabel: inferredSpec?.label ?? String(item.systemLabel).slice(0, 96),
        sampleIndex:
          typeof item.sampleIndex === 'number' && Number.isFinite(item.sampleIndex)
            ? Math.max(1, Math.min(6, Math.round(item.sampleIndex)))
            : undefined,
        base64: cleanRef.base64,
        mimeType: cleanRef.mimeType,
        byteLength: cleanRef.byteLength,
      });
    }
  }
  return validated;
}

function extractReadableErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unable to complete radiographic analysis.';
  }
  const raw = error.message || '';
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Not JSON
  }
  return raw || 'Unable to complete radiographic analysis.';
}

async function startServer() {
  const app = express();

  // High payload budget for up to 24 full-resolution Stage 2 reference radiographs (6 per system x Top 4) + target X-ray
  app.use(express.json({ limit: '100mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      model: 'gemini-4-hydrogen',
      fallbackModel: 'gemini-3.1-flash-lite',
      mediaResolution: 'MEDIA_RESOLUTION_HIGH',
      temperature: 0,
      supportedSystems: VERIFIED_CORE_SPECS.length,
      maxReferencesPerSystem: 6,
      pipeline: '2-stage',
    });
  });

  // STAGE 1: Fast 14-system morphological screening -> Top 4 candidate IDs
  app.post('/api/analyze-stage1', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Missing target radiograph image data.' });
        return;
      }

      const validatedTarget = validateAndCanonicalizeBase64(imageBase64, mimeType);
      if (!validatedTarget) {
        res.status(400).json({
          error: 'Unsupported image format. Please upload a valid .jpg or .png radiograph.',
        });
        return;
      }

      const ai = getGeminiClient();
      const screening = await runStage1Screening(ai, validatedTarget);
      res.json(screening);
    } catch (error: unknown) {
      const message = extractReadableErrorMessage(error);
      console.error('Stage 1 screening error:', error);
      res.status(502).json({ error: message });
    }
  });

  // STAGE 2: Head-to-head comparison attaching up to 24 labeled reference X-rays for Top 4 candidates
  app.post('/api/analyze-stage2', async (req, res) => {
    try {
      const { imageBase64, mimeType, stage1CandidateIds, stage1CandidateLabels, referenceSamples } =
        req.body as {
          imageBase64?: string;
          mimeType?: string;
          stage1CandidateIds?: string[];
          stage1CandidateLabels?: string[];
          referenceSamples?: IncomingReferenceSample[];
        };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Missing target radiograph image data.' });
        return;
      }

      const validatedTarget = validateAndCanonicalizeBase64(imageBase64, mimeType);
      if (!validatedTarget) {
        res.status(400).json({
          error: 'Unsupported image format. Please upload a valid .jpg or .png radiograph.',
        });
        return;
      }

      const validatedRefs = validateIncomingReferences(referenceSamples, 24);
      const resolvedLabels =
        Array.isArray(stage1CandidateLabels) && stage1CandidateLabels.length > 0
          ? stage1CandidateLabels.map((l) => String(l)).slice(0, 4)
          : Array.isArray(stage1CandidateIds)
            ? stage1CandidateIds
                .map((id) => SPEC_BY_ID.get(String(id))?.label ?? String(id))
                .slice(0, 4)
            : [];

      const ai = getGeminiClient();
      const result = await runStage2VisualMatch(
        ai,
        validatedTarget,
        validatedRefs,
        resolvedLabels
      );
      res.json(result);
    } catch (error: unknown) {
      const message = extractReadableErrorMessage(error);
      console.error('Stage 2 visual match error:', error);
      res.status(502).json({ error: message });
    }
  });

  // Unified backwards-compatible endpoint executing Stage 1 -> filter matching refs -> Stage 2
  app.post('/api/analyze-radiograph', async (req, res) => {
    try {
      const { imageBase64, mimeType, referenceSamples } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        referenceSamples?: IncomingReferenceSample[];
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Missing target radiograph image data.' });
        return;
      }

      const validatedTarget = validateAndCanonicalizeBase64(imageBase64, mimeType);
      if (!validatedTarget) {
        res.status(400).json({
          error: 'Unsupported image format. Please upload a valid .jpg or .png radiograph.',
        });
        return;
      }

      const allValidatedRefs = validateIncomingReferences(referenceSamples, 84);
      const ai = getGeminiClient();
      const stage1 = await runStage1Screening(ai, validatedTarget);

      const candidateIdSet = new Set(stage1.top4CandidateIds);
      const matchedStage2Refs = allValidatedRefs
        .filter((ref) => candidateIdSet.has(ref.systemId))
        .slice(0, 24);

      const result = await runStage2VisualMatch(
        ai,
        validatedTarget,
        matchedStage2Refs,
        stage1.top4CandidateLabels
      );
      res.json(result);
    } catch (error: unknown) {
      const message = extractReadableErrorMessage(error);
      console.error('Radiograph analysis error:', error);
      res.status(502).json({ error: message });
    }
  });

  // MULTI-IMPLANT MODE: Detect every implant fixture, return 0–1000 bounding boxes, and classify each independently
  app.post('/api/analyze-multi-implant', async (req, res) => {
    try {
      const { imageBase64, mimeType, referenceSamples } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        referenceSamples?: IncomingReferenceSample[];
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Missing target radiograph image data.' });
        return;
      }

      const validatedTarget = validateAndCanonicalizeBase64(imageBase64, mimeType);
      if (!validatedTarget) {
        res.status(400).json({
          error: 'Unsupported image format. Please upload a valid .jpg or .png radiograph.',
        });
        return;
      }

      const validatedRefs = validateIncomingReferences(referenceSamples, 24);
      const ai = getGeminiClient();
      const result = await runMultiImplantAnalysis(ai, validatedTarget, validatedRefs);
      res.json(result);
    } catch (error: unknown) {
      const message = extractReadableErrorMessage(error);
      console.error('Multi-implant analysis error:', error);
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/scan-body/download', (req, res) => {
    const format = String(req.query.format || 'exocad').toLowerCase();
    const manufacturer = String(req.query.manufacturer || 'ImplantSystem');
    const systemName = String(req.query.systemName || 'Standard');
    const platformLine = String(req.query.platformLine || 'Standard Platform');
    const libraryId = String(req.query.libraryId || `${manufacturer}_${systemName}_SB`);
    const scanBodyName = String(
      req.query.scanBodyName || `${manufacturer} ${systemName} Scan Body`
    );
    const connectionType = String(req.query.connectionType || 'Internal Conical');
    const screwdriverBit = String(req.query.screwdriverBit || '1.25 mm Hex Driver');
    const torqueLabel = String(
      req.query.torqueLabel || `${Number(req.query.torqueNcm) || 35} Ncm`
    );
    const diameterMm = Math.max(2.8, Math.min(6.5, Number(req.query.diameterMm) || 4.0));
    const heightMm = Math.max(5.0, Math.min(12.0, Number(req.query.heightMm) || 7.5));

    const safeBase = sanitizeSlug(`${manufacturer}_${systemName}_${libraryId}`);

    if (format === '3shape') {
      const xml = buildThreeShapeXml({
        manufacturer,
        systemName,
        platformLine,
        libraryId,
        scanBodyName,
        connectionType,
        screwdriverBit,
        torqueLabel,
        diameterMm,
        heightMm,
      });
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeBase}_3Shape_ScanBody.xml"`
      );
      res.send(xml);
      return;
    }

    const stl = buildParametricScanBodySTL({
      libraryId,
      diameterMm,
      heightMm,
    });
    res.setHeader('Content-Type', 'model/stl; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeBase}_ScanBody.stl"`
    );
    res.send(stl);
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ImplantID AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ImplantID AI server:', err);
  process.exit(1);
});
