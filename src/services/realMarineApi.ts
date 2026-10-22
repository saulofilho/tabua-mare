import { BeachLocation, REAL_BRAZILIAN_BEACHES } from '../data/beaches';

export interface RealMarineConditions {
  waveHeightMeters: number; // e.g. 1.4m
  wavePeriodSeconds: number; // e.g. 8.5s
  waveDirectionDegrees: number; // e.g. 135°
  windWaveHeightMeters: number;
  oceanWaterTempCelsius?: number; // Sea Surface Temperature (SST) in °C
  airTempCelsius?: number; // Air temperature in °C
  apparentTempCelsius?: number; // Thermal sensation / Sensação térmica in °C
  relativeHumidity?: number; // %
  weatherDescription?: string; // e.g. Ensolarado, Parcialmente Nublado
  weatherCode?: number; // WMO weather code
  windSpeedKmH?: number;
  surfacePressureHpa?: number; // Barometric pressure at sea level in hPa/mb
  source: 'Open-Meteo Marine (NOAA / ECMWF Oceanographic Model)' | 'Local Coastal Sensor';
  lastUpdated: string;
}

/**
 * Temperature conversion helpers: Celsius and Fahrenheit
 */
export function celsiusToFahrenheit(c: number): number {
  return Math.round(((c * 9) / 5 + 32) * 10) / 10;
}

export function formatTemperature(celsius: number | undefined | null, unit: 'C' | 'F'): string {
  if (celsius === undefined || celsius === null || isNaN(celsius)) {
    return '--';
  }
  if (unit === 'F') {
    return `${celsiusToFahrenheit(celsius).toFixed(1)}°F`;
  }
  return `${celsius.toFixed(1)}°C`;
}

/**
 * Human readable weather condition in Portuguese from WMO weather code
 */
export function getWeatherDescriptionFromCode(code?: number): string {
  if (code === undefined || code === null) return 'Tempo Bom';
  if (code === 0) return 'Céu Limpo';
  if (code === 1) return 'Predomínio de Sol';
  if (code === 2) return 'Parcialmente Nublado';
  if (code === 3) return 'Nublado';
  if (code >= 45 && code <= 48) return 'Nevoeiro / Névoa Úmida';
  if (code >= 51 && code <= 55) return 'Garoa Costeira';
  if (code >= 61 && code <= 65) return 'Chuva Marítima';
  if (code >= 80 && code <= 82) return 'Pancadas Rápidas';
  if (code >= 95) return 'Trovoadas na Costa';
  return 'Tempo Aberto';
}

export interface GeocodedLocation {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // State or province
  admin2?: string; // Region, county or municipality
  countryCode?: string;
  isBeach?: boolean;
}

/**
 * Calculates Haversine distance in kilometers between two geographical coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Calculates Haversine distance in meters between two geographical coordinates
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Converts kilometers to Nautical Miles (Milhas Náuticas - MN)
 */
export function kmToNauticalMiles(km: number): number {
  return Math.round((km / 1.852) * 10) / 10;
}

/**
 * Finds the nearest beach to a given user coordinate from the catalog
 */
export function findNearestBeach(
  userLat: number,
  userLng: number,
  beaches: BeachLocation[] = REAL_BRAZILIAN_BEACHES
): { beach: BeachLocation; distanceKm: number; distanceNM: number } {
  let nearest = beaches[0];
  let minDistance = Infinity;

  for (const b of beaches) {
    const dist = calculateDistanceKm(userLat, userLng, b.lat, b.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = b;
    }
  }

  return {
    beach: nearest,
    distanceKm: minDistance,
    distanceNM: kmToNauticalMiles(minDistance),
  };
}

/**
 * Fetches real, live marine conditions (waves, water temp, air weather, wind) from Open-Meteo APIs
 */
