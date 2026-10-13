import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TideStation } from '../types/tide';
import { findTideExtremes, getMoonPhaseInfo } from '../utils/tideHarmonics';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Waves,
  Moon,
  Info,
  ChevronRight,
  Compass,
} from 'lucide-react';

interface WeeklyTideStatsChartProps {
  station: TideStation;
  currentTime?: number;
}

interface DailyTideStat {
  dayIndex: number;
  dateStr: string;
  dayShort: string;
  dayFull: string;
  isToday: boolean;
  maxHeight: number;
  minHeight: number;
  dailyRange: number;
  dailyDisplacement: number;
  accumulatedDisplacement: number;
  accumulatedRange: number;
  cyclesCount: number;
  highCount: number;
  lowCount: number;
  moonName: string;
  isSpringTide: boolean;
  eventsSummary: string;
}

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export const WeeklyTideStatsChart: React.FC<WeeklyTideStatsChartProps> = ({
  station,
  currentTime = Date.now(),
}) => {
  const [viewMetric, setViewMetric] = useState<'cumulative' | 'extremes' | 'displacement'>('cumulative');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(0);

  // Calcula estatísticas dos 7 dias a partir do dia atual
  const stats = useMemo<DailyTideStat[]>(() => {
    const list: DailyTideStat[] = [];
    const now = new Date(currentTime);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let runningDisplacement = 0;
    let runningRange = 0;

    for (let i = 0; i < 7; i++) {
      const dayStart = startOfToday + i * 24 * 60 * 60 * 1000;
      const dayDate = new Date(dayStart);
      const dayWeekday = dayDate.getDay();
      const dayNum = String(dayDate.getDate()).padStart(2, '0');
      const monthNum = String(dayDate.getMonth() + 1).padStart(2, '0');

      // Calcula extremos de maré (Preia-mar e Baixa-mar) para este dia
      const extremes = findTideExtremes(station, dayStart, 24);
      const highs = extremes.filter((e) => e.type === 'preia-mar');
      const lows = extremes.filter((e) => e.type === 'baixa-mar');

      // Alturas máxima e mínima
      const allHeights = extremes.map((e) => e.height);
      const maxHeight = allHeights.length > 0 ? Math.max(...allHeights) : station.meanSeaLevel + 0.8;
      const minHeight = allHeights.length > 0 ? Math.min(...allHeights) : Math.max(0.1, station.meanSeaLevel - 0.8);
      const dailyRange = Math.round(Math.max(0, maxHeight - minHeight) * 100) / 100;

      // Deslocamento vertical diário (soma dos deltas entre extremos consecutivos ordenados)
      let dailyDisplacement = 0;
      if (extremes.length >= 2) {
        for (let k = 1; k < extremes.length; k++) {
          dailyDisplacement += Math.abs(extremes[k].height - extremes[k - 1].height);
        }
      } else {
        dailyDisplacement = dailyRange * 2;
      }
      dailyDisplacement = Math.round(dailyDisplacement * 100) / 100;

      runningDisplacement += dailyDisplacement;
      runningRange += dailyRange;

      const moon = getMoonPhaseInfo(dayStart + 12 * 60 * 60 * 1000);

      list.push({
        dayIndex: i,
        dateStr: `${dayNum}/${monthNum}`,
        dayShort: `${WEEKDAY_NAMES[dayWeekday]} ${dayNum}/${monthNum}`,
        dayFull: `${WEEKDAY_FULL[dayWeekday]}, ${dayNum}/${monthNum}`,
        isToday: i === 0,
        maxHeight: Math.round(maxHeight * 100) / 100,
        minHeight: Math.round(minHeight * 100) / 100,
        dailyRange,
        dailyDisplacement,
        accumulatedDisplacement: Math.round(runningDisplacement * 100) / 100,
        accumulatedRange: Math.round(runningRange * 100) / 100,
        cyclesCount: extremes.length,
        highCount: highs.length,
        lowCount: lows.length,
        moonName: moon.phaseName,
        isSpringTide: moon.isSpringTide,
        eventsSummary: `${highs.length} Preia-mar, ${lows.length} Baixa-mar`,
      });
    }

    return list;
  }, [station, currentTime]);

  // Totais e Métricas da Semana
  const summaryMetrics = useMemo(() => {
    if (stats.length === 0) {
      return {
        totalAccumulated: 0,
        maxDailyRange: 0,
        minDailyRange: 0,
        avgDailyRange: 0,
        peakDay: '',
        maxHeightWeek: 0,
        minHeightWeek: 0,
      };
    }

    const totalAccumulated = stats[stats.length - 1].accumulatedDisplacement;
    const ranges = stats.map((s) => s.dailyRange);
    const maxDailyRange = Math.max(...ranges);
    const minDailyRange = Math.min(...ranges);
    const avgDailyRange =
      Math.round((ranges.reduce((acc, r) => acc + r, 0) / ranges.length) * 100) / 100;

    const peakStat = stats.find((s) => s.dailyRange === maxDailyRange) || stats[0];
    const maxHeightWeek = Math.max(...stats.map((s) => s.maxHeight));
    const minHeightWeek = Math.min(...stats.map((s) => s.minHeight));

    return {
      totalAccumulated,
      maxDailyRange,
      minDailyRange,
      avgDailyRange,
      peakDay: peakStat.dayShort,
      maxHeightWeek,
      minHeightWeek,
    };
  }, [stats]);

  const selectedDay = selectedDayIndex !== null ? stats[selectedDayIndex] : stats[0];

  // Tooltip Tático Customizado do Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: DailyTideStat = payload[0].payload;
      const progressPercent = Math.round(
        (data.accumulatedDisplacement / summaryMetrics.totalAccumulated) * 100
      );

      return (
        <div className="bg-white border-2 border-black p-3.5 font-mono shadow-[4px_4px_0px_#000] text-xs max-w-xs z-50">
          <div className="flex items-center justify-between border-b border-black/20 pb-1.5 mb-2">
            <span className="font-bold text-black uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#d42020]" />
              {data.dayFull}
            </span>
            {data.isToday && (
              <span className="bg-[#d42020] text-white text-[9px] font-bold px-1.5 py-0.5 uppercase">
                Hoje
              </span>
            )}
          </div>

          <div className="space-y-2">
            {/* Variação Acumulada */}
            <div className="flex items-baseline justify-between">
              <span className="text-[#0284c7] font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Variação Acumulada:
              </span>
              <span className="font-display font-bold text-sm text-[#0284c7] tabular-nums">
                {data.accumulatedDisplacement.toFixed(2)} m
                <span className="text-[10px] text-[#666] font-normal ml-1">({progressPercent}%)</span>
              </span>
            </div>

            {/* Amplitude do Dia */}
            <div className="flex items-baseline justify-between border-t border-black/10 pt-1.5">
              <span className="text-[#111111] font-semibold flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-[#d97706]" />
                Amplitude do Dia:
              </span>
              <span className="font-bold text-black tabular-nums">
                {data.dailyRange.toFixed(2)} m
              </span>
            </div>

            {/* Cotas Máx / Mín */}
            <div className="flex items-center justify-between text-[11px] bg-[#f8f7f4] p-1.5 border border-black/20">
              <span className="text-[#008800] font-bold flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                Alta: {data.maxHeight.toFixed(2)}m
              </span>
              <span className="text-[#d42020] font-bold flex items-center gap-0.5">
                <ArrowDownRight className="w-3 h-3" />
                Baixa: {data.minHeight.toFixed(2)}m
              </span>
            </div>

            {/* Fase da Lua & Ciclos */}
            <div className="text-[10px] text-[#555] pt-1 border-t border-black/10 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Moon className="w-3 h-3 text-black" />
                {data.moonName}
              </span>
              <span className="font-bold uppercase text-[9px] text-[#888]">
                {data.cyclesCount} marés
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full font-mono space-y-5">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b-2 border-black">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#0066cc]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
              Análise Preditiva Semanal // {station.name}
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase text-black mt-0.5">
            Estatísticas & Variação Acumulada da Maré (7 Dias)
          </h3>
          <p className="text-xs text-[#555] mt-1 max-w-3xl">
            Acompanhe o volume acumulado de oscilação vertical da maré ao longo da semana. Entenda a intensidade da troca hídrica, correntes de sizígia e as maiores amplitudes para navegação e lazer.
          </p>
        </div>

        {/* Seletor de Modo de Visualização do Gráfico */}
        <div className="flex items-center gap-1.5 shrink-0 bg-[#f8f7f4] p-1 border-2 border-black">
          <button
            onClick={() => setViewMetric('cumulative')}
            className={`px-3 py-1.5 text-xs font-bold uppercase border border-black cursor-pointer transition-colors ${
              viewMetric === 'cumulative'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-[#eee]'
            }`}
          >
            Variação Acumulada
          </button>
          <button
            onClick={() => setViewMetric('extremes')}
            className={`px-3 py-1.5 text-xs font-bold uppercase border border-black cursor-pointer transition-colors ${
              viewMetric === 'extremes'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-[#eee]'
            }`}
          >
            Extremos & Cotas
          </button>
          <button
            onClick={() => setViewMetric('displacement')}
            className={`px-3 py-1.5 text-xs font-bold uppercase border border-black cursor-pointer transition-colors ${
              viewMetric === 'displacement'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-[#eee]'
            }`}
          >
            Sobe-e-Desce Diário
          </button>
        </div>
      </div>

      {/* Cartões Táticos com Métricas-Chave da Semana */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Métrica 1: Variação Total Acumulada */}
        <div className="p-4 bg-[#f0f9ff] border-2 border-black shadow-[3px_3px_0px_#000]">
          <span className="block text-[10px] font-bold uppercase text-[#0369a1] tracking-wider mb-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Variação Total Acumulada
          </span>
          <div className="font-display text-3xl sm:text-4xl font-bold text-black tabular-nums">
            {summaryMetrics.totalAccumulated.toFixed(2)}
            <span className="text-lg font-mono ml-1 text-[#0369a1]">M</span>
          </div>
          <p className="text-[11px] text-[#444] mt-1.5 leading-tight">
            Soma de todo o deslocamento vertical de água (subida + descida) nos 7 dias.
          </p>
        </div>

        {/* Métrica 2: Maior Amplitude (Pico de Sizígia) */}
        <div className="p-4 bg-[#fffbeb] border-2 border-black shadow-[3px_3px_0px_#000]">
          <span className="block text-[10px] font-bold uppercase text-[#b45309] tracking-wider mb-1 flex items-center gap-1">
            <Waves className="w-3.5 h-3.5" />
            Maior Amplitude Diária
          </span>
          <div className="font-display text-3xl sm:text-4xl font-bold text-black tabular-nums">
            {summaryMetrics.maxDailyRange.toFixed(2)}
            <span className="text-lg font-mono ml-1 text-[#b45309]">M</span>
          </div>
          <p className="text-[11px] text-[#444] mt-1.5 leading-tight">
            Pico de variação na semana registrado em <strong>{summaryMetrics.peakDay}</strong>.
          </p>
        </div>

        {/* Métrica 3: Média Diária de Amplitude */}
        <div className="p-4 bg-[#f8f7f4] border-2 border-black shadow-[3px_3px_0px_#000]">
          <span className="block text-[10px] font-bold uppercase text-[#666] tracking-wider mb-1 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5 text-black" />
            Média Diária de Amplitude
          </span>
          <div className="font-display text-3xl sm:text-4xl font-bold text-black tabular-nums">
            {summaryMetrics.avgDailyRange.toFixed(2)}
            <span className="text-lg font-mono ml-1 text-[#666]">M/DIA</span>
          </div>
          <p className="text-[11px] text-[#444] mt-1.5 leading-tight">
            Mínima: {summaryMetrics.minDailyRange.toFixed(2)}m • Máxima: {summaryMetrics.maxDailyRange.toFixed(2)}m.
          </p>
        </div>

        {/* Métrica 4: Extremos Globais da Semana */}
        <div className="p-4 bg-[#fdf2f8] border-2 border-black shadow-[3px_3px_0px_#000]">
          <span className="block text-[10px] font-bold uppercase text-[#be185d] tracking-wider mb-1 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5" />
            Cotas Globais da Semana
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <div className="font-display text-2xl font-bold text-[#008800] tabular-nums">
              +{summaryMetrics.maxHeightWeek.toFixed(2)}m
            </div>
            <span className="text-xs text-[#888]">/</span>
            <div className="font-display text-2xl font-bold text-[#d42020] tabular-nums">
              {summaryMetrics.minHeightWeek.toFixed(2)}m
            </div>
          </div>
          <p className="text-[11px] text-[#444] mt-1.5 leading-tight">
            Nível máximo de maré alta e nível mínimo de recuo absoluto no período.
          </p>
        </div>
      </div>

      {/* Gráfico Interativo com Recharts */}
      <div className="border-2 border-black bg-white p-4 sm:p-5 shadow-[4px_4px_0px_#000]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-black/15 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold uppercase text-[11px] text-black">
              {viewMetric === 'cumulative'
                ? 'Curva de Variação Acumulada (m) vs. Amplitude Diária (m)'
                : viewMetric === 'extremes'
                ? 'Oscilação entre Preia-mar Máxima e Baixa-mar Mínima (m)'
                : 'Deslocamento Vertical Total por Dia (m de água movimentada)'}
            </span>
            <span className="text-[10px] bg-[#eee] px-2 py-0.5 border border-black/40 font-bold uppercase">
              7 Dias Previsionais
            </span>
          </div>
          <span className="text-[10px] text-[#666]">
            Clique em qualquer dia para ver a análise tática detalhada
          </span>
        </div>

        {/* Container Gráfico com Recharts */}
        <div className="h-[320px] sm:h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={stats}
              margin={{ top: 15, right: 25, left: -10, bottom: 10 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length) {
                  setSelectedDayIndex(state.activePayload[0].payload.dayIndex);
                }
              }}
            >
              <defs>
                {/* Gradiente Azul Oceânico para Variação Acumulada */}
                <linearGradient id="tideAccumulatedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.05} />
                </linearGradient>
                {/* Gradiente Âmbar para Deslocamento */}
                <linearGradient id="tideDisplacementGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.25} vertical={false} />

              <XAxis
                dataKey="dayShort"
                tick={{ fontSize: 11, fontFamily: 'Roboto Mono', fill: '#111111', fontWeight: 'bold' }}
                tickLine={{ stroke: '#111111' }}
                axisLine={{ stroke: '#111111', strokeWidth: 1.5 }}
              />

              {/* MODO 1: VARIAÇÃO ACUMULADA (2 EIXOS Y) */}
              {viewMetric === 'cumulative' && (
                <>
                  <YAxis
                    yAxisId="accumulated"
                    orientation="left"
                    domain={[0, (dataMax: number) => Math.ceil(dataMax + 2)]}
                    tick={{ fontSize: 11, fontFamily: 'Roboto Mono', fill: '#0284c7', fontWeight: 'bold' }}
                    tickFormatter={(v) => `${v.toFixed(0)}m`}
                    axisLine={{ stroke: '#0284c7', strokeWidth: 1.5 }}
                    tickLine={{ stroke: '#0284c7' }}
                    label={{
                      value: 'Variação Acumulada (m)',
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
                  <YAxis
                    yAxisId="daily"
                    orientation="right"
                    domain={[0, (dataMax: number) => Math.ceil((dataMax + 0.5) * 10) / 10]}
                    tick={{ fontSize: 11, fontFamily: 'Roboto Mono', fill: '#d97706', fontWeight: 'bold' }}
                    tickFormatter={(v) => `${v.toFixed(1)}m`}
                    axisLine={{ stroke: '#d97706', strokeWidth: 1.5 }}
                    tickLine={{ stroke: '#d97706' }}
                    label={{
                      value: 'Amplitude Diária (m)',
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

                  {/* Área Acumulada (Soma Progressiva dos Metros) */}
                  <Area
                    yAxisId="accumulated"
                    type="monotone"
                    dataKey="accumulatedDisplacement"
                    name="Variação Acumulada (m)"
                    stroke="#0284c7"
                    strokeWidth={3}
                    fill="url(#tideAccumulatedGrad)"
                  />

                  {/* Barras de Amplitude Diária */}
                  <Bar
                    yAxisId="daily"
                    dataKey="dailyRange"
                    name="Amplitude Diária (m)"
                    fill="#d97706"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />

                  {/* Linha de Cota Máxima */}
                  <Line
                    yAxisId="daily"
                    type="monotone"
                    dataKey="maxHeight"
                    name="Preia-mar Máx (m)"
                    stroke="#008800"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#008800' }}
                  />
                </>
              )}

              {/* MODO 2: EXTREMOS & COTAS */}
              {viewMetric === 'extremes' && (
                <>
                  <YAxis
                    domain={[0, (dataMax: number) => Math.ceil((dataMax + 0.5) * 10) / 10]}
                    tick={{ fontSize: 11, fontFamily: 'Roboto Mono', fill: '#111111' }}
                    tickFormatter={(v) => `${v.toFixed(1)}m`}
                    axisLine={{ stroke: '#111111' }}
                    tickLine={{ stroke: '#111111' }}
                    label={{
                      value: 'Nível da Água (Metros)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 15,
                      style: {
                        textAnchor: 'middle',
                        fontSize: 10,
                        fill: '#111',
                        fontFamily: 'Roboto Mono',
                        fontWeight: 'bold',
                      },
                    }}
                  />

                  <ReferenceLine
                    y={station.meanSeaLevel}
                    stroke="#888888"
                    strokeDasharray="4 4"
                    label={{
                      value: `Nível Médio (${station.meanSeaLevel.toFixed(2)}m)`,
                      fill: '#888',
                      fontSize: 10,
                      position: 'right',
                    }}
                  />

                  <Bar
                    dataKey="maxHeight"
                    name="Preia-mar Máxima (m)"
                    fill="#008800"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                  />
                  <Bar
                    dataKey="minHeight"
                    name="Baixa-mar Mínima (m)"
                    fill="#d42020"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                  />
                  <Line
                    type="monotone"
                    dataKey="dailyRange"
                    name="Amplitude Diária (m)"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#d97706' }}
                  />
                </>
              )}

              {/* MODO 3: DESLOCAMENTO VERTICAL DIÁRIO */}
              {viewMetric === 'displacement' && (
                <>
                  <YAxis
                    domain={[0, (dataMax: number) => Math.ceil((dataMax + 1) * 10) / 10]}
                    tick={{ fontSize: 11, fontFamily: 'Roboto Mono', fill: '#111111' }}
                    tickFormatter={(v) => `${v.toFixed(1)}m`}
                    axisLine={{ stroke: '#111111' }}
                    tickLine={{ stroke: '#111111' }}
                    label={{
                      value: 'Metros Deslocados no Dia',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 15,
                      style: {
                        textAnchor: 'middle',
                        fontSize: 10,
                        fill: '#111',
                        fontFamily: 'Roboto Mono',
                        fontWeight: 'bold',
                      },
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="dailyDisplacement"
                    name="Deslocamento Diário (m)"
                    stroke="#d97706"
                    strokeWidth={3}
                    fill="url(#tideDisplacementGrad)"
                  />
                  <Line
                    type="monotone"
                    dataKey="accumulatedRange"
                    name="Amplitude Acumulada (m)"
                    stroke="#0284c7"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#0284c7' }}
                  />
                </>
              )}

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontFamily: 'Roboto Mono' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Painel Tático Detalhado do Dia Selecionado */}
      {selectedDay && (
        <div className="border-2 border-black bg-[#f8f7f4] p-4 sm:p-5 shadow-[3px_3px_0px_#000]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-black" />
              <span className="font-bold uppercase text-xs">
                DETALHAMENTO DO DIA // {selectedDay.dayFull}
              </span>
              {selectedDay.isToday && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#d42020] text-white border border-black">
                  HOJE
                </span>
              )}
              {selectedDay.isSpringTide && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#fef08a] text-black border border-black">
                  🌊 SIZÍGIA
                </span>
              )}
            </div>

            <div className="text-xs text-[#555] flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-black" />
              <span>Lua: <strong>{selectedDay.moonName}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5 text-xs">
            <div className="bg-white p-3 border border-black">
              <span className="text-[10px] text-[#666] font-bold uppercase block">Variação Acumulada</span>
              <span className="font-display text-xl font-bold text-[#0284c7] tabular-nums">
                {selectedDay.accumulatedDisplacement.toFixed(2)} m
              </span>
              <span className="text-[9px] text-[#888] block mt-0.5">
                {(
                  (selectedDay.accumulatedDisplacement / summaryMetrics.totalAccumulated) *
                  100
                ).toFixed(0)}% do ciclo semanal
              </span>
            </div>

            <div className="bg-white p-3 border border-black">
              <span className="text-[10px] text-[#666] font-bold uppercase block">Amplitude do Dia</span>
              <span className="font-display text-xl font-bold text-[#d97706] tabular-nums">
                {selectedDay.dailyRange.toFixed(2)} m
              </span>
              <span className="text-[9px] text-[#888] block mt-0.5">
                Preia-mar vs. Baixa-mar
              </span>
            </div>

            <div className="bg-white p-3 border border-black">
              <span className="text-[10px] text-[#666] font-bold uppercase block">Cota Máxima (Preia-mar)</span>
              <span className="font-display text-xl font-bold text-[#008800] tabular-nums">
                +{selectedDay.maxHeight.toFixed(2)} m
              </span>
              <span className="text-[9px] text-[#888] block mt-0.5">
                Água mais funda do dia
              </span>
            </div>

            <div className="bg-white p-3 border border-black">
              <span className="text-[10px] text-[#666] font-bold uppercase block">Cota Mínima (Baixa-mar)</span>
              <span className="font-display text-xl font-bold text-[#d42020] tabular-nums">
                {selectedDay.minHeight.toFixed(2)} m
              </span>
              <span className="text-[9px] text-[#888] block mt-0.5">
                Recuo máximo da água
              </span>
            </div>
          </div>

          {/* Dica Náutica da Estatística */}
          <div className="mt-3.5 pt-3 border-t border-black/15 flex items-start gap-2 text-[11px] text-[#333]">
            <Info className="w-4 h-4 text-black shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Interpretação para Navegadores e Banhistas:</strong> Dias com grande amplitude (acima de{' '}
              {summaryMetrics.avgDailyRange.toFixed(2)}m) geram <strong>correntes de maré mais fortes</strong> nos canais de entrada de barra e baías. A variação acumulada de{' '}
              <strong>{summaryMetrics.totalAccumulated.toFixed(1)}m</strong> demonstra uma renovação expressiva do volume das bacias costeiras da região durante o ciclo.
            </p>
          </div>
        </div>
      )}

      {/* Grid Resumo dos 7 Dias da Semana em Mini-Cartões Clicáveis */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
        {stats.map((day) => {
          const isSelected = selectedDayIndex === day.dayIndex;
          return (
            <button
              key={`stat-day-${day.dayIndex}`}
              onClick={() => setSelectedDayIndex(day.dayIndex)}
              className={`p-2.5 text-left border-2 border-black transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-black text-white shadow-[3px_3px_0px_#0284c7]'
                  : 'bg-white hover:bg-[#f8f7f4] text-black shadow-[2px_2px_0px_#000]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase">{day.dayShort}</span>
                  {day.isToday && (
                    <span
                      className={`text-[8px] font-bold px-1 uppercase ${
                        isSelected ? 'bg-white text-black' : 'bg-[#d42020] text-white'
                      }`}
                    >
                      Hoje
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className={isSelected ? 'text-[#aaa]' : 'text-[#666]'}>Amplitude:</span>
                    <span className="font-bold tabular-nums">{day.dailyRange.toFixed(2)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isSelected ? 'text-[#aaa]' : 'text-[#666]'}>Acumulado:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        isSelected ? 'text-[#38bdf8]' : 'text-[#0284c7]'
                      }`}
                    >
                      {day.accumulatedDisplacement.toFixed(1)}m
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`mt-2 pt-1 border-t text-[9px] flex items-center justify-between ${
                  isSelected ? 'border-white/20 text-[#ddd]' : 'border-black/10 text-[#555]'
                }`}
              >
                <span>{day.moonName.split(' ')[0]}</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyTideStatsChart;
