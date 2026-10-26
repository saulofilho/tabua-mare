import { describe, it, expect } from 'vitest';
import {
  calculateDistanceKm,
  kmToNauticalMiles,
  formatTemperature,
  celsiusToFahrenheit,
  getWeatherDescriptionFromCode,
  getBeaufortScale,
} from './realMarineApi';

describe('Arbitrary Coordinates & Marine Weather Utilities (realMarineApi)', () => {
  describe('Geodesic Distance & Nautical Conversions', () => {
    it('deve calcular a distância geodésica entre coordenadas arbitrárias com precisão (Haversine)', () => {
      // Salvador (-12.9714, -38.5014) até Santos (-23.9618, -46.3322) ~ 1450 km
      const distance = calculateDistanceKm(-12.9714, -38.5014, -23.9618, -46.3322);
      expect(distance).toBeGreaterThan(1400);
      expect(distance).toBeLessThan(1500);
    });

    it('distância entre o mesmo ponto deve ser exatamente 0 km', () => {
      const distance = calculateDistanceKm(-23.0, -43.0, -23.0, -43.0);
      expect(distance).toBe(0);
    });

    it('deve converter quilômetros para milhas náuticas com precisão náutica (1 MN = 1.852 km)', () => {
      // 18.52 km = 10.0 Milhas Náuticas
      const nauticalMiles = kmToNauticalMiles(18.52);
      expect(nauticalMiles).toBe(10);

      // 1.852 km = 1.0 Milha Náutica
      expect(kmToNauticalMiles(1.852)).toBe(1);
    });
  });

  describe('Temperature & Weather Formatter', () => {
    it('deve formatar temperaturas em Celsius e Fahrenheit corretamente', () => {
      expect(formatTemperature(25, 'C')).toBe('25.0°C');
      expect(formatTemperature(25, 'F')).toBe('77.0°F');
      expect(formatTemperature(0, 'C')).toBe('0.0°C');
      expect(formatTemperature(0, 'F')).toBe('32.0°F');
      expect(formatTemperature(undefined, 'C')).toBe('--');
    });

    it('deve converter Celsius para Fahrenheit de acordo com a fórmula clássica', () => {
      expect(celsiusToFahrenheit(100)).toBe(212);
      expect(celsiusToFahrenheit(0)).toBe(32);
      expect(celsiusToFahrenheit(-40)).toBe(-40);
    });

    it('deve traduzir códigos meteorológicos da WMO para descrições em português', () => {
      expect(getWeatherDescriptionFromCode(0)).toBe('Céu Limpo');
      expect(getWeatherDescriptionFromCode(1)).toBe('Predomínio de Sol');
      expect(getWeatherDescriptionFromCode(3)).toBe('Nublado');
      expect(getWeatherDescriptionFromCode(61)).toBe('Chuva Marítima');
      expect(getWeatherDescriptionFromCode(95)).toBe('Trovoadas na Costa');
    });

    it('deve calcular a escala Beaufort para intensidade do vento costeiro', () => {
      // Vento de 5 km/h (~2.7 nós) = Bafagem (Escala 1)
      const b1 = getBeaufortScale(5);
      expect(b1.scale).toBe(1);

      // Vento de 35 km/h (~18.9 nós) = Brisa Fresca (Escala 5)
      const b5 = getBeaufortScale(35);
      expect(b5.scale).toBe(5);
    });
  });
});
