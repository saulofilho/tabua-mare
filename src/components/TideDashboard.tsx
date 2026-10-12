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
  Calendar,
  Clock,
  Compass,
  Info,
  Layers,
  Moon,
  ShieldCheck,
  ShieldAlert,
  Ship,
  Sun,
  Waves,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Thermometer,
  Droplets,
  CloudSun,
  BookOpen,
} from 'lucide-react';

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
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'cards' | 'table'>('timeline');

  // Profundidade de referência para canais costeiros (2.5m de profundidade na carta náutica)
  const refChartedDepth = 2.5;
  const ukcResult = calculateUKC(refChartedDepth, status.currentHeight, vessel.draft);

  // Determinar o momento do dia e se um evento já passou
  const now = new Date();
  const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="w-full font-mono">
      {/* 4 Cartões Principais de Telemetria com Linguagem Amigável & Temperaturas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b-2 border-black">
        {/* Célula 1: Altura da Maré em Tempo Real */}
        <div className="p-5 sm:p-6 border-b-2 sm:border-b-0 sm:border-r-2 border-black bg-[#f8f7f4]">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-2">
            Nível da Água Agora // {station.name.split(' ')[0]}
          </span>
          <div className="font-display text-5xl lg:text-6xl font-bold leading-none tracking-tight text-[#111111] tabular-nums">
            {status.currentHeight.toFixed(2)}
            <span className="text-xl font-display ml-1">M</span>
          </div>
          <div
            className={`text-xs font-bold uppercase mt-2.5 flex items-center gap-1.5 ${
              status.tendency === 'enchente'
                ? 'text-[#008800]'
                : status.tendency === 'vazante'
                ? 'text-[#d42020]'
                : 'text-[#888888]'
            }`}
          >
            {status.tendency === 'enchente' ? (
              <>
                <ArrowUpRight className="w-4 h-4 text-[#008800]" />
                <span>MARÉ SUBINDO (+{status.rateCmPerHour} CM/H)</span>
              </>
            ) : status.tendency === 'vazante' ? (
              <>
                <ArrowDownRight className="w-4 h-4 text-[#d42020]" />
                <span>MARÉ DESCENDO (-{status.rateCmPerHour} CM/H)</span>
              </>
            ) : (
              <span>MARÉ ESTÁVEL (ESTOFO)</span>
            )}
          </div>
        </div>

        {/* Célula 2: Próxima Virada da Maré */}
        <div className="p-5 sm:p-6 border-b-2 lg:border-b-0 lg:border-r-2 border-black bg-[#f8f7f4]">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-2">
            Próxima Virada da Maré
          </span>
          <div className="font-display text-5xl lg:text-6xl font-bold leading-none tracking-tight text-[#111111] tabular-nums">
            {status.nextExtreme.timeString}
          </div>
          <div className="text-xs font-bold uppercase mt-2.5 text-[#111111] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#888888]" />
            <span>
              {status.nextExtreme.type === 'preia-mar'
                ? `Pico de Maré Alta (${status.nextExtreme.height.toFixed(2)}m)`
                : `Maré Baixa Rasa (${status.nextExtreme.height.toFixed(2)}m)`}
            </span>
          </div>
        </div>

        {/* Célula 3: Espaço Sob o Barco (Folga da Quilha) */}
        <div className="p-5 sm:p-6 border-b-2 sm:border-b-0 sm:border-r-2 border-black bg-[#f8f7f4]">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-2">
            Folga Sob o Casco (Não Encalhar)
          </span>
          <div className="font-display text-5xl lg:text-6xl font-bold leading-none tracking-tight text-[#111111] tabular-nums">
            {ukcResult.ukc >= 0 ? `+${ukcResult.ukc.toFixed(2)}` : ukcResult.ukc.toFixed(2)}
            <span className="text-xl font-display ml-1">M</span>
          </div>
          <div
            className={`text-xs font-bold uppercase mt-2.5 flex items-center gap-1.5 ${
              ukcResult.safetyStatus === 'safe'
                ? 'text-[#008800]'
                : ukcResult.safetyStatus === 'caution'
                ? 'text-[#b45309]'
                : 'text-[#d42020]'
            }`}
          >
            {ukcResult.safetyStatus === 'safe' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-[#008800]" />
                <span>NAVEGAÇÃO LIVRE // PROF: {ukcResult.actualDepth.toFixed(2)}M</span>
              </>
            ) : ukcResult.safetyStatus === 'caution' ? (
              <>
                <ShieldAlert className="w-4 h-4 text-[#b45309]" />
                <span>ATENÇÃO // PROF: {ukcResult.actualDepth.toFixed(2)}M</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-[#d42020]" />
                <span>ÁGUA RASA PARA SEU BARCO</span>
              </>
            )}
          </div>
        </div>

        {/* Célula 4: TEMPERATURAS (Água do Mar & Clima) com Suporte a Celsius e Fahrenheit */}
        <div className="p-5 sm:p-6 bg-[#f8f7f4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-[#d42020]" />
              TEMPERATURAS LOCAIS
            </span>
            {/* Botão de Alternância de Unidade °C / °F */}
            <button
              onClick={onToggleTempUnit}
              title="Trocar entre Celsius e Fahrenheit"
              className="text-[10px] font-bold px-1.5 py-0.5 border border-black bg-white hover:bg-black hover:text-white transition-colors cursor-pointer"
            >
              <span className={tempUnit === 'C' ? 'font-black underline' : 'text-[#888]'}>°C</span>
              <span className="mx-0.5 text-[#aaa]">/</span>
              <span className={tempUnit === 'F' ? 'font-black underline' : 'text-[#888]'}>°F</span>
            </button>
          </div>

          <div className="space-y-2">
            {/* Temperatura da Água */}
            <div className="flex items-baseline justify-between border-b border-black/10 pb-1.5">
              <div className="flex items-center gap-1.5 text-xs text-[#555]">
                <Droplets className="w-3.5 h-3.5 text-[#0284c7]" />
                <span>Água do Mar:</span>
              </div>
              <div className="text-right">
                <span className="font-display text-2xl font-bold text-black tabular-nums">
                  {formatTemperature(realMarineConditions?.oceanWaterTempCelsius, tempUnit)}
                </span>
                <span className="text-[9px] font-bold text-[#0284c7] uppercase ml-1 block">
                  {realMarineConditions?.oceanWaterTempCelsius && realMarineConditions.oceanWaterTempCelsius >= 24 ? 'Boa para Banho' : 'Água Fresca'}
                </span>
              </div>
            </div>

            {/* Temperatura do Clima / Ar */}
            <div className="flex items-baseline justify-between pt-0.5">
              <div className="flex items-center gap-1.5 text-xs text-[#555]">
                <CloudSun className="w-3.5 h-3.5 text-[#d97706]" />
                <span>Clima / Ar:</span>
              </div>
              <div className="text-right">
                <span className="font-display text-2xl font-bold text-black tabular-nums">
                  {formatTemperature(realMarineConditions?.airTempCelsius, tempUnit)}
                </span>
                <span className="text-[9px] text-[#666] block">
                  Sensação {formatTemperature(realMarineConditions?.apparentTempCelsius, tempUnit)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[9px] text-[#888888] uppercase mt-2 pt-1 border-t border-black/10 flex items-center justify-between">
            <span>{realMarineConditions?.weatherDescription || 'Tempo Estável'}</span>
            <button
              onClick={() => {
                const el = document.getElementById('wave-wind-forecast-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-[9px] font-bold text-[#0284c7] hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <span>Gráfico 24h Ondas/Vento ↓</span>
            </button>
          </div>
        </div>
      </div>

      {/* Seção Principal: Registro Diário Oficial - ULTRA VISUAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 border-b-2 border-black">
        {/* Painel Diário das Marés de Hoje (2 Colunas) */}
        <div className="lg:col-span-2 p-5 sm:p-6 border-b-2 lg:border-b-0 lg:border-r-2 border-black bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888] block">
                Previsão Oficial de Hoje // Padrão Marinha do Brasil (DHN)
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase text-black">
                Ciclo Diário das Marés de Hoje
              </h3>
              <p className="text-xs text-[#555] mt-0.5">
                Acompanhe o sobe e desce do mar em ordem cronológica de fácil entendimento
              </p>
            </div>

            {/* Alternar modos de visualização */}
            <div className="flex flex-wrap items-center gap-1 border-2 border-black bg-[#f8f7f4] p-1 shrink-0 self-start sm:self-center">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-2.5 py-1 text-xs font-bold uppercase cursor-pointer transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-black text-white'
                    : 'text-black hover:bg-white'
                }`}
              >
                Linha do Tempo
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 text-xs font-bold uppercase cursor-pointer transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-black text-white'
                    : 'text-black hover:bg-white'
                }`}
              >
                Réguas Ilustradas
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-xs font-bold uppercase cursor-pointer transition-colors ${
                  viewMode === 'table'
                    ? 'bg-black text-white'
                    : 'text-black hover:bg-white'
                }`}
              >
                Tabela Resumida
              </button>
            </div>
          </div>

          {/* MODO 1: LINHA DO TEMPO VISUAL CRONOLÓGICA (SUPER INTUITIVA) */}
          {viewMode === 'timeline' && (
            <div className="space-y-4">
              {/* Barra de progresso do dia com marcadores */}
              <div className="p-4 border-2 border-black bg-[#f8f7f4] shadow-[3px_3px_0px_#000]">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-[#666] mb-3">
                  <span>Horários ao Longo do Dia</span>
                  <span>4 Momentos Principais</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
                  {todayExtremes.map((ext, idx) => {
                    const isHigh = ext.type === 'preia-mar';
                    const [hStr, mStr] = ext.timeString.split(':');
                    const eventMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
                    const isPast = eventMinutes < currentMinutesOfDay - 20;
                    const isNext = ext.timeString === status.nextExtreme.timeString;

                    // Altura percentual da coluna visual (baseada em 2.8m max)
                    const percent = Math.min(100, Math.max(15, Math.round((ext.height / 2.8) * 100)));

                    return (
                      <div
                        key={`timeline-step-${idx}`}
                        className={`p-3.5 border-2 border-black flex flex-col justify-between transition-all ${
                          isNext
                            ? 'bg-[#fef9c3] ring-2 ring-black shadow-[3px_3px_0px_#000]'
                            : isPast
                            ? 'bg-[#f4f2ee] opacity-80'
                            : isHigh
                            ? 'bg-[#eff6ff]'
                            : 'bg-[#fffbeb]'
                        }`}
                      >
                        {/* Status Tag no Topo */}
                        <div className="flex items-center justify-between pb-2 border-b border-black/20 text-[10px] font-bold uppercase">
                          <span className="text-[#666]">{idx + 1}º Momento</span>
                          {isNext ? (
                            <span className="bg-[#d42020] text-white px-1.5 py-0.2 animate-pulse">
                              PRÓXIMO!
                            </span>
                          ) : isPast ? (
                            <span className="text-[#888]">JÁ PASSOU</span>
                          ) : (
                            <span className="text-black">A SEGUIR</span>
                          )}
                        </div>

                        {/* Tipo de Maré */}
                        <div className="my-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase">
                            <span className="text-base">{isHigh ? '🌊' : '🏖️'}</span>
                            <span className={isHigh ? 'text-[#1d4ed8]' : 'text-[#b45309]'}>
                              {isHigh ? 'Maré Alta' : 'Maré Baixa'}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#777] uppercase font-bold">
                            {isHigh ? '(Preia-mar)' : '(Baixa-mar)'}
                          </div>
                        </div>

                        {/* Hora e Altura */}
                        <div className="my-1 flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] text-[#666] uppercase block font-bold">Horário</span>
                            <span className="font-display text-3xl font-bold text-black tabular-nums">
                              {ext.timeString}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[#666] uppercase block font-bold">Nível</span>
                            <span className="font-display text-2xl font-bold text-black tabular-nums">
                              {ext.height.toFixed(2)}m
                            </span>
                          </div>
                        </div>

                        {/* Régua d'água miniatura */}
                        <div className="mt-2 pt-2 border-t border-black/15">
                          <div className="flex justify-between text-[9px] font-bold text-[#666] mb-1">
                            <span>Nível da Água</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full h-3 border border-black bg-white overflow-hidden relative">
                            <div
                              className={`h-full transition-all ${
                                isHigh ? 'bg-[#3b82f6]' : 'bg-[#f59e0b]'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Resumo prático em 1 frase */}
                        <div className="mt-2.5 text-[10px] text-[#333] font-bold leading-tight pt-1.5 border-t border-black/10">
                          {isHigh
                            ? '🚢 Máxima profundidade: ótimo para barcos e atracar.'
                            : '🏖️ Mar recuado: ótimo para piscinas naturais e praia.'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guia explicativo das condições de hoje */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 border-2 border-black bg-[#f0fdf4]">
                  <div className="font-bold text-black uppercase flex items-center gap-1.5 mb-1 text-xs">
                    <span className="text-sm">🏖️</span>
                    <span>Para Banhistas, Mergulho e Caminhadas</span>
                  </div>
                  <p className="text-[11px] text-[#222] leading-relaxed">
                    O melhor momento para visitar piscinas naturais e faixas de areia extensas é durante a{' '}
                    <strong>Maré Baixa</strong> (por volta de{' '}
                    {todayExtremes.filter(e => e.type === 'baixa-mar').map(e => e.timeString).join(' e ') || 'horários indicados'}).
                  </p>
                </div>

                <div className="p-3.5 border-2 border-black bg-[#eff6ff]">
                  <div className="font-bold text-black uppercase flex items-center gap-1.5 mb-1 text-xs">
                    <span className="text-sm">⛵</span>
                    <span>Para Embarcações e Navegação</span>
                  </div>
                  <p className="text-[11px] text-[#222] leading-relaxed">
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
                    className={`p-4 border-2 border-black flex flex-col justify-between shadow-[3px_3px_0px_#000] ${
                      isHigh ? 'bg-[#f0f9ff]' : 'bg-[#fffbeb]'
                    }`}
                  >
                    <div>
                      {/* Topo do Cartão */}
                      <div className="flex items-center justify-between pb-2 border-b border-black/20">
                        <div className="flex items-center gap-1.5 font-bold text-xs uppercase">
                          <span className="text-base">{isHigh ? '🌊' : '🏖️'}</span>
                          <span className={isHigh ? 'text-black' : 'text-[#b45309]'}>
                            {isHigh ? 'Maré Alta (Preia-mar)' : 'Maré Baixa (Baixa-mar)'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#888888] uppercase">
                          {idx + 1}º Evento de Hoje
                        </span>
                      </div>

                      {/* Horário e Altura em Destaque */}
                      <div className="my-3 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-[#888888] uppercase block">
                            Horário Previsto
                          </span>
                          <span className="font-display text-4xl font-bold text-black tabular-nums">
                            {ext.timeString}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-[#888888] uppercase block">
                            Altura da Água
                          </span>
                          <span className="font-display text-3xl font-bold text-black tabular-nums">
                            {ext.height.toFixed(2)}
                            <span className="text-lg font-display ml-0.5">m</span>
                          </span>
                        </div>
                      </div>

                      {/* Barra Visual Ilustrada */}
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-[#666] font-bold mb-1">
                          <span>Volume da Coluna de Água</span>
                          <span>{percent}% do Volume Máximo</span>
                        </div>
                        <div className="w-full h-3 border border-black bg-white overflow-hidden">
                          <div
                            className={`h-full ${
                              isHigh ? 'bg-[#3b82f6]' : 'bg-[#f59e0b]'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Informações Práticas em Linguagem Clara */}
                      <div className="text-xs space-y-1.5 pt-2 border-t border-black/15 text-[#333]">
                        <div className="flex items-center justify-between">
                          <span className="text-[#666]">Profundidade total no canal:</span>
                          <strong className="text-black tabular-nums">{totalWater.toFixed(2)} metros</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#666]">Folga de segurança sob o barco:</span>
                          <strong
                            className={`tabular-nums ${
                              isSafe ? 'text-[#008800]' : 'text-[#d42020]'
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
                        className={`text-center py-1.5 font-bold text-[11px] uppercase border border-black ${
                          isSafe
                            ? 'bg-black text-white'
                            : 'bg-[#d42020] text-white'
                        }`}
                      >
                        {isSafe
                          ? isHigh
                            ? '✓ Água Funda: Navegação e Atracação Livres'
                            : '✓ Seguro para Navegar com Atenção'
                          : '⚠️ Cuidado: Risco de Encalhe para Barcos Maiores'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO 3: TABELA OFICIAL RESUMIDA E CLARA */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto border-2 border-black">
              <table className="w-full text-left font-mono text-xs border-collapse bg-white">
                <thead>
                  <tr className="border-b-2 border-black bg-[#eeebe6]">
                    <th className="p-2.5 font-bold uppercase text-[11px]">Tipo de Maré</th>
                    <th className="p-2.5 font-bold uppercase text-[11px]">Horário</th>
                    <th className="p-2.5 font-bold uppercase text-[11px]">Nível da Água</th>
                    <th className="p-2.5 font-bold uppercase text-[11px]">Profundidade Total</th>
                    <th className="p-2.5 font-bold uppercase text-[11px]">Folga do Barco</th>
                    <th className="p-2.5 font-bold uppercase text-[11px] text-right">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/15">
                  {todayExtremes.map((ext, idx) => {
                    const totalD = ext.height + refChartedDepth;
                    const clear = totalD - vessel.draft;
                    const isSafe = clear >= vessel.safetyMargin;

                    return (
                      <tr key={`tbl-${ext.timeString}-${idx}`} className="hover:bg-[#f8f7f4] transition-colors">
                        <td className="p-2.5 font-bold">
                          {ext.type === 'preia-mar' ? '🌊 Maré Alta (Preia-mar)' : '🏖️ Maré Baixa (Baixa-mar)'}
                        </td>
                        <td className="p-2.5 font-bold text-black tabular-nums">{ext.timeString}</td>
                        <td className="p-2.5 font-bold tabular-nums text-black">{ext.height.toFixed(2)} metros</td>
                        <td className="p-2.5 tabular-nums">{totalD.toFixed(2)} m</td>
                        <td className="p-2.5 tabular-nums">
                          <strong className={clear >= 0.6 ? 'text-[#008800]' : 'text-[#d42020]'}>
                            +{clear.toFixed(2)} m livre
                          </strong>
                        </td>
                        <td className="p-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isSafe ? 'bg-black text-white' : 'bg-[#d42020] text-white'
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

          {/* Dica de fácil compreensão para qualquer pessoa */}
          <div className="mt-4 p-3.5 border-2 border-black bg-[#f8f7f4] text-xs flex items-start gap-2.5 text-[#333]">
            <Info className="w-4 h-4 text-black shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Como funciona a maré no Brasil:</strong> A água sobe e desce cerca de duas vezes por dia. Na <strong>Maré Alta (Preia-mar)</strong> o mar chega ao nível máximo — ideal para lanchas, veleiros e atracação. Na <strong>Maré Baixa (Baixa-mar)</strong> a água recua — excelente para curtir piscinas naturais e caminhar na areia, mas exige atenção para embarcações não rasparem no fundo.
            </div>
          </div>
        </div>

        {/* Controles Laterais em Português Claro (1 Coluna) */}
        <div className="p-6 bg-[#eeebe6] flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div>
              <label
                htmlFor="tactical-station-select"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-1.5"
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
                className="w-full border-2 border-black p-2.5 text-xs font-bold bg-white text-black focus:outline-none cursor-pointer"
              >
                {allStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-1.5">
                Embarcação Configurada & Calado
              </span>
              <button
                onClick={onOpenVesselModal}
                className="w-full border-2 border-black p-2.5 text-xs font-bold bg-white text-black hover:bg-[#f8f7f4] text-left flex items-center justify-between cursor-pointer"
              >
                <span>{vessel.name} ({vessel.draft.toFixed(2)}m de Calado)</span>
                <span className="text-[10px] uppercase underline text-[#d42020]">ALTERAR</span>
              </button>
              <p className="text-[10px] text-[#666] mt-1">
                Calado é quanto o casco do barco afunda na água.
              </p>
            </div>

            {onOpenLogbook && (
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-1.5">
                  Diário de Navegação & Livro de Bordo
                </span>
                <button
                  onClick={onOpenLogbook}
                  className="w-full border-2 border-black p-2.5 text-xs font-bold bg-white hover:bg-black hover:text-white transition-colors text-black text-left flex items-center justify-between cursor-pointer shadow-[2px_2px_0px_#000]"
                >
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#d42020]" />
                    <span>LIVRO DE BORDO ({status.currentHeight.toFixed(2)}M)</span>
                  </div>
                  <span className="text-[10px] uppercase underline">ABRIR →</span>
                </button>
                <p className="text-[10px] text-[#666] mt-1">
                  Registre partidas/chegadas com as cotas exatas de maré.
                </p>
              </div>
            )}

            {onOpenConverter && (
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-1.5">
                  Conversão Rápida de Unidades Náuticas
                </span>
                <button
                  onClick={onOpenConverter}
                  className="w-full border-2 border-black p-2.5 text-xs font-bold bg-[#f8f7f4] hover:bg-black hover:text-white transition-colors text-black text-left flex items-center justify-between cursor-pointer shadow-[2px_2px_0px_#000]"
                >
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#d42020]" />
                    <span>CONVERSOR (NÓS ↔ KM/H, MN, HPA)</span>
                  </div>
                  <span className="text-[10px] uppercase underline">CALCULAR →</span>
                </button>
                <p className="text-[10px] text-[#666] mt-1">
                  {realMarineConditions?.windSpeedKmH
                    ? `Vento atual: ${(realMarineConditions.windSpeedKmH / 1.852).toFixed(1)} nós (${realMarineConditions.windSpeedKmH} km/h).`
                    : 'Converta nós para km/h, milhas náuticas e pressão barométrica instantaneamente.'}
                </p>
              </div>
            )}
          </div>

          {/* Bloco de Meteorologia Marinha & Temperaturas no Painel Lateral */}
          <div className="pt-4 border-t-2 border-black/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#888888] flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-[#d42020]" />
                Condições de Superfície
              </span>
              <span className="text-[10px] font-bold text-black border border-black px-1 bg-white">
                {tempUnit === 'C' ? 'CELSIUS (°C)' : 'FAHRENHEIT (°F)'}
              </span>
            </div>

            <div className="bg-white border-2 border-black p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#666] flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-[#0284c7]" />
                  Temperatura da Água:
                </span>
                <span className="font-bold text-black tabular-nums">
                  {formatTemperature(realMarineConditions?.oceanWaterTempCelsius, tempUnit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#666] flex items-center gap-1">
                  <CloudSun className="w-3.5 h-3.5 text-[#d97706]" />
                  Temperatura do Ar:
                </span>
                <span className="font-bold text-black tabular-nums">
                  {formatTemperature(realMarineConditions?.airTempCelsius, tempUnit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#666]">Sensação Térmica:</span>
                <span className="font-bold text-[#444] tabular-nums">
                  {formatTemperature(realMarineConditions?.apparentTempCelsius, tempUnit)}
                </span>
              </div>
              {realMarineConditions?.relativeHumidity && (
                <div className="flex items-center justify-between border-t border-black/10 pt-1.5 text-[11px]">
                  <span className="text-[#666]">Umidade Relativa:</span>
                  <span className="font-bold text-black">{realMarineConditions.relativeHumidity}%</span>
                </div>
              )}

              <button
                onClick={() => {
                  const el = document.getElementById('wave-wind-forecast-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full mt-2.5 py-1.5 px-2 bg-black text-white hover:bg-[#333] text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#888]"
              >
                <Waves className="w-3.5 h-3.5 text-[#0284c7]" />
                <span>Ver Gráfico 24h de Ondas e Ventos ↓</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-black/20">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-1">
              Fase da Lua & Influência no Mar
            </span>
            <div className="font-bold text-sm text-[#111111] uppercase flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-black" />
              <span>{status.moon.phaseName} ({status.moon.illumination}% Iluminada)</span>
            </div>
            {status.moon.isSpringTide ? (
              <div className="text-xs font-bold text-[#d42020] uppercase mt-1 leading-normal">
                🌊 Maré de Sizígia: Variação Máxima (Marés Mais Altas e Mais Baixas do Mês)
              </div>
            ) : (
              <div className="text-xs font-bold text-[#008800] uppercase mt-1 leading-normal">
                ⚖️ Maré de Quadratura: Variação Suave e Correntes Tranquilas
              </div>
            )}
            <p className="text-[10px] text-[#666] mt-1.5 leading-relaxed">
              Durante as luas Cheia e Nova, a atração gravitacional é mais forte, gerando as maiores amplitudes de maré.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
