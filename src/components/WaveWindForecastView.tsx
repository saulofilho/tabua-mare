import React from 'react';
import { TideStation } from '../types/tide';
import { ArrowLeft, Wind, Waves, Compass, Activity } from 'lucide-react';
import WaveWindForecastBarChart from './WaveWindForecastBarChart';

interface WaveWindForecastViewProps {
  station: TideStation;
  beachLat?: number;
  beachLng?: number;
  locationName: string;
  isOfflineMode: boolean;
  onBackToTides: () => void;
}

export const WaveWindForecastView: React.FC<WaveWindForecastViewProps> = ({
  station,
  beachLat,
  beachLng,
  locationName,
  isOfflineMode,
  onBackToTides,
}) => {
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
          <span className="hidden sm:inline">LOCAL:</span>
          <span className="text-black dark:text-white uppercase px-2 py-0.5 bg-[#eee] dark:bg-[#21262d] border border-black/20 dark:border-white/20">
            {locationName}
          </span>
        </div>
      </div>

      {/* Componente Principal de Previsão de Ondas e Rosa dos Ventos */}
      <div className="p-0 sm:p-2">
        <WaveWindForecastBarChart
          station={station}
          beachLat={beachLat}
          beachLng={beachLng}
          locationName={locationName}
          isOfflineMode={isOfflineMode}
        />
      </div>
    </div>
  );
};

export default WaveWindForecastView;