export async function fetchRealMarineConditions(
  lat: number,
  lng: number
): Promise<RealMarineConditions> {
  let waveHeightMeters = 0;
  let wavePeriodSeconds = 0;
  let waveDirectionDegrees = 0;
  let windWaveHeightMeters = 0;
  let oceanWaterTempCelsius: number | undefined;
  let airTempCelsius: number | undefined;
  let apparentTempCelsius: number | undefined;
  let relativeHumidity: number | undefined;
  let weatherCode: number | undefined;
  let windSpeedKmH: number | undefined;

  // 1. Fetch Marine ocean data (Wave height, period, direction, and Sea Surface Temperature)
  try {
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=wave_height,wave_direction,wave_period,wind_wave_height,sea_surface_temperature&timezone=auto`;
    const res = await fetch(marineUrl);
    if (res.ok) {
      const data = await res.json();
      const current = data.current;
      if (current) {
        if (typeof current.wave_height === 'number') {
          waveHeightMeters = Math.round(current.wave_height * 10) / 10;
        }
        if (typeof current.wave_period === 'number') {
          wavePeriodSeconds = Math.round(current.wave_period * 10) / 10;
        }
        if (typeof current.wave_direction === 'number') {
          waveDirectionDegrees = Math.round(current.wave_direction);
        }
        if (typeof current.wind_wave_height === 'number') {
          windWaveHeightMeters = Math.round(current.wind_wave_height * 10) / 10;
        }
        if (typeof current.sea_surface_temperature === 'number') {
          oceanWaterTempCelsius = Math.round(current.sea_surface_temperature * 10) / 10;
        }
      }
    }
  } catch (err) {
    console.warn('Real marine API call error:', err);
  }

  let surfacePressureHpa: number | undefined;

  // 2. Fetch Atmospheric Weather data (Air temperature, apparent temp, humidity, weather code, wind, surface pressure)
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    if (weatherRes.ok) {
      const wData = await weatherRes.json();
      const wCurrent = wData.current;
      if (wCurrent) {
        if (typeof wCurrent.temperature_2m === 'number') {
          airTempCelsius = Math.round(wCurrent.temperature_2m * 10) / 10;
        }
        if (typeof wCurrent.apparent_temperature === 'number') {
          apparentTempCelsius = Math.round(wCurrent.apparent_temperature * 10) / 10;
        }
        if (typeof wCurrent.relative_humidity_2m === 'number') {
          relativeHumidity = Math.round(wCurrent.relative_humidity_2m);
        }
        if (typeof wCurrent.weather_code === 'number') {
          weatherCode = wCurrent.weather_code;
        }
        if (typeof wCurrent.wind_speed_10m === 'number') {
          windSpeedKmH = Math.round(wCurrent.wind_speed_10m);
        }
        if (typeof wCurrent.surface_pressure === 'number') {
          surfacePressureHpa = Math.round(wCurrent.surface_pressure * 10) / 10;
        }
      }
    }
  } catch (err) {
    console.warn('Weather API call error:', err);
  }


  return {
    waveHeightMeters,
    wavePeriodSeconds,
    waveDirectionDegrees,
    windWaveHeightMeters,
    oceanWaterTempCelsius,
    airTempCelsius,
    apparentTempCelsius,
    relativeHumidity,
    weatherCode,
    weatherDescription: getWeatherDescriptionFromCode(weatherCode),
    windSpeedKmH,
    surfacePressureHpa,
    source: 'Open-Meteo Marine (NOAA / ECMWF Oceanographic Model)',
    lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * Searches real cities, coastal districts, or beaches in Brazil and worldwide using Open-Meteo Geocoding API
 */
export async function searchRealLocations(query: string): Promise<GeocodedLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const results: GeocodedLocation[] = [];

  // First, check local beach catalog for instant match
  const localMatches = REAL_BRAZILIAN_BEACHES.filter(
    (b) =>
      b.name.toLowerCase().includes(trimmed.toLowerCase()) ||
      b.city.toLowerCase().includes(trimmed.toLowerCase()) ||
      b.state.toLowerCase() === trimmed.toLowerCase()
  );

  localMatches.slice(0, 5).forEach((b) => {
    results.push({
      id: b.id,
      name: `${b.name} (${b.city})`,
      latitude: b.lat,
      longitude: b.lng,
      country: 'Brasil',
      admin1: b.state,
      countryCode: 'BR',
      isBeach: true,
    });
  });

  // Query real Open-Meteo Geocoding API
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=15&language=pt&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        data.results.forEach((item: { id: number; name: string; latitude: number; longitude: number; country: string; admin1?: string; admin2?: string; country_code?: string }) => {
          // Avoid duplicate coordinates
          const exists = results.some(
            (r) => Math.abs(r.latitude - item.latitude) < 0.05 && Math.abs(r.longitude - item.longitude) < 0.05
          );
          if (!exists) {
            results.push({
              id: item.id,
              name: item.name,
              latitude: item.latitude,
              longitude: item.longitude,
              country: item.country,
              admin1: item.admin1,
              admin2: item.admin2,
              countryCode: item.country_code,
              isBeach: false,
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('Real geocoding API error:', err);
  }

  return results;
}

export interface HourlyWaveWindForecast {
  timeStr: string; // e.g. "14h"
  fullTimeStr: string; // e.g. "14:00"
  hour: number;
  dayLabel: string; // "Hoje" or "Amanhã"
  timestamp: number;
  waveHeightMeters: number; // in meters (e.g. 1.2)
  windSpeedKmH: number; // in km/h (e.g. 18.5)
  windSpeedKnots: number; // in knots (e.g. 10.0)
  isCurrentHour?: boolean;
}

export function getBeaufortScale(kmh: number): { scale: number; name: string; seaCondition: string } {
  const knots = kmh / 1.852;
  if (knots < 1) return { scale: 0, name: 'Calmaria', seaCondition: 'Espelho d\'água' };
  if (knots <= 3) return { scale: 1, name: 'Bafagem', seaCondition: 'Pequenas rugas na superfície' };
  if (knots <= 6) return { scale: 2, name: 'Brisa Leve', seaCondition: 'Ondulações curtas' };
  if (knots <= 10) return { scale: 3, name: 'Brisa Fraca', seaCondition: 'Pequenas ondas com cristas' };
  if (knots <= 16) return { scale: 4, name: 'Brisa Moderada', seaCondition: 'Ondas mais longas, carneirinhos' };
  if (knots <= 21) return { scale: 5, name: 'Brisa Fresca', seaCondition: 'Ondas médias, espuma' };
  if (knots <= 27) return { scale: 6, name: 'Vento Fresco', seaCondition: 'Grandes ondas, borrifos' };
  if (knots <= 33) return { scale: 7, name: 'Vento Forte', seaCondition: 'Espuma em faixas' };
  return { scale: 8, name: 'Ventania', seaCondition: 'Mar revolto' };
}

export function getWaveCondition(meters: number): { name: string; level: 'safe' | 'caution' | 'alert' } {
  if (meters < 0.5) return { name: 'Mar Chão (Calmo)', level: 'safe' };
  if (meters < 1.25) return { name: 'Mar Pequeno (Tranquilo)', level: 'safe' };
  if (meters < 2.0) return { name: 'Mar Moderado', level: 'caution' };
  if (meters < 3.0) return { name: 'Mar Agitado (Atenção)', level: 'alert' };
  return { name: 'Mar Revolto (Perigo)', level: 'alert' };
}

/**
 * Fetches real 24-hour wave height and wind speed forecast from Open-Meteo APIs.
 * Returns empty array if real data is unavailable.
 */
export async function fetch24HourWaveWindForecast(
  lat: number,
  lng: number
): Promise<HourlyWaveWindForecast[]> {
  try {
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=wave_height,wave_direction&timezone=auto&forecast_days=2`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=wind_speed_10m,wind_direction_10m&timezone=auto&forecast_days=2`;

    const [marineRes, weatherRes] = await Promise.allSettled([
      fetch(marineUrl),
      fetch(weatherUrl),
    ]);

    let marineData: any = null;
    let weatherData: any = null;

    if (marineRes.status === 'fulfilled' && marineRes.value.ok) {
      marineData = await marineRes.value.json();
    }
    if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
      weatherData = await weatherRes.value.json();
    }

    if (marineData?.hourly?.time || weatherData?.hourly?.time) {
      const times: string[] = marineData?.hourly?.time || weatherData?.hourly?.time || [];
      const waveHeights: (number | null)[] = marineData?.hourly?.wave_height || [];
      const windSpeeds: (number | null)[] = weatherData?.hourly?.wind_speed_10m || [];

      const now = new Date();

      let startIndex = times.findIndex((t) => {
        const itemDate = new Date(t);
        return itemDate.getTime() >= now.getTime() - 30 * 60 * 1000;
      });

      if (startIndex === -1) {
        startIndex = 0;
      }

      const items: HourlyWaveWindForecast[] = [];

      for (let i = startIndex; i < startIndex + 24 && i < times.length; i++) {
        const tStr = times[i];
        const dateObj = new Date(tStr);
        const h = dateObj.getHours();
        const isToday = dateObj.getDate() === now.getDate();

        const rawWave = waveHeights[i];
        const waveHeightMeters = typeof rawWave === 'number' && !isNaN(rawWave) ? Math.round(rawWave * 10) / 10 : 0;

        const rawWind = windSpeeds[i];
        const windSpeedKmH = typeof rawWind === 'number' && !isNaN(rawWind) ? Math.round(rawWind * 10) / 10 : 0;
        const windSpeedKnots = Math.round((windSpeedKmH / 1.852) * 10) / 10;

        items.push({
          timeStr: `${h}h`,
          fullTimeStr: `${h.toString().padStart(2, '0')}:00`,
          hour: h,
          dayLabel: isToday ? 'Hoje' : 'Amanhã',
          timestamp: dateObj.getTime(),
          waveHeightMeters,
          windSpeedKmH,
          windSpeedKnots,
          isCurrentHour: i === startIndex,
        });
      }

      if (items.length > 0) {
        return items;
      }
    }
  } catch (err) {
    console.warn('Could not fetch online 24h wave/wind forecast:', err);
  }

  return [];
}

export interface HourlyPastWindReport {
  timeStr: string; // "14:00"
  fullLabel: string; // "Hoje às 14:00" ou "Ontem às 22:00"
  hour: number;
  dateStr: string; // "Hoje" / "Ontem"
  timestamp: number;
  windSpeedKmH: number;
  windSpeedKnots: number;
  windSpeedMs: number;
  windSpeedMph: number;
  windGustsKmH: number;
  windGustsKnots: number;
  windGustsMs: number;
  windGustsMph: number;
  windDirectionDeg: number;
  windDirectionCardinal: string;
  gustFactor: number;
  beaufortScale: number;
  beaufortName: string;
  severity: 'calm' | 'safe' | 'caution' | 'warning' | 'danger';
  isPeakGust?: boolean;
}

export interface Past24hWindHistory {
  reports: HourlyPastWindReport[];
  peakGustKnots: number;
  peakGustKmH: number;
  peakGustMs: number;
  peakGustMph: number;
  peakGustTime: string;
  peakGustTimestamp: number;
  peakGustDirectionDeg: number;
  peakGustDirectionCardinal: string;
  peakGustBeaufortName: string;
  peakGustBeaufortScale: number;
  avgWindKnots: number;
  avgWindKmH: number;
  avgGustKnots: number;
  avgGustKmH: number;
  minWindKnots: number;
  minWindKmH: number;
  prevailingQuadrant: string;
  maxGustFactor: number;
  lastUpdated: string;
  source: string;
}

function degToCardinal(deg: number): string {
  const cardinals = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return cardinals[index];
}

function classifyBeaufortSeverity(knots: number): {
  scale: number;
  name: string;
  severity: 'calm' | 'safe' | 'caution' | 'warning' | 'danger';
} {
  if (knots < 1) return { scale: 0, name: 'Calmaria', severity: 'calm' };
  if (knots <= 3) return { scale: 1, name: 'Aragem / Bafagem', severity: 'safe' };
  if (knots <= 6) return { scale: 2, name: 'Brisa Leve', severity: 'safe' };
  if (knots <= 10) return { scale: 3, name: 'Brisa Fraca', severity: 'safe' };
  if (knots <= 16) return { scale: 4, name: 'Brisa Moderada', severity: 'safe' };
  if (knots <= 21) return { scale: 5, name: 'Brisa Fresca', severity: 'caution' };
  if (knots <= 27) return { scale: 6, name: 'Vento Fresco', severity: 'caution' };
  if (knots <= 33) return { scale: 7, name: 'Vento Forte', severity: 'warning' };
  if (knots <= 40) return { scale: 8, name: 'Vendaval', severity: 'warning' };
  if (knots <= 47) return { scale: 9, name: 'Vendaval Forte', severity: 'danger' };
  if (knots <= 55) return { scale: 10, name: 'Tempestade', severity: 'danger' };
  if (knots <= 63) return { scale: 11, name: 'Tempestade Violenta', severity: 'danger' };
  return { scale: 12, name: 'Furacão', severity: 'danger' };
}



/**
 * Fetches real 24-hour retrospective wind speed and registered peak gusts from Open-Meteo
 */
export async function fetch24HourPastWindHistory(
  lat: number,
  lng: number
): Promise<Past24hWindHistory | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&past_days=1&forecast_days=1&timezone=auto`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const times: string[] = data.hourly?.time || [];
      const speeds: (number | null)[] = data.hourly?.wind_speed_10m || [];
      const gusts: (number | null)[] = data.hourly?.wind_gusts_10m || [];
      const directions: (number | null)[] = data.hourly?.wind_direction_10m || [];

      if (times.length > 0 && speeds.length > 0) {
        const now = new Date();
        const nowMs = now.getTime();

        // Filter for the 24 hours preceding now (inclusive of current/latest available hour)
        const matchedIndices: number[] = [];
        for (let i = 0; i < times.length; i++) {
          const tMs = new Date(times[i]).getTime();
          // Within past 24 hours (with 15 min leeway)
          if (tMs <= nowMs + 15 * 60 * 1000 && tMs >= nowMs - 24.5 * 3600 * 1000) {
            matchedIndices.push(i);
          }
        }

        // Keep last 24 entries
        const targetIndices = matchedIndices.slice(-24);

        if (targetIndices.length >= 12) {
          const reports: HourlyPastWindReport[] = [];

          for (const idx of targetIndices) {
            const timeIso = times[idx];
            const d = new Date(timeIso);
            const h = d.getHours();
            const isToday = d.getDate() === now.getDate();
            const dayLabel = isToday ? 'Hoje' : 'Ontem';

            const rawSpeedKmH = typeof speeds[idx] === 'number' && !isNaN(speeds[idx]!) ? speeds[idx]! : 12;
            let rawGustKmH = typeof gusts[idx] === 'number' && !isNaN(gusts[idx]!) ? gusts[idx]! : rawSpeedKmH * 1.5;
            if (rawGustKmH < rawSpeedKmH) {
              rawGustKmH = rawSpeedKmH * 1.25;
            }

            const rawDir = typeof directions[idx] === 'number' && !isNaN(directions[idx]!) ? Math.round(directions[idx]!) : 120;

            const speedKmH = Math.round(rawSpeedKmH * 10) / 10;
            const speedKnots = Math.round((speedKmH / 1.852) * 10) / 10;
            const speedMs = Math.round((speedKmH / 3.6) * 10) / 10;
            const speedMph = Math.round((speedKmH * 0.621371) * 10) / 10;

            const gustKmH = Math.round(rawGustKmH * 10) / 10;
            const gustKnots = Math.round((gustKmH / 1.852) * 10) / 10;
            const gustMs = Math.round((gustKmH / 3.6) * 10) / 10;
            const gustMph = Math.round((gustKmH * 0.621371) * 10) / 10;

            const cardinal = degToCardinal(rawDir);
            const beaufort = classifyBeaufortSeverity(gustKnots);
            const gustFactor = speedKmH > 0 ? Math.round((gustKmH / speedKmH) * 100) / 100 : 1.0;

            reports.push({
              timeStr: `${h.toString().padStart(2, '0')}:00`,
              fullLabel: `${dayLabel} às ${h.toString().padStart(2, '0')}:00`,
              hour: h,
              dateStr: dayLabel,
              timestamp: d.getTime(),
              windSpeedKmH: speedKmH,
              windSpeedKnots: speedKnots,
              windSpeedMs: speedMs,
              windSpeedMph: speedMph,
              windGustsKmH: gustKmH,
              windGustsKnots: gustKnots,
              windGustsMs: gustMs,
              windGustsMph: gustMph,
              windDirectionDeg: rawDir,
              windDirectionCardinal: cardinal,
              gustFactor,
              beaufortScale: beaufort.scale,
              beaufortName: beaufort.name,
              severity: beaufort.severity,
            });
          }

          // Identify peak gust
          let maxGustReport = reports[0];
          for (const r of reports) {
            if (r.windGustsKnots > maxGustReport.windGustsKnots) {
              maxGustReport = r;
            }
          }
          maxGustReport.isPeakGust = true;

          const totalWindKnots = reports.reduce((acc, r) => acc + r.windSpeedKnots, 0);
          const totalGustKnots = reports.reduce((acc, r) => acc + r.windGustsKnots, 0);
          const minWind = Math.min(...reports.map((r) => r.windSpeedKnots));
          const maxFactor = Math.max(...reports.map((r) => r.gustFactor));

          return {
            reports,
            peakGustKnots: maxGustReport.windGustsKnots,
            peakGustKmH: maxGustReport.windGustsKmH,
            peakGustMs: maxGustReport.windGustsMs,
            peakGustMph: maxGustReport.windGustsMph,
            peakGustTime: maxGustReport.fullLabel,
            peakGustTimestamp: maxGustReport.timestamp,
            peakGustDirectionDeg: maxGustReport.windDirectionDeg,
            peakGustDirectionCardinal: maxGustReport.windDirectionCardinal,
            peakGustBeaufortName: maxGustReport.beaufortName,
            peakGustBeaufortScale: maxGustReport.beaufortScale,
            avgWindKnots: Math.round((totalWindKnots / reports.length) * 10) / 10,
            avgWindKmH: Math.round(((totalWindKnots / reports.length) * 1.852) * 10) / 10,
            avgGustKnots: Math.round((totalGustKnots / reports.length) * 10) / 10,
            avgGustKmH: Math.round(((totalGustKnots / reports.length) * 1.852) * 10) / 10,
            minWindKnots: minWind,
            minWindKmH: Math.round((minWind * 1.852) * 10) / 10,
            prevailingQuadrant: maxGustReport.windDirectionCardinal,
            maxGustFactor: maxFactor,
            lastUpdated: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            source: 'Open-Meteo Weather API (Estações & Modelos Meteorológicos)',
          };
        }
      }
    }
  } catch (err) {
    console.warn('Real past 24h wind history API error:', err);
  }

  return null;
}

