import React from 'react';
import { BeachLocation } from '../data/beaches';
import { RealMarineConditions } from '../services/realMarineApi';
import {
  Compass,
  MapPin,
  Navigation,
  Search,
  Waves,
  Wind,
  Check,
} from 'lucide-react';

interface NearestBeachBannerProps {
  nearestBeach: BeachLocation;
  distanceKm: number;
  distanceNM: number;
  realMarineConditions: RealMarineConditions | null;
  tideHeight: number;
  tendency: 'enchente' | 'vazante' | 'estofo';
  hasRealGPS: boolean;
  onRequestGPS: () => void;
  onSelectBeach: (beach: BeachLocation) => void;
  onOpenSearch: () => void;
  isActiveStationBeach: boolean;
}

export const NearestBeachBanner: React.FC<NearestBeachBannerProps> = ({
  nearestBeach,
  distanceKm,
  distanceNM,
  realMarineConditions,
  tideHeight,
  tendency,
  hasRealGPS,
  onRequestGPS,
  onSelectBeach,
  onOpenSearch,
  isActiveStationBeach,
}) => {
  return (
    <div className="border-b-2 border-black bg-white p-4 font-mono">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Section: Nearest Beach Identification */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-black text-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#d42020]" />
              PRAIA MAIS PRÓXIMA
            </span>

            {hasRealGPS ? (
              <span className="text-[10px] font-bold text-[#008800] border border-[#008800] px-1.5 py-0.5 uppercase bg-[#f0fff0]">
                GPS REAL CALIBRADO
              </span>
            ) : (
              <button
                onClick={onRequestGPS}
                className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 uppercase bg-[#eeebe6] hover:bg-black hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                title="Obter coordenadas GPS reais do dispositivo"
              >
                <Navigation className="w-2.5 h-2.5" />
                OBTER MEU GPS
              </button>
            )}

            <span className="text-xs font-bold text-[#888888] hidden sm:inline">
              DISTÂNCIA: <strong className="text-black">{distanceKm} KM</strong> ({distanceNM} MN)
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-black">
              {nearestBeach.name}
            </h2>
            <span className="text-xs font-bold text-[#666] uppercase">
              // {nearestBeach.city} - {nearestBeach.state}
            </span>
          </div>

          <p className="text-[11px] text-[#666] max-w-2xl">
            {nearestBeach.description} · Coordenadas:{' '}
            <span className="text-black font-bold">
              {nearestBeach.lat.toFixed(4)}°, {nearestBeach.lng.toFixed(4)}°
            </span>
          </p>
        </div>

        {/* Middle Section: Real Ocean Conditions (Open-Meteo Marine API) */}
        <div className="flex flex-wrap items-center gap-3 py-2 px-3 border-2 border-black bg-[#f8f7f4] shadow-[2px_2px_0px_#000]">
          {/* Real Tide at this beach */}
          <div className="pr-3 border-r-2 border-black/20">
            <span className="block text-[10px] font-bold uppercase text-[#888888]">
              MARÉ NESTA PRAIA
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-2xl font-bold text-black tabular-nums">
                {tideHeight.toFixed(2)}M
              </span>
              <span
                className={`text-[10px] font-bold uppercase ${
                  tendency === 'enchente'
                    ? 'text-black'
                    : tendency === 'vazante'
                    ? 'text-[#d42020]'
                    : 'text-[#888888]'
                }`}
              >
                [{tendency === 'enchente' ? '▲ ENCHENDO' : tendency === 'vazante' ? '▼ VAZANDO' : 'ESTOFO'}]
              </span>
            </div>
          </div>

          {/* Real Ocean Waves from Marine API */}
          {realMarineConditions && (
            <div className="pr-3 border-r-2 border-black/20">
              <span className="block text-[10px] font-bold uppercase text-[#888888] flex items-center gap-1">
                <Waves className="w-3 h-3 text-black" />
                ONDULAÇÃO REAL
              </span>
              <div className="text-xs font-bold text-black tabular-nums">
                {realMarineConditions.waveHeightMeters}m · {realMarineConditions.wavePeriodSeconds}s
              </div>
            </div>
          )}

          {/* Wind / Direction */}
          {realMarineConditions && (
            <div>
              <span className="block text-[10px] font-bold uppercase text-[#888888] flex items-center gap-1">
                <Compass className="w-3 h-3 text-black" />
                DIREÇÃO ONDA
              </span>
              <div className="text-xs font-bold text-black tabular-nums">
                {realMarineConditions.waveDirectionDegrees}° ({realMarineConditions.windSpeedKmH ? `${realMarineConditions.windSpeedKmH} km/h` : 'MODERADO'})
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Actions (Select Beach & Search) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onSelectBeach(nearestBeach)}
            className={`px-3 py-2 text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-colors ${
              isActiveStationBeach
                ? 'bg-black text-white cursor-default'
                : 'border-2 border-black bg-white hover:bg-black hover:text-white text-black shadow-[2px_2px_0px_#000]'
            }`}
          >
            {isActiveStationBeach ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#008800]" />
                <span>PRAIA SELECIONADA</span>
              </>
            ) : (
              <span>VER TÁBUA DESTA PRAIA</span>
            )}
          </button>

          <button
            onClick={onOpenSearch}
            className="px-3.5 py-2 bg-black hover:bg-[#333] text-white text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000]"
          >
            <Search className="w-3.5 h-3.5" />
            <span>BUSCAR PRAIA/CIDADE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
