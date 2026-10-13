import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Clock, Waves, Wind } from 'lucide-react';
import {
  HourlyWaveWindForecast,
  getBeaufortScale,
  getWaveCondition,
} from '../services/realMarineApi';

interface RechartsWaveWindGraphProps {
  forecast: HourlyWaveWindForecast[];
  displayMode: 'both' | 'waves' | 'wind';
  selectedHour: HourlyWaveWindForecast | null;
  onSelectHour: (hour: HourlyWaveWindForecast) => void;
}

export const RechartsWaveWindGraph: React.FC<RechartsWaveWindGraphProps> = ({
  forecast,
  displayMode,
  selectedHour: _selectedHour,
  onSelectHour,
}) => {
  // Tooltip customizado com visual tático de alta legibilidade
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: HourlyWaveWindForecast = payload[0].payload;
      const beaufort = getBeaufortScale(data.windSpeedKmH);
      const waveCond = getWaveCondition(data.waveHeightMeters);

      return (
        <div className="bg-white dark:bg-[#161b22] border-2 border-black dark:border-white p-3 font-mono shadow-[4px_4px_0px_#000] text-xs max-w-xs z-50">
          <div className="flex items-center justify-between border-b border-black/20 dark:border-white/20 pb-1.5 mb-2">
            <span className="font-bold text-black dark:text-white uppercase flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#d42020]" />
              {data.dayLabel} às {data.fullTimeStr}
            </span>
            {data.isCurrentHour && (
              <span className="bg-[#d42020] text-white text-[9px] font-bold px-1 uppercase">
                Agora
              </span>
            )}
          </div>

          <div className="space-y-2">
            {/* Altura das Ondas */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[#0284c7] font-bold flex items-center gap-1">
                  <Waves className="w-3.5 h-3.5" />
                  Altura das Ondas:
                </span>
                <span className="text-[10px] text-[#666] dark:text-[#aaa] block">
                  {waveCond.name}
                </span>
              </div>
              <div className="text-right">
                <span className="font-display text-base font-bold text-black dark:text-white tabular-nums">
                  {data.waveHeightMeters.toFixed(1)} m
                </span>
              </div>
            </div>

            {/* Velocidade do Vento */}
            <div className="flex items-start justify-between gap-3 border-t border-black/10 dark:border-white/10 pt-1.5">
              <div>
                <span className="text-[#d97706] font-bold flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5" />
                  Vento de Superfície:
                </span>
                <span className="text-[10px] text-[#666] dark:text-[#aaa] block">
                  F{beaufort.scale} • {beaufort.name}
                </span>
              </div>
              <div className="text-right">
                <span className="font-display text-base font-bold text-black dark:text-white tabular-nums">
                  {data.windSpeedKmH.toFixed(0)} km/h
                </span>
                <span className="text-[10px] text-[#666] dark:text-[#aaa] block tabular-nums">
                  ({data.windSpeedKnots.toFixed(1)} nós)
                </span>
              </div>
            </div>

            <div className="text-[9px] text-[#777] dark:text-[#999] pt-1 border-t border-black/10 dark:border-white/10">
              Efeito no mar: {beaufort.seaCondition}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={forecast}
          margin={{ top: 20, right: 25, left: -10, bottom: 15 }}
          onClick={(state: any) => {
            if (state && state.activePayload && state.activePayload.length) {
              onSelectHour(state.activePayload[0].payload);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.2} vertical={false} />

          <XAxis
            dataKey="timeStr"
            tick={{ fontSize: 11, fontFamily: 'Roboto Mono', fill: '#666666' }}
            tickLine={{ stroke: '#888888' }}
            axisLine={{ stroke: '#888888' }}
          />

          {/* Eixo Y Esquerdo: Altura das Ondas (Metros) */}
          {(displayMode === 'both' || displayMode === 'waves') && (
            <YAxis
              yAxisId="waves"
              orientation="left"
              domain={[0, (dataMax: number) => Math.ceil((dataMax + 0.3) * 10) / 10]}
              tick={{ fontSize: 11, fontFamily: 'Roboto Mono', fill: '#0284c7' }}
              tickFormatter={(val) => `${val.toFixed(1)}m`}
              axisLine={{ stroke: '#0284c7' }}
              tickLine={{ stroke: '#0284c7' }}
              label={{
                value: 'Ondas (m)',
                angle: -90,
                position: 'insideLeft',
                offset: 15,
                style: {
                  textAnchor: 'middle',
                  fontSize: 10,
                  fill: '#0284c7',
                  fontFamily: 'Roboto Mono',
                  fontWeight: 'bold',
                },
              }}
            />
          )}

          {/* Eixo Y Direito: Velocidade do Vento (km/h) */}
          {(displayMode === 'both' || displayMode === 'wind') && (
            <YAxis
              yAxisId="wind"
              orientation="right"
              domain={[0, (dataMax: number) => Math.ceil((dataMax + 8) / 5) * 5]}
              tick={{ fontSize: 11, fontFamily: 'Roboto Mono', fill: '#d97706' }}
              tickFormatter={(val) => `${val} km/h`}
              axisLine={{ stroke: '#d97706' }}
              tickLine={{ stroke: '#d97706' }}
              label={{
                value: 'Vento (km/h)',
                angle: 90,
                position: 'insideRight',
                offset: 15,
                style: {
                  textAnchor: 'middle',
                  fontSize: 10,
                  fill: '#d97706',
                  fontFamily: 'Roboto Mono',
                  fontWeight: 'bold',
                },
              }}
            />
          )}

          <Tooltip content={<CustomTooltip />} />

          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontFamily: 'Roboto Mono' }}
          />

          {/* Barra 1: Altura das Ondas (Azul Oceânico) */}
          {(displayMode === 'both' || displayMode === 'waves') && (
            <Bar
              yAxisId="waves"
              dataKey="waveHeightMeters"
              name="Altura das Ondas (m)"
              fill="#0284c7"
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
            />
          )}

          {/* Barra 2: Velocidade do Vento (Âmbar Tático) */}
          {(displayMode === 'both' || displayMode === 'wind') && (
            <Bar
              yAxisId="wind"
              dataKey="windSpeedKmH"
              name="Velocidade do Vento (km/h)"
              fill="#d97706"
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RechartsWaveWindGraph;
