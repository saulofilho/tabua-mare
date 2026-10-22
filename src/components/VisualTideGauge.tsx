import React, { useState, useMemo } from 'react';
import { CurrentTideStatus, TideExtreme, VesselProfile } from '../types/tide';
import { ArrowUpRight, ArrowDownRight, Anchor, Ship, Waves, Info, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface VisualTideGaugeProps {
  currentHeight: number;
  maxTideRange: number; // e.g. 2.5m or 3.0m
  status: CurrentTideStatus;
  todayExtremes: TideExtreme[];
  vessel: VesselProfile;
  stationName: string;
}

export const VisualTideGauge: React.FC<VisualTideGaugeProps> = ({
  currentHeight,
  maxTideRange,
  status,
  todayExtremes,
  vessel,
  stationName,
}) => {
  const [simulationHeight, setSimulationHeight] = useState<number | null>(null);

  // Active height to display (actual current or simulated scrubber)
  const displayHeight = simulationHeight !== null ? simulationHeight : currentHeight;

  // Reference depths for realistic cross-section
  const chartedSeabedDepth = 2.5; // meters below chart datum
  const totalWaterDepth = displayHeight + chartedSeabedDepth;
  const ukc = totalWaterDepth - vessel.draft;

  // SVG Geometry (Enhanced 800x340 viewport to prevent any overlap)
  const svgWidth = 800;
  const svgHeight = 340;

  // Heights scale
  const seabedY = 280; // baseline for sea bottom
  const maxScaleMeters = Math.max(maxTideRange + 1.2, 4.0); // max scale in meters
  const totalMetersSpan = chartedSeabedDepth + maxScaleMeters;
  const usableHeightPixels = seabedY - 45; // top margin of 45px for mast headroom
  const metersPerPixel = totalMetersSpan / usableHeightPixels;

  // Key Y levels
  const datumY = seabedY - chartedSeabedDepth / metersPerPixel; // 0.00m Chart Datum
  const waterSurfaceY = Math.max(45, datumY - displayHeight / metersPerPixel);

  // Vessel floating on water
  const boatWidth = 110;
  const boatHeight = 24;
  const boatX = 300;
  const boatY = waterSurfaceY - boatHeight + 6; // sitting on water
  const keelDepthPixels = (vessel.draft / metersPerPixel);
  const keelBottomY = boatY + boatHeight + keelDepthPixels - 6;

  // Extrema lines (highest PM and lowest BM of today)
  const highestPM = todayExtremes
    .filter((e) => e.type === 'preia-mar')
    .reduce((max, e) => (e.height > max ? e.height : max), 2.2);

  const lowestBM = todayExtremes
    .filter((e) => e.type === 'baixa-mar')
    .reduce((min, e) => (e.height < min ? e.height : min), 0.4);

  const pmY = Math.max(45, datumY - highestPM / metersPerPixel);
  const bmY = Math.max(45, datumY - lowestBM / metersPerPixel);

  // Anti-collision algorithm for right-hand badges (PM, BM, Actual level)
  const { badgeActualY, badgePmY, badgeBmY } = useMemo(() => {
    const bHeight = 26; // badge height
    let aY = waterSurfaceY - bHeight / 2;
    let pY = pmY - bHeight / 2;
    let bY = bmY - bHeight / 2;

    // Sort badges by nominal Y to prevent overlapping
    const items = [
      { id: 'pm', y: pY },
      { id: 'actual', y: aY },
      { id: 'bm', y: bY },
    ].sort((a, b) => a.y - b.y);

    // Ensure minimum gap between badges
    const minGap = bHeight + 4;
    for (let i = 1; i < items.length; i++) {
      if (items[i].y < items[i - 1].y + minGap) {
        items[i].y = items[i - 1].y + minGap;
      }
    }

    // Keep within canvas bounds
    if (items[items.length - 1].y > seabedY - 32) {
      const shift = items[items.length - 1].y - (seabedY - 32);
      for (let i = 0; i < items.length; i++) {
        items[i].y = Math.max(15, items[i].y - shift);
      }
    }

    const resultMap: Record<string, number> = {};
    items.forEach((it) => {
      resultMap[it.id] = it.y;
    });

    return {
      badgeActualY: resultMap['actual'],
      badgePmY: resultMap['pm'],
      badgeBmY: resultMap['bm'],
    };
  }, [waterSurfaceY, pmY, bmY, seabedY]);

  // Keel clearance status
  const isCriticalUKC = ukc < 0.4 || ukc < vessel.draft * 0.15;
  const isWarningUKC = ukc < vessel.safetyMargin;

  return (
    <div className="bg-white dark:bg-[#0d1117] border-2 border-black dark:border-[#30363d] p-4 sm:p-6 font-mono shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black dark:border-[#30363d] mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e]">
              CORTE TRANSVERSAL // HIDROGRAFIA & BATIMETRIA
            </span>
            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-black text-white dark:bg-white dark:text-black">
              DHN ZERO HIDROGRÁFICO
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase text-[#111111] dark:text-white flex items-center gap-2">
            <Waves className="w-5 h-5 text-[#0284c7]" />
            <span>Coluna de Água & Folga sob a Quilha</span>
          </h3>
          <p className="text-xs text-[#555] dark:text-[#8b949e] mt-0.5">
            Visualização precisa da cota da maré, calado de {vessel.draft.toFixed(2)}m ({vessel.name}) e margem de segurança no leito.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {simulationHeight !== null ? (
            <button
              onClick={() => setSimulationHeight(null)}
              className="px-2.5 py-1 bg-[#d42020] text-white text-xs font-bold uppercase cursor-pointer hover:bg-black transition-colors shadow-xs"
            >
              RESETAR P/ TEMPO REAL
            </button>
          ) : (
            <span className="px-2.5 py-1 bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold uppercase">
              LEITURA EM TEMPO REAL
            </span>
          )}

          <div className="border-2 border-black dark:border-white px-2.5 py-0.5 text-xs font-bold text-black dark:text-white bg-[#f8f7f4] dark:bg-[#161b22] tabular-nums">
            MARÉ: <span className="text-[#0284c7] font-black">{displayHeight.toFixed(2)}m</span>
          </div>
        </div>
      </div>

      {/* SVG Diagram Stage */}
      <div className="relative w-full overflow-x-auto border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#161b22] p-1 sm:p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[700px] h-auto select-none block"
          style={{ maxHeight: '420px' }}
        >
          <defs>
            {/* Water gradient */}
            <linearGradient id="tacticalWaterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="35%" stopColor="#0284c7" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.85" />
            </linearGradient>

            {/* Pattern for sand & seabed */}
            <pattern id="seabedPattern" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect width="16" height="16" fill="#f1ece1" />
              <circle cx="4" cy="4" r="1.2" fill="#78716c" opacity="0.4" />
              <circle cx="12" cy="12" r="1.5" fill="#57534e" opacity="0.45" />
              <circle cx="12" cy="4" r="0.8" fill="#a8a29e" opacity="0.3" />
              <line x1="0" y1="16" x2="16" y2="0" stroke="#78716c" strokeWidth="0.7" opacity="0.25" />
            </pattern>

            {/* Shadow filter for badges */}
            <filter id="badgeShadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="1.5" dy="1.5" stdDeviation="0" floodColor="#000000" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Sky background */}
          <rect x="0" y="0" width={svgWidth} height={seabedY} fill="#fdfbf7" className="dark:fill-[#0d1117]" />

          {/* Seabed Area (Leito Marinho) */}
          <rect
            x="0"
            y={seabedY}
            width={svgWidth}
            height={svgHeight - seabedY}
            fill="url(#seabedPattern)"
          />
          <line x1="0" y1={seabedY} x2={svgWidth} y2={seabedY} stroke="#111111" strokeWidth="3" />
          
          <rect x="18" y={seabedY + 12} width="360" height="24" fill="#ffffff" stroke="#111111" strokeWidth="1.5" />
          <text
            x="28"
            y={seabedY + 28}
            fontFamily="Roboto Mono, monospace"
            fontSize="10"
            fontWeight="bold"
            fill="#111111"
          >
            ⚓ LEITO MARINHO // PROF. CARTOGRAFADA: {chartedSeabedDepth.toFixed(2)}M
          </text>

          {/* Water Fill Layer */}
          <rect
            x="0"
            y={waterSurfaceY}
            width={svgWidth}
            height={seabedY - waterSurfaceY}
            fill="url(#tacticalWaterGrad)"
          />

          {/* Water Surface Line with Nautical Wave Accent */}
          <line
            x1="70"
            y1={waterSurfaceY}
            x2={svgWidth - 210}
            y2={waterSurfaceY}
            stroke="#0284c7"
            strokeWidth="3"
          />

          {/* Chart Datum Line (Zero Hidrográfico 0.00m) */}
          <line
            x1="70"
            y1={datumY}
            x2={svgWidth - 210}
            y2={datumY}
            stroke="#6b7280"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <g transform={`translate(75, ${datumY - 10})`}>
            <rect x="0" y="-8" width="245" height="17" fill="#ffffff" stroke="#4b5563" strokeWidth="1" rx="2" />
            <text
              x="8"
              y="4"
              fontFamily="Roboto Mono, monospace"
              fontSize="9"
              fontWeight="bold"
              fill="#374151"
            >
              ZERO HIDROGRÁFICO (DATUM DHN 0.00M)
            </text>
          </g>

          {/* Daily Extremes Guide Lines */}
          {/* Preia-mar Guide */}
          <line
            x1="70"
            y1={pmY}
            x2={svgWidth - 210}
            y2={pmY}
            stroke="#0284c7"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            strokeOpacity="0.8"
          />

          {/* Baixa-mar Guide */}
          <line
            x1="70"
            y1={bmY}
            x2={svgWidth - 210}
            y2={bmY}
            stroke="#d42020"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            strokeOpacity="0.8"
          />

          {/* Left Vertical Tide Pole (Régua Maregráfica Graduada) */}
          <g transform="translate(18, 20)">
            <rect
              x="0"
              y="0"
              width="36"
              height={seabedY - 20}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="2"
            />
            {/* Header label on top of pole */}
            <rect x="0" y="-14" width="36" height="14" fill="#000000" />
            <text x="18" y="-4" textAnchor="middle" fontFamily="Roboto Mono, monospace" fontSize="8" fontWeight="bold" fill="#ffffff">
              COTA
            </text>

            {/* Graduations */}
            {[-2.0, -1.0, 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((m) => {
              const yTick = datumY - 20 - m / metersPerPixel;
              if (yTick < 6 || yTick > seabedY - 24) return null;
              const isDatum = m === 0;
              return (
                <g key={`pole-${m}`}>
                  <line
                    x1="0"
                    y1={yTick}
                    x2={isDatum ? '18' : '10'}
                    y2={yTick}
                    stroke={isDatum ? '#d42020' : '#000000'}
                    strokeWidth={isDatum ? '2' : '1'}
                  />
                  <text
                    x="20"
                    y={yTick + 3}
                    fontFamily="Roboto Mono, monospace"
                    fontSize={isDatum ? '8.5' : '7.5'}
                    fontWeight="bold"
                    fill={isDatum ? '#d42020' : '#111111'}
                  >
                    {m.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Pointer on the pole for current water height */}
            <polygon
              points={`36,${waterSurfaceY - 20} 46,${waterSurfaceY - 25} 46,${waterSurfaceY - 15}`}
              fill="#0284c7"
            />
          </g>

          {/* Vessel (Barco Flutuando com Quilha Real) */}
          <g transform={`translate(${boatX}, ${boatY})`}>
            {/* Mast */}
            <line x1="52" y1="-4" x2="52" y2="-44" stroke="#111111" strokeWidth="3" />
            
            {/* Sail / Pennant */}
            <polygon points="53,-42 85,-18 53,-18" fill="#f8fafc" stroke="#111111" strokeWidth="1.5" />
            <line x1="53" y1="-30" x2="74" y2="-18" stroke="#0284c7" strokeWidth="1" />

            {/* Flag on mast tip */}
            <polygon points="52,-44 40,-48 52,-52" fill="#10b981" />

            {/* Superstructure / Cabin */}
            <rect x="26" y="-8" width="46" height="14" fill="#111111" stroke="#000000" strokeWidth="1.5" rx="1" />
            {/* Cabin windows */}
            <rect x="32" y="-5" width="8" height="6" fill="#38bdf8" />
            <rect x="44" y="-5" width="8" height="6" fill="#38bdf8" />
            <rect x="56" y="-5" width="8" height="6" fill="#38bdf8" />

            {/* Hull */}
            <path
              d="M 6,6 L 18,22 L 92,22 L 104,6 Z"
              fill="#ffffff"
              stroke="#111111"
              strokeWidth="2.5"
            />

            {/* Vessel Name on Hull */}
            <text
              x="55"
              y="16"
              textAnchor="middle"
              fontFamily="Roboto Mono, monospace"
              fontSize="7.5"
              fontWeight="bold"
              fill="#111111"
            >
              {vessel.name.toUpperCase().slice(0, 14)}
            </text>

            {/* Keel (Quilha em Vermelho Naval) */}
            <path
              d={`M 48,22 L 48,${22 + keelDepthPixels} L 60,${22 + keelDepthPixels} L 56,22 Z`}
              fill="#d42020"
              stroke="#000000"
              strokeWidth="2"
            />

            {/* Vessel Draft Tag */}
            <g transform={`translate(108, ${22 + keelDepthPixels / 2 - 8})`}>
              <line x1="-48" y1="8" x2="-4" y2="8" stroke="#d42020" strokeWidth="1" strokeDasharray="2 2" />
              <rect x="0" y="0" width="78" height="17" fill="#ffffff" stroke="#d42020" strokeWidth="1.2" rx="2" />
              <text x="6" y="12" fontFamily="Roboto Mono, monospace" fontSize="8" fontWeight="bold" fill="#d42020">
                CALADO: {vessel.draft.toFixed(2)}m
              </text>
            </g>
          </g>

          {/* Under Keel Clearance (UKC) Dimension Bracket & Badge */}
          <g>
            {/* Vertical measurement bracket from keel tip to seabed */}
            <line
              x1={boatX + 54}
              y1={keelBottomY}
              x2={boatX + 54}
              y2={seabedY}
              stroke={isCriticalUKC ? '#d42020' : isWarningUKC ? '#d97706' : '#10b981'}
              strokeWidth="2.5"
            />
            {/* Top and bottom tick bars */}
            <line
              x1={boatX + 44}
              y1={keelBottomY}
              x2={boatX + 64}
              y2={keelBottomY}
              stroke={isCriticalUKC ? '#d42020' : isWarningUKC ? '#d97706' : '#10b981'}
              strokeWidth="2"
            />
            <line
              x1={boatX + 44}
              y1={seabedY}
              x2={boatX + 64}
              y2={seabedY}
              stroke={isCriticalUKC ? '#d42020' : isWarningUKC ? '#d97706' : '#10b981'}
              strokeWidth="2"
            />

            {/* UKC Badge safely positioned to the right with pointer to prevent overlapping */}
            <g transform={`translate(${boatX + 70}, ${Math.max(keelBottomY - 5, Math.min(seabedY - 30, (keelBottomY + seabedY) / 2 - 12))})`}>
              <rect
                x="0"
                y="0"
                width="142"
                height="24"
                fill="#ffffff"
                stroke={isCriticalUKC ? '#d42020' : isWarningUKC ? '#d97706' : '#10b981'}
                strokeWidth="2"
                filter="url(#badgeShadow)"
                rx="2"
              />
              <text
                x="8"
                y="11"
                fontFamily="Roboto Mono, monospace"
                fontSize="7.5"
                fontWeight="bold"
                fill="#555555"
              >
                FOLGA SOB QUILHA (UKC)
              </text>
              <text
                x="8"
                y="20"
                fontFamily="Roboto Mono, monospace"
                fontSize="9"
                fontWeight="900"
                fill={isCriticalUKC ? '#d42020' : isWarningUKC ? '#d97706' : '#10b981'}
              >
                {ukc >= 0 ? `+${ukc.toFixed(2)}m livre` : `${ukc.toFixed(2)}m (ENCALHE)`}
              </text>
            </g>
          </g>

          {/* Right Rail: Tactical Non-Overlapping Reference Badges */}
          <g transform={`translate(${svgWidth - 195}, 0)`}>
            {/* 1. Preia-mar Máxima (PM) */}
            <g transform={`translate(0, ${badgePmY})`}>
              <line x1="-15" y1="13" x2="0" y2="13" stroke="#0284c7" strokeWidth="1.5" />
              <rect
                x="0"
                y="0"
                width="180"
                height="26"
                fill="#ffffff"
                stroke="#0284c7"
                strokeWidth="2"
                filter="url(#badgeShadow)"
                rx="2"
              />
              <path d="M 10,17 L 16,9 L 22,17 Z" fill="#0284c7" />
              <text x="28" y="11" fontFamily="Roboto Mono, monospace" fontSize="8" fontWeight="bold" fill="#0284c7">
                PREIA-MAR MÁX (PM)
              </text>
              <text x="28" y="21" fontFamily="Roboto Mono, monospace" fontSize="10" fontWeight="900" fill="#111111">
                {highestPM.toFixed(2)}m
              </text>
            </g>

            {/* 2. Nível Atual da Água (Black pointer badge) */}
            <g transform={`translate(0, ${badgeActualY})`}>
              <line x1="-15" y1="13" x2="0" y2="13" stroke="#000000" strokeWidth="2" />
              <rect
                x="0"
                y="0"
                width="180"
                height="28"
                fill="#000000"
                stroke="#000000"
                strokeWidth="2"
                filter="url(#badgeShadow)"
                rx="2"
              />
              <circle cx="16" cy="14" r="5" fill="#38bdf8" />
              <text x="28" y="11" fontFamily="Roboto Mono, monospace" fontSize="8" fontWeight="bold" fill="#38bdf8">
                NÍVEL ATUAL DA ÁGUA
              </text>
              <text x="28" y="23" fontFamily="Roboto Mono, monospace" fontSize="11" fontWeight="900" fill="#ffffff">
                {displayHeight.toFixed(2)}m · {status.tendency.toUpperCase()}
              </text>
            </g>

            {/* 3. Baixa-mar Mínima (BM) */}
            <g transform={`translate(0, ${badgeBmY})`}>
              <line x1="-15" y1="13" x2="0" y2="13" stroke="#d42020" strokeWidth="1.5" />
              <rect
                x="0"
                y="0"
                width="180"
                height="26"
                fill="#ffffff"
                stroke="#d42020"
                strokeWidth="2"
                filter="url(#badgeShadow)"
                rx="2"
              />
              <path d="M 10,9 L 16,17 L 22,9 Z" fill="#d42020" />
              <text x="28" y="11" fontFamily="Roboto Mono, monospace" fontSize="8" fontWeight="bold" fill="#d42020">
                BAIXA-MAR MÍN (BM)
              </text>
              <text x="28" y="21" fontFamily="Roboto Mono, monospace" fontSize="10" fontWeight="900" fill="#111111">
                {lowestBM.toFixed(2)}m
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* Grid de Métricas Táticas Imediatas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3 pt-3 border-t-2 border-black dark:border-[#30363d]">
        <div className="border-2 border-black dark:border-white p-2.5 bg-[#f8f7f4] dark:bg-[#161b22]">
          <span className="block text-[10px] text-[#666] dark:text-[#8b949e] uppercase font-bold">
            Cota da Maré Atual
          </span>
          <div className="font-display text-xl sm:text-2xl font-black text-[#0284c7] tabular-nums mt-0.5">
            {displayHeight.toFixed(2)}m
          </div>
          <span className="text-[10px] font-bold uppercase text-black dark:text-white">
            {status.tendency === 'enchente' ? '↑ Enchendo' : status.tendency === 'vazante' ? '↓ Vazando' : '↔ Estofo'}
          </span>
        </div>

        <div className="border-2 border-black dark:border-white p-2.5 bg-[#f8f7f4] dark:bg-[#161b22]">
          <span className="block text-[10px] text-[#666] dark:text-[#8b949e] uppercase font-bold">
            Profundidade Total
          </span>
          <div className="font-display text-xl sm:text-2xl font-black text-black dark:text-white tabular-nums mt-0.5">
            {totalWaterDepth.toFixed(2)}m
          </div>
          <span className="text-[10px] text-[#666] dark:text-[#8b949e]">
            Carta ({chartedSeabedDepth.toFixed(2)}m) + Maré
          </span>
        </div>

        <div className="border-2 border-black dark:border-white p-2.5 bg-[#f8f7f4] dark:bg-[#161b22]">
          <span className="block text-[10px] text-[#666] dark:text-[#8b949e] uppercase font-bold">
            Calado do Barco ({vessel.name})
          </span>
          <div className="font-display text-xl sm:text-2xl font-black text-black dark:text-white tabular-nums mt-0.5">
            {vessel.draft.toFixed(2)}m
          </div>
          <span className="text-[10px] text-[#666] dark:text-[#8b949e]">
            Margem Req: {vessel.safetyMargin.toFixed(2)}m
          </span>
        </div>

        <div
          className={`border-2 border-black dark:border-white p-2.5 transition-colors ${
            isCriticalUKC
              ? 'bg-[#fee2e2] text-[#d42020]'
              : isWarningUKC
              ? 'bg-[#fef3c7] text-[#854d0e]'
              : 'bg-[#dcfce7] text-[#15803d]'
          }`}
        >
          <span className="block text-[10px] uppercase font-bold">
            Folga sob Quilha (UKC)
          </span>
          <div className="font-display text-xl sm:text-2xl font-black tabular-nums mt-0.5">
            {ukc >= 0 ? `+${ukc.toFixed(2)}m` : `${ukc.toFixed(2)}m`}
          </div>
          <span className="text-[10px] font-black uppercase flex items-center gap-1">
            {isCriticalUKC ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>RISCO DE ENCALHE</span>
              </>
            ) : isWarningUKC ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ATENÇÃO / RASA</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ÁGUA SEGURA</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Interactive Simulation Slider Bar */}
      <div className="mt-3 pt-3 border-t border-black/15 dark:border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase text-[11px] text-[#666] dark:text-[#8b949e]">
            Simular Variação de Nível:
          </span>
          <span className="font-bold text-black dark:text-white tabular-nums text-sm">
            {displayHeight.toFixed(2)}m
          </span>
          {simulationHeight !== null && (
            <span className="text-[10px] bg-[#d42020] text-white px-1.5 py-0.2 font-bold uppercase">
              MODO TESTE
            </span>
          )}
        </div>

        <div className="flex-1 max-w-sm flex items-center gap-2">
          <span className="text-[10px] text-[#777] dark:text-[#8b949e]">0.0m</span>
          <input
            type="range"
            min="0"
            max="3.5"
            step="0.05"
            value={displayHeight}
            onChange={(e) => setSimulationHeight(Number(e.target.value))}
            className="w-full accent-[#0284c7] cursor-pointer"
            aria-label="Controle deslizante para simular cota da maré na coluna d'água"
          />
          <span className="text-[10px] text-[#777] dark:text-[#8b949e]">3.5m</span>
        </div>

        <div className="text-[11px] text-[#555] dark:text-[#8b949e] flex items-center gap-2">
          <Anchor className="w-3.5 h-3.5 text-[#0284c7]" />
          <span>Local: <strong>{stationName}</strong></span>
        </div>
      </div>
    </div>
  );
};

export default VisualTideGauge;
