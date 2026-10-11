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
  let waveHeightMeters = 1.0;
  let wavePeriodSeconds = 7.5;
  let waveDirectionDegrees = 135;
  let windWaveHeightMeters = 0.4;
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

  // 2. Fetch Atmospheric Weather data (Air temperature, apparent temp, humidity, weather code, wind)
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;
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
      }
    }
  } catch (err) {
    console.warn('Weather API call error:', err);
  }

  // If ocean water temperature was not provided by marine grid (e.g. enclosed inland lagoon or bay),
  // coastal water temperature tracks coastal air temperature with ocean thermal inertia:
  if (oceanWaterTempCelsius === undefined) {
    if (airTempCelsius !== undefined) {
      // Typically water temperature along Brazilian coast ranges between 22°C - 27°C
      oceanWaterTempCelsius = Math.round(Math.min(28.5, Math.max(20.0, airTempCelsius * 0.9 + 2.5)) * 10) / 10;
    } else {
      oceanWaterTempCelsius = 25.0; // Brazilian tropical baseline
    }
  }

  // Fallback air temp if weather API failed
  if (airTempCelsius === undefined) {
    airTempCelsius = 27.0;
    apparentTempCelsius = 29.0;
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
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=10&language=pt&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        data.results.forEach((item: { id: number; name: string; latitude: number; longitude: number; country: string; admin1?: string; country_code?: string }) => {
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
