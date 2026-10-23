import React, { useState } from 'react';
import {
  CurrentTideStatus,
  TideExtreme,
  TideStation,
  VesselProfile,
  TemperatureUnit,
} from '../types/tide';
import { calculateUKC } from '../utils/tideHarmonics';
import { RealMarineConditions, formatTemperature } from '../services/realMarineApi';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Compass,
  Info,
  Moon,
  ShieldCheck,
  ShieldAlert,
  Ship,
  Waves,
  Thermometer,
  Droplets,
  CloudSun,
  BookOpen,
  History,
  Sparkles,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { WeeklyTideStatsChart } from './WeeklyTideStatsChart';
import { TideHistoryPast7Days } from './TideHistoryPast7Days';
import { TideHistory24hRealVsAstroChart } from './TideHistory24hRealVsAstroChart';

interface TideDashboardProps {
  station: TideStation;
  allStations: TideStation[];
  onSelectStation: (station: TideStation) => void;
  status: CurrentTideStatus;
  todayExtremes: TideExtreme[];
  vessel: VesselProfile;
  realMarineConditions?: RealMarineConditions | null;
  tempUnit: TemperatureUnit;
  onToggleTempUnit: () => void;
  onOpenVesselModal: () => void;
  onOpenAlertsModal: () => void;
  onOpenLogbook?: () => void;
  onOpenConverter?: () => void;
  currentTime?: number;
}

