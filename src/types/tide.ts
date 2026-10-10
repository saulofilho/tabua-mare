export interface TideConstituents {
  m2: { amp: number; phase: number }; // Principal lunar semidiurnal
  s2: { amp: number; phase: number }; // Principal solar semidiurnal
  n2: { amp: number; phase: number }; // Larger lunar elliptic semidiurnal
  k1: { amp: number; phase: number }; // Luni-solar diurnal
  o1: { amp: number; phase: number }; // Principal lunar diurnal
  m4: { amp: number; phase: number }; // Shallow water overtide
}

export type TidalType = 'semidiurnal' | 'diurnal' | 'mixed';

export interface NauticalHazard {
  id: string;
  name: string;
  type: 'rock' | 'shallow' | 'wreck' | 'sandbank' | 'buoy' | 'lighthouse';
  lat: number;
  lng: number;
  chartedDepth: number; // in meters at Chart Datum (Zero Hidrográfico)
  description: string;
  lightCharacteristic?: string; // e.g. "Fl(2) W 10s 22m 14M"
}

export interface TideStation {
  id: string;
  name: string;
  portName: string;
  state: string;
  lat: number;
  lng: number;
  meanSeaLevel: number; // Z0 (Nível Médio) in meters
  datumDescription: string; // Zero Hidrográfico (DHN)
  tidalType: TidalType;
  constituents: TideConstituents;
  averageRange: number; // Variação média em metros
  hazards: NauticalHazard[];
  offlineSizeMB: number;
  tileCountEstimate: number;
  recommendedMaxDraft: number; // in meters
}

export interface TidePoint {
  timestamp: number;
  timeString: string;
  height: number; // in meters
  rateOfChange: number; // in cm/hour (positive = rising, negative = falling)
}

export interface TideExtreme {
  timestamp: number;
  timeString: string;
  height: number;
  type: 'preia-mar' | 'baixa-mar';
}

export interface MoonPhaseInfo {
  phaseName: string;
  phaseCode: 'new' | 'waxing_crescent' | 'first_quarter' | 'waxing_gibbous' | 'full' | 'waning_gibbous' | 'last_quarter' | 'waning_crescent';
  illumination: number; // 0 to 100%
  ageDays: number;
  isSpringTide: boolean; // Maré de Sizígia
  springTideName: 'Sizígia (Variação Máxima)' | 'Quadratura (Variação Mínima)' | 'Intermediária';
}

export interface CurrentTideStatus {
  currentHeight: number;
  tendency: 'enchente' | 'vazante' | 'estofo';
  rateCmPerHour: number;
  nextExtreme: TideExtreme;
  subsequentExtreme: TideExtreme;
  moon: MoonPhaseInfo;
  ruleOfTwelfthsHour: number; // 1st, 2nd, 3rd, 4th, 5th, or 6th hour of cycle
  estimatedCurrentKnots: number; // Estimated tidal stream current speed in knots
}

export interface VesselProfile {
  name: string;
  vesselType: 'veleiro' | 'lancha' | 'pesqueiro' | 'catamara' | 'escuna';
  draft: number; // Calado em metros (distância da linha d'água ao fundo da quilha)
  safetyMargin: number; // Folga mínima sob a quilha desejada (UKC safety buffer em metros)
  airDraft: number; // Calado aéreo em metros (altura do mastro/superestrutura)
}

export type AlertType = 'high_tide' | 'low_tide' | 'ukc_clearance' | 'spring_tide' | 'strong_current';

export interface TideAlertRule {
  id: string;
  title: string;
  type: AlertType;
  thresholdValue: number; // meters for tide/UKC, knots for current
  operator: 'greater_than' | 'less_than';
  enabled: boolean;
  soundAlert: boolean;
  soundType: 'sonar' | 'foghorn' | 'shipbell' | 'danger';
  unit: string;
  description: string;
  lastTriggered?: number;
}

export interface ActiveAlertNotification {
  id: string;
  ruleId: string;
  title: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
  timestamp: number;
  value: string;
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  chartedDepth: number; // Depth on chart
}

export interface RouteClearanceResult {
  waypoint: Waypoint;
  actualDepth: number;
  ukc: number; // Under-Keel Clearance
  isSafe: boolean;
}

export interface OfflineRegionStatus {
  stationId: string;
  isDownloaded: boolean;
  downloadProgress: number; // 0 to 100
  downloadDate?: string;
  sizeBytes: number;
  tilesCached: number;
}
