import { describe, it, expect } from 'vitest';
import {
  calculateTideHeight,
  calculateTideRateOfChange,
  findTideExtremes,
  generateTideCurve,
  getMoonPhaseInfo,
  getCurrentTideStatus,
  calculateUKC,
} from './tideHarmonics';
import { TIDE_STATIONS } from '../data/tideStations';
import { TideStation } from '../types/tide';

describe('Harmonic Tide Calculation Module (tideHarmonics)', () => {
  const salvadorStation = TIDE_STATIONS[0]; // salvador-bts (semidiurnal)
  const santosStation = TIDE_STATIONS[1] || TIDE_STATIONS[0];

  // Estação sintética controlada para testes analíticos precisos
  const mockSimpleStation: TideStation = {
    id: 'test-station',
    name: 'Estação de Teste Simples',
    portName: 'Porto de Teste',
    state: 'TS',
    lat: -23.0,
    lng: -43.0,
    meanSeaLevel: 1.5,
    datumDescription: 'Zero Hidrográfico (0.00m)',
    tidalType: 'semidiurnal',
    averageRange: 2.0,
    recommendedMaxDraft: 4.0,
    offlineSizeMB: 10,
    tileCountEstimate: 50,
    constituents: {
      m2: { amp: 1.0, phase: 0.0 }, // período ~12.42h
      s2: { amp: 0.0, phase: 0.0 },
      n2: { amp: 0.0, phase: 0.0 },
      k1: { amp: 0.0, phase: 0.0 },
      o1: { amp: 0.0, phase: 0.0 },
      m4: { amp: 0.0, phase: 0.0 },
    },
    hazards: [],
  };

  describe('calculateTideHeight()', () => {
    it('deve retornar exatamente o Nível Médio do Mar quando todas as amplitudes forem zero', () => {
      const flatStation: TideStation = {
        ...mockSimpleStation,
        meanSeaLevel: 1.45,
        constituents: {
          m2: { amp: 0, phase: 0 },
          s2: { amp: 0, phase: 0 },
          n2: { amp: 0, phase: 0 },
          k1: { amp: 0, phase: 0 },
          o1: { amp: 0, phase: 0 },
          m4: { amp: 0, phase: 0 },
        },
      };

      const height = calculateTideHeight(flatStation, Date.now());
      expect(height).toBe(1.45);
    });

    it('deve respeitar os limites teóricos máximos e mínimos da estação', () => {
      const totalAmp =
        salvadorStation.constituents.m2.amp +
        salvadorStation.constituents.s2.amp +
        salvadorStation.constituents.n2.amp +
        salvadorStation.constituents.k1.amp +
        salvadorStation.constituents.o1.amp +
        salvadorStation.constituents.m4.amp;

      const theoreticalMax = salvadorStation.meanSeaLevel + totalAmp + 0.05;
      const theoreticalMin = Math.max(0, salvadorStation.meanSeaLevel - totalAmp - 0.05);

      const baseTime = 1714500000000;
      for (let h = 0; h < 48; h += 2) {
        const t = baseTime + h * 3600 * 1000;
        const height = calculateTideHeight(salvadorStation, t);
        expect(height).toBeGreaterThanOrEqual(theoreticalMin);
        expect(height).toBeLessThanOrEqual(theoreticalMax);
        expect(height).toBeGreaterThanOrEqual(0); // Nunca negativo sobre o datum
      }
    });

    it('deve respeitar a periodicidade de 12 horas da componente solar S2', () => {
      const s2Station: TideStation = {
        ...mockSimpleStation,
        meanSeaLevel: 1.2,
        constituents: {
          m2: { amp: 0, phase: 0 },
          s2: { amp: 0.8, phase: 45.0 }, // velocidade = 30°/h -> período = 360/30 = 12h
          n2: { amp: 0, phase: 0 },
          k1: { amp: 0, phase: 0 },
          o1: { amp: 0, phase: 0 },
          m4: { amp: 0, phase: 0 },
        },
      };

      const t0 = 1714500000000;
      const t12h = t0 + 12 * 3600 * 1000;
      const t24h = t0 + 24 * 3600 * 1000;

      const h0 = calculateTideHeight(s2Station, t0);
      const h12 = calculateTideHeight(s2Station, t12h);
      const h24 = calculateTideHeight(s2Station, t24h);

      expect(h0).toBeCloseTo(h12, 2);
      expect(h0).toBeCloseTo(h24, 2);
    });

    it('deve arredondar o resultado para 2 casas decimais', () => {
      const height = calculateTideHeight(salvadorStation, 1714567890123);
      const decimalCount = (height.toString().split('.')[1] || '').length;
      expect(decimalCount).toBeLessThanOrEqual(2);
    });
  });

  describe('calculateTideRateOfChange()', () => {
    it('deve retornar taxa positiva durante a enchente e negativa durante a vazante', () => {
      // Localiza um ponto de enchente e vazante ao longo de 24 horas
      const baseTime = 1714500000000;
      let foundEnchente = false;
      let foundVazante = false;

      for (let m = 0; m < 24 * 60; m += 30) {
        const t = baseTime + m * 60 * 1000;
        const rate = calculateTideRateOfChange(salvadorStation, t);
        if (rate > 5) foundEnchente = true;
        if (rate < -5) foundVazante = true;
      }

      expect(foundEnchente).toBe(true);
      expect(foundVazante).toBe(true);
    });

    it('deve ser aproximadamente zero próximo aos estofos de maré (extremos)', () => {
      const extremes = findTideExtremes(salvadorStation, 1714500000000, 24);
      expect(extremes.length).toBeGreaterThan(0);

      for (const ext of extremes) {
        const rateAtExtreme = calculateTideRateOfChange(salvadorStation, ext.timestamp);
        // Próximo à preamar ou baixamar, a derivada dh/dt deve estar próxima de 0 (estofo)
        expect(Math.abs(rateAtExtreme)).toBeLessThanOrEqual(4.0); // Tolerância de 4 cm/h devido à discretização de 3min
      }
    });
  });

  describe('findTideExtremes() - Preamar e Baixamar', () => {
    it('deve detectar preamar e baixamar alternadas em um ciclo semidiurno de 24 horas', () => {
      const startTime = 1714500000000;
      const extremes = findTideExtremes(salvadorStation, startTime, 24);

      // Em um porto semidiurno típico como Salvador, há entre 3 e 4 extremos em 24h
      expect(extremes.length).toBeGreaterThanOrEqual(3);
      expect(extremes.length).toBeLessThanOrEqual(5);

      // Os tipos de extremos devem alternar rigorosamente entre preia-mar e baixa-mar
      for (let i = 0; i < extremes.length - 1; i++) {
        expect(extremes[i].type).not.toBe(extremes[i + 1].type);
      }
    });

    it('toda preia-mar deve ter altura maior do que as baixas-mares adjacentes', () => {
      const extremes = findTideExtremes(salvadorStation, 1714500000000, 48);

      for (let i = 0; i < extremes.length - 1; i++) {
        const curr = extremes[i];
        const next = extremes[i + 1];

        if (curr.type === 'preia-mar' && next.type === 'baixa-mar') {
          expect(curr.height).toBeGreaterThan(next.height);
          // A amplitude em Salvador varia tipicamente entre 1.0m e 2.8m
          expect(curr.height - next.height).toBeGreaterThanOrEqual(0.6);
        } else if (curr.type === 'baixa-mar' && next.type === 'preia-mar') {
          expect(next.height).toBeGreaterThan(curr.height);
          expect(next.height - curr.height).toBeGreaterThanOrEqual(0.6);
        }
      }
    });

    it('o intervalo médio entre extremos consecutivos deve ser de aproximadamente 6.2 horas', () => {
      const extremes = findTideExtremes(salvadorStation, 1714500000000, 48);

      const intervalsHours: number[] = [];
      for (let i = 0; i < extremes.length - 1; i++) {
        const diffHours = (extremes[i + 1].timestamp - extremes[i].timestamp) / (1000 * 3600);
        intervalsHours.push(diffHours);
      }

      const avgInterval = intervalsHours.reduce((a, b) => a + b, 0) / intervalsHours.length;
      // Período semidiurno = 12.42h, intervalo entre PM e BM = 12.42 / 2 = 6.21h
      expect(avgInterval).toBeGreaterThanOrEqual(5.5);
      expect(avgInterval).toBeLessThanOrEqual(6.8);
    });

    it('deve gerar timeString formatada corretamente no padrão HH:MM', () => {
      const extremes = findTideExtremes(salvadorStation, 1714500000000, 12);
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

      for (const ext of extremes) {
        expect(ext.timeString).toMatch(timeRegex);
      }
    });

    it('deve calcular preamar e baixamar de forma consistente para todas as estações oficiais da DHN', () => {
      const sampleStations = TIDE_STATIONS.slice(0, 5); // Salvador, Santos, Rio, Paranaguá, Recife
      const startTime = 1714500000000;

      for (const st of sampleStations) {
        const extremes = findTideExtremes(st, startTime, 24);
        expect(extremes.length).toBeGreaterThanOrEqual(2);
        expect(extremes.length).toBeLessThanOrEqual(5);

        // Verifica que as alturas dos extremos calculados coincidem com calculateTideHeight
        for (const ext of extremes) {
          const directHeight = calculateTideHeight(st, ext.timestamp);
          expect(ext.height).toBeCloseTo(directHeight, 2);
        }
      }
    });
  });

  describe('generateTideCurve()', () => {
    it('deve gerar a quantidade correta de pontos para um intervalo de 24h a cada 15 minutos', () => {
      const startTime = 1714500000000;
      const points = generateTideCurve(salvadorStation, startTime, 24, 15);

      // 24 horas * 4 pontos por hora + 1 ponto inicial = 97 pontos
      expect(points.length).toBe(97);
      expect(points[0].timestamp).toBe(startTime);
      expect(points[points.length - 1].timestamp).toBe(startTime + 24 * 3600 * 1000);
    });

    it('cada ponto da curva deve conter timestamp, timeString, height e rateOfChange válidos', () => {
      const points = generateTideCurve(salvadorStation, 1714500000000, 6, 30);

      for (const pt of points) {
        expect(pt.timestamp).toBeGreaterThan(0);
        expect(pt.timeString).toMatch(/^\d{2}:\d{2}$/);
        expect(pt.height).toBeGreaterThanOrEqual(0);
        expect(typeof pt.rateOfChange).toBe('number');
      }
    });
  });

  describe('getMoonPhaseInfo()', () => {
    it('deve identificar corretamente a Lua Nova na data de referência', () => {
      // 11 de Janeiro de 2024 às 11:57 UTC = 1704974220000
      const refNewMoon = 1704974220000;
      const moon = getMoonPhaseInfo(refNewMoon);

      expect(moon.phaseCode).toBe('new');
      expect(moon.illumination).toBeLessThanOrEqual(2);
      expect(moon.isSpringTide).toBe(true);
      expect(moon.springTideName).toContain('Sizígia');
    });

    it('deve identificar a Lua Cheia aproximadamente 14.76 dias após a Lua Nova', () => {
      const refNewMoon = 1704974220000;
      const fullMoonTime = refNewMoon + 14.765 * 24 * 3600 * 1000;
      const moon = getMoonPhaseInfo(fullMoonTime);

      expect(moon.phaseCode).toBe('full');
      expect(moon.illumination).toBeGreaterThanOrEqual(95);
      expect(moon.isSpringTide).toBe(true);
      expect(moon.springTideName).toContain('Sizígia');
    });

    it('deve identificar Quadratura (Neap Tide) no Quarto Crescente', () => {
      const refNewMoon = 1704974220000;
      const firstQuarterTime = refNewMoon + 7.38 * 24 * 3600 * 1000;
      const moon = getMoonPhaseInfo(firstQuarterTime);

      expect(moon.phaseCode).toBe('first_quarter');
      expect(moon.illumination).toBeGreaterThanOrEqual(40);
      expect(moon.illumination).toBeLessThanOrEqual(60);
      expect(moon.springTideName).toContain('Quadratura');
    });
  });

  describe('getCurrentTideStatus()', () => {
    it('deve prever o próximo e subsequente extremos com tipos opostos', () => {
      const status = getCurrentTideStatus(salvadorStation, 1714500000000);

      expect(status.currentHeight).toBeGreaterThanOrEqual(0);
      expect(['enchente', 'vazante', 'estofo']).toContain(status.tendency);
      expect(status.nextExtreme.timestamp).toBeGreaterThanOrEqual(1714500000000);
      expect(status.subsequentExtreme.timestamp).toBeGreaterThan(status.nextExtreme.timestamp);
      expect(status.nextExtreme.type).not.toBe(status.subsequentExtreme.type);
    });

    it('deve estimar a hora da regra dos dozeavos entre 1 e 6', () => {
      const status = getCurrentTideStatus(salvadorStation, 1714500000000);
      expect(status.ruleOfTwelfthsHour).toBeGreaterThanOrEqual(1);
      expect(status.ruleOfTwelfthsHour).toBeLessThanOrEqual(6);
    });

    it('deve estimar velocidade de correnteza coerente (>= 0 nós)', () => {
      const status = getCurrentTideStatus(salvadorStation, 1714500000000);
      expect(status.estimatedCurrentKnots).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateUKC() - Folga sob a Quilha', () => {
    it('deve calcular a profundidade real e a folga com precisão', () => {
      // Sondagem da carta = 5.00m, Maré atual = 1.50m, Calado do barco = 2.00m
      // Profundidade real = 5.00 + 1.50 = 6.50m
      // UKC = 6.50 - 2.00 = 4.50m
      const result = calculateUKC(5.0, 1.5, 2.0);

      expect(result.actualDepth).toBe(6.5);
      expect(result.ukc).toBe(4.5);
      expect(result.safetyStatus).toBe('safe');
    });

    it('deve classificar como "danger" quando a folga for inferior a 0.30m', () => {
      // Sondagem = 1.0m, Maré = 0.5m, Calado = 1.3m -> Profundidade = 1.5m -> UKC = 0.2m (< 0.3m)
      const result = calculateUKC(1.0, 0.5, 1.3);

      expect(result.ukc).toBe(0.2);
      expect(result.safetyStatus).toBe('danger');
    });

    it('deve classificar como "caution" quando a folga estiver entre 0.30m e 0.80m', () => {
      // Sondagem = 2.0m, Maré = 0.0m, Calado = 1.5m -> Profundidade = 2.0m -> UKC = 0.5m
      const result = calculateUKC(2.0, 0.0, 1.5);

      expect(result.ukc).toBe(0.5);
      expect(result.safetyStatus).toBe('caution');
    });
  });
});
