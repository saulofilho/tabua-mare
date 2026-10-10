import React, { useState } from 'react';
import { CurrentTideStatus, TideExtreme, VesselProfile } from '../types/tide';
import { ArrowUpRight, ArrowDownRight, Anchor, Ship, Waves, Info } from 'lucide-react';

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

  // SVG Geometry
  const svgWidth = 620;
  const svgHeight = 280;

  // Heights scale
  // Sea floor is at bottom, datum is higher, water level is above datum
  const maxScaleMeters = Math.max(maxTideRange + 1.2, 4.0);
  const seabedY = 240; // baseline for sea bottom
  const datumY = seabedY - (chartedSeabedDepth / (chartedSeabedDepth + maxScaleMeters)) * 180;
  
  // Water surface Y
  const metersPerPixel = (chartedSeabedDepth + maxScaleMeters) / (seabedY - 30);
  const waterSurfaceY = Math.max(35, datumY - displayHeight / metersPerPixel);

  // Vessel floating on water
  const boatWidth = 90;
  const boatHeight = 24;
  const boatX = 260;
  const boatY = waterSurfaceY - boatHeight + 6; // sitting on water
  const keelDepthPixels = vessel.draft / metersPerPixel;
  const keelBottomY = boatY + boatHeight + keelDepthPixels - 6;

  // Extrema lines (highest PM and lowest BM of today)
  const highestPM = todayExtremes
    .filter((e) => e.type === 'preia-mar')
    .reduce((max, e) => (e.height > max ? e.height : max), 2.2);

  const lowestBM = todayExtremes
    .filter((e) => e.type === 'baixa-mar')
    .reduce((min, e) => (e.height < min ? e.height : min), 0.4);

  const pmY = Math.max(35, datumY - highestPM / metersPerPixel);
  const bmY = Math.max(35, datumY - lowestBM / metersPerPixel);

  return (
    <div className="bg-white border-2 border-black p-5 font-mono shadow-[3px_3px_0px_#000]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black mb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888] block">
            Representação Visual em Corte Transversal
          </span>
          <h3 className="font-display text-2xl font-bold uppercase text-black flex items-center gap-2">
            <Waves className="w-5 h-5 text-black" />
            <span>Coluna de Água & Nível da Maré</span>
          </h3>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2">
          {simulationHeight !== null ? (
            <button
              onClick={() => setSimulationHeight(null)}
              className="px-2.5 py-1 bg-[#d42020] text-white text-xs font-bold uppercase cursor-pointer hover:bg-black transition-colors"
            >
              RESETAR P/ TEMPO REAL
            </button>
          ) : (
            <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold uppercase">
              LEITURA EM TEMPO REAL
            </span>
          )}

          <div className="border border-black px-2 py-0.5 text-[11px] font-bold text-black bg-[#f8f7f4]">
            ALTURA: <span className="text-[#d42020]">{displayHeight.toFixed(2)}M</span>
          </div>
        </div>
      </div>

      {/* SVG Diagram Stage */}
      <div className="relative w-full overflow-x-auto border-2 border-black bg-[#f8f7f4]">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[580px] h-auto select-none"
        >
          <defs>
            {/* Water gradient */}
            <linearGradient id="tacticalWaterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.95" />
            </linearGradient>

            {/* Pattern for sand & seabed */}
            <pattern id="seabedPattern" width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="#eeebe6" />
              <line x1="0" y1="12" x2="12" y2="0" stroke="#000000" strokeWidth="0.8" opacity="0.3" />
            </pattern>
          </defs>

          {/* Sky background */}
          <rect x="0" y="0" width={svgWidth} height={seabedY} fill="#ffffff" />

          {/* Seabed area */}
          <rect
            x="0"
            y={seabedY}
            width={svgWidth}
            height={svgHeight - seabedY}
            fill="url(#seabedPattern)"
          />
          <line x1="0" y1={seabedY} x2={svgWidth} y2={seabedY} stroke="#000000" strokeWidth="3" />
          <text
            x="15"
            y={seabedY + 22}
            fontFamily="Roboto Mono"
            fontSize="10"
            fontWeight="bold"
            fill="#111111"
          >
            LEITO MARINHO / FUNDO DE AREIA E ROCHA
          </text>

          {/* Water Fill Layer */}
          <rect
            x="0"
            y={waterSurfaceY}
            width={svgWidth}
            height={seabedY - waterSurfaceY}
            fill="url(#tacticalWaterGrad)"
          />

          {/* Animated Wave Surface Lines */}
          <line
            x1="0"
            y1={waterSurfaceY}
            x2={svgWidth}
            y2={waterSurfaceY}
            stroke="#111111"
            strokeWidth="2.5"
          />

          {/* Chart Datum Line (Zero Hidrográfico 0.00m) */}
          <line
            x1="50"
            y1={datumY}
            x2={svgWidth - 20}
            y2={datumY}
            stroke="#888888"
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />
          <text
            x="55"
            y={datumY - 5}
            fontFamily="Roboto Mono"
            fontSize="9"
            fontWeight="bold"
            fill="#666666"
          >
            NÍVEL ZERO DA CARTA NÁUTICA (DATUM DHN 0.00M)
          </text>

          {/* High Tide line (Preia-mar PM) */}
          <line
            x1="180"
            y1={pmY}
            x2={svgWidth - 20}
            y2={pmY}
            stroke="#111111"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <text
            x={svgWidth - 25}
            y={pmY - 4}
            textAnchor="end"
            fontFamily="Roboto Mono"
            fontSize="9"
            fontWeight="bold"
            fill="#111111"
          >
            MARÉ ALTA MÁX. [{highestPM.toFixed(2)}M]
          </text>

          {/* Low Tide line (Baixa-mar BM) */}
          <line
            x1="180"
            y1={bmY}
            x2={svgWidth - 20}
            y2={bmY}
            stroke="#d42020"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <text
            x={svgWidth - 25}
            y={bmY + 12}
            textAnchor="end"
            fontFamily="Roboto Mono"
            fontSize="9"
            fontWeight="bold"
            fill="#d42020"
          >
            MARÉ BAIXA MÍN. [{lowestBM.toFixed(2)}M]
          </text>

          {/* Left Vertical Tide Pole (Régua Maregráfica Graduada) */}
          <g transform="translate(20, 20)">
            <rect
              x="0"
              y="0"
              width="24"
              height={seabedY - 20}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="2"
            />
            {/* Graduations */}
            {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((m) => {
              const yTick = datumY - 20 - m / metersPerPixel;
              if (yTick < 5 || yTick > seabedY - 20) return null;
              return (
                <g key={`pole-${m}`}>
                  <line x1="0" y1={yTick} x2="10" y2={yTick} stroke="#000000" strokeWidth="1.5" />
                  <text
                    x="12"
                    y={yTick + 3}
                    fontFamily="Roboto Mono"
                    fontSize="7"
                    fontWeight="bold"
                    fill="#111111"
                  >
                    {m}m
                  </text>
                </g>
              );
            })}
          </g>

          {/* Boat Graphic sitting on water surface */}
          <g transform={`translate(${boatX}, ${boatY})`}>
            {/* Hull */}
            <path
              d="M 5,6 L 15,22 L 75,22 L 85,6 Z"
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="2"
            />
            {/* Cabin / superstructure */}
            <rect x="25" y="-8" width="35" height="14" fill="#000000" stroke="#000000" strokeWidth="1" />
            {/* Mast */}
            <line x1="42" y1="-8" x2="42" y2="-45" stroke="#000000" strokeWidth="2.5" />
            <polygon points="43,-42 68,-16 43,-16" fill="#111111" />
            {/* Keel extending into water */}
            <path
              d={`M 40,22 L 40,${22 + keelDepthPixels} L 50,${22 + keelDepthPixels} L 46,22 Z`}
              fill="#d42020"
              stroke="#000000"
              strokeWidth="1.5"
            />
          </g>

          {/* Keel Clearance (UKC) Dimension Bracket */}
          <g>
            {/* Vertical measurement bracket from keel bottom to seabed */}
            <line
              x1={boatX + 58}
              y1={keelBottomY}
              x2={boatX + 58}
              y2={seabedY}
              stroke={ukc < 0.5 ? '#d42020' : '#008800'}
              strokeWidth="2"
            />
            <line
              x1={boatX + 52}
              y1={keelBottomY}
              x2={boatX + 64}
              y2={keelBottomY}
              stroke={ukc < 0.5 ? '#d42020' : '#008800'}
              strokeWidth="1.5"
            />
            <line
              x1={boatX + 52}
              y1={seabedY}
              x2={boatX + 64}
              y2={seabedY}
              stroke={ukc < 0.5 ? '#d42020' : '#008800'}
              strokeWidth="1.5"
            />

            {/* UKC Badge label */}
            <rect
              x={boatX + 66}
              y={(keelBottomY + seabedY) / 2 - 10}
              width="130"
              height="20"
              fill="#ffffff"
              stroke={ukc < 0.5 ? '#d42020' : '#000000'}
              strokeWidth="1.5"
            />
            <text
              x={boatX + 72}
              y={(keelBottomY + seabedY) / 2 + 4}
              fontFamily="Roboto Mono"
              fontSize="9"
              fontWeight="bold"
              fill={ukc < 0.5 ? '#d42020' : '#008800'}
            >
              FOLGA: {ukc >= 0 ? `+${ukc.toFixed(2)}m livre` : `${ukc.toFixed(2)}m`}
            </text>
          </g>

          {/* Water Height Pointer on right */}
          <g transform={`translate(${svgWidth - 95}, ${waterSurfaceY - 14})`}>
            <polygon points="0,14 12,6 12,22" fill="#000000" />
            <rect x="12" y="2" width="75" height="24" fill="#000000" />
            <text
              x="18"
              y="18"
              fontFamily="Roboto Mono"
              fontSize="11"
              fontWeight="bold"
              fill="#ffffff"
            >
              {displayHeight.toFixed(2)} M
            </text>
          </g>
        </svg>
      </div>

      {/* Interactive Simulation Slider Bar */}
      <div className="mt-4 pt-3 border-t-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase text-[11px] text-[#888888]">
            Simular Variação de Nível:
          </span>
          <span className="font-bold text-black tabular-nums">
            {displayHeight.toFixed(2)}m
          </span>
          {simulationHeight !== null && (
            <span className="text-[10px] bg-[#d42020] text-white px-1.5 py-0.2 font-bold">
              MODO TESTE
            </span>
          )}
        </div>

        <div className="flex-1 max-w-xs flex items-center gap-2">
          <span className="text-[10px] text-[#888888]">0.0m</span>
          <input
            type="range"
            min="0"
            max="3.5"
            step="0.05"
            value={displayHeight}
            onChange={(e) => setSimulationHeight(Number(e.target.value))}
            className="w-full accent-black cursor-pointer"
          />
          <span className="text-[10px] text-[#888888]">3.5m</span>
        </div>

        <div className="text-[11px] text-[#666] flex items-center gap-2">
          <Anchor className="w-3.5 h-3.5 text-black" />
          <span>Calado: <strong>{vessel.draft.toFixed(2)}m</strong></span>
          <span>·</span>
          <span>Prof. Efetiva: <strong>{totalWaterDepth.toFixed(2)}m</strong></span>
        </div>
      </div>
    </div>
  );
};
