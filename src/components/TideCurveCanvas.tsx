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

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxHeight > 4 ? 1.0 : 0.5;
    for (let h = 0; h <= maxHeight; h += step) {
      ticks.push(Math.round(h * 10) / 10);
    }
    return ticks;
  }, [maxHeight]);

  // X-axis ticks
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
    <div className="p-6 bg-white border-b-2 border-black">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888]">
          Harmonic Prediction Curve (Astronomic) // {timeRange}H INTERVAL
        </span>
        {inspectedPoint && (
          <div className="font-mono text-xs font-bold text-[#111111] flex items-center gap-3">
            <span>
              TIME: <span className="text-black">{new Date(inspectedPoint.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
            <span>
              TIDE: <span className="text-[#d42020]">{inspectedPoint.height.toFixed(2)}M</span>
            </span>
            {inspectedUKC && (
              <span>
                UKC: <span className="text-[#008800]">+{inspectedUKC.ukc.toFixed(2)}M</span>
              </span>
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
          {/* Y-axis horizontal grid lines */}
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
                  fontWeight="700"
                  fill="#888888"
                >
                  {tick.toFixed(1)}m
                </text>
              </g>
            );
          })}

          {/* Low tide safety threshold line */}
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

          {/* X-axis vertical grid lines */}
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
                  fontWeight="700"
                  fill="#888888"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* Primary harmonic curve path (Stark ink black) */}
          <path
            d={pathD}
            fill="none"
            stroke="#111111"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Extremes (High Tide / Low Tide markers) */}
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
                  x={extX - 22}
                  y={isPM ? extY - 20 : extY + 8}
                  width="44"
                  height="14"
                  fill="#ffffff"
                  stroke="#111111"
                  strokeWidth="1.5"
                />
                <text
                  x={extX}
                  y={isPM ? extY - 9 : extY + 19}
                  textAnchor="middle"
                  fontFamily="Roboto Mono"
                  fontSize="9"
                  fontWeight="700"
                  fill="#111111"
                >
                  {ext.height.toFixed(2)}m
                </text>
              </g>
            );
          })}

          {/* NOW_TIME indicator (Signal red dashed vertical line) */}
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
                fontWeight="700"
                fill="#d42020"
              >
                NOW_TIME [{new Date(currentTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}]
              </text>
            </g>
          )}

          {/* Hover scrubber */}
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

      {/* 3 Figures strip matching Variation 6 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="border border-black p-3 bg-[#f8f7f4] font-mono text-xs">
          <strong className="block font-bold text-black uppercase text-[11px] mb-0.5">
            FIGURE 01: HARMONICS
          </strong>
          <span className="text-[#888888] text-[11px]">
            Constants: M2, S2, N2, K1, O1, M4 (DHN Astronomical Calibration)
          </span>
        </div>

        <div className="border border-black p-3 bg-[#f8f7f4] font-mono text-xs">
          <strong className="block font-bold text-black uppercase text-[11px] mb-0.5">
            FIGURE 02: BATHYMETRY
          </strong>
          <span className="text-[#888888] text-[11px]">
            Real-time depth integration: Chart Sounding + Tide Height - Draft
          </span>
        </div>

        <div className="border border-black p-3 bg-[#f8f7f4] font-mono text-xs">
          <strong className="block font-bold text-black uppercase text-[11px] mb-0.5">
            FIGURE 03: RULE OF 12ths
          </strong>
          <span className="text-[#888888] text-[11px]">
            Tidal stream flow distribution · Peak velocity in 3rd & 4th hour
          </span>
        </div>
      </div>
    </div>
  );
};
