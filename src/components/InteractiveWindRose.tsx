import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Compass,
  Wind,
  RotateCw,
  Info,
  Zap,
  ShieldCheck,
  ShieldAlert,
  ArrowUp,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import {
  fetch24HourPastWindHistory,
  Past24hWindHistory,
  HourlyPastWindReport,
} from '../services/realMarineApi';

export interface InteractiveWindRoseProps {
  lat: number;
  lng: number;
  locationName?: string;
  initialWindHistory?: Past24hWindHistory | null;
  className?: string;
}

// Definição dos 16 rumos da rosa dos ventos náutica (padrão DHN / Marinha do Brasil)
export interface WindRoseSector {
  id: string;
  cardinal: string; // ex: "N", "NNE", "NE"
  namePt: string; // "Norte", "Norte-Nordeste", etc.
  centerDeg: number; // 0, 22.5, 45, etc.
  startDeg: number;
  endDeg: number;
  count: number;
  percentage: number;
  avgSpeedKnots: number;
  avgSpeedKmH: number;
  maxGustKnots: number;
  maxGustKmH: number;
  reports: HourlyPastWindReport[];
}

const SECTOR_DEFINITIONS = [
  { id: 'N', cardinal: 'N', namePt: 'Norte', deg: 0 },
  { id: 'NNE', cardinal: 'NNE', namePt: 'Norte-Nordeste', deg: 22.5 },
  { id: 'NE', cardinal: 'NE', namePt: 'Nordeste', deg: 45 },
  { id: 'ENE', cardinal: 'ENE', namePt: 'Leste-Nordeste', deg: 67.5 },
  { id: 'E', cardinal: 'L', namePt: 'Leste', deg: 90 }, // 'L' para padrão português
  { id: 'ESE', cardinal: 'LSE', namePt: 'Leste-Sudeste', deg: 112.5 },
  { id: 'SE', cardinal: 'SE', namePt: 'Sudeste', deg: 135 },
  { id: 'SSE', cardinal: 'SSE', namePt: 'Sul-Sudeste', deg: 157.5 },
  { id: 'S', cardinal: 'S', namePt: 'Sul', deg: 180 },
  { id: 'SSW', cardinal: 'SSO', namePt: 'Sul-Sudoeste', deg: 202.5 },
  { id: 'SW', cardinal: 'SO', namePt: 'Sudoeste', deg: 225 },
  { id: 'WSW', cardinal: 'OSO', namePt: 'Oeste-Sudoeste', deg: 247.5 },
  { id: 'W', cardinal: 'O', namePt: 'Oeste', deg: 270 },
  { id: 'WNW', cardinal: 'ONO', namePt: 'Oeste-Noroeste', deg: 292.5 },
  { id: 'NW', cardinal: 'NO', namePt: 'Noroeste', deg: 315 },
  { id: 'NNW', cardinal: 'NNO', namePt: 'Norte-Noroeste', deg: 337.5 },
];

// Cor de acordo com velocidade em nós
function getWindColor(knots: number, isDark = false): string {
  if (knots < 4) return isDark ? '#38bdf8' : '#0284c7'; // Calmaria / Brisa Leve (Azul)
  if (knots < 11) return isDark ? '#4ade80' : '#16a34a'; // Brisa Fraca a Moderada (Verde)
  if (knots < 17) return isDark ? '#facc15' : '#ca8a04'; // Brisa Moderada (Amarelo ouro)
  if (knots < 22) return isDark ? '#fb923c' : '#ea580c'; // Brisa Fresca (Laranja)
  if (knots < 28) return isDark ? '#f87171' : '#dc2626'; // Vento Forte (Vermelho)
  return isDark ? '#c084fc' : '#9333ea'; // Muito Forte / Tempestade (Púrpura)
}

