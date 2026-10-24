import React, { useState } from 'react';
import { TideStation } from '../types/tide';
import { ArrowLeft, Activity, History, Sparkles, Compass } from 'lucide-react';
import { TideHistory24hRealVsAstroChart } from './TideHistory24hRealVsAstroChart';
import { TideHistoryPast7Days } from './TideHistoryPast7Days';
import { WeeklyTideStatsChart } from './WeeklyTideStatsChart';

interface TideHistoryViewProps {
  station: TideStation;
  currentTime?: number;
  onBackToTides: () => void;
}

export const TideHistoryView: React.FC<TideHistoryViewProps> = ({
  station,
  currentTime,
  onBackToTides,
}) => {
  const [tideAnalysisView, setTideAnalysisView] = useState<'24h' | 'history' | 'forecast' | 'all'>('24h');

  return (
    <div className="w-full font-mono bg-[#f8f7f4] dark:bg-[#0d1117] transition-colors pb-10">
      {/* Barra de Navegação Superior / Retorno */}
      <div className="border-b-2 border-black dark:border-[#30363d] bg-white dark:bg-[#161b22] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <button
          onClick={onBackToTides}
          className="px-3 py-1.5 bg-black hover:bg-[#333] text-white dark:bg-white dark:text-black dark:hover:bg-[#eee] text-xs font-bold uppercase border-2 border-black dark:border-white cursor-pointer flex items-center gap-2 shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>VOLTAR PARA TÁBUA DE MARÉ</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-bold text-[#666] dark:text-[#8b949e]">
          <span className="hidden sm:inline">ESTAÇÃO:</span>
          <span className="text-black dark:text-white uppercase px-2 py-0.5 bg-[#eee] dark:bg-[#21262d] border border-black/20 dark:border-white/20">
            {station.name} ({station.state})
          </span>
        </div>
      </div>

      {/* Cabeçalho da Feature */}
      <div className="p-4 sm:p-6 border-b-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117]">
        <div className="flex items-center gap-2 flex-wrap">
          <Activity className="w-5 h-5 text-[#0284c7]" />
          <h2 className="font-display text-xl sm:text-2xl font-bold uppercase text-black dark:text-white tracking-tight">
            Análise Histórica & Astronômica das Marés
          </h2>
          <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-[#e0f2fe] text-[#0369a1] border border-[#0284c7]">
            Recharts Telemetria
          </span>
        </div>
        <p className="text-xs text-[#555] dark:text-[#8b949e] mt-1.5 leading-relaxed max-w-3xl">
          Compare a curva real observada com o modelo harmônico astronômico da DHN (Diretoria de Hidrografia e Navegação) nas últimas 24 horas, examine o histórico dos últimos 7 dias ou visualize as projeções da próxima semana.
        </p>

        {/* Seletor de Análise */}
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Visualização de análise de maré">
          <button
            onClick={() => setTideAnalysisView('24h')}
            aria-pressed={tideAnalysisView === '24h'}
            className={`px-3.5 py-1.5 text-xs font-bold uppercase border-2 border-black dark:border-white cursor-pointer transition-colors flex items-center gap-1.5 shadow-[2px_2px_0px_#000] ${
              tideAnalysisView === '24h'
                ? 'bg-[#0284c7] text-white border-[#0284c7]'
                : 'bg-white text-black dark:bg-[#0d1117] dark:text-white hover:bg-[#eee]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Últimas 24h: Real vs. Astronômica</span>
          </button>

          <button
            onClick={() => setTideAnalysisView('history')}
            aria-pressed={tideAnalysisView === 'history'}
            className={`px-3.5 py-1.5 text-xs font-bold uppercase border-2 border-black dark:border-white cursor-pointer transition-colors flex items-center gap-1.5 shadow-[2px_2px_0px_#000] ${
              tideAnalysisView === 'history'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white text-black dark:bg-[#0d1117] dark:text-white hover:bg-[#eee]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#d42020]" />
            <span>Últimos 7 Dias</span>
          </button>

          <button
            onClick={() => setTideAnalysisView('forecast')}
            aria-pressed={tideAnalysisView === 'forecast'}
            className={`px-3.5 py-1.5 text-xs font-bold uppercase border-2 border-black dark:border-white cursor-pointer transition-colors flex items-center gap-1.5 shadow-[2px_2px_0px_#000] ${
              tideAnalysisView === 'forecast'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white text-black dark:bg-[#0d1117] dark:text-white hover:bg-[#eee]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Próximos 7 Dias</span>
          </button>

          <button
            onClick={() => setTideAnalysisView('all')}
            aria-pressed={tideAnalysisView === 'all'}
            className={`px-3.5 py-1.5 text-xs font-bold uppercase border-2 border-black dark:border-white cursor-pointer transition-colors shadow-[2px_2px_0px_#000] ${
              tideAnalysisView === 'all'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white text-black dark:bg-[#0d1117] dark:text-white hover:bg-[#eee]'
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

export default TideHistoryView;
