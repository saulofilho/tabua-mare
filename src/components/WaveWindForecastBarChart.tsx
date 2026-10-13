import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  Waves,
  Wind,
  ShieldCheck,
  ShieldAlert,
  Info,
  Compass,
  ArrowUpRight,
  TrendingUp,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  HourlyWaveWindForecast,
  fetch24HourWaveWindForecast,
  getBeaufortScale,
  getWaveCondition,
} from '../services/realMarineApi';
import { TideStation } from '../types/tide';

// Code-splitting via React.lazy() do motor gráfico Recharts
const RechartsWaveWindGraph = lazy(() => import('./RechartsWaveWindGraph'));

interface WaveWindForecastBarChartProps {
  station: TideStation;
  beachLat?: number;
  beachLng?: number;
  locationName?: string;
  isOfflineMode?: boolean;
}

export const WaveWindForecastBarChart: React.FC<WaveWindForecastBarChartProps> = ({
  station,
  beachLat,
  beachLng,
  locationName,
  isOfflineMode,
}) => {
  const [forecast, setForecast] = useState<HourlyWaveWindForecast[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [displayMode, setDisplayMode] = useState<'both' | 'waves' | 'wind'>('both');
  const [selectedHour, setSelectedHour] = useState<HourlyWaveWindForecast | null>(null);

  const targetLat = beachLat ?? station.lat;
  const targetLng = beachLng ?? station.lng;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetch24HourWaveWindForecast(targetLat, targetLng);
      setForecast(data);
      if (data.length > 0) {
        setSelectedHour(data[0]);
      }
    } catch (err) {
      console.error('Erro carregando previsão horária de ondas e ventos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetLat, targetLng]);

  // Estatísticas calculadas das 24 horas
  const stats = useMemo(() => {
    if (forecast.length === 0) {
      return {
        maxWave: { waveHeightMeters: 0, timeStr: '--', fullTimeStr: '--', dayLabel: 'Hoje' },
        minWave: { waveHeightMeters: 0, timeStr: '--', fullTimeStr: '--', dayLabel: 'Hoje' },
        maxWind: { windSpeedKmH: 0, windSpeedKnots: 0, timeStr: '--', fullTimeStr: '--', dayLabel: 'Hoje' },
        avgWave: 0,
        avgWind: 0,
        safestWindow: 'Manhã',
      };
    }

    let maxW = forecast[0];
    let minW = forecast[0];
    let maxV = forecast[0];
    let sumW = 0;
    let sumV = 0;

    forecast.forEach((item) => {
      if (item.waveHeightMeters > maxW.waveHeightMeters) maxW = item;
      if (item.waveHeightMeters < minW.waveHeightMeters) minW = item;
      if (item.windSpeedKmH > maxV.windSpeedKmH) maxV = item;
      sumW += item.waveHeightMeters;
      sumV += item.windSpeedKmH;
    });

    // Encontrar melhor período com mar mais brando
    const morningHours = forecast.filter((f) => f.hour >= 5 && f.hour <= 11);
    const morningAvg = morningHours.reduce((acc, h) => acc + h.waveHeightMeters, 0) / (morningHours.length || 1);
    const afternoonHours = forecast.filter((f) => f.hour >= 12 && f.hour <= 18);
    const afternoonAvg = afternoonHours.reduce((acc, h) => acc + h.waveHeightMeters, 0) / (afternoonHours.length || 1);

    const safest = morningAvg <= afternoonAvg ? 'Período da Manhã (Mar Mais Calmo)' : 'Período da Tarde';

    return {
      maxWave: maxW,
      minWave: minW,
      maxWind: maxV,
      avgWave: Math.round((sumW / forecast.length) * 10) / 10,
      avgWind: Math.round((sumV / forecast.length) * 10) / 10,
      safestWindow: safest,
    };
  }, [forecast]);

  return (
    <div id="wave-wind-forecast-section" className="w-full border-b-2 border-black bg-white dark:bg-[#0d1117] font-mono scroll-mt-14">
      {/* Cabeçalho do Bloco de Previsão 24h */}
      <div className="p-5 sm:p-6 border-b-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#f8f7f4] dark:bg-[#161b22]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">
              TELEMETRIA OCEÂNICA // PRÓXIMAS 24 HORAS
            </span>
            {isOfflineMode && (
              <span className="text-[9px] font-bold bg-[#eeebe6] dark:bg-[#21262d] text-black dark:text-white px-1.5 py-0.5 border border-black dark:border-white">
                MODELO HARMÔNICO LOCAL
              </span>
            )}
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase text-[#111111] dark:text-white flex items-center gap-2.5">
            <Waves className="w-6 h-6 text-[#0284c7]" />
            Previsão de Ondas e Ventos (24 Horas)
          </h3>
          <p className="text-xs text-[#555] dark:text-[#aaa] mt-1">
            Visualização horária da altura de vagas marítimas (m) e intensidade do vento costeiro (km/h) para{' '}
            <strong>{locationName || station.name}</strong>
          </p>
        </div>

        {/* Controles de Modo de Visualização do Gráfico */}
        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-center">
          <div className="border-2 border-black dark:border-white bg-white dark:bg-[#0d1117] p-1 flex items-center gap-1 text-xs">
            <button
              onClick={() => setDisplayMode('both')}
              aria-label="Exibir gráfico com ondas e vento combinados"
              aria-pressed={displayMode === 'both'}
              className={`px-2.5 py-1 font-bold uppercase cursor-pointer transition-colors ${
                displayMode === 'both'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'text-black dark:text-white hover:bg-[#eeebe6] dark:hover:bg-[#21262d]'
              }`}
            >
              Ambos (Ondas + Vento)
            </button>
            <button
              onClick={() => setDisplayMode('waves')}
              aria-label="Exibir apenas gráfico de altura das ondas"
              aria-pressed={displayMode === 'waves'}
              className={`px-2.5 py-1 font-bold uppercase cursor-pointer transition-colors flex items-center gap-1 ${
                displayMode === 'waves'
                  ? 'bg-[#0284c7] text-white'
                  : 'text-black dark:text-white hover:bg-[#eeebe6] dark:hover:bg-[#21262d]'
              }`}
            >
              <Waves className="w-3.5 h-3.5" aria-hidden="true" />
              Apenas Ondas
            </button>
            <button
              onClick={() => setDisplayMode('wind')}
              aria-label="Exibir apenas gráfico de velocidade do vento"
              aria-pressed={displayMode === 'wind'}
              className={`px-2.5 py-1 font-bold uppercase cursor-pointer transition-colors flex items-center gap-1 ${
                displayMode === 'wind'
                  ? 'bg-[#d97706] text-white'
                  : 'text-black dark:text-white hover:bg-[#eeebe6] dark:hover:bg-[#21262d]'
              }`}
            >
              <Wind className="w-3.5 h-3.5" aria-hidden="true" />
              Apenas Vento
            </button>
          </div>

          <button
            onClick={loadData}
            aria-label="Atualizar telemetria e previsão horária de ondas e vento"
            title="Atualizar dados com modelos oceanográficos"
            className="p-2 border-2 border-black dark:border-white bg-white dark:bg-[#0d1117] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 4 Cards de Resumo Náutico Rápido das 24 Horas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b-2 border-black text-xs">
        {/* Card 1: Onda Máxima */}
        <div className="p-4 sm:p-5 border-b-2 sm:border-b-0 sm:border-r-2 border-black bg-white dark:bg-[#0d1117]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888] block mb-1">
            Pico de Ondas (Máx 24h)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl sm:text-4xl font-bold text-[#0284c7] tabular-nums">
              {stats.maxWave.waveHeightMeters.toFixed(1)}
            </span>
            <span className="font-display text-lg font-bold text-[#0284c7]">M</span>
          </div>
          <div className="mt-1 text-[11px] text-[#444] dark:text-[#aaa] flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#888]" />
            <span>Pico às <strong>{stats.maxWave.fullTimeStr}</strong> ({stats.maxWave.dayLabel})</span>
          </div>
          <span className="inline-block mt-1.5 text-[10px] font-bold text-[#0284c7] uppercase">
            {getWaveCondition(stats.maxWave.waveHeightMeters).name}
          </span>
        </div>

        {/* Card 2: Vento Máximo */}
        <div className="p-4 sm:p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black bg-white dark:bg-[#0d1117]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888] block mb-1">
            Vento Máximo Previsto
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl sm:text-4xl font-bold text-[#d97706] tabular-nums">
              {stats.maxWind.windSpeedKmH.toFixed(0)}
            </span>
            <span className="font-display text-lg font-bold text-[#d97706]">KM/H</span>
            <span className="text-xs text-[#888] tabular-nums font-bold">
              ({stats.maxWind.windSpeedKnots.toFixed(1)} nós)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[#444] dark:text-[#aaa] flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#888]" />
            <span>Rajada às <strong>{stats.maxWind.fullTimeStr}</strong></span>
          </div>
          <span className="inline-block mt-1.5 text-[10px] font-bold text-[#d97706] uppercase">
            Escala Beaufort: {getBeaufortScale(stats.maxWind.windSpeedKmH).name}
          </span>
        </div>

        {/* Card 3: Janela Ideal para Navegar */}
        <div className="p-4 sm:p-5 border-b-2 sm:border-b-0 sm:border-r-2 border-black bg-white dark:bg-[#0d1117]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888] block mb-1">
            Melhor Janela para Navegar
          </span>
          <div className="flex items-center gap-1.5 text-black dark:text-white font-bold text-base mt-1">
            <ShieldCheck className="w-5 h-5 text-[#008800] shrink-0" />
            <span>{stats.safestWindow}</span>
          </div>
          <div className="mt-2 text-[11px] text-[#555] dark:text-[#aaa] leading-relaxed">
            Menor incidência de vento térmico e mar mais brando (mínima de {stats.minWave.waveHeightMeters.toFixed(1)}m às {stats.minWave.fullTimeStr}).
          </div>
        </div>

        {/* Card 4: Médias Estimadas */}
        <div className="p-4 sm:p-5 bg-white dark:bg-[#0d1117] flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888888] block mb-1">
            Médias do Período (24h)
          </span>
          <div className="space-y-1.5 my-1">
            <div className="flex items-center justify-between">
              <span className="text-[#666] dark:text-[#aaa] flex items-center gap-1">
                <Waves className="w-3.5 h-3.5 text-[#0284c7]" />
                Onda Média:
              </span>
              <strong className="text-black dark:text-white tabular-nums">{stats.avgWave.toFixed(1)} metros</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#666] dark:text-[#aaa] flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-[#d97706]" />
                Vento Médio:
              </span>
              <strong className="text-black dark:text-white tabular-nums">{stats.avgWind.toFixed(0)} km/h</strong>
            </div>
          </div>
          <span className="text-[10px] text-[#888] uppercase block pt-1 border-t border-black/10 dark:border-white/10">
            Origem: Modelos Globais NOAA / ECMWF
          </span>
        </div>
      </div>

      {/* ÁREA DO GRÁFICO RECHARTS */}
      <div className="p-4 sm:p-6 bg-white dark:bg-[#0d1117]">
        {isLoading ? (
          <div className="h-72 flex flex-col items-center justify-center gap-3 text-[#666] dark:text-[#aaa]">
            <RefreshCw className="w-7 h-7 animate-spin text-black dark:text-white" />
            <span className="text-xs font-bold uppercase">Carregando telemetria horária de ondas e vento...</span>
          </div>
        ) : forecast.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs text-[#888] uppercase">
            Nenhum dado de previsão disponível para esta coordenada no momento.
          </div>
        ) : (
          <div className="w-full">
            <Suspense
              fallback={
                <div className="h-[320px] w-full flex flex-col items-center justify-center gap-3 bg-[#f8f7f4] dark:bg-[#161b22] border-2 border-black/10 dark:border-white/10 font-mono text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#d42020]" />
                  <span className="font-bold uppercase tracking-wider text-[#666] dark:text-[#aaa]">
                    Inicializando gráficos Recharts...
                  </span>
                </div>
              }
            >
              <RechartsWaveWindGraph
                forecast={forecast}
                displayMode={displayMode}
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
              />
            </Suspense>

            {/* Painel de Detalhes da Hora Selecionada (ao clicar ou interagir) */}
            {selectedHour && (
              <div className="mt-4 p-3.5 border-2 border-black dark:border-white bg-[#f8f7f4] dark:bg-[#161b22] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-black dark:border-white bg-white dark:bg-[#0d1117] font-bold text-center shrink-0">
                    <span className="block text-[10px] text-[#888]">{selectedHour.dayLabel}</span>
                    <span className="font-display text-lg text-black dark:text-white leading-tight">
                      {selectedHour.fullTimeStr}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-black dark:text-white uppercase">
                        {selectedHour.isCurrentHour ? 'Momento Atual (Agora)' : `Condição às ${selectedHour.fullTimeStr}`}
                      </strong>
                      <span className="text-[10px] px-1.5 py-0.2 bg-black text-white dark:bg-white dark:text-black font-bold">
                        {getWaveCondition(selectedHour.waveHeightMeters).name}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#555] dark:text-[#aaa] mt-0.5">
                      Ondas com <strong>{selectedHour.waveHeightMeters.toFixed(1)}m</strong> de altura • Vento de{' '}
                      <strong>{selectedHour.windSpeedKmH.toFixed(0)} km/h ({selectedHour.windSpeedKnots.toFixed(1)} nós)</strong>{' '}
                      [{getBeaufortScale(selectedHour.windSpeedKmH).name}]
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-right font-bold text-[#444] dark:text-[#ccc] border-t sm:border-t-0 sm:border-l border-black/10 dark:border-white/10 sm:pl-3 pt-1 sm:pt-0">
                  <span>Toque em qualquer barra para inspecionar</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legenda Informativa e Guia Náutico Rápido */}
      <div className="p-4 sm:p-5 border-t-2 border-black bg-[#eeebe6] dark:bg-[#161b22] text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[#333] dark:text-[#ccc]">
          <div className="flex items-start gap-2 bg-white dark:bg-[#0d1117] p-2.5 border border-black dark:border-white">
            <Info className="w-4 h-4 text-[#0284c7] shrink-0 mt-0.5" />
            <div>
              <strong className="text-black dark:text-white block uppercase text-[11px]">Altura de Onda Significativa:</strong>
              <span className="text-[11px] leading-relaxed text-[#555] dark:text-[#aaa]">
                Média do terço superior das maiores ondas. Ondas acima de 1.5m exigem cautela redobrada em barras e arrebentações.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-white dark:bg-[#0d1117] p-2.5 border border-black dark:border-white">
            <Wind className="w-4 h-4 text-[#d97706] shrink-0 mt-0.5" />
            <div>
              <strong className="text-black dark:text-white block uppercase text-[11px]">Velocidade do Vento a 10m:</strong>
              <span className="text-[11px] leading-relaxed text-[#555] dark:text-[#aaa]">
                Ventos acima de 30 km/h (~16 nós) geram carneirinhos na crista das ondas e aumentam o arrasto para caiaques e pequenas embarcações.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-white dark:bg-[#0d1117] p-2.5 border border-black dark:border-white md:col-span-2 lg:col-span-1">
            <Compass className="w-4 h-4 text-black dark:text-white shrink-0 mt-0.5" />
            <div>
              <strong className="text-black dark:text-white block uppercase text-[11px]">Ciclo Térmico Litorâneo:</strong>
              <span className="text-[11px] leading-relaxed text-[#555] dark:text-[#aaa]">
                A brisa marítima costuma intensificar no início da tarde devido ao aquecimento do continente, amainando ao anoitecer.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaveWindForecastBarChart;