export const InteractiveWindRose: React.FC<InteractiveWindRoseProps> = ({
  lat,
  lng,
  locationName = 'Local de Referência',
  initialWindHistory = null,
  className = '',
}) => {
  const [history, setHistory] = useState<Past24hWindHistory | null>(initialWindHistory);
  const [loading, setLoading] = useState<boolean>(!initialWindHistory);
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);
  const [displayMetric, setDisplayMetric] = useState<'frequency' | 'speed'>('frequency');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch24HourPastWindHistory(lat, lng);
      setHistory(res);
    } catch (err) {
      console.warn('Erro ao carregar telemetria de vento 24h para rosa dos ventos:', err);
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    if (!initialWindHistory) {
      loadData();
    } else {
      setHistory(initialWindHistory);
    }
  }, [initialWindHistory, loadData]);

  // Processar distribuição dos 16 setores e direção vetorial predominante
  const { sectors, prevailingSector, vectorDeg, maxSectorFreq, maxSectorSpeed, totalReportsCount } = useMemo(() => {
    if (!history || !history.reports || history.reports.length === 0) {
      return {
        sectors: [],
        prevailingSector: null,
        vectorDeg: 0,
        maxSectorFreq: 0,
        maxSectorSpeed: 0,
        totalReportsCount: 0,
      };
    }

    const reports = history.reports;
    const totalCount = reports.length;

    // Inicializar baldes dos 16 setores
    const sectorBuckets = SECTOR_DEFINITIONS.map((def) => {
      const half = 11.25;
      const startDeg = (def.deg - half + 360) % 360;
      const endDeg = (def.deg + half) % 360;
      return {
        ...def,
        startDeg,
        endDeg,
        reports: [] as HourlyPastWindReport[],
      };
    });

    let sumSin = 0;
    let sumCos = 0;

    // Distribuir cada registro horária no setor correspondente
    reports.forEach((rep) => {
      const deg = ((rep.windDirectionDeg % 360) + 360) % 360;
      const rad = (deg * Math.PI) / 180;
      sumSin += Math.sin(rad);
      sumCos += Math.cos(rad);

      // Determinar índice do setor mais próximo (0 a 15)
      const sectorIndex = Math.round(deg / 22.5) % 16;
      sectorBuckets[sectorIndex].reports.push(rep);
    });

    // Direção vetorial média ponderada
    let meanDeg = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
    if (meanDeg < 0) meanDeg += 360;
    meanDeg = Math.round(meanDeg);

    // Calcular estatísticas para cada setor
    let maxFreq = 0;
    let maxSpeed = 0;

    const computedSectors: WindRoseSector[] = sectorBuckets.map((b) => {
      const count = b.reports.length;
      const percentage = totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0;
      if (count > maxFreq) maxFreq = count;

      const sumKnots = b.reports.reduce((acc, r) => acc + r.windSpeedKnots, 0);
      const sumKmH = b.reports.reduce((acc, r) => acc + r.windSpeedKmH, 0);
      const avgKnots = count > 0 ? Math.round((sumKnots / count) * 10) / 10 : 0;
      const avgKmH = count > 0 ? Math.round((sumKmH / count) * 10) / 10 : 0;
      if (avgKnots > maxSpeed) maxSpeed = avgKnots;

      const maxGustK = b.reports.reduce((acc, r) => (r.windGustsKnots > acc ? r.windGustsKnots : acc), 0);
      const maxGustKm = b.reports.reduce((acc, r) => (r.windGustsKmH > acc ? r.windGustsKmH : acc), 0);

      return {
        id: b.id,
        cardinal: b.cardinal,
        namePt: b.namePt,
        centerDeg: b.deg,
        startDeg: b.startDeg,
        endDeg: b.endDeg,
        count,
        percentage,
        avgSpeedKnots: avgKnots,
        avgSpeedKmH: avgKmH,
        maxGustKnots: maxGustK,
        maxGustKmH: maxGustKm,
        reports: b.reports,
      };
    });

    // Encontrar setor predominante (maior número de ocorrências)
    let prevailing = computedSectors[0];
    for (const s of computedSectors) {
      if (s.count > prevailing.count) {
        prevailing = s;
      } else if (s.count === prevailing.count && s.avgSpeedKnots > prevailing.avgSpeedKnots) {
        prevailing = s;
      }
    }

    return {
      sectors: computedSectors,
      prevailingSector: prevailing,
      vectorDeg: meanDeg,
      maxSectorFreq: Math.max(maxFreq, 1),
      maxSectorSpeed: Math.max(maxSpeed, 10),
      totalReportsCount: totalCount,
    };
  }, [history]);

  // Setor ativo (hover ou clique) ou padrão predominante
  const selectedSector = useMemo(() => {
    if (activeSectorId) {
      return sectors.find((s) => s.id === activeSectorId) || prevailingSector;
    }
    return prevailingSector;
  }, [activeSectorId, sectors, prevailingSector]);

  // Geometria da Rosa dos Ventos SVG
  const size = 300;
  const center = size / 2; // 150
  const maxPetalRadius = 110;
  const minPetalRadius = 26; // raio da ilha central para o ponteiro

  // Converte coordenadas polares em cartesianas (0° no Norte/topo, sentido horário)
  const polarToCartesian = (angleDeg: number, radius: number) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(angleRad),
      y: center + radius * Math.sin(angleRad),
    };
  };

  // Cria caminho SVG para pétala de cunha de cada rumo
  const makeSectorPath = (startAngle: number, endAngle: number, innerR: number, outerR: number) => {
    const p1 = polarToCartesian(startAngle, innerR);
    const p2 = polarToCartesian(startAngle, outerR);
    const p3 = polarToCartesian(endAngle, outerR);
    const p4 = polarToCartesian(endAngle, innerR);
    const largeArc = (endAngle - startAngle + 360) % 360 > 180 ? 1 : 0;

    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${p1.x} ${p1.y} Z`;
  };

  return (
    <div
      className={`border-2 border-black dark:border-white bg-[#f8f7f4] dark:bg-[#161b22] font-mono shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] flex flex-col justify-between ${className}`}
      id="interactive-wind-rose-component"
    >
      {/* Cabeçalho Náutico Tático */}
      <div className="p-3.5 sm:p-4 border-b-2 border-black dark:border-white bg-white dark:bg-[#0d1117] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 border border-black dark:border-white bg-[#f8f7f4] dark:bg-[#161b22]">
            <Compass className="w-4 h-4 text-[#d42020] animate-spin-slow" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] block">
              ROSA DOS VENTOS RETROSPECTIVA
            </span>
            <h4 className="font-display text-sm sm:text-base font-bold uppercase text-black dark:text-white leading-tight">
              Direção Predominante (24h)
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={loadData}
            disabled={loading}
            aria-label="Atualizar rosa dos ventos com dados das últimas 24 horas"
            className="p-1.5 border border-black dark:border-white bg-white dark:bg-[#0d1117] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer"
            title="Atualizar leituras de vento"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#d42020]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alternador de Métrica (Frequência vs Velocidade Média) */}
      <div className="px-3.5 py-2 border-b border-black/15 dark:border-white/15 bg-[#eeebe6] dark:bg-[#161b22] flex items-center justify-between text-[11px]">
        <span className="text-[#666] dark:text-[#8b949e] uppercase font-bold flex items-center gap-1">
          <Sliders className="w-3 h-3 text-black dark:text-white" />
          Métrica dos Setores:
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDisplayMetric('frequency')}
            className={`px-2 py-0.5 font-bold uppercase cursor-pointer text-[10px] border border-black dark:border-white transition-colors ${
              displayMetric === 'frequency'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#ddd]'
            }`}
          >
            Frequência (%)
          </button>
          <button
            onClick={() => setDisplayMetric('speed')}
            className={`px-2 py-0.5 font-bold uppercase cursor-pointer text-[10px] border border-black dark:border-white transition-colors ${
              displayMetric === 'speed'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#ddd]'
            }`}
          >
            Intensidade (nós)
          </button>
        </div>
      </div>

      {/* BÚSSOLA / DIAL INTERATIVO DA ROSA DOS VENTOS */}
      <div className="p-3 sm:p-4 flex flex-col items-center justify-center relative select-none">
        {loading ? (
          <div className="w-[280px] h-[280px] flex flex-col items-center justify-center gap-2 text-xs text-[#666] dark:text-[#8b949e]">
            <RotateCw className="w-7 h-7 animate-spin text-[#d42020]" />
            <span className="font-bold uppercase text-[11px]">Calculando distribuição dos 16 rumos...</span>
          </div>
        ) : !history || sectors.length === 0 ? (
          <div className="w-[280px] h-[280px] flex items-center justify-center text-xs text-[#888] uppercase text-center p-4">
            Dados de vento 24h indisponíveis no momento.
          </div>
        ) : (
          <div className="relative w-[280px] sm:w-[300px] h-[280px] sm:h-[300px]">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full overflow-visible drop-shadow-sm"
              role="img"
              aria-label={`Rosa dos Ventos com direção predominante de ${prevailingSector?.namePt || 'vento'}`}
            >
              <defs>
                {/* Gradiente para a agulha de rumo predominante */}
                <linearGradient id="needleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d42020" />
                  <stop offset="100%" stopColor="#991b1b" />
                </linearGradient>
                <filter id="roseGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* Anéis concêntricos de escala (10%, 25%, 50%, etc.) */}
              {[0.33, 0.66, 1.0].map((ratio, idx) => {
                const r = minPetalRadius + (maxPetalRadius - minPetalRadius) * ratio;
                const percentVal = Math.round((maxSectorFreq / totalReportsCount) * 100 * ratio);
                return (
                  <g key={`ring-${idx}`}>
                    <circle
                      cx={center}
                      cy={center}
                      r={r}
                      fill="none"
                      stroke="#888"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                      opacity="0.35"
                    />
                    {/* Marcador percentual no eixo Norte */}
                    <text
                      x={center + 3}
                      y={center - r + 9}
                      fill="#888"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {displayMetric === 'frequency'
                        ? `${percentVal}%`
                        : `${Math.round(maxSectorSpeed * ratio)}kn`}
                    </text>
                  </g>
                );
              })}

              {/* Linhas radiais de referência cardinal (N-S, L-O) */}
              <line
                x1={center}
                y1={center - maxPetalRadius - 10}
                x2={center}
                y2={center + maxPetalRadius + 10}
                stroke="#666"
                strokeWidth="1"
                opacity="0.2"
              />
              <line
                x1={center - maxPetalRadius - 10}
                y1={center}
                x2={center + maxPetalRadius + 10}
                y2={center}
                stroke="#666"
                strokeWidth="1"
                opacity="0.2"
              />

              {/* Anel Externo com Graduações e Marcadores de Graus */}
              <circle
                cx={center}
                cy={center}
                r={maxPetalRadius + 12}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-black/80 dark:text-white/80"
              />

              {/* Ticks e Rótulos a cada 30 graus */}
              {Array.from({ length: 36 }).map((_, i) => {
                const angle = i * 10;
                const isMajor = angle % 30 === 0;
                const rIn = maxPetalRadius + (isMajor ? 7 : 10);
                const rOut = maxPetalRadius + 12;
                const pIn = polarToCartesian(angle, rIn);
                const pOut = polarToCartesian(angle, rOut);

                return (
                  <line
                    key={`tick-${angle}`}
                    x1={pIn.x}
                    y1={pIn.y}
                    x2={pOut.x}
                    y2={pOut.y}
                    stroke="currentColor"
                    strokeWidth={isMajor ? 1.5 : 0.75}
                    className="text-black dark:text-white opacity-60"
                  />
                );
              })}

              {/* Rótulos dos 4 Pontos Cardeais Principais (N, L, S, O) */}
              <g className="font-mono font-black text-[12px]">
                {/* NORTE (Destaque em Vermelho Náutico) */}
                <text
                  x={center}
                  y={center - maxPetalRadius - 18}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#d42020"
                  fontWeight="900"
                >
                  N (0°)
                </text>
                {/* LESTE */}
                <text
                  x={center + maxPetalRadius + 22}
                  y={center}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="currentColor"
                  className="text-black dark:text-white"
                >
                  L (90°)
                </text>
                {/* SUL */}
                <text
                  x={center}
                  y={center + maxPetalRadius + 20}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="currentColor"
                  className="text-black dark:text-white"
                >
                  S (180°)
                </text>
                {/* OESTE */}
                <text
                  x={center - maxPetalRadius - 22}
                  y={center}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="currentColor"
                  className="text-black dark:text-white"
                >
                  O (270°)
                </text>
              </g>

              {/* 16 PÉTALAS/SETORES INTERATIVOS DA ROSA */}
              {sectors.map((sec) => {
                const isSelected = selectedSector?.id === sec.id;
                const isPrevailing = prevailingSector?.id === sec.id;

                // Calcular raio exterior da pétala
                let ratio = 0;
                if (displayMetric === 'frequency') {
                  ratio = sec.count > 0 ? sec.count / maxSectorFreq : 0;
                } else {
                  ratio = sec.avgSpeedKnots > 0 ? sec.avgSpeedKnots / maxSectorSpeed : 0;
                }

                // Garante que mesmo setores vazios tenham um minirelevo clicável se hovered
                const petalRadius =
                  sec.count > 0
                    ? minPetalRadius + ratio * (maxPetalRadius - minPetalRadius)
                    : minPetalRadius + 4;

                const pathData = makeSectorPath(
                  sec.centerDeg - 10.5,
                  sec.centerDeg + 10.5,
                  minPetalRadius,
                  petalRadius
                );

                const fillColor =
                  sec.count === 0
                    ? '#cbd5e1'
                    : getWindColor(sec.avgSpeedKnots, false);

                return (
                  <path
                    key={`petal-${sec.id}`}
                    d={pathData}
                    fill={fillColor}
                    fillOpacity={
                      isSelected
                        ? 0.95
                        : isPrevailing
                        ? 0.85
                        : sec.count > 0
                        ? 0.6
                        : 0.15
                    }
                    stroke={
                      isSelected
                        ? '#000000'
                        : isPrevailing
                        ? '#d42020'
                        : '#ffffff'
                    }
                    strokeWidth={isSelected ? 2.5 : isPrevailing ? 1.5 : 0.75}
                    className="cursor-pointer transition-all duration-150 hover:brightness-110"
                    onMouseEnter={() => setActiveSectorId(sec.id)}
                    onClick={() => setActiveSectorId(sec.id)}
                    style={{
                      transformOrigin: `${center}px ${center}px`,
                      transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                    }}
                  >
                    <title>
                      {`${sec.namePt} (${sec.cardinal} · ${sec.centerDeg}°): ${sec.count} horas (${sec.percentage}%) • Vento Médio: ${sec.avgSpeedKnots} kn`}
                    </title>
                  </path>
                );
              })}

              {/* PONTEIRO NÁUTICO CENTRAL DE DIREÇÃO PREDOMINANTE (Vetor resultante) */}
              {prevailingSector && (
                <g
                  transform={`rotate(${vectorDeg}, ${center}, ${center})`}
                  className="transition-transform duration-500 ease-out"
                >
                  {/* Agulha de Alta Visibilidade apontando para onde o vento sopra */}
                  <polygon
                    points={`${center},${center - maxPetalRadius + 4} ${center - 5},${center - minPetalRadius + 2} ${center + 5},${center - minPetalRadius + 2}`}
                    fill="url(#needleGradient)"
                    stroke="#ffffff"
                    strokeWidth="1"
                    filter="url(#roseGlow)"
                  />
                  {/* Contrapeso traseiro da agulha */}
                  <polygon
                    points={`${center},${center + minPetalRadius - 2} ${center - 3.5},${center} ${center + 3.5},${center}`}
                    fill="#111111"
                    stroke="#ffffff"
                    strokeWidth="0.75"
                  />
                </g>
              )}

              {/* Pivô Náutico Central com Acrônimo do Rumo Predominante */}
              <circle
                cx={center}
                cy={center}
                r={minPetalRadius - 4}
                fill="#111111"
                stroke="#ffffff"
                strokeWidth="2"
                className="cursor-pointer"
                onClick={() => setActiveSectorId(null)}
              />
              <text
                x={center}
                y={center - 3}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="900"
              >
                {selectedSector?.cardinal || 'VNT'}
              </text>
              <text
                x={center}
                y={center + 8}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fbbf24"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {selectedSector?.centerDeg}°
              </text>
            </svg>

            {/* Marcador Tático de Direção Flutuante */}
            <div className="absolute top-1 left-1 bg-white/95 dark:bg-[#0d1117]/95 px-2 py-0.5 border border-black dark:border-white text-[10px] font-bold shadow-xs flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#d42020] animate-pulse" />
              <span>{vectorDeg}° {prevailingSector?.cardinal}</span>
            </div>
          </div>
        )}
      </div>

      {/* PAINEL INFORMATIVO DO SETOR INSPECIONADO */}
      <div className="p-3.5 sm:p-4 bg-white dark:bg-[#0d1117] border-t-2 border-black dark:border-white">
        {selectedSector ? (
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-black/15 dark:border-white/15">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getWindColor(selectedSector.avgSpeedKnots) }} />
                <strong className="text-black dark:text-white uppercase text-xs">
                  {selectedSector.namePt} ({selectedSector.cardinal}) • {selectedSector.centerDeg}°
                </strong>
                {selectedSector.id === prevailingSector?.id && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-[#d42020] text-white">
                    PREDOMINANTE
                  </span>
                )}
              </div>

              {activeSectorId && (
                <button
                  onClick={() => setActiveSectorId(null)}
                  className="text-[10px] text-[#0284c7] hover:underline font-bold uppercase cursor-pointer"
                >
                  Ver Predominante
                </button>
              )}
            </div>

            {/* Métricas do Setor Selecionado */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2.5 text-xs">
              <div className="bg-[#f8f7f4] dark:bg-[#161b22] p-2 border border-black/20 dark:border-white/20">
                <span className="text-[10px] text-[#666] dark:text-[#8b949e] uppercase block font-bold">
                  Frequência (24h)
                </span>
                <span className="font-display text-base sm:text-lg font-bold text-black dark:text-white tabular-nums">
                  {selectedSector.count} h{' '}
                  <span className="text-xs font-mono font-normal text-[#666] dark:text-[#8b949e]">
                    ({selectedSector.percentage}%)
                  </span>
                </span>
              </div>

              <div className="bg-[#f8f7f4] dark:bg-[#161b22] p-2 border border-black/20 dark:border-white/20">
                <span className="text-[10px] text-[#666] dark:text-[#8b949e] uppercase block font-bold">
                  Vento Médio
                </span>
                <span className="font-display text-base sm:text-lg font-bold text-black dark:text-white tabular-nums">
                  {selectedSector.avgSpeedKnots.toFixed(1)}{' '}
                  <span className="text-xs font-mono font-normal text-[#666] dark:text-[#8b949e]">
                    nós ({selectedSector.avgSpeedKmH.toFixed(0)} km/h)
                  </span>
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-[#f8f7f4] dark:bg-[#161b22] p-2 border border-black/20 dark:border-white/20">
                <span className="text-[10px] text-[#666] dark:text-[#8b949e] uppercase block font-bold">
                  Rajada Máxima
                </span>
                <span className="font-display text-base sm:text-lg font-bold text-[#d42020] tabular-nums">
                  {selectedSector.maxGustKnots.toFixed(1)}{' '}
                  <span className="text-xs font-mono font-normal text-[#666] dark:text-[#8b949e]">
                    nós
                  </span>
                </span>
              </div>
            </div>

            {/* Dica do Rumo do Vento */}
            <div className="mt-2 text-[11px] text-[#444] dark:text-[#aaa] leading-tight flex items-start gap-1.5 pt-1.5 border-t border-black/10 dark:border-white/10">
              <Info className="w-3.5 h-3.5 text-[#0284c7] shrink-0 mt-0.5" />
              <span>
                {selectedSector.count > 0 ? (
                  <>
                    Vento soprando <strong>de {selectedSector.namePt}</strong> ({selectedSector.centerDeg}°) em direção ao quadrante oposto ({((selectedSector.centerDeg + 180) % 360)}°).
                  </>
                ) : (
                  <>Nenhuma ocorrência de vento registrada nesta direção nas últimas 24 horas.</>
                )}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#888] text-center">Nenhum dado selecionado.</div>
        )}
      </div>

      {/* Legenda de Intensidade Beaufort / Cores Náuticas */}
      <div className="px-3 py-2 bg-[#eeebe6] dark:bg-[#161b22] border-t border-black/15 dark:border-white/15 text-[10px] font-bold uppercase flex flex-wrap items-center justify-between gap-1 text-[#555] dark:text-[#aaa]">
        <span className="text-black dark:text-white">Escala:</span>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: getWindColor(2) }} />
          <span>&lt;4 kn</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: getWindColor(8) }} />
          <span>4-10 kn</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: getWindColor(14) }} />
          <span>11-16 kn</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: getWindColor(20) }} />
          <span>17-21 kn</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: getWindColor(26) }} />
          <span>&gt;22 kn</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveWindRose;
