import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TideStation } from '../types/tide';
import {
  fetch24HourTideRealVsAstro,
  Past24hTideRealVsAstroData,
  HourlyTideRealVsAstro,
} from '../services/realMarineApi';
import {
  Activity,
  Waves,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Info,
  RotateCw,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  Wind,
  Check,
} from 'lucide-react';

interface TideHistory24hRealVsAstroChartProps {
  station: TideStation;
  currentTime?: number;
  className?: string;
}

export const TideHistory24hRealVsAstroChart: React.FC<TideHistory24hRealVsAstroChartProps> = ({
  station,
  currentTime = Date.now(),
  className = '',
}) => {
  const [data, setData] = useState<Past24hTideRealVsAstroData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showReal, setShowReal] = useState<boolean>(true);
  const [showAstro, setShowAstro] = useState<boolean>(true);
  const [showSurgeArea, setShowSurgeArea] = useState<boolean>(true);
  const [hoveredRecord, setHoveredRecord] = useState<HourlyTideRealVsAstro | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetch24HourTideRealVsAstro(station, currentTime);
      setData(result);
    } catch (err) {
      console.warn('Erro ao carregar histórico 24h maré real vs astronômica:', err);
    } finally {
      setLoading(false);
    }
  }, [station, currentTime]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Formata dados para o Recharts
  const chartData = useMemo(() => {
    if (!data || !data.records) return [];
    return data.records.map((r) => ({
      ...r,
      // Para o Recharts exibir com precisão numérica
      real: r.realHeight,
      astronomica: r.astronomicalHeight,
      residuo: r.surgeHeight,
      // Para área de desvio preenchida
      surgePositive: r.surgeHeight > 0 ? r.surgeHeight : 0,
      surgeNegative: r.surgeHeight < 0 ? r.surgeHeight : 0,
    }));
  }, [data]);

  // Limites do eixo Y
  const yDomain = useMemo(() => {
    if (!data) return [0, 3.0];
    const maxVal = Math.max(data.maxRealHeight, data.maxAstroHeight, 2.5);
    const minVal = Math.min(data.minRealHeight, data.minAstroHeight, 0);
    return [
      Math.max(0, Math.floor(minVal * 10) / 10),
      Math.ceil((maxVal + 0.3) * 10) / 10,
    ];
  }, [data]);

  const latestRecord = data?.records[data.records.length - 1];
  const activeRecord = hoveredRecord || latestRecord;

  return (
    <div className={`p-4 sm:p-6 bg-white dark:bg-[#0d1117] border-2 border-black dark:border-[#30363d] font-mono shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] transition-colors ${className}`}>
      {/* 1. CABEÇALHO TÁTICO E CONTROLES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b-2 border-black dark:border-[#30363d] mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e]">
              HIDROGRAFIA RETROSPECTIVA 24H // TELEMETRIA METEOMARINHA
            </span>
            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-[#0284c7] text-white">
              RECHARTS COMPOSITE
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase text-[#111111] dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#0284c7] shrink-0" />
            <span>Histórico de Maré 24h: Real vs. Astronômica</span>
          </h3>
          <p className="text-xs text-[#555] dark:text-[#8b949e] mt-0.5">
            Estação: <strong className="text-black dark:text-white">{station.name}</strong> · Comparação contínua da maré observada (com influência de vento e pressão) contra o cálculo harmônico puro (DHN).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 border-2 border-black dark:border-white bg-[#f8f7f4] dark:bg-[#161b22] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-xs font-bold uppercase cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs"
            title="Atualizar dados de telemetria das últimas 24 horas"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'ATUALIZANDO...' : 'ATUALIZAR'}</span>
          </button>
        </div>
      </div>

      {/* 2. CARTÕES DE TELEMETRIA E RESUMO DAS 24H */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        {/* Card 1: Cota Real Atual */}
        <div className="p-3 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#161b22] flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-[#666] dark:text-[#8b949e] block">
            Cota Real Atual (Medida)
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="font-display text-2xl sm:text-3xl font-black text-[#0284c7] tabular-nums">
              {data ? `${data.currentRealHeight.toFixed(2)}` : '--'}
            </span>
            <span className="text-sm font-bold text-[#0284c7]">m</span>
          </div>
          <span className="text-[10px] font-semibold text-[#444] dark:text-[#aaa]">
            Soma astronômica + maré meteorológica
          </span>
        </div>

        {/* Card 2: Cota Teórica DHN */}
        <div className="p-3 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#161b22] flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-[#666] dark:text-[#8b949e] block">
            Cota Teórica (DHN Harmônica)
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="font-display text-2xl sm:text-3xl font-black text-[#4f46e5] tabular-nums">
              {data ? `${data.currentAstroHeight.toFixed(2)}` : '--'}
            </span>
            <span className="text-sm font-bold text-[#4f46e5]">m</span>
          </div>
          <span className="text-[10px] font-semibold text-[#444] dark:text-[#aaa]">
            Gravitação pura Sol & Lua
          </span>
        </div>

        {/* Card 3: Sobreelevação Atual (Resíduo) */}
        <div className={`p-3 border-2 border-black dark:border-[#30363d] flex flex-col justify-between ${
          data && data.currentSurge > 0.05
            ? 'bg-[#ecfdf5] dark:bg-[#064e3b]/30'
            : data && data.currentSurge < -0.05
            ? 'bg-[#fef2f2] dark:bg-[#7f1d1d]/30'
            : 'bg-[#f8f7f4] dark:bg-[#161b22]'
        }`}>
          <span className="text-[10px] font-bold uppercase text-[#666] dark:text-[#8b949e] block">
            Sobreelevação Atual (Surge)
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className={`font-display text-2xl sm:text-3xl font-black tabular-nums ${
              data && data.currentSurge > 0.05
                ? 'text-[#16a34a]'
                : data && data.currentSurge < -0.05
                ? 'text-[#dc2626]'
                : 'text-[#111111] dark:text-white'
            }`}>
              {data ? `${data.currentSurge >= 0 ? '+' : ''}${data.currentSurge.toFixed(2)}` : '--'}
            </span>
            <span className="text-sm font-bold">m</span>
          </div>
          <span className="text-[10px] font-semibold text-[#444] dark:text-[#aaa]">
            {data ? `${data.currentSurge >= 0 ? 'Sobreelevação' : 'Rebaixamento'} de ${Math.abs(Math.round(data.currentSurge * 100))}cm` : '--'}
          </span>
        </div>

        {/* Card 4: Extremos de Desvio 24h */}
        <div className="p-3 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#161b22] flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-[#666] dark:text-[#8b949e] block">
            Variação Máx. 24h (Desvio)
          </span>
          <div className="flex items-baseline justify-between my-1">
            <span className="text-xs font-bold text-[#16a34a]">
              Máx: {data ? `+${data.maxSurge.toFixed(2)}m` : '--'}
            </span>
            <span className="text-xs font-bold text-[#dc2626]">
              Mín: {data ? `${data.minSurge.toFixed(2)}m` : '--'}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-[#444] dark:text-[#aaa]">
            Média: {data ? `${data.avgSurge >= 0 ? '+' : ''}${data.avgSurge.toFixed(2)}m` : '--'}
          </span>
        </div>
      </div>

      {/* 3. FILTROS INTERATIVOS DE VISIBILIDADE DAS LINHAS */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-[#f8f7f4] dark:bg-[#161b22] p-2.5 border border-black dark:border-[#30363d]">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-bold text-[11px] uppercase text-[#666] dark:text-[#8b949e]">
            LINHAS EXIBIDAS:
          </span>

          <label className="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-[#0d1117] border border-black dark:border-white px-2 py-1 shadow-2xs">
            <input
              type="checkbox"
              checked={showReal}
              onChange={(e) => setShowReal(e.target.checked)}
              className="accent-[#0284c7] cursor-pointer"
            />
            <span className="w-2.5 h-2.5 bg-[#0284c7] inline-block" />
            <span className="font-bold uppercase text-[11px] text-[#0284c7]">
              Maré Real (Observada)
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-[#0d1117] border border-black dark:border-white px-2 py-1 shadow-2xs">
            <input
              type="checkbox"
              checked={showAstro}
              onChange={(e) => setShowAstro(e.target.checked)}
              className="accent-[#4f46e5] cursor-pointer"
            />
            <span className="w-2.5 h-1 border-t-2 border-dashed border-[#4f46e5] inline-block" />
            <span className="font-bold uppercase text-[11px] text-[#4f46e5]">
              Maré Astronômica (DHN)
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-[#0d1117] border border-black dark:border-white px-2 py-1 shadow-2xs">
            <input
              type="checkbox"
              checked={showSurgeArea}
              onChange={(e) => setShowSurgeArea(e.target.checked)}
              className="accent-[#16a34a] cursor-pointer"
            />
            <span className="w-2.5 h-2.5 bg-[#16a34a]/30 border border-[#16a34a] inline-block" />
            <span className="font-bold uppercase text-[11px] text-[#16a34a]">
              Área de Sobreelevação (Surge)
            </span>
          </label>
        </div>

        {activeRecord && (
          <div className="text-[11px] font-bold text-black dark:text-white flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#0284c7]" />
            <span>Ponto: <strong>{activeRecord.fullLabel}</strong></span>
            <span>·</span>
            <span>Real: <strong className="text-[#0284c7]">{activeRecord.realHeight.toFixed(2)}m</strong></span>
            <span>·</span>
            <span>Astro: <strong className="text-[#4f46e5]">{activeRecord.astronomicalHeight.toFixed(2)}m</strong></span>
            <span>·</span>
            <span className={activeRecord.surgeHeight >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}>
              Δ: <strong>{activeRecord.surgeHeight >= 0 ? '+' : ''}{activeRecord.surgeHeight.toFixed(2)}m</strong>
            </span>
          </div>
        )}
      </div>

      {/* 4. GRÁFICO DE LINHA RECHARTS */}
      <div className="w-full h-[320px] sm:h-[380px] bg-white dark:bg-[#0d1117] border-2 border-black dark:border-[#30363d] p-2 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-black dark:text-white uppercase">
              <RotateCw className="w-4 h-4 animate-spin text-[#0284c7]" />
              <span>Sincronizando telemetria de 24 horas...</span>
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 15, right: 20, left: -10, bottom: 20 }}
            onMouseMove={(e: any) => {
              if (e && e.activePayload && e.activePayload.length > 0) {
                setHoveredRecord(e.activePayload[0].payload as HourlyTideRealVsAstro);
              }
            }}
            onMouseLeave={() => setHoveredRecord(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2dfd9" vertical={false} />

            <XAxis
              dataKey="timeStr"
              stroke="#666"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#111111', strokeWidth: 1.5 }}
              interval="preserveStartEnd"
              tickFormatter={(val, idx) => {
                const item = chartData[idx];
                if (!item) return val;
                // Exibe label especial para 00:00 (meia-noite) e agora
                if (item.hour === 0) return `${item.dateStr} 00h`;
                if (item.isCurrentHour) return 'Agora';
                return val;
              }}
            />

            <YAxis
              stroke="#666"
              fontSize={10}
              domain={yDomain}
              tickLine={false}
              axisLine={{ stroke: '#111111', strokeWidth: 1.5 }}
              tickFormatter={(v) => `${Number(v).toFixed(1)}m`}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload as HourlyTideRealVsAstro;
                  return (
                    <div className="bg-black/95 text-white p-3 border-2 border-white shadow-[3px_3px_0px_#000] text-xs font-mono space-y-1.5 min-w-[220px]">
                      <div className="font-bold text-white border-b border-white/20 pb-1 flex items-center justify-between">
                        <span>{p.fullLabel}</span>
                        {p.isCurrentHour && (
                          <span className="bg-[#0284c7] text-white px-1 py-0.2 text-[9px] font-black uppercase">
                            AGORA
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[#38bdf8]">
                        <span>Maré Real (Medida):</span>
                        <strong className="text-base tabular-nums">{p.realHeight.toFixed(2)}m</strong>
                      </div>

                      <div className="flex items-center justify-between text-[#818cf8]">
                        <span>Maré Astronômica (DHN):</span>
                        <strong className="text-base tabular-nums">{p.astronomicalHeight.toFixed(2)}m</strong>
                      </div>

                      <div className={`flex items-center justify-between pt-1 border-t border-white/10 ${
                        p.surgeHeight >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'
                      }`}>
                        <span>Sobreelevação (Surge):</span>
                        <strong className="tabular-nums">
                          {p.surgeHeight >= 0 ? '+' : ''}{p.surgeHeight.toFixed(2)}m ({Math.abs(Math.round(p.surgeHeight * 100))}cm)
                        </strong>
                      </div>

                      <div className="text-[10px] text-[#aaa] pt-1 border-t border-white/10 flex items-center justify-between">
                        <span>Pressão / Vento:</span>
                        <span>{p.pressureHpa} hPa · {p.windSpeedKmH} km/h</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Zero Hidrográfico ReferenceLine (0.00m) */}
            <ReferenceLine
              y={0}
              stroke="#6b7280"
              strokeDasharray="4 4"
              label={{
                value: 'Zero Hidrográfico (0.00m)',
                position: 'insideBottomLeft',
                fill: '#6b7280',
                fontSize: 9,
                fontWeight: 'bold',
              }}
            />

            {/* Nível Médio da Estação (Z0) */}
            {station.meanSeaLevel > 0 && (
              <ReferenceLine
                y={station.meanSeaLevel}
                stroke="#9ca3af"
                strokeDasharray="2 2"
                label={{
                  value: `Nível Médio Z0 (${station.meanSeaLevel.toFixed(2)}m)`,
                  position: 'insideTopLeft',
                  fill: '#9ca3af',
                  fontSize: 9,
                }}
              />
            )}

            {/* Linha da hora atual */}
            {latestRecord && (
              <ReferenceLine
                x={latestRecord.timeStr}
                stroke="#111111"
                strokeWidth={2}
                label={{
                  value: 'HORA ATUAL',
                  position: 'top',
                  fill: '#111111',
                  fontSize: 9,
                  fontWeight: 'bold',
                }}
              />
            )}

            {/* Área sombreada opcional para visualizar o volume da maré real */}
            {showReal && (
              <Area
                type="monotone"
                dataKey="real"
                fill="#0284c7"
                fillOpacity={0.08}
                stroke="none"
              />
            )}

            {/* Linha 1: Maré Real Observada */}
            {showReal && (
              <Line
                type="monotone"
                dataKey="real"
                name="Maré Real (Observada / Meteorológica)"
                stroke="#0284c7"
                strokeWidth={3}
                dot={{ r: 2.5, fill: '#0284c7', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#ffffff', stroke: '#0284c7', strokeWidth: 3 }}
              />
            )}

            {/* Linha 2: Maré Astronômica Pura (DHN) */}
            {showAstro && (
              <Line
                type="monotone"
                dataKey="astronomica"
                name="Maré Astronômica (Teórica DHN)"
                stroke="#4f46e5"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, fill: '#ffffff', stroke: '#4f46e5', strokeWidth: 2 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 5. LEGENDA EXPLICATIVA NÁUTICA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
        <div className="border border-black dark:border-[#30363d] p-3 bg-[#f8f7f4] dark:bg-[#161b22]">
          <div className="flex items-center gap-1.5 font-bold text-black dark:text-white uppercase text-[11px] mb-1">
            <span className="w-2.5 h-2.5 bg-[#0284c7] inline-block" />
            <span>1. Maré Real (Observada)</span>
          </div>
          <p className="text-[#666] dark:text-[#8b949e] text-[11px] leading-relaxed">
            Representa a lâmina d'água física medida. Inclui a gravitação astronômica somada ao empilhamento de vento costeiro e efeito barométrico invertido.
          </p>
        </div>

        <div className="border border-black dark:border-[#30363d] p-3 bg-[#f8f7f4] dark:bg-[#161b22]">
          <div className="flex items-center gap-1.5 font-bold text-black dark:text-white uppercase text-[11px] mb-1">
            <span className="w-2.5 h-1 border-t-2 border-dashed border-[#4f46e5] inline-block" />
            <span>2. Maré Astronômica (DHN)</span>
          </div>
          <p className="text-[#666] dark:text-[#8b949e] text-[11px] leading-relaxed">
            Curva puramente gravitacional calculada pelas 6 constantes harmônicas oficiais da Marinha do Brasil ($M_2, S_2, N_2, K_1, O_1, M_4$).
          </p>
        </div>

        <div className="border border-black dark:border-[#30363d] p-3 bg-[#f8f7f4] dark:bg-[#161b22]">
          <div className="flex items-center gap-1.5 font-bold text-black dark:text-white uppercase text-[11px] mb-1">
            <Gauge className="w-3.5 h-3.5 text-[#16a34a]" />
            <span>3. Sobreelevação (Surge)</span>
          </div>
          <p className="text-[#666] dark:text-[#8b949e] text-[11px] leading-relaxed">
            Diferença entre o nível real e o teórico. Uma queda na pressão barométrica abaixo de 1013 hPa eleva o nível do mar em ~1 cm por hPa.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TideHistory24hRealVsAstroChart;
