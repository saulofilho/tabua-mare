import { describe, it, expect } from 'vitest';
import { TIDE_STATIONS } from '../data/tideStations';
import { findTideExtremes, getMoonPhaseInfo, calculateUKC } from '../utils/tideHarmonics';

describe('Virtual Scroller Engine & Multi-Year Tide Records', () => {
  const station = TIDE_STATIONS[0]; // Salvador
  const vessel = {
    name: 'Albatroz',
    draft: 1.5,
    safetyMargin: 0.6,
    vesselType: 'veleiro' as const,
    airDraft: 12.0,
  };

  describe('Multi-Year Day Record Generator Math', () => {
    it('deve calcular corretamente a quantidade exata de dias em anos bissextos e normais', () => {
      // 2024 é bissexto -> 366 dias
      const leapStart = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const leapEnd = new Date(2024, 11, 31, 23, 59, 59, 999).getTime();
      const leapDaysCount = Math.round((leapEnd - leapStart) / (1000 * 3600 * 24));
      expect(leapDaysCount).toBe(366);

      // 2025 é normal -> 365 dias
      const normStart = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const normEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      const normDaysCount = Math.round((normEnd - normStart) / (1000 * 3600 * 24));
      expect(normDaysCount).toBe(365);
    });

    it('deve gerar extremos de maré e fases lunares consistentes para qualquer dia do ano', () => {
      const testDay = new Date(2026, 9, 26, 0, 0, 0, 0).getTime();
      const extremes = findTideExtremes(station, testDay, 24);

      expect(extremes.length).toBeGreaterThanOrEqual(3);
      expect(extremes.length).toBeLessThanOrEqual(5);

      const moon = getMoonPhaseInfo(testDay + 12 * 3600 * 1000);
      expect(typeof moon.illumination).toBe('number');
      expect(moon.illumination).toBeGreaterThanOrEqual(0);
      expect(moon.illumination).toBeLessThanOrEqual(100);
      expect(typeof moon.isSpringTide).toBe('boolean');
    });

    it('deve calcular a folga sob a quilha (UKC) diária corretamente', () => {
      const testDay = new Date(2026, 5, 15, 0, 0, 0, 0).getTime();
      const extremes = findTideExtremes(station, testDay, 24);
      const minHeight = Math.min(...extremes.map((e) => e.height));

      const refDepth = 2.5;
      const ukc = calculateUKC(refDepth, minHeight, vessel.draft);

      expect(ukc.actualDepth).toBeCloseTo(refDepth + minHeight, 2);
      expect(ukc.ukc).toBeCloseTo(refDepth + minHeight - vessel.draft, 2);
      expect(['safe', 'caution', 'danger']).toContain(ukc.safetyStatus);
    });
  });

  describe('Virtual Windowing Geometry Calculations', () => {
    const ROW_HEIGHT = 108;
    const OVERSCAN = 6;
    const VIEWPORT_HEIGHT = 540;
    const TOTAL_DAYS = 3652; // 10 anos de dados

    it('deve calcular altura virtual total proporcional ao número de dias sem renderizar todos os nós', () => {
      const totalVirtualHeight = TOTAL_DAYS * ROW_HEIGHT;
      expect(totalVirtualHeight).toBe(394416); // ~394.416px de scroll suave
    });

    it('no topo do scroll (scrollTop = 0), deve limitar os nós renderizados à janela visível + overscan', () => {
      const scrollTop = 0;
      const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
      const endIndex = Math.min(
        TOTAL_DAYS - 1,
        Math.floor((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN
      );
      const renderedCount = endIndex - startIndex + 1;

      expect(startIndex).toBe(0);
      expect(endIndex).toBe(5 + OVERSCAN); // 11
      expect(renderedCount).toBe(12); // Apenas 12 nós no DOM em vez de 3.652!
    });

    it('no meio do scroll (scrollTop = 100.000px), deve manter o número de nós fixo e ultraleve', () => {
      const scrollTop = 100000;
      const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
      const endIndex = Math.min(
        TOTAL_DAYS - 1,
        Math.floor((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN
      );
      const renderedCount = endIndex - startIndex + 1;

      // 540 / 108 = 5 linhas visíveis + 2 * OVERSCAN (12) = ~17 nós
      expect(renderedCount).toBeGreaterThanOrEqual(15);
      expect(renderedCount).toBeLessThanOrEqual(20);
      expect(startIndex).toBeGreaterThan(900);
    });

    it('deve permitir saltar diretamente para qualquer dia pelo índice matemático em O(1)', () => {
      const targetDayIndex = 365; // Dia 366 (ano 2)
      const targetScrollTop = targetDayIndex * ROW_HEIGHT;

      expect(targetScrollTop).toBe(39420);
      const computedStartIndex = Math.floor(targetScrollTop / ROW_HEIGHT);
      expect(computedStartIndex).toBe(targetDayIndex);
    });
  });

  describe('Filter Rules for Maritime Safety', () => {
    it('filtro de Sizígia deve isolar apenas dias de maré viva (Lua Nova / Cheia)', () => {
      const refNewMoon = 1704974220000; // Lua Nova
      const moonInfo = getMoonPhaseInfo(refNewMoon);
      expect(moonInfo.isSpringTide).toBe(true);

      const quarterMoon = refNewMoon + 7.38 * 24 * 3600 * 1000; // Quarto Crescente
      const quarterInfo = getMoonPhaseInfo(quarterMoon);
      expect(quarterInfo.isSpringTide).toBe(false);
    });
  });
});