export const TideDashboard: React.FC<TideDashboardProps> = ({
  station,
  allStations,
  onSelectStation,
  status,
  todayExtremes,
  vessel,
  realMarineConditions,
  tempUnit,
  onToggleTempUnit,
  onOpenVesselModal,
  onOpenAlertsModal,
  onOpenLogbook,
  onOpenConverter,
  currentTime,
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'cards' | 'table'>('timeline');
  const [tideAnalysisView, setTideAnalysisView] = useState<'24h' | 'history' | 'forecast' | 'all'>('24h');

  // Profundidade de referência para canais costeiros (2.5m de profundidade na carta náutica)
  const refChartedDepth = 2.5;
  const ukcResult = calculateUKC(refChartedDepth, status.currentHeight, vessel.draft);

  // Determinar o momento do dia e se um evento já passou
  const now = new Date();
  const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="w-full font-mono bg-[#f8f7f4] dark:bg-[#0d1117] transition-colors">
      {/* 1. 4 CARTÕES PRINCIPAIS DE TELEMETRIA COM GRID RESPONSIVO & ALTURAS MÍNIMAS CONSISTENTES */}
      <div className="p-3 sm:p-5 border-b-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#161b22]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Célula 1: Altura da Maré em Tempo Real */}
          <div className="min-h-[175px] sm:min-h-[195px] p-4 sm:p-5 border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] flex flex-col justify-between shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d] transition-all">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] mb-1.5 truncate">
                Nível da Água Agora // {station.name.split(' ')[0]}
              </span>
              <div className="flex items-baseline gap-1 my-1">
                <span className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-none tracking-tight text-[#111111] dark:text-white tabular-nums">
                  {status.currentHeight.toFixed(2)}
                </span>
                <span className="text-xl sm:text-2xl font-display font-bold text-[#0284c7]">M</span>
              </div>
            </div>

            <div>
              <div
                className={`text-xs font-bold uppercase mt-2 flex items-center gap-1.5 flex-wrap ${
                  status.tendency === 'enchente'
                    ? 'text-[#16a34a] dark:text-[#4ade80]'
                    : status.tendency === 'vazante'
                    ? 'text-[#d42020] dark:text-[#f87171]'
                    : 'text-[#666] dark:text-[#8b949e]'
                }`}
              >
                {status.tendency === 'enchente' ? (
                  <>
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                    <span>MARÉ SUBINDO (+{status.rateCmPerHour} CM/H)</span>
                  </>
                ) : status.tendency === 'vazante' ? (
                  <>
                    <ArrowDownRight className="w-4 h-4 shrink-0" />
                    <span>MARÉ DESCENDO (-{status.rateCmPerHour} CM/H)</span>
                  </>
                ) : (
                  <span>MARÉ ESTÁVEL (ESTOFO)</span>
                )}
              </div>
              <button
                onClick={() => {
                  const el = document.getElementById('weekly-tide-stats-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-[10px] font-bold text-[#0284c7] hover:underline cursor-pointer flex items-center gap-0.5 mt-2 transition-colors"
              >
                <span>Ver Análise Semanal (7 Dias) ↓</span>
              </button>
            </div>
          </div>

          {/* Célula 2: Próxima Virada da Maré */}
          <div className="min-h-[175px] sm:min-h-[195px] p-4 sm:p-5 border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] flex flex-col justify-between shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d] transition-all">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] mb-1.5">
                Próxima Virada da Maré
              </span>
              <div className="my-1">
                <span className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-none tracking-tight text-[#111111] dark:text-white tabular-nums">
                  {status.nextExtreme.timeString}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase mt-2 text-[#111111] dark:text-white flex items-center gap-1.5 flex-wrap">
                <Clock className="w-3.5 h-3.5 text-[#666] dark:text-[#8b949e] shrink-0" />
                <span className="truncate">
                  {status.nextExtreme.type === 'preia-mar'
                    ? `Pico de Maré Alta (${status.nextExtreme.height.toFixed(2)}m)`
                    : `Maré Baixa Rasa (${status.nextExtreme.height.toFixed(2)}m)`}
                </span>
              </div>
              <span className="block text-[10px] text-[#777] dark:text-[#8b949e] mt-1">
                Subsequente: {status.subsequentExtreme.timeString} ({status.subsequentExtreme.height.toFixed(2)}m)
              </span>
            </div>
          </div>

          {/* Célula 3: Espaço Sob o Barco (Folga da Quilha) */}
          <div className="min-h-[175px] sm:min-h-[195px] p-4 sm:p-5 border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] flex flex-col justify-between shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d] transition-all">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] mb-1.5">
                Folga Sob o Casco (Não Encalhar)
              </span>
              <div className="flex items-baseline gap-1 my-1">
                <span className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-none tracking-tight text-[#111111] dark:text-white tabular-nums">
                  {ukcResult.ukc >= 0 ? `+${ukcResult.ukc.toFixed(2)}` : ukcResult.ukc.toFixed(2)}
                </span>
                <span className="text-xl sm:text-2xl font-display font-bold text-[#10b981]">M</span>
              </div>
            </div>

            <div>
              <div
                className={`text-xs font-bold uppercase mt-2 flex items-center gap-1.5 flex-wrap ${
                  ukcResult.safetyStatus === 'safe'
                    ? 'text-[#16a34a] dark:text-[#4ade80]'
                    : ukcResult.safetyStatus === 'caution'
                    ? 'text-[#d97706] dark:text-[#fbbf24]'
                    : 'text-[#d42020] dark:text-[#f87171]'
                }`}
              >
                {ukcResult.safetyStatus === 'safe' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 shrink-0 text-[#16a34a]" />
                    <span>ÁGUA SEGURA // PROF: {ukcResult.actualDepth.toFixed(2)}M</span>
                  </>
                ) : ukcResult.safetyStatus === 'caution' ? (
                  <>
                    <ShieldAlert className="w-4 h-4 shrink-0 text-[#d97706]" />
                    <span>ATENÇÃO // PROF: {ukcResult.actualDepth.toFixed(2)}M</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4 shrink-0 text-[#d42020]" />
                    <span>ÁGUA RASA PARA SEU BARCO</span>
                  </>
                )}
              </div>
              <button
                onClick={onOpenVesselModal}
                className="text-[10px] font-bold text-[#666] dark:text-[#8b949e] hover:text-black dark:hover:text-white underline cursor-pointer mt-1 block"
              >
                Calado: {vessel.draft.toFixed(2)}m ({vessel.name})
              </button>
            </div>
          </div>

          {/* Célula 4: TEMPERATURAS (Água do Mar & Clima) */}
          <div className="min-h-[175px] sm:min-h-[195px] p-4 sm:p-5 border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] flex flex-col justify-between shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d] transition-all">
            <div className="flex items-center justify-between pb-1 border-b border-black/10 dark:border-white/10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-[#d42020]" />
                TEMPERATURAS LOCAIS
              </span>
              <button
                onClick={onToggleTempUnit}
                title="Trocar entre Celsius e Fahrenheit"
                className="text-[10px] font-bold px-1.5 py-0.5 border border-black dark:border-white bg-[#f8f7f4] dark:bg-[#161b22] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer"
              >
                <span className={tempUnit === 'C' ? 'font-black underline' : 'text-[#888]'}>°C</span>
                <span className="mx-0.5 text-[#aaa]">/</span>
                <span className={tempUnit === 'F' ? 'font-black underline' : 'text-[#888]'}>°F</span>
              </button>
            </div>

            <div className="space-y-1.5 py-1">
              {/* Temperatura da Água */}
              <div className="flex items-baseline justify-between border-b border-black/10 dark:border-white/10 pb-1">
                <div className="flex items-center gap-1.5 text-xs text-[#555] dark:text-[#aaa]">
                  <Droplets className="w-3.5 h-3.5 text-[#0284c7]" />
                  <span>Água do Mar:</span>
                </div>
                <div className="text-right">
                  <span className="font-display text-xl sm:text-2xl font-bold text-black dark:text-white tabular-nums">
                    {formatTemperature(realMarineConditions?.oceanWaterTempCelsius, tempUnit)}
                  </span>
                  <span className="text-[9px] font-bold text-[#0284c7] uppercase ml-1 block">
                    {realMarineConditions?.oceanWaterTempCelsius && realMarineConditions.oceanWaterTempCelsius >= 24 ? 'Boa para Banho' : 'Água Fresca'}
                  </span>
                </div>
              </div>

              {/* Temperatura do Clima / Ar */}
              <div className="flex items-baseline justify-between pt-0.5">
                <div className="flex items-center gap-1.5 text-xs text-[#555] dark:text-[#aaa]">
                  <CloudSun className="w-3.5 h-3.5 text-[#d97706]" />
                  <span>Clima / Ar:</span>
                </div>
                <div className="text-right">
                  <span className="font-display text-xl sm:text-2xl font-bold text-black dark:text-white tabular-nums">
                    {formatTemperature(realMarineConditions?.airTempCelsius, tempUnit)}
                  </span>
                  <span className="text-[9px] text-[#666] dark:text-[#8b949e] block">
                    Sensação {formatTemperature(realMarineConditions?.apparentTempCelsius, tempUnit)}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[9px] text-[#777] dark:text-[#8b949e] uppercase pt-1 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
              <span className="truncate">{realMarineConditions?.weatherDescription || 'Tempo Estável'}</span>
              <button
                onClick={() => {
                  const el = document.getElementById('wave-wind-forecast-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-[9px] font-bold text-[#0284c7] hover:underline cursor-pointer flex items-center gap-0.5 shrink-0 ml-1"
              >
                <span>Ondas 24h ↓</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SEÇÃO PRINCIPAL: CICLO DIÁRIO & CONTROLES LATERAIS COM GRID RESPONSIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 border-b-2 border-black dark:border-[#30363d]">
        {/* Painel Diário das Marés de Hoje (2 Colunas no Desktop) */}
        <div className="lg:col-span-2 p-4 sm:p-6 border-b-2 lg:border-b-0 lg:border-r-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117]">
          {/* Header do Ciclo com Alternador de Visualização */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] block">
                Previsão Oficial de Hoje // Padrão Marinha do Brasil (DHN)
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase text-black dark:text-white">
                Ciclo Diário das Marés de Hoje
              </h3>
              <p className="text-xs text-[#555] dark:text-[#8b949e] mt-0.5">
                Acompanhe o sobe e desce do mar em ordem cronológica de fácil entendimento
              </p>
            </div>

            {/* Alternar modos de visualização */}
            <div className="flex flex-wrap items-center gap-1 border-2 border-black dark:border-white bg-[#f8f7f4] dark:bg-[#161b22] p-1 shrink-0 self-start sm:self-center">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-2.5 py-1 text-xs font-bold uppercase cursor-pointer transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-black dark:text-white hover:bg-white dark:hover:bg-[#21262d]'
                }`}
              >
                Linha do Tempo
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 text-xs font-bold uppercase cursor-pointer transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-black dark:text-white hover:bg-white dark:hover:bg-[#21262d]'
                }`}
              >
                Réguas Ilustradas
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-xs font-bold uppercase cursor-pointer transition-colors ${
                  viewMode === 'table'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-black dark:text-white hover:bg-white dark:hover:bg-[#21262d]'
                }`}
              >
                Tabela Resumida
              </button>
            </div>
          </div>

          {/* MODO 1: LINHA DO TEMPO CRONOLÓGICA COM ALTURAS MÍNIMAS CONSISTENTES */}
          {viewMode === 'timeline' && (
            <div className="space-y-4">
              <div className="p-3 sm:p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#161b22] shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d]">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-[#666] dark:text-[#8b949e] mb-3">
                  <span>Horários ao Longo do Dia</span>
                  <span>{todayExtremes.length} Momentos Principais</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {todayExtremes.map((ext, idx) => {
                    const isHigh = ext.type === 'preia-mar';
                    const [hStr, mStr] = ext.timeString.split(':');
                    const eventMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
                    const isPast = eventMinutes < currentMinutesOfDay - 20;
                    const isNext = ext.timeString === status.nextExtreme.timeString;
                    const percent = Math.min(100, Math.max(15, Math.round((ext.height / 2.8) * 100)));

                    return (
                      <div
                        key={`timeline-step-${idx}`}
                        className={`min-h-[220px] p-3.5 border-2 border-black dark:border-white flex flex-col justify-between transition-all ${
                          isNext
                            ? 'bg-[#fef9c3] dark:bg-[#2d2a14] ring-2 ring-black dark:ring-white shadow-[3px_3px_0px_#000]'
                            : isPast
                            ? 'bg-[#f4f2ee] dark:bg-[#1c2128] opacity-85'
                            : isHigh
                            ? 'bg-[#eff6ff] dark:bg-[#112240]'
                            : 'bg-[#fffbeb] dark:bg-[#261c14]'
                        }`}
                      >
                        {/* Status Tag no Topo */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-black/20 dark:border-white/20 text-[10px] font-bold uppercase">
                          <span className="text-[#666] dark:text-[#8b949e]">{idx + 1}º Momento</span>
                          {isNext ? (
                            <span className="bg-[#d42020] text-white px-1.5 py-0.2 animate-pulse font-black">
                              PRÓXIMO!
                            </span>
                          ) : isPast ? (
                            <span className="text-[#888] dark:text-[#777]">JÁ PASSOU</span>
                          ) : (
                            <span className="text-black dark:text-white">A SEGUIR</span>
                          )}
                        </div>

                        {/* Tipo de Maré */}
                        <div className="my-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase">
                            <span className="text-base">{isHigh ? '🌊' : '🏖️'}</span>
                            <span className={isHigh ? 'text-[#1d4ed8] dark:text-[#60a5fa]' : 'text-[#b45309] dark:text-[#fbbf24]'}>
                              {isHigh ? 'Maré Alta' : 'Maré Baixa'}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#777] dark:text-[#8b949e] uppercase font-bold">
                            {isHigh ? '(Preia-mar)' : '(Baixa-mar)'}
                          </div>
                        </div>

                        {/* Hora e Altura */}
                        <div className="my-1 flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] text-[#666] dark:text-[#8b949e] uppercase block font-bold">Horário</span>
                            <span className="font-display text-2xl sm:text-3xl font-black text-black dark:text-white tabular-nums">
                              {ext.timeString}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[#666] dark:text-[#8b949e] uppercase block font-bold">Nível</span>
                            <span className="font-display text-xl sm:text-2xl font-bold text-black dark:text-white tabular-nums">
                              {ext.height.toFixed(2)}m
                            </span>
                          </div>
                        </div>

                        {/* Régua d'água miniatura */}
                        <div className="mt-1 pt-1.5 border-t border-black/15 dark:border-white/15">
                          <div className="flex justify-between text-[9px] font-bold text-[#666] dark:text-[#8b949e] mb-1">
                            <span>Volume d'Água</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full h-2.5 border border-black dark:border-white bg-white dark:bg-[#0d1117] overflow-hidden relative">
                            <div
                              className={`h-full transition-all ${
                                isHigh ? 'bg-[#3b82f6]' : 'bg-[#f59e0b]'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Resumo prático em 1 frase */}
                        <div className="mt-2 text-[10px] text-[#333] dark:text-[#c9d1d9] font-bold leading-tight pt-1 border-t border-black/10 dark:border-white/10">
                          {isHigh
                            ? '🚢 Máxima profundidade: ótimo para barcos e atracar.'
                            : '🏖️ Mar recuado: ótimo para piscinas naturais e praia.'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guia explicativo das condições de hoje com alturas mínimas iguais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="min-h-[105px] p-3.5 border-2 border-black dark:border-[#30363d] bg-[#f0fdf4] dark:bg-[#0e271a] flex flex-col justify-between">
                  <div className="font-bold text-black dark:text-white uppercase flex items-center gap-1.5 mb-1 text-xs">
                    <span className="text-sm">🏖️</span>
                    <span>Para Banhistas, Mergulho e Caminhadas</span>
                  </div>
                  <p className="text-[11px] text-[#222] dark:text-[#a7f3d0] leading-relaxed">
                    O melhor momento para visitar piscinas naturais e faixas de areia extensas é durante a{' '}
                    <strong>Maré Baixa</strong> (por volta de{' '}
                    {todayExtremes.filter(e => e.type === 'baixa-mar').map(e => e.timeString).join(' e ') || 'horários indicados'}).
                  </p>
                </div>

                <div className="min-h-[105px] p-3.5 border-2 border-black dark:border-[#30363d] bg-[#eff6ff] dark:bg-[#112240] flex flex-col justify-between">
                  <div className="font-bold text-black dark:text-white uppercase flex items-center gap-1.5 mb-1 text-xs">
                    <span className="text-sm">⛵</span>
                    <span>Para Embarcações e Navegação</span>
                  </div>
                  <p className="text-[11px] text-[#222] dark:text-[#bfdbfe] leading-relaxed">
                    Para navegar sobre lajes de pedra, passar em canais rasos ou atracar com tranquilidade, aproveite a{' '}
                    <strong>Maré Alta</strong> (por volta de{' '}
                    {todayExtremes.filter(e => e.type === 'preia-mar').map(e => e.timeString).join(' e ') || 'horários indicados'}).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* MODO 2: CARTÕES COM RÉGUAS ILUSTRADAS DETALHADAS */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {todayExtremes.map((ext, idx) => {
                const isHigh = ext.type === 'preia-mar';
                const totalWater = ext.height + refChartedDepth;
                const freeSpace = totalWater - vessel.draft;
                const isSafe = freeSpace >= vessel.safetyMargin;
                const percent = Math.min(100, Math.max(15, Math.round((ext.height / 2.8) * 100)));

                return (
                  <div
                    key={`card-${ext.timeString}-${idx}`}
                    className={`min-h-[250px] p-4 sm:p-5 border-2 border-black dark:border-white flex flex-col justify-between shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] ${
                      isHigh ? 'bg-[#f0f9ff] dark:bg-[#112240]' : 'bg-[#fffbeb] dark:bg-[#261c14]'
                    }`}
                  >
                    <div>
                      {/* Topo do Cartão */}
                      <div className="flex items-center justify-between pb-2 border-b border-black/20 dark:border-white/20">
                        <div className="flex items-center gap-1.5 font-bold text-xs uppercase">
                          <span className="text-base">{isHigh ? '🌊' : '🏖️'}</span>
                          <span className={isHigh ? 'text-black dark:text-white' : 'text-[#b45309] dark:text-[#fbbf24]'}>
                            {isHigh ? 'Maré Alta (Preia-mar)' : 'Maré Baixa (Baixa-mar)'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#666] dark:text-[#8b949e] uppercase">
                          {idx + 1}º Evento de Hoje
                        </span>
                      </div>

                      {/* Horário e Altura em Destaque */}
                      <div className="my-3 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-[#666] dark:text-[#8b949e] uppercase block">
                            Horário Previsto
                          </span>
                          <span className="font-display text-3xl sm:text-4xl font-black text-black dark:text-white tabular-nums">
                            {ext.timeString}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-[#666] dark:text-[#8b949e] uppercase block">
                            Altura da Água
                          </span>
                          <span className="font-display text-2xl sm:text-3xl font-bold text-black dark:text-white tabular-nums">
                            {ext.height.toFixed(2)}
                            <span className="text-lg font-display ml-0.5">m</span>
                          </span>
                        </div>
                      </div>

                      {/* Barra Visual Ilustrada */}
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-[#666] dark:text-[#8b949e] font-bold mb-1">
                          <span>Volume da Coluna de Água</span>
                          <span>{percent}% do Volume Máximo</span>
                        </div>
                        <div className="w-full h-3 border border-black dark:border-white bg-white dark:bg-[#0d1117] overflow-hidden">
                          <div
                            className={`h-full ${
                              isHigh ? 'bg-[#3b82f6]' : 'bg-[#f59e0b]'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Informações Práticas em Linguagem Clara */}
                      <div className="text-xs space-y-1.5 pt-2 border-t border-black/15 dark:border-white/15 text-[#333] dark:text-[#c9d1d9]">
                        <div className="flex items-center justify-between">
                          <span className="text-[#666] dark:text-[#8b949e]">Profundidade total no canal:</span>
                          <strong className="text-black dark:text-white tabular-nums">{totalWater.toFixed(2)} metros</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#666] dark:text-[#8b949e]">Folga de segurança sob o barco:</span>
                          <strong
                            className={`tabular-nums ${
                              isSafe ? 'text-[#16a34a] dark:text-[#4ade80]' : 'text-[#d42020] dark:text-[#f87171]'
                            }`}
                          >
                            +{freeSpace.toFixed(2)}m livre
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Rodapé do Cartão */}
                    <div className="mt-3 pt-2">
                      <div
                        className={`text-center py-1.5 px-2 font-bold text-[11px] uppercase border border-black dark:border-white ${
                          isSafe
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : 'bg-[#d42020] text-white'
                        }`}
                      >
                        {isSafe
                          ? isHigh
                            ? '✓ Água Funda: Navegação Livre'
                            : '✓ Seguro para Navegar com Atenção'
                          : '⚠️ Cuidado: Risco de Encalhe'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO 3: TABELA OFICIAL RESUMIDA COM SCROLL HORIZONTAL RESPONSIVO */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto border-2 border-black dark:border-[#30363d]">
              <table className="w-full min-w-[560px] text-left font-mono text-xs border-collapse bg-white dark:bg-[#0d1117]">
                <thead>
                  <tr className="border-b-2 border-black dark:border-[#30363d] bg-[#eeebe6] dark:bg-[#161b22]">
                    <th className="p-2.5 font-bold uppercase text-[11px] text-black dark:text-white">Tipo de Maré</th>
                    <th className="p-2.5 font-bold uppercase text-[11px] text-black dark:text-white">Horário</th>
                    <th className="p-2.5 font-bold uppercase text-[11px] text-black dark:text-white">Nível da Água</th>
                    <th className="p-2.5 font-bold uppercase text-[11px] text-black dark:text-white">Profundidade</th>
                    <th className="p-2.5 font-bold uppercase text-[11px] text-black dark:text-white">Folga do Barco</th>
                    <th className="p-2.5 font-bold uppercase text-[11px] text-right text-black dark:text-white">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/15 dark:divide-white/15">
                  {todayExtremes.map((ext, idx) => {
                    const totalD = ext.height + refChartedDepth;
                    const clear = totalD - vessel.draft;
                    const isSafe = clear >= vessel.safetyMargin;

                    return (
                      <tr key={`tbl-${ext.timeString}-${idx}`} className="hover:bg-[#f8f7f4] dark:hover:bg-[#161b22] transition-colors">
                        <td className="p-2.5 font-bold text-black dark:text-white">
                          {ext.type === 'preia-mar' ? '🌊 Maré Alta (Preia-mar)' : '🏖️ Maré Baixa (Baixa-mar)'}
                        </td>
                        <td className="p-2.5 font-bold text-black dark:text-white tabular-nums">{ext.timeString}</td>
                        <td className="p-2.5 font-bold tabular-nums text-black dark:text-white">{ext.height.toFixed(2)}m</td>
                        <td className="p-2.5 tabular-nums text-black dark:text-white">{totalD.toFixed(2)}m</td>
                        <td className="p-2.5 tabular-nums">
                          <strong className={clear >= 0.6 ? 'text-[#16a34a] dark:text-[#4ade80]' : 'text-[#d42020] dark:text-[#f87171]'}>
                            +{clear.toFixed(2)}m livre
                          </strong>
                        </td>
                        <td className="p-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isSafe
                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                : 'bg-[#d42020] text-white'
                            }`}
                          >
                            {isSafe ? 'Água Segura' : 'Atenção ao Calado'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Dica explicativa didática */}
          <div className="mt-4 p-3.5 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#161b22] text-xs flex items-start gap-2.5 text-[#333] dark:text-[#c9d1d9]">
            <Info className="w-4 h-4 text-black dark:text-white shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Como funciona a maré no Brasil:</strong> A água sobe e desce cerca de duas vezes ao dia. Na <strong>Maré Alta (Preia-mar)</strong> o mar atinge a cota máxima — ideal para navegação segura e atracação. Na <strong>Maré Baixa (Baixa-mar)</strong> a água recua — excelente para piscinas naturais, exigindo cautela contra encalhe sobre lajes e baixios.
            </div>
          </div>
        </div>

        {/* 3. CONTROLES LATERAIS COM ESPAÇAMENTO ADEQUADO E ALTURAS MÍNIMAS */}
        <div className="p-4 sm:p-6 bg-[#eeebe6] dark:bg-[#161b22] flex flex-col justify-between gap-5">
          <div className="space-y-4">
            {/* Seletor de Estação */}
            <div className="min-h-[72px] p-3.5 border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d]">
              <label
                htmlFor="tactical-station-select"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] mb-1.5"
              >
                Estação de Referência (Porto Oficial)
              </label>
              <select
                id="tactical-station-select"
                value={station.id}
                onChange={(e) => {
                  const found = allStations.find((s) => s.id === e.target.value);
                  if (found) onSelectStation(found);
                }}
                className="w-full border-2 border-black dark:border-white p-2 text-xs font-bold bg-[#f8f7f4] dark:bg-[#161b22] text-black dark:text-white focus:outline-none cursor-pointer"
              >
                {allStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state})
                  </option>
                ))}
              </select>
            </div>

            {/* Embarcação & Calado */}
            <div className="min-h-[72px] p-3.5 border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d]">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] mb-1.5">
                Embarcação Configurada & Calado
              </span>
              <button
                onClick={onOpenVesselModal}
                className="w-full border-2 border-black dark:border-white p-2 text-xs font-bold bg-[#f8f7f4] dark:bg-[#161b22] text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors text-left flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">{vessel.name} ({vessel.draft.toFixed(2)}m)</span>
                <span className="text-[10px] uppercase font-black text-[#d42020] shrink-0 ml-2">ALTERAR</span>
              </button>
            </div>

            {/* Acesso ao Diário de Navegação */}
            {onOpenLogbook && (
              <div className="p-3.5 border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d]">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] mb-1.5">
                  Diário de Navegação & Livro de Bordo
                </span>
                <button
                  onClick={onOpenLogbook}
                  className="w-full border-2 border-black dark:border-white p-2 text-xs font-bold bg-[#f8f7f4] dark:bg-[#161b22] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors text-black dark:text-white text-left flex items-center justify-between cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#d42020]" />
                    <span>LIVRO DE BORDO ({status.currentHeight.toFixed(2)}M)</span>
                  </div>
                  <span className="text-[10px] uppercase font-black">ABRIR →</span>
                </button>
              </div>
            )}

            {/* Acesso ao Conversor Náutico */}
            {onOpenConverter && (
              <div className="p-3.5 border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d]">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] mb-1.5">
                  Conversão Rápida de Unidades Náuticas
                </span>
                <button
                  onClick={onOpenConverter}
                  className="w-full border-2 border-black dark:border-white p-2 text-xs font-bold bg-[#f8f7f4] dark:bg-[#161b22] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors text-black dark:text-white text-left flex items-center justify-between cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#0284c7]" />
                    <span>CONVERSOR (NÓS, MN, HPA)</span>
                  </div>
                  <span className="text-[10px] uppercase font-black">CALCULAR →</span>
                </button>
              </div>
            )}
          </div>

          {/* Condições de Superfície & Fase Lunar no Painel Lateral */}
          <div className="space-y-4 pt-3 border-t-2 border-black/20 dark:border-white/20">
            {/* Bloco de Meteorologia Marinha & Temperaturas */}
            <div className="bg-white dark:bg-[#0d1117] border-2 border-black dark:border-[#30363d] p-3.5 space-y-2 text-xs shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d]">
              <div className="flex items-center justify-between pb-1.5 border-b border-black/10 dark:border-white/10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-[#d42020]" />
                  Condições de Superfície
                </span>
                <span className="text-[10px] font-bold text-black dark:text-white border border-black dark:border-white px-1 bg-[#f8f7f4] dark:bg-[#161b22]">
                  {tempUnit === 'C' ? '°C' : '°F'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#666] dark:text-[#8b949e] flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-[#0284c7]" />
                  Temperatura da Água:
                </span>
                <span className="font-bold text-black dark:text-white tabular-nums">
                  {formatTemperature(realMarineConditions?.oceanWaterTempCelsius, tempUnit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#666] dark:text-[#8b949e] flex items-center gap-1">
                  <CloudSun className="w-3.5 h-3.5 text-[#d97706]" />
                  Temperatura do Ar:
                </span>
                <span className="font-bold text-black dark:text-white tabular-nums">
                  {formatTemperature(realMarineConditions?.airTempCelsius, tempUnit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#666] dark:text-[#8b949e]">Sensação Térmica:</span>
                <span className="font-bold text-black dark:text-white tabular-nums">
                  {formatTemperature(realMarineConditions?.apparentTempCelsius, tempUnit)}
                </span>
              </div>
              {realMarineConditions?.relativeHumidity && (
                <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-1.5 text-[11px]">
                  <span className="text-[#666] dark:text-[#8b949e]">Umidade Relativa:</span>
                  <span className="font-bold text-black dark:text-white">{realMarineConditions.relativeHumidity}%</span>
                </div>
              )}

              <button
                onClick={() => {
                  const el = document.getElementById('wave-wind-forecast-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full mt-2 py-1.5 px-2 bg-black text-white hover:bg-[#333] dark:bg-white dark:text-black dark:hover:bg-[#eee] text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Waves className="w-3.5 h-3.5 text-[#0284c7]" />
                <span>Ver Gráfico 24h de Ondas e Ventos ↓</span>
              </button>
            </div>

            {/* Fase da Lua */}
            <div className="bg-white dark:bg-[#0d1117] border-2 border-black dark:border-[#30363d] p-3.5 shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d]">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] mb-1">
                Fase da Lua & Influência no Mar
              </span>
              <div className="font-bold text-sm text-[#111111] dark:text-white uppercase flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-black dark:text-white" />
                <span>{status.moon.phaseName} ({status.moon.illumination}% Iluminada)</span>
              </div>
              {status.moon.isSpringTide ? (
                <div className="text-xs font-bold text-[#d42020] uppercase mt-1 leading-normal">
                  🌊 Maré de Sizígia: Variação Máxima (Grandes Amplitudes)
                </div>
              ) : (
                <div className="text-xs font-bold text-[#16a34a] dark:text-[#4ade80] uppercase mt-1 leading-normal">
                  ⚖️ Maré de Quadratura: Variação Suave e Correntes Tranquilas
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. SELETOR DE ANÁLISE TEMPORAL (HISTÓRICO 24H REAL VS ASTRO, 7 DIAS PASSADOS & PREVISÃO) */}
      <div className="border-b-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#161b22] px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0284c7]" />
          <span className="font-display font-bold text-xs uppercase tracking-tight text-black dark:text-white">
            Análise Histórica & Astronômica das Marés
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Visualização de análise de maré">
          <button
            onClick={() => setTideAnalysisView('24h')}
            aria-pressed={tideAnalysisView === '24h'}
            className={`px-3 py-1.5 text-xs font-bold uppercase border-2 border-black dark:border-white cursor-pointer transition-colors flex items-center gap-1.5 ${
              tideAnalysisView === '24h'
                ? 'bg-[#0284c7] text-white border-[#0284c7]'
                : 'bg-white text-black dark:bg-[#0d1117] dark:text-white hover:bg-[#eee] dark:hover:bg-[#21262d]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Últimas 24h: Real vs. Astronômica</span>
          </button>

          <button
            onClick={() => setTideAnalysisView('history')}
            aria-pressed={tideAnalysisView === 'history'}
            className={`px-3 py-1.5 text-xs font-bold uppercase border-2 border-black dark:border-white cursor-pointer transition-colors flex items-center gap-1.5 ${
              tideAnalysisView === 'history'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white text-black dark:bg-[#0d1117] dark:text-white hover:bg-[#eee] dark:hover:bg-[#21262d]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#d42020]" />
            <span>Últimos 7 Dias</span>
          </button>

          <button
            onClick={() => setTideAnalysisView('forecast')}
            aria-pressed={tideAnalysisView === 'forecast'}
            className={`px-3 py-1.5 text-xs font-bold uppercase border-2 border-black dark:border-white cursor-pointer transition-colors flex items-center gap-1.5 ${
              tideAnalysisView === 'forecast'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white text-black dark:bg-[#0d1117] dark:text-white hover:bg-[#eee] dark:hover:bg-[#21262d]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Próximos 7 Dias</span>
          </button>

          <button
            onClick={() => setTideAnalysisView('all')}
            aria-pressed={tideAnalysisView === 'all'}
            className={`px-3 py-1.5 text-xs font-bold uppercase border-2 border-black dark:border-white cursor-pointer transition-colors ${
              tideAnalysisView === 'all'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white text-black dark:bg-[#0d1117] dark:text-white hover:bg-[#eee] dark:hover:bg-[#21262d]'
            }`}
          >
            Ver Todos
          </button>
        </div>
      </div>

      {/* SEÇÃO 1: GRÁFICO RECHARTS DE LINHA DAS ÚLTIMAS 24H: REAL VS. ASTRONÔMICA */}
      {(tideAnalysisView === '24h' || tideAnalysisView === 'all') && (
        <div className="border-b-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] p-4 sm:p-6" id="tide-24h-real-vs-astro-section">
          <TideHistory24hRealVsAstroChart station={station} currentTime={currentTime} />
        </div>
      )}

      {/* SEÇÃO 2: HISTÓRICO DE MARÉS DOS ÚLTIMOS 7 DIAS COM RECHARTS */}
      {(tideAnalysisView === 'history' || tideAnalysisView === 'all') && (
        <div className="border-b-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] p-4 sm:p-6" id="past-tide-history-section">
          <TideHistoryPast7Days station={station} currentTime={currentTime} />
        </div>
      )}

      {/* SEÇÃO 3: ESTATÍSTICAS SEMANAIS DA MARÉ COM RECHARTS */}
      {(tideAnalysisView === 'forecast' || tideAnalysisView === 'all') && (
        <div className="border-b-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] p-4 sm:p-6" id="weekly-tide-stats-section">
          <WeeklyTideStatsChart station={station} currentTime={currentTime} />
        </div>
      )}
    </div>
  );
};

export default TideDashboard;
