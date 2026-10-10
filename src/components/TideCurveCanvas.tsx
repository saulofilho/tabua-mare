import React, { useState, useMemo } from 'react';
import { TidePoint, TideStation, VesselProfile } from '../types/tide';
import { generateTideCurve, findTideExtremes, calculateUKC } from '../utils/tideHarmonics';

interface TideCurveCanvasProps {
  station: TideStation;
  vessel: VesselProfile;
  currentTime: number;
  lowTideAlertThreshold?: number;
  timeRange?: 24 | 168;
}

export const TideCurveCanvas: React.FC<TideCurveCanvasProps> = ({
  station,
  vessel,
  currentTime,
  lowTideAlertThreshold = 0.55,
  timeRange = 24,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<TidePoint | null>(null);

  const startTime = useMemo(() => {
    return currentTime - 2 * 3600 * 1000;
  }, [currentTime]);

  const intervalMinutes = timeRange === 168 ? 60 : 15;

  const points = useMemo(() => {
    return generateTideCurve(station, startTime, timeRange, intervalMinutes);
  }, [station, startTime, timeRange, intervalMinutes]);

  const extremes = useMemo(() => {
    return findTideExtremes(station, startTime, timeRange);
  }, [station, startTime, timeRange]);

  const minHeight = 0;
  const maxHeight = useMemo(() => {
    const maxVal = Math.max(...points.map((p) => p.height), 2.5);
    return Math.ceil(maxVal * 10) / 10 + 0.4;
  }, [points]);

  const svgWidth = 1000;
  const svgHeight = 220;
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  const getX = (timestamp: number) => {
    const ratio = (timestamp - startTime) / (timeRange * 3600 * 1000);
    return padding.left + ratio * graphWidth;
  };

  const getY = (height: number) => {
    const ratio = (height - minHeight) / (maxHeight - minHeight);
    return padding.top + (1 - ratio) * graphHeight;
  };

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, index) => {
      const x = getX(pt.timestamp);
      const y = getY(pt.height);
      return index === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [points, minHeight, maxHeight, startTime, timeRange]);

  const currentX = getX(currentTime);

  // Ticks do eixo Y
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxHeight > 4 ? 1.0 : 0.5;
    for (let h = 0; h <= maxHeight; h += step) {
      ticks.push(Math.round(h * 10) / 10);
    }
    return ticks;
  }, [maxHeight]);

  // Ticks do eixo X
  const xTicks = useMemo(() => {
    const ticks: { timestamp: number; label: string }[] = [];
    const stepHours = timeRange === 168 ? 24 : 3;
    const startHourDate = new Date(startTime);
    startHourDate.setMinutes(0, 0, 0);
    let t = startHourDate.getTime();
    const endT = startTime + timeRange * 3600 * 1000;

    while (t <= endT) {
      if (t >= startTime) {
        const d = new Date(t);
        const hours = String(d.getHours()).padStart(2, '0');
        const day = d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);
        const label = timeRange === 168 ? `${day} ${hours}h` : `${hours}:00`;
        ticks.push({ timestamp: t, label });
      }
      t += stepHours * 3600 * 1000;
    }
    return ticks;
  }, [startTime, timeRange]);

  const inspectedPoint = hoveredPoint || points.find(
    (p) => Math.abs(p.timestamp - currentTime) < 15 * 60 * 1000
  ) || points[0];

  const inspectedUKC = inspectedPoint
    ? calculateUKC(2.5, inspectedPoint.height, vessel.draft)
    : null;

  return (
    <div className="p-6 bg-white border-b-2 border-black font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888] block">
            Gráfico Contínuo das Marés // {timeRange === 24 ? 'Previsão de 24 Horas' : 'Previsão de 7 Dias'}
          </span>
          <h4 className="font-display text-xl font-bold uppercase text-black">
            Como a Maré vai Subir e Descer ao Longo do Dia
          </h4>
        </div>

        {inspectedPoint && (
          <div className="text-xs font-bold text-[#111111] flex flex-wrap items-center gap-3 bg-[#f8f7f4] border border-black p-1.5 px-3">
            <span>
              HORÁRIO: <strong className="text-black">{new Date(inspectedPoint.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
            </span>
            <span>·</span>
            <span>
              ALTURA: <strong className="text-[#3b82f6]">{inspectedPoint.height.toFixed(2)}m</strong>
            </span>
            {inspectedUKC && (
              <>
                <span>·</span>
                <span>
                  FOLGA DO BARCO: <strong className={inspectedUKC.safetyStatus === 'safe' ? 'text-[#008800]' : 'text-[#d42020]'}>+{inspectedUKC.ukc.toFixed(2)}m livre</strong>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[700px] h-auto select-none overflow-visible cursor-crosshair"
          onMouseLeave={() => setHoveredPoint(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const svgX = (mouseX / rect.width) * svgWidth;
            if (svgX >= padding.left && svgX <= svgWidth - padding.right) {
              const ratio = (svgX - padding.left) / graphWidth;
              const targetTime = startTime + ratio * timeRange * 3600 * 1000;
              let closest = points[0];
              let minDiff = Infinity;
              for (const p of points) {
                const diff = Math.abs(p.timestamp - targetTime);
                if (diff < minDiff) {
                  minDiff = diff;
                  closest = p;
                }
              }
              setHoveredPoint(closest);
            }
          }}
        >
          {/* Linhas horizontais de altura da água */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={`y-${tick}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="#e2dfd9"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontFamily="Roboto Mono"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#888888"
                >
                  {tick.toFixed(1)}m
                </text>
              </g>
            );
          })}

          {/* Linha de alerta de maré muito baixa */}
          {lowTideAlertThreshold > 0 && (
            <line
              x1={padding.left}
              y1={getY(lowTideAlertThreshold)}
              x2={svgWidth - padding.right}
              y2={getY(lowTideAlertThreshold)}
              stroke="#d42020"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {/* Linhas verticais de horário */}
          {xTicks.map((tick) => {
            const x = getX(tick.timestamp);
            return (
              <g key={`x-${tick.timestamp}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={svgHeight - padding.bottom}
                  stroke="#e2dfd9"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={x}
                  y={svgHeight - padding.bottom + 16}
                  textAnchor="middle"
                  fontFamily="Roboto Mono"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#888888"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* Curva da maré contínua em tinta preta de alto contraste */}
          <path
            d={pathD}
            fill="none"
            stroke="#111111"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Pontos de Maré Alta e Maré Baixa */}
          {extremes.map((ext, idx) => {
            const extX = getX(ext.timestamp);
            if (extX < padding.left || extX > svgWidth - padding.right) return null;
            const extY = getY(ext.height);
            const isPM = ext.type === 'preia-mar';

            return (
              <g key={`ext-${idx}`}>
                <circle
                  cx={extX}
                  cy={extY}
                  r="4"
                  fill={isPM ? '#111111' : '#d42020'}
                />
                <rect
                  x={extX - 25}
                  y={isPM ? extY - 22 : extY + 8}
                  width="50"
                  height="16"
                  fill="#ffffff"
                  stroke="#111111"
                  strokeWidth="1.5"
                />
                <text
                  x={extX}
                  y={isPM ? extY - 10 : extY + 20}
                  textAnchor="middle"
                  fontFamily="Roboto Mono"
                  fontSize="9"
                  fontWeight="bold"
                  fill="#111111"
                >
                  {isPM ? 'ALTA' : 'BAIXA'} {ext.height.toFixed(2)}m
                </text>
              </g>
            );
          })}

          {/* Indicador do MOMENTO ATUAL (Linha vermelha tracejada) */}
          {currentX >= padding.left && currentX <= svgWidth - padding.right && (
            <g>
              <line
                x1={currentX}
                y1={0}
                x2={currentX}
                y2={svgHeight}
                stroke="#d42020"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <text
                x={currentX + 8}
                y={18}
                fontFamily="Roboto Mono"
                fontSize="11"
                fontWeight="bold"
                fill="#d42020"
              >
                MOMENTO ATUAL [{new Date(currentTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}]
              </text>
            </g>
          )}

          {/* Scrubber do mouse ao passar por cima */}
          {hoveredPoint && (
            <g>
              <line
                x1={getX(hoveredPoint.timestamp)}
                y1={padding.top}
                x2={getX(hoveredPoint.timestamp)}
                y2={svgHeight - padding.bottom}
                stroke="#000000"
                strokeWidth="1"
              />
              <circle
                cx={getX(hoveredPoint.timestamp)}
                cy={getY(hoveredPoint.height)}
                r="5"
                fill="#d42020"
                stroke="#000000"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Faixa explicativa em Português simples */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
        <div className="border border-black p-3 bg-[#f8f7f4]">
          <strong className="block font-bold text-black uppercase text-[11px] mb-0.5">
            1. Previsão Astronômica Real
          </strong>
          <span className="text-[#666] text-[11px] leading-relaxed">
            Calculada a partir das posições exatas da Lua e do Sol sobre o litoral brasileiro, sem dados fictícios.
          </span>
        </div>

        <div className="border border-black p-3 bg-[#f8f7f4]">
          <strong className="block font-bold text-black uppercase text-[11px] mb-0.5">
            2. Profundidade Total com a Maré
          </strong>
          <span className="text-[#666] text-[11px] leading-relaxed">
            A lâmina d'água no mapa soma a profundidade do fundo à altura da maré de agora para garantir que o barco passe livre.
          </span>
        </div>

        <div className="border border-black p-3 bg-[#f8f7f4]">
          <strong className="block font-bold text-black uppercase text-[11px] mb-0.5">
            3. Força da Correnteza Marítima
          </strong>
          <span className="text-[#666] text-[11px] leading-relaxed">
            A corrente de maré atinge seu fluxo mais veloz entre a 3ª e a 4ª hora após a maré virar (Regra dos Dozeavos).
          </span>
        </div>
      </div>
    </div>
  );
};
