import {
  CurrentTideStatus,
  MoonPhaseInfo,
  TideConstituents,
  TideExtreme,
  TidePoint,
  TideStation,
} from '../types/tide';

// Astronomical harmonic constituent angular speeds (degrees per solar hour)
const SPEED = {
  m2: 28.9841042, // Principal lunar semidiurnal
  s2: 30.0, // Principal solar semidiurnal
  n2: 28.4397295, // Larger lunar elliptic semidiurnal
  k1: 15.0410686, // Luni-solar diurnal
  o1: 13.9430356, // Principal lunar diurnal
  m4: 57.9682084, // Shallow water overtide
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * Calculates theoretical astronomical tide height at a specific timestamp for a given station.
 * Formula: h(t) = Z0 + sum(A_i * cos(omega_i * t - phi_i))
 */
export function calculateTideHeight(
  station: TideStation,
  timestamp: number
): number {
  const { constituents, meanSeaLevel } = station;
  // Hours elapsed since Unix Epoch
  const hoursSinceEpoch = timestamp / (1000 * 60 * 60);

  let height = meanSeaLevel;

  const addConstituent = (
    amp: number,
    phaseDeg: number,
    speedDegPerHour: number
  ) => {
    if (amp <= 0) return;
    const angleRad = (speedDegPerHour * hoursSinceEpoch - phaseDeg) * DEG_TO_RAD;
    height += amp * Math.cos(angleRad);
  };

  addConstituent(constituents.m2.amp, constituents.m2.phase, SPEED.m2);
  addConstituent(constituents.s2.amp, constituents.s2.phase, SPEED.s2);
  addConstituent(constituents.n2.amp, constituents.n2.phase, SPEED.n2);
  addConstituent(constituents.k1.amp, constituents.k1.phase, SPEED.k1);
  addConstituent(constituents.o1.amp, constituents.o1.phase, SPEED.o1);
  addConstituent(constituents.m4.amp, constituents.m4.phase, SPEED.m4);

  // Return clamped above 0 with 2 decimal precision
  return Math.max(0, Math.round(height * 100) / 100);
}

/**
 * Calculates the derivative / rate of change of tide (dh/dt) in cm/hour at a given timestamp.
 */
export function calculateTideRateOfChange(
  station: TideStation,
  timestamp: number
): number {
  const deltaMs = 5 * 60 * 1000; // 5 minute delta
  const h1 = calculateTideHeight(station, timestamp - deltaMs);
  const h2 = calculateTideHeight(station, timestamp + deltaMs);
  // (h2 - h1) meters in 10 minutes -> cm / hour
  const deltaHeightMeters = h2 - h1;
  const cmPerHour = (deltaHeightMeters * 100) / (10 / 60);
  return Math.round(cmPerHour * 10) / 10;
}

/**
 * Generates continuous tide curve points for charting over a range of hours.
 */
export function generateTideCurve(
  station: TideStation,
  startTime: number,
  durationHours: number,
  intervalMinutes: number = 15
): TidePoint[] {
  const points: TidePoint[] = [];
  const totalMinutes = durationHours * 60;

  for (let min = 0; min <= totalMinutes; min += intervalMinutes) {
    const time = startTime + min * 60 * 1000;
    const height = calculateTideHeight(station, time);
    const rate = calculateTideRateOfChange(station, time);
    const date = new Date(time);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    points.push({
      timestamp: time,
      timeString: `${hours}:${minutes}`,
      height,
      rateOfChange: rate,
    });
  }

  return points;
}

/**
 * Computes high water (Preia-mar) and low water (Baixa-mar) extremes for an interval.
 */
export function findTideExtremes(
  station: TideStation,
  startTime: number,
  durationHours: number
): TideExtreme[] {
  const extremes: TideExtreme[] = [];
  const stepMs = 3 * 60 * 1000; // 3 minute resolution
  const totalSteps = Math.floor((durationHours * 60 * 60 * 1000) / stepMs);

  let prevHeight = calculateTideHeight(station, startTime);
  let prevDiff = calculateTideHeight(station, startTime + stepMs) - prevHeight;

  for (let i = 1; i < totalSteps; i++) {
    const t = startTime + i * stepMs;
    const currHeight = calculateTideHeight(station, t);
    const nextHeight = calculateTideHeight(station, t + stepMs);
    const currDiff = nextHeight - currHeight;

    // Zero-crossing in derivative indicates local minimum or maximum
    if (prevDiff > 0 && currDiff <= 0) {
      // Local Maximum: Preia-mar
      const date = new Date(t);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      extremes.push({
        timestamp: t,
        timeString: `${hours}:${minutes}`,
        height: currHeight,
        type: 'preia-mar',
      });
    } else if (prevDiff < 0 && currDiff >= 0) {
      // Local Minimum: Baixa-mar
      const date = new Date(t);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      extremes.push({
        timestamp: t,
        timeString: `${hours}:${minutes}`,
        height: currHeight,
        type: 'baixa-mar',
      });
    }

    prevHeight = currHeight;
    prevDiff = currDiff;
  }

  return extremes;
}

/**
 * Computes accurate astronomical Moon Phase and spring/neap cycle info.
 * Known reference new moon: Jan 11, 2024, 11:57 UTC (approx timestamp 1704974220000)
 * Synodic month: 29.53058867 days
 */
export function getMoonPhaseInfo(timestamp: number): MoonPhaseInfo {
  const synodicMonthDays = 29.53058867;
  const refNewMoonMs = 1704974220000;
  const diffDays = (timestamp - refNewMoonMs) / (1000 * 60 * 60 * 24);
  const cycleDay = ((diffDays % synodicMonthDays) + synodicMonthDays) % synodicMonthDays;

  // Illumination calculation: 0% at new, 100% at full
  const phaseAngle = (cycleDay / synodicMonthDays) * 2 * Math.PI;
  const illumination = Math.round(((1 - Math.cos(phaseAngle)) / 2) * 100);

  let phaseName = 'Lua Nova';
  let phaseCode: MoonPhaseInfo['phaseCode'] = 'new';

  if (cycleDay < 1.84) {
    phaseName = 'Lua Nova';
    phaseCode = 'new';
  } else if (cycleDay < 5.53) {
    phaseName = 'Crescente Inicial';
    phaseCode = 'waxing_crescent';
  } else if (cycleDay < 9.22) {
    phaseName = 'Quarto Crescente';
    phaseCode = 'first_quarter';
  } else if (cycleDay < 12.91) {
    phaseName = 'Crescente Gibosa';
    phaseCode = 'waxing_gibbous';
  } else if (cycleDay < 16.61) {
    phaseName = 'Lua Cheia';
    phaseCode = 'full';
  } else if (cycleDay < 20.3) {
    phaseName = 'Minguante Gibosa';
    phaseCode = 'waning_gibbous';
  } else if (cycleDay < 23.99) {
    phaseName = 'Quarto Minguante';
    phaseCode = 'last_quarter';
  } else {
    phaseName = 'Minguante Final';
    phaseCode = 'waning_crescent';
  }

  // Spring tide (Sizígia) occurs around New Moon and Full Moon (+/- 2.5 days)
  const distFromNew = Math.min(cycleDay, synodicMonthDays - cycleDay);
  const distFromFull = Math.abs(cycleDay - synodicMonthDays / 2);
  const isSpringTide = distFromNew <= 2.2 || distFromFull <= 2.2;

  // Neap tide (Quadratura) occurs around First Quarter and Last Quarter
  const distFromFirstQ = Math.abs(cycleDay - synodicMonthDays * 0.25);
  const distFromLastQ = Math.abs(cycleDay - synodicMonthDays * 0.75);
  const isNeapTide = distFromFirstQ <= 2.0 || distFromLastQ <= 2.0;

  let springTideName: MoonPhaseInfo['springTideName'] = 'Intermediária';
  if (isSpringTide) {
    springTideName = 'Sizígia (Variação Máxima)';
  } else if (isNeapTide) {
    springTideName = 'Quadratura (Variação Mínima)';
  }

  return {
    phaseName,
    phaseCode,
    illumination,
    ageDays: Math.round(cycleDay * 10) / 10,
    isSpringTide,
    springTideName,
  };
}

/**
 * Computes full real-time tide status for the current moment.
 */
export function getCurrentTideStatus(
  station: TideStation,
  currentTime: number
): CurrentTideStatus {
  const currentHeight = calculateTideHeight(station, currentTime);
  const rateCmPerHour = calculateTideRateOfChange(station, currentTime);

  let tendency: 'enchente' | 'vazante' | 'estofo' = 'estofo';
  if (rateCmPerHour > 2) {
    tendency = 'enchente';
  } else if (rateCmPerHour < -2) {
    tendency = 'vazante';
  }

  // Find upcoming extremes in the next 18 hours
  const upcomingExtremes = findTideExtremes(station, currentTime, 18);
  const nextExtreme = upcomingExtremes[0] || {
    timestamp: currentTime + 3 * 3600 * 1000,
    timeString: '--:--',
    height: currentHeight,
    type: tendency === 'enchente' ? 'preia-mar' : 'baixa-mar',
  };
  const subsequentExtreme = upcomingExtremes[1] || {
    timestamp: currentTime + 9 * 3600 * 1000,
    timeString: '--:--',
    height: currentHeight,
    type: nextExtreme.type === 'preia-mar' ? 'baixa-mar' : 'preia-mar',
  };

  const moon = getMoonPhaseInfo(currentTime);

  // Rule of twelfths (Regra dos dozeavos):
  // 1st hour: 1/12
  // 2nd hour: 2/12
  // 3rd hour: 3/12 (peak flow)
  // 4th hour: 3/12 (peak flow)
  // 5th hour: 2/12
  // 6th hour: 1/12
  // Estimate current velocity in knots based on rate of change and station range
  const absRate = Math.abs(rateCmPerHour);
  // A typical tidal current peaks at ~1.5 - 3.5 knots during rapid mid-tide
  const estimatedCurrentKnots = Math.round((absRate / 22) * 10) / 10;

  // Approximate hour of cycle (1 to 6)
  const timeToNext = Math.max(0, nextExtreme.timestamp - currentTime);
  const hoursRemaining = timeToNext / (1000 * 60 * 60);
  const cycleHour = Math.min(6, Math.max(1, Math.round(6 - hoursRemaining)));

  return {
    currentHeight,
    tendency,
    rateCmPerHour,
    nextExtreme,
    subsequentExtreme,
    moon,
    ruleOfTwelfthsHour: cycleHour,
    estimatedCurrentKnots,
  };
}

/**
 * Calculates Under-Keel Clearance (Folga sob a quilha)
 * UKC = Charted Depth + Current Tide Height - Vessel Draft
 */
export function calculateUKC(
  chartedDepth: number,
  currentTideHeight: number,
  vesselDraft: number
): {
  ukc: number;
  actualDepth: number;
  safetyStatus: 'safe' | 'caution' | 'danger';
} {
  const actualDepth = Math.round((chartedDepth + currentTideHeight) * 100) / 100;
  const ukc = Math.round((actualDepth - vesselDraft) * 100) / 100;

  let safetyStatus: 'safe' | 'caution' | 'danger' = 'safe';
  if (ukc < 0.3) {
    safetyStatus = 'danger';
  } else if (ukc < 0.8) {
    safetyStatus = 'caution';
  }

  return {
    ukc,
    actualDepth,
    safetyStatus,
  };
}
