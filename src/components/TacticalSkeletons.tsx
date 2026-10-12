import React from 'react';
import { Compass, Waves, Navigation, Loader2 } from 'lucide-react';

/**
 * Skeleton para Carta Náutica e GPS (Leaflet)
 * Garante layout idêntico de 600px sem Cumulative Layout Shift (CLS)
 */
export const RadarMapSkeleton: React.FC = () => {
  return (
    <div className="w-full border-b-2 border-black bg-white dark:bg-[#0d1117] font-mono select-none">
      {/* Barra de Status */}
      <div className="bg-[#111] text-white px-4 py-2 border-b-2 border-black flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 text-[#d42020] animate-spin" />
          <span className="font-bold tracking-wider uppercase">
            CARREGANDO CARTA NÁUTICA ELETRÔNICA (ENC)...
          </span>
        </div>
        <div className="text-[10px] text-[#888] hidden sm:block">
          SISTEMA CARTOGRÁFICO OPENSEAMAP // DATUM WGS-84
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 border-b-2 border-black">
        {/* Painel do Mapa (600px exatos) */}
        <div className="lg:col-span-3 border-b-2 lg:border-b-0 lg:border-r-2 border-black relative h-[600px] bg-[#e5e5df] dark:bg-[#161b22] overflow-hidden flex items-center justify-center">
          {/* Grade Tática de Coordenadas Náuticas */}
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#111_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />

          {/* Anéis de Alcance do Radar (Range Rings) */}
          <div className="absolute w-[440px] h-[440px] rounded-full border border-black/20 dark:border-white/20 pointer-events-none" />
          <div className="absolute w-[300px] h-[300px] rounded-full border border-dashed border-black/30 dark:border-white/30 pointer-events-none animate-pulse" />
          <div className="absolute w-[160px] h-[160px] rounded-full border border-black/40 dark:border-white/40 pointer-events-none" />

          {/* Linhas de Mira Cruzada */}
          <div className="absolute inset-x-0 h-px bg-black/20 dark:bg-white/20 pointer-events-none" />
          <div className="absolute inset-y-0 w-px bg-black/20 dark:bg-white/20 pointer-events-none" />

          {/* Card Central de Carregamento */}
          <div className="relative z-10 bg-white dark:bg-[#1c2128] border-2 border-black dark:border-white p-6 shadow-[4px_4px_0px_#000] dark:shadow-[4px_4px_0px_#fff] text-center max-w-sm mx-4">
            <Compass className="w-8 h-8 text-[#d42020] mx-auto mb-2 animate-spin" style={{ animationDuration: '4s' }} />
            <h4 className="font-display text-lg font-bold uppercase text-black dark:text-white">
              Sincronizando Cartografia
            </h4>
            <p className="text-xs text-[#555] dark:text-[#aaa] mt-1 mb-3">
              Carregando camadas vetoriais de batimetria, perigos e sinalização náutica...
            </p>
            <div className="w-full bg-[#eee] dark:bg-[#333] h-2 border border-black dark:border-white overflow-hidden">
              <div className="bg-[#d42020] h-full w-2/3 animate-pulse" />
            </div>
            <div className="text-[10px] text-[#888] mt-2 font-mono uppercase">
              Leaflet 1.9 // OpenSeaMap Engine
            </div>
          </div>

          {/* Fita de Instrumentos Superior */}
          <div className="absolute top-3 left-3 z-20 flex gap-2">
            <div className="bg-white/90 dark:bg-[#161b22]/90 border-2 border-black dark:border-white px-3 py-1.5 text-xs text-black dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#d42020] animate-ping" />
              <span>RADAR GPS: CALIBRANDO...</span>
            </div>
          </div>
        </div>

        {/* Coluna Lateral de Instrumentos */}
        <div className="p-4 bg-[#f8f7f4] dark:bg-[#0d1117] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="h-4 bg-black/10 dark:bg-white/10 w-3/4 animate-pulse" />
            <div className="h-20 bg-white dark:bg-[#161b22] border-2 border-black dark:border-white p-3 space-y-2">
              <div className="h-3 bg-black/10 dark:bg-white/10 w-1/2 animate-pulse" />
              <div className="h-6 bg-black/10 dark:bg-white/10 w-5/6 animate-pulse" />
            </div>
            <div className="h-28 bg-white dark:bg-[#161b22] border-2 border-black dark:border-white p-3 space-y-2">
              <div className="h-3 bg-black/10 dark:bg-white/10 w-2/3 animate-pulse" />
              <div className="h-4 bg-black/10 dark:bg-white/10 w-full animate-pulse" />
              <div className="h-4 bg-black/10 dark:bg-white/10 w-4/5 animate-pulse" />
            </div>
          </div>
          <div className="h-10 bg-black text-white flex items-center justify-center text-xs font-bold uppercase">
            INICIALIZANDO ROTA...
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton para o Gráfico de Ondas e Vento (Recharts)
 * Altura exata para prevenir Cumulative Layout Shift (CLS)
 */
export const WaveWindChartSkeleton: React.FC = () => {
  return (
    <div className="w-full border-b-2 border-black bg-white dark:bg-[#0d1117] font-mono min-h-[440px]">
      {/* Cabeçalho */}
      <div className="bg-[#f8f7f4] dark:bg-[#161b22] border-b-2 border-black px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black dark:bg-white flex items-center justify-center shrink-0">
            <Waves className="w-4 h-4 text-white dark:text-black animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg sm:text-xl font-bold uppercase tracking-tight text-black dark:text-white">
                Previsão Meteomarinha 24h
              </span>
              <span className="text-[10px] bg-black text-white px-1.5 py-0.5 uppercase font-bold animate-pulse">
                Carregando
              </span>
            </div>
            <p className="text-[11px] text-[#666] dark:text-[#aaa]">
              Sincronizando séries horárias de vagas oceânicas e anemômetro...
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Placeholder */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b-2 border-black">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3 border-r-2 last:border-r-0 border-black/20 bg-white dark:bg-[#0d1117] space-y-1.5">
            <div className="h-3 bg-black/10 dark:bg-white/10 w-2/3 animate-pulse" />
            <div className="h-6 bg-black/15 dark:bg-white/15 w-1/2 animate-pulse" />
            <div className="h-2.5 bg-black/10 dark:bg-white/10 w-4/5 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Área das Barras Recharts (Altura sincronizada) */}
      <div className="p-4 sm:p-6 bg-white dark:bg-[#0d1117]">
        <div className="h-[260px] w-full flex items-end justify-between gap-1.5 px-4 pb-4 border-b border-l border-black/20 dark:border-white/20">
          {[40, 55, 70, 85, 60, 45, 50, 65, 80, 95, 75, 60, 50, 65, 80, 70, 55, 45, 40, 50, 60, 55, 45, 40].map((h, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                className="w-full bg-[#111]/15 dark:bg-[#fff]/15 rounded-t-sm transition-all"
                style={{ height: `${h}%`, animation: `pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite ${idx * 60}ms` }}
              />
              <span className="text-[9px] text-[#999] opacity-70">
                {idx % 4 === 0 ? `${idx}h` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton genérico para abas modulares (Diário de Bordo, Alertas)
 */
export const TabModuleSkeleton: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle = 'Carregando módulo e dados salvos no aparelho...',
}) => {
  return (
    <div className="p-6 bg-white dark:bg-[#0d1117] border-b-2 border-black font-mono space-y-4 min-h-[400px]">
      <div className="flex items-center justify-between pb-4 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#d42020] animate-spin" />
          <div>
            <h3 className="font-display text-xl font-bold uppercase text-black dark:text-white">
              {title}
            </h3>
            <p className="text-xs text-[#666] dark:text-[#aaa]">{subtitle}</p>
          </div>
        </div>
        <span className="px-2 py-1 bg-black text-white text-[10px] font-bold uppercase">
          CARREGANDO
        </span>
      </div>

      <div className="space-y-3 pt-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="p-4 border-2 border-black bg-[#f8f7f4] dark:bg-[#161b22] space-y-2 animate-pulse"
          >
            <div className="h-4 bg-black/10 dark:bg-white/10 w-1/3" />
            <div className="h-3 bg-black/10 dark:bg-white/10 w-2/3" />
            <div className="h-3 bg-black/10 dark:bg-white/10 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
};
