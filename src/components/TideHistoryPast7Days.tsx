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
import { TideStation, TideExtreme } from '../types/tide';
import {
  calculateTideHeight,
  calculateTideRateOfChange,
  findTideExtremes,
  getMoonPhaseInfo,
} from '../utils/tideHarmonics';
import {
  History,
  Calendar,
  TrendingUp,
  TrendingDown,
  Moon,
  Waves,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Layers,
  ChevronRight,
  BarChart3,
  Clock,
  Sparkles,
} from 'lucide-react';

interface TideHistoryPast7DaysProps {
  station: TideStation;
  currentTime?: number;
}

interface PastDayStat {
  dayOffset: number; // -7 to -1, 0 is today
  dateStr: string;
  dayShort: string;
  dayFull: string;
  timestamp: number;
  maxHeight: number;
  minHeight: number;
  amplitude: number;
  extremes: TideExtreme[];
  moonPhase: string;
  isSpringTide: boolean;
  springTideName: string;
  illumination: number;
}

interface PastHourlyPoint {
  timestamp: number;
  timeLabel: string;
  dayLabel: string;
  height: number;
  rate: number;
  isHighExt: boolean;
  isLowExt: boolean;
  meanLevel: number;
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

export const TideHistoryPast7Days: React.FC<TideHistoryPast7DaysProps> = ({
  station,
  currentTime = Date.now(),
}) => {
  const [viewMode, setViewMode] = useState<'curve' | 'extremes' | 'table'>('curve');
  const [selectedDayOffset, setSelectedDayOffset] = useState<number | null>(null);

  // Calcula estatísticas astronômicas dos últimos 7 dias (do 7º dia atrás até hoje)
  const { dailyStats, hourlyPoints, trendSummary } = useMemo(() => {
    const now = new Date(currentTime);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const dStats: PastDayStat[] = [];
    const hPoints: PastHourlyPoint[] = [];

    // Dos 7 dias passados (-7 até 0/hoje)
    for (let offset = -7; offset <= 0; offset++) {
      const dayStart = startOfToday + offset * 24 * 60 * 60 * 1000;
      const dayDate = new Date(dayStart);
      const dayWeekday = dayDate.getDay();
      const dayNum = String(dayDate.getDate()).padStart(2, '0');
      const monthNum = String(dayDate.getMonth() + 1).padStart(2, '0');
      const dayShort = `${WEEKDAY_NAMES[dayWeekday]} ${dayNum}/${monthNum}`;
      const dayFull = `${WEEKDAY_FULL[dayWeekday]}, ${dayNum}/${monthNum}`;

      // Extremos astronômicos (Preia-mar e Baixa-mar)
      const extremes = findTideExtremes(station, dayStart, 24);
      const heights = extremes.map((e) => e.height);
      const maxHeight = heights.length > 0 ? Math.max(...heights) : station.meanSeaLevel + 0.8;
      const minHeight = heights.length > 0 ? Math.min(...heights) : Math.max(0.1, station.meanSeaLevel - 0.8);
      const amplitude = Math.round(Math.max(0, maxHeight - minHeight) * 100) / 100;

      const moon = getMoonPhaseInfo(dayStart + 12 * 60 * 60 * 1000);

      dStats.push({
        dayOffset: offset,
        dateStr: `${dayNum}/${monthNum}`,
        dayShort,
        dayFull,
        timestamp: dayStart,
        maxHeight: Math.round(maxHeight * 100) / 100,
        minHeight: Math.round(minHeight * 100) / 100,
        amplitude,
        extremes,
        moonPhase: moon.phaseName,
        isSpringTide: moon.isSpringTide,
        springTideName: moon.springTideName,
        illumination: moon.illumination,
      });

      // Pontos horários da curva para cada 2 horas (ou 1 hora) para gráfico contínuo leve
      for (let hour = 0; hour < 24; hour += 2) {
        const pointTime = dayStart + hour * 60 * 60 * 1000;
        // Não projeta além do currentTime
        if (pointTime > currentTime) continue;

        const h = calculateTideHeight(station, pointTime);
        const rate = calculateTideRateOfChange(station, pointTime);
        const pHour = String(hour).padStart(2, '0');

        hPoints.push({
          timestamp: pointTime,
          timeLabel: `${dayNum}/${monthNum} ${pHour}h`,
          dayLabel: dayShort,
          height: h,
          rate,
          isHighExt: false,
          isLowExt: false,
          meanLevel: station.meanSeaLevel,
        });
      }
    }

    // Análise de tendências passadas
    const past7Only = dStats.slice(0, 7);
    const maxHistorical = Math.max(...past7Only.map((d) => d.maxHeight));
    const minHistorical = Math.min(...past7Only.map((d) => d.minHeight));
    const avgAmplitude =
      Math.round(
        (past7Only.reduce((acc, d) => acc + d.amplitude, 0) / (past7Only.length || 1)) * 100
      ) / 100;

    // Tendência: comparando o início da semana (-7) com o fim (-1)
    const ampStart = past7Only[0]?.amplitude || 0;
    const ampEnd = past7Only[past7Only.length - 1]?.amplitude || 0;
    const ampDiff = Math.round((ampEnd - ampStart) * 100) / 100;

    let trendDescription = '';
    if (ampDiff > 0.15) {
      trendDescription = `Amplitudes em expansão (+${ampDiff}m): transição para maré de Sizígia com correntes mais fortes e maiores variações de nível.`;
    } else if (ampDiff < -0.15) {
      trendDescription = `Amplitudes em declínio (${ampDiff}m): transição para maré de Quadratura com correntes calmas e marés mais suaves.`;
    } else {
      trendDescription = `Variações estáveis (~${avgAmplitude}m de amplitude média): comportamento astronômico sem grandes oscilações sazonais.`;
    }

    return {
      dailyStats: dStats,
      hourlyPoints: hPoints,
      trendSummary: {
        maxHistorical,
        minHistorical,
        avgAmplitude,
        ampDiff,
        trendDescription,
      },
    };
  }, [station, currentTime]);

  return (
    <div className="font-mono border-2 border-black bg-white shadow-[4px_4px_0px_#000]">
      {/* Header com Ícone e Modos de Exibição */}
      <div className="p-4 sm:p-5 border-b-2 border-black bg-[#f8f7f4] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black text-white flex items-center justify-center border-2 border-black">
              <History className="w-4 h-4 text-[#d42020]" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold uppercase tracking-tight text-[#111] leading-none">
                Histórico de Marés dos Últimos 7 Dias
              </h2>
              <p className="text-[11px] text-[#666] uppercase mt-0.5 font-bold">
                Consulta Astronômica Harmônica & Análise de Tendências Passadas
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Modo de Visualização */}
        <div className="flex items-center gap-1.5 self-start md:self-auto" role="group" aria-label="Modo de visualização do histórico de maré">
          <button
            onClick={() => setViewMode('curve')}
            aria-pressed={viewMode === 'curve'}
            className={`px-3 py-1.5 text-xs font-bold uppercase border-2 border-black cursor-pointer transition-colors flex items-center gap-1.5 ${
              viewMode === 'curve'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-[#eee] text-black'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-[#0284c7]" />
            <span>Curva Histórica</span>
          </button>

          <button
            onClick={() => setViewMode('extremes')}
            aria-pressed={viewMode === 'extremes'}
            className={`px-3 py-1.5 text-xs font-bold uppercase border-2 border-black cursor-pointer transition-colors flex items-center gap-1.5 ${
              viewMode === 'extremes'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-[#eee] text-black'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#d42020]" />
            <span>Máximas & Mínimas</span>
          </button>

          <button
            onClick={() => setViewMode('table')}
            aria-pressed={viewMode === 'table'}
            className={`px-3 py-1.5 text-xs font-bold uppercase border-2 border-black cursor-pointer transition-colors flex items-center gap-1.5 ${
              viewMode === 'table'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-[#eee] text-black'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#15803d]" />
            <span>Diário Astronômico</span>
          </button>
        </div>
      </div>

      {/* Cartões Rápidos de Resumo Tático da Semana Passada */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b-2 border-black bg-white">
        {/* Máxima Histórica */}
        <div className="p-3 sm:p-4 border-r-2 border-b-2 lg:border-b-0 border-black">
          <span className="block text-[10px] font-bold uppercase text-[#777] mb-0.5 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#d42020]" />
            Pico Máximo na Semana
          </span>
          <div className="font-display text-2xl font-black text-black tabular-nums">
            {trendSummary.maxHistorical.toFixed(2)}m
          </div>
          <div className="text-[10px] text-[#555] uppercase mt-0.5">
            Preia-mar mais alta
          </div>
        </div>

        {/* Mínima Histórica */}
        <div className="p-3 sm:p-4 border-b-2 lg:border-b-0 lg:border-r-2 border-black">
          <span className="block text-[10px] font-bold uppercase text-[#777] mb-0.5 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-[#0284c7]" />
            Nível Mais Baixo
          </span>
          <div className="font-display text-2xl font-black text-black tabular-nums">
            {trendSummary.minHistorical.toFixed(2)}m
          </div>
          <div className="text-[10px] text-[#555] uppercase mt-0.5">
            Baixa-mar mais rasa
          </div>
        </div>

        {/* Amplitude Média */}
        <div className="p-3 sm:p-4 border-r-2 border-black">
          <span className="block text-[10px] font-bold uppercase text-[#777] mb-0.5 flex items-center gap-1">
            <Waves className="w-3.5 h-3.5 text-[#15803d]" />
            Variação Média Diária
          </span>
          <div className="font-display text-2xl font-black text-black tabular-nums">
            {trendSummary.avgAmplitude.toFixed(2)}m
          </div>
          <div className="text-[10px] text-[#555] uppercase mt-0.5">
            Amplitude astronômica
          </div>
        </div>

        {/* Tendência da Semana */}
        <div className="p-3 sm:p-4 bg-[#f8f7f4]">
          <span className="block text-[10px] font-bold uppercase text-[#777] mb-0.5 flex items-center gap-1">
            {trendSummary.ampDiff >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-[#d42020]" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-[#0284c7]" />
            )}
            Tendência de Amplitude
          </span>
          <div
            className={`font-display text-2xl font-black tabular-nums ${
              trendSummary.ampDiff > 0
                ? 'text-[#d42020]'
                : trendSummary.ampDiff < 0
                ? 'text-[#0284c7]'
                : 'text-black'
            }`}
          >
            {trendSummary.ampDiff > 0 ? `+${trendSummary.ampDiff.toFixed(2)}m` : `${trendSummary.ampDiff.toFixed(2)}m`}
          </div>
          <div className="text-[10px] text-[#444] uppercase mt-0.5 truncate font-bold">
            {trendSummary.ampDiff > 0 ? 'Rumo a Sizígia' : 'Rumo a Quadratura'}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal do Gráfico de Acordo com o Modo Selecionado */}
      <div className="p-4 sm:p-6">
        {/* MODO 1: CURVA HORÁRIA CONTÍNUA COM RECHARTS */}
        {viewMode === 'curve' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between text-xs font-bold uppercase gap-2">
              <span className="text-[#333] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#d42020]" />
                Oscilação Horária Astronômica (Últimas 168 Horas)
              </span>
              <div className="flex items-center gap-3 text-[11px] text-[#666]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#0284c7] inline-block" />
                  Nível da Maré (m)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-black inline-block border-t border-dashed" />
                  Nível Médio ({station.meanSeaLevel.toFixed(2)}m)
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={hourlyPoints}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="tideHistoryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: '#444', fontSize: 10, fontFamily: 'monospace' }}
                    interval={11}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 1.5 }}
                  />
                  <YAxis
                    domain={[0, (dataMax: number) => Math.ceil((dataMax + 0.3) * 10) / 10]}
                    tick={{ fill: '#444', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(v) => `${v.toFixed(1)}m`}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 1.5 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0].payload as PastHourlyPoint;
                      return (
                        <div className="bg-black text-white p-2.5 border-2 border-white shadow-[3px_3px_0px_#000] font-mono text-xs">
                          <div className="font-bold text-[#d42020] uppercase text-[11px] mb-1">
                            {pt.timeLabel} ({pt.dayLabel})
                          </div>
                          <div className="space-y-0.5">
                            <div>
                              Altura Astronômica:{' '}
                              <strong className="text-white text-sm">{pt.height.toFixed(2)}m</strong>
                            </div>
                            <div className="text-[10px] text-[#aaa]">
                              Taxa de Variação: {pt.rate > 0 ? `+${pt.rate}` : pt.rate} cm/h
                            </div>
                            <div className="text-[10px] text-[#aaa]">
                              Variação sobre Nível Médio:{' '}
                              {(pt.height - pt.meanLevel >= 0 ? '+' : '')}
                              {(pt.height - pt.meanLevel).toFixed(2)}m
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={station.meanSeaLevel}
                    stroke="#000"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Z0: ${station.meanSeaLevel.toFixed(2)}m`,
                      fill: '#444',
                      fontSize: 10,
                      position: 'insideTopRight',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="height"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fill="url(#tideHistoryGradient)"
                    name="Altura da Maré"
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* MODO 2: EXTREMOS DIÁRIOS (MÁXIMAS, MÍNIMAS & AMPLITUDE) */}
        {viewMode === 'extremes' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between text-xs font-bold uppercase gap-2">
              <span className="text-[#333] flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#d42020]" />
                Comparação de Preia-mar, Baixa-mar e Amplitude por Dia
              </span>
              <div className="flex items-center gap-3 text-[11px] text-[#666]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#111] inline-block" />
                  Preia-mar Máx (m)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#0284c7] inline-block" />
                  Baixa-mar Mín (m)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1 bg-[#d42020] inline-block" />
                  Amplitude (m)
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dailyStats}
                  margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="dayShort"
                    tick={{ fill: '#333', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 1.5 }}
                  />
                  <YAxis
                    domain={[0, (dataMax: number) => Math.ceil((dataMax + 0.5) * 10) / 10]}
                    tick={{ fill: '#333', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(v) => `${v.toFixed(1)}m`}
                    tickLine={{ stroke: '#000' }}
                    axisLine={{ stroke: '#000', strokeWidth: 1.5 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const day = payload[0].payload as PastDayStat;
                      return (
                        <div className="bg-black text-white p-3 border-2 border-white shadow-[3px_3px_0px_#000] font-mono text-xs">
                          <div className="font-bold text-[#d42020] uppercase text-xs mb-1.5 flex items-center justify-between gap-3">
                            <span>{day.dayFull}</span>
                            <span className="text-[10px] text-white/80">{day.moonPhase}</span>
                          </div>
                          <div className="space-y-1 text-[11px]">
                            <div className="text-emerald-400">
                              Preia-mar Máxima: <strong>{day.maxHeight.toFixed(2)}m</strong>
                            </div>
                            <div className="text-sky-400">
                              Baixa-mar Mínima: <strong>{day.minHeight.toFixed(2)}m</strong>
                            </div>
                            <div className="text-amber-300 font-bold">
                              Amplitude Diária: <strong>{day.amplitude.toFixed(2)}m</strong>
                            </div>
                            <div className="text-[10px] text-white/70 pt-1 border-t border-white/20">
                              Ciclo: {day.springTideName}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="maxHeight" fill="#111111" name="Preia-mar (Máx)" barSize={20} />
                  <Bar dataKey="minHeight" fill="#0284c7" name="Baixa-mar (Mín)" barSize={20} />
                  <Line
                    type="monotone"
                    dataKey="amplitude"
                    stroke="#d42020"
                    strokeWidth={2.5}
                    dot={{ fill: '#d42020', stroke: '#000', strokeWidth: 1.5, r: 4 }}
                    name="Amplitude Diária"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* MODO 3: TABELA / DIÁRIO ASTRONÔMICO DETALHADO */}
        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-2 border-black">
              <thead className="bg-[#111] text-white uppercase text-[10px]">
                <tr>
                  <th className="p-2.5 border-r border-white/20">Data & Dia</th>
                  <th className="p-2.5 border-r border-white/20">Fase da Lua</th>
                  <th className="p-2.5 border-r border-white/20">Máxima (Preia-mar)</th>
                  <th className="p-2.5 border-r border-white/20">Mínima (Baixa-mar)</th>
                  <th className="p-2.5 border-r border-white/20">Amplitude</th>
                  <th className="p-2.5">Comportamento Hidrodinâmico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/20">
                {dailyStats.map((d) => (
                  <tr
                    key={d.dayOffset}
                    className={`hover:bg-[#f3f4f6] transition-colors ${
                      d.dayOffset === 0 ? 'bg-[#fefce8] font-bold' : ''
                    }`}
                  >
                    <td className="p-2.5 border-r border-black/20 font-bold text-black whitespace-nowrap">
                      {d.dayFull} {d.dayOffset === 0 && <span className="text-[#d42020] text-[10px]">(HOJE)</span>}
                    </td>
                    <td className="p-2.5 border-r border-black/20 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-black" />
                        <span>{d.moonPhase} ({d.illumination}%)</span>
                      </div>
                    </td>
                    <td className="p-2.5 border-r border-black/20 font-bold tabular-nums text-black">
                      {d.maxHeight.toFixed(2)}m
                    </td>
                    <td className="p-2.5 border-r border-black/20 font-bold tabular-nums text-[#0284c7]">
                      {d.minHeight.toFixed(2)}m
                    </td>
                    <td className="p-2.5 border-r border-black/20 font-bold tabular-nums text-[#d42020]">
                      {d.amplitude.toFixed(2)}m
                    </td>
                    <td className="p-2.5 text-[11px] text-[#444]">
                      {d.isSpringTide ? (
                        <span className="font-bold text-[#d42020]">
                          🌊 Maré de Sizígia: correntes fortes e picos elevados.
                        </span>
                      ) : (
                        <span className="text-[#15803d]">
                          ⚖️ Quadratura: variação branda e calmaria de maré.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Box de Interpretação e Análise Tática Náutica */}
        <div className="mt-4 p-3 sm:p-4 bg-[#f8f7f4] border-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#d42020] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase text-black block mb-0.5">
                Diagnóstico Náutico dos Últimos 7 Dias:
              </span>
              <p className="text-[11px] text-[#555] leading-relaxed">
                {trendSummary.trendDescription}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-[10px] uppercase font-bold text-[#777] bg-white border border-black px-2 py-1">
            Estação: {station.name} ({station.state})
          </div>
        </div>
      </div>
    </div>
  );
};

export default TideHistoryPast7Days;
