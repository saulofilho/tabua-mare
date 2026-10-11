import React from 'react';
import { BeachLocation } from '../data/beaches';
import { RealMarineConditions, formatTemperature } from '../services/realMarineApi';
import { TemperatureUnit } from '../types/tide';
import {
  Compass,
  MapPin,
  Navigation,
  Search,
  Waves,
  RotateCcw,
  CheckCircle,
  Thermometer,
  CloudSun,
  Droplets,
} from 'lucide-react';

interface NearestBeachBannerProps {
  activeBeach: BeachLocation; // Praia atualmente em destaque (selecionada ou padrão)
  nearestBeach: BeachLocation; // Praia mais próxima calculada pelo GPS
  isNearestBeach: boolean; // Se a praia em destaque é a mais próxima do usuário
  distanceToActiveKm: number;
  distanceToNearestKm: number;
  realMarineConditions: RealMarineConditions | null;
  tideHeight: number;
  tendency: 'enchente' | 'vazante' | 'estofo';
  hasRealGPS: boolean;
  tempUnit: TemperatureUnit;
  onToggleTempUnit: () => void;
  onRequestGPS: () => void;
  onResetToNearest: () => void;
  onOpenSearch: () => void;
}

export const NearestBeachBanner: React.FC<NearestBeachBannerProps> = ({
  activeBeach,
  nearestBeach,
  isNearestBeach,
  distanceToActiveKm,
  distanceToNearestKm,
  realMarineConditions,
  tideHeight,
  tendency,
  hasRealGPS,
  tempUnit,
  onToggleTempUnit,
  onRequestGPS,
  onResetToNearest,
  onOpenSearch,
}) => {
  // Visual calculation for mini water column (0m to 3.0m)
  const maxVisualRange = 3.0;
  const clampedHeight = Math.max(0, Math.min(maxVisualRange, tideHeight));
  const waterPercent = Math.round((clampedHeight / maxVisualRange) * 100);

  return (
    <div className="border-b-2 border-black bg-white p-4 font-mono shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Section: Active Beach in Highlight */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {isNearestBeach ? (
              <span className="bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[1px_1px_0px_#000]">
                <MapPin className="w-3.5 h-3.5 text-[#d42020]" />
                📍 PRAIA MAIS PRÓXIMA DE VOCÊ
              </span>
            ) : (
              <span className="bg-[#111111] text-[#f8f7f4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-white" />
                PRAIA SELECIONADA EM DESTAQUE
              </span>
            )}

            {hasRealGPS ? (
              <span className="text-[10px] font-bold text-[#008800] border border-[#008800] px-1.5 py-0.5 uppercase bg-[#f0fff0]">
                GPS REAL CALIBRADO
              </span>
            ) : (
              <button
                onClick={onRequestGPS}
                className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 uppercase bg-[#eeebe6] hover:bg-black hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                title="Calibrar posição pelo GPS do dispositivo"
              >
                <Navigation className="w-2.5 h-2.5" />
                CALIBRAR MEU GPS
              </button>
            )}

            <span className="text-xs font-bold text-[#888888]">
              DISTÂNCIA:{' '}
              <strong className="text-black tabular-nums">{distanceToActiveKm} KM</strong>
            </span>
          </div>

          {/* Beach Title */}
          <div className="flex items-baseline gap-2 pt-0.5">
            <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-black">
              {activeBeach.name}
            </h2>
            <span className="text-xs font-bold text-[#666] uppercase">
              // {activeBeach.city} - {activeBeach.state}
            </span>
          </div>

          <p className="text-[11px] text-[#666] max-w-2xl">
            {activeBeach.description} · Coordenadas:{' '}
            <span className="text-black font-bold">
              {activeBeach.lat.toFixed(4)}°, {activeBeach.lng.toFixed(4)}°
            </span>
          </p>

          {/* If another beach is selected, display notice pointing to the nearest beach */}
          {!isNearestBeach && (
            <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#888888] font-bold text-[11px]">
                Sua praia mais próxima por GPS é{' '}
                <strong className="text-black">{nearestBeach.name}</strong> ({distanceToNearestKm} km):
              </span>
              <button
                onClick={onResetToNearest}
                className="text-[10px] font-bold border border-black px-2 py-0.5 uppercase bg-[#eeebe6] hover:bg-black hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3 text-[#d42020]" />
                VOLTAR PARA A PRAIA MAIS PRÓXIMA
              </button>
            </div>
          )}
        </div>

        {/* Middle Section: Visual Tide Meter & Real Ocean Conditions & Temperatures */}
        <div className="flex flex-wrap items-center gap-3 py-2 px-3 border-2 border-black bg-[#f8f7f4] shadow-[2px_2px_0px_#000]">
          {/* REPRESENTAÇÃO VISUAL DA MARÉ (Mini Coluna de Água) */}
          <div className="pr-3 border-r-2 border-black/20 flex items-center gap-2.5">
            {/* Visual graduated gauge column */}
            <div className="flex flex-col items-center">
              <div
                className="w-5 h-14 border-2 border-black bg-white relative flex flex-col justify-end overflow-hidden"
                title={`Nível da maré: ${tideHeight.toFixed(2)}m (${waterPercent}% da escala)`}
              >
                {/* Water level fill */}
                <div
                  className="w-full bg-[#3b82f6] border-t-2 border-black transition-all duration-500"
                  style={{ height: `${Math.min(100, Math.max(8, waterPercent))}%` }}
                />
                {/* Graduations */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                  <div className="w-full border-b border-black" />
                  <div className="w-full border-b border-black" />
                  <div className="w-full border-b border-black" />
                </div>
              </div>
              <span className="text-[8px] font-bold text-[#888888] mt-0.5">RÉGUA</span>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase text-[#888888]">
                NÍVEL DA MARÉ
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-2xl sm:text-3xl font-bold text-black tabular-nums">
                  {tideHeight.toFixed(2)}M
                </span>
                <span
                  className={`text-[10px] font-bold uppercase ${
                    tendency === 'enchente'
                      ? 'text-[#008800]'
                      : tendency === 'vazante'
                      ? 'text-[#d42020]'
                      : 'text-[#888888]'
                  }`}
                >
                  [{tendency === 'enchente' ? '▲ ENCHENDO' : tendency === 'vazante' ? '▼ VAZANDO' : 'ESTOFO'}]
                </span>
              </div>
              <span className="text-[9px] text-[#666] block">
                {waterPercent}% DA AMPLITUDE MÁX
              </span>
            </div>
          </div>

          {/* TEMPERATURA DA ÁGUA DO MAR */}
          <div className="pr-3 border-r-2 border-black/20">
            <span className="block text-[10px] font-bold uppercase text-[#888888] flex items-center gap-1">
              <Droplets className="w-3 h-3 text-[#0284c7]" />
              TEMP. ÁGUA DO MAR
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-xl sm:text-2xl font-bold text-black tabular-nums">
                {formatTemperature(realMarineConditions?.oceanWaterTempCelsius, tempUnit)}
              </span>
              <span className="text-[9px] font-bold text-[#0284c7] uppercase">
                {realMarineConditions?.oceanWaterTempCelsius && realMarineConditions.oceanWaterTempCelsius >= 24 ? 'AGRADÁVEL' : 'REFRESCANTE'}
              </span>
            </div>
            <span className="text-[9px] text-[#888888] block">SUPERFÍCIE OCEÂNICA</span>
          </div>

          {/* CLIMA & TEMPERATURA DO AR */}
          <div className="pr-3 border-r-2 border-black/20">
            <span className="block text-[10px] font-bold uppercase text-[#888888] flex items-center gap-1">
              <CloudSun className="w-3 h-3 text-[#d97706]" />
              CLIMA & TEMPO
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-xl sm:text-2xl font-bold text-black tabular-nums">
                {formatTemperature(realMarineConditions?.airTempCelsius, tempUnit)}
              </span>
              <span className="text-[10px] font-bold text-black uppercase">
                {realMarineConditions?.weatherDescription || 'BOM'}
              </span>
            </div>
            <span className="text-[9px] text-[#888888] block">
              SENS. {formatTemperature(realMarineConditions?.apparentTempCelsius, tempUnit)}
              {realMarineConditions?.relativeHumidity ? ` · ${realMarineConditions.relativeHumidity}% UR` : ''}
            </span>
          </div>

          {/* Real Ocean Waves from Open-Meteo Marine API */}
          {realMarineConditions && (
            <div className="pr-3 border-r-2 border-black/20 hidden sm:block">
              <span className="block text-[10px] font-bold uppercase text-[#888888] flex items-center gap-1">
                <Waves className="w-3 h-3 text-black" />
                ONDULAÇÃO REAL
              </span>
              <div className="text-xs font-bold text-black tabular-nums">
                {realMarineConditions.waveHeightMeters}m · {realMarineConditions.wavePeriodSeconds}s
              </div>
              <span className="text-[9px] text-[#888888] block">MODELO ECMWF</span>
            </div>
          )}

          {/* Direction / Wind */}
          {realMarineConditions && (
            <div className="hidden md:block">
              <span className="block text-[10px] font-bold uppercase text-[#888888] flex items-center gap-1">
                <Compass className="w-3 h-3 text-black" />
                VENTO & ONDA
              </span>
              <div className="text-xs font-bold text-black tabular-nums">
                {realMarineConditions.waveDirectionDegrees}° ({realMarineConditions.windSpeedKmH ? `${realMarineConditions.windSpeedKmH} km/h` : 'MODERADO'})
              </div>
              <span className="text-[9px] text-[#888888] block">RADIAL COSTEIRO</span>
            </div>
          )}
        </div>

        {/* Right Section: Temperature Unit Toggle (°C / °F) & Search Beach Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Alternador Celsius / Fahrenheit */}
          <button
            onClick={onToggleTempUnit}
            title="Alternar unidade entre Celsius (°C) e Fahrenheit (°F)"
            className="px-2.5 py-2 border-2 border-black bg-white hover:bg-[#eeebe6] text-black text-xs font-bold uppercase flex items-center gap-1 cursor-pointer shadow-[2px_2px_0px_#000] transition-colors"
          >
            <Thermometer className="w-3.5 h-3.5 text-[#d42020]" />
            <span className="font-mono">
              <strong className={tempUnit === 'C' ? 'text-black underline' : 'text-[#888]'}>°C</strong>
              <span className="mx-0.5 text-[#aaa]">/</span>
              <strong className={tempUnit === 'F' ? 'text-black underline' : 'text-[#888]'}>°F</strong>
            </span>
          </button>

          <button
            onClick={onOpenSearch}
            className="px-4 py-2 bg-black hover:bg-[#333] text-white text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000]"
          >
            <Search className="w-3.5 h-3.5 text-[#d42020]" />
            <span>BUSCAR PRAIA/CIDADE</span>
          </button>
        </div>
      </div>
    </div>
  );
};

