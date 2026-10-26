import React, { useState } from 'react';
import { BeachLocation } from '../data/beaches';
import {
  RealMarineConditions,
  formatTemperature,
  fetchRealMarineConditions,
  calculateDistanceKm,
  kmToNauticalMiles,
} from '../services/realMarineApi';
import { TemperatureUnit } from '../types/tide';
import { TIDE_STATIONS } from '../data/tideStations';
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
  Crosshair,
  Loader2,
  X,
  Wind,
  Check,
  Globe,
  Gauge,
  ArrowRight,
  Sparkles,
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
  userCoords?: { lat: number; lng: number };
  onSelectCustomLocation?: (name: string, lat: number, lng: number) => void;
}

const PRESET_COORDINATES = [
  { name: 'Laje de Santos (SP - Alto-mar)', lat: -24.3167, lng: -46.1833, desc: 'Parque Marinho em alto-mar' },
  { name: 'Farol de São Tomé (RJ)', lat: -22.0433, lng: -41.0500, desc: 'Costão e plataforma marítima' },
  { name: 'Arquipélago das Cagarras (RJ)', lat: -23.0333, lng: -43.1833, desc: 'Ilhas oceânicas costeiras' },
  { name: 'Arquipélago de Abrolhos (BA)', lat: -17.9667, lng: -38.7000, desc: 'Área marinha de corais' },
  { name: 'Canal de São Sebastião (SP)', lat: -23.8200, lng: -45.3800, desc: 'Canal de ventos fortes' },
];

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
  userCoords,
  onSelectCustomLocation,
}) => {
  // Visual calculation for mini water column (0m to 3.0m)
  const maxVisualRange = 3.0;
  const clampedHeight = Math.max(0, Math.min(maxVisualRange, tideHeight));
  const waterPercent = Math.round((clampedHeight / maxVisualRange) * 100);

  // Estados para pesquisa de condições meteorológicas por coordenadas arbitrárias
  const [isCoordModalOpen, setIsCoordModalOpen] = useState<boolean>(false);
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [labelInput, setLabelInput] = useState<string>('');
  const [isLoadingCoords, setIsLoadingCoords] = useState<boolean>(false);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [customResult, setCustomResult] = useState<{
    lat: number;
    lng: number;
    name: string;
    conditions: RealMarineConditions;
    distanceKm: number;
    distanceMN: number;
    nearestStationName: string;
  } | null>(null);

  /**
   * Consulta condições meteorológicas e oceanográficas em tempo real para coordenadas arbitrárias
   * utilizando os modelos meteorológicos ECMWF e NOAA da Open-Meteo.
   */
  const searchArbitraryCoordinates = async (
    targetLat?: number,
    targetLng?: number,
    customName?: string
  ) => {
    setCoordError(null);

    const lat = targetLat !== undefined ? targetLat : parseFloat(latInput.replace(',', '.'));
    const lng = targetLng !== undefined ? targetLng : parseFloat(lngInput.replace(',', '.'));

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setCoordError('Latitude inválida. Insira um número decimal entre -90.0000 e +90.0000 (ex: -23.5505).');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setCoordError('Longitude inválida. Insira um número decimal entre -180.0000 e +180.0000 (ex: -46.3322).');
      return;
    }

    setIsLoadingCoords(true);

    try {
      const conditions = await fetchRealMarineConditions(lat, lng);

      const userLat = userCoords?.lat ?? lat;
      const userLng = userCoords?.lng ?? lng;
      const distanceKm = calculateDistanceKm(userLat, userLng, lat, lng);
      const distanceMN = kmToNauticalMiles(distanceKm);

      // Localiza a estação astronômica de maré mais próxima
      let closestSt = TIDE_STATIONS[0];
      let minD = Infinity;
      TIDE_STATIONS.forEach((st) => {
        const d = calculateDistanceKm(lat, lng, st.lat, st.lng);
        if (d < minD) {
          minD = d;
          closestSt = st;
        }
      });

      const finalName =
        customName ||
        labelInput.trim() ||
        `Ponto Costeiro (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;

      setCustomResult({
        lat,
        lng,
        name: finalName,
        conditions,
        distanceKm,
        distanceMN,
        nearestStationName: closestSt.name,
      });
    } catch (err) {
      setCoordError('Falha ao obter condições para as coordenadas informadas. Tente novamente.');
    } finally {
      setIsLoadingCoords(false);
    }
  };

  /**
   * Preenche automaticamente com o GPS atual do usuário
   */
  const handleUseCurrentGPS = () => {
    if (userCoords) {
      setLatInput(userCoords.lat.toFixed(4));
      setLngInput(userCoords.lng.toFixed(4));
      setLabelInput('Minhas Coordenadas Atuais');
      searchArbitraryCoordinates(userCoords.lat, userCoords.lng, 'Minhas Coordenadas Atuais');
    }
  };

  /**
   * Aplica o ponto de coordenadas arbitrárias ao aplicativo inteiro (tábua de maré, mapa, alertas)
   */
  const handleApplyCoordinatesToApp = () => {
    if (!customResult) return;
    if (onSelectCustomLocation) {
      onSelectCustomLocation(customResult.name, customResult.lat, customResult.lng);
    }
    setIsCoordModalOpen(false);
  };

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
                aria-label="Calibrar posição pelo GPS do dispositivo"
                className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 uppercase bg-[#eeebe6] hover:bg-black hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                title="Calibrar posição pelo GPS do dispositivo"
              >
                <Navigation className="w-2.5 h-2.5" aria-hidden="true" />
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
                aria-label="Voltar para a praia mais próxima identificada por GPS"
                className="text-[10px] font-bold border border-black px-2 py-0.5 uppercase bg-[#eeebe6] hover:bg-black hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3 text-[#d42020]" aria-hidden="true" />
                VOLTAR PARA A PRAIA MAIS PRÓXIMA
              </button>
            </div>
          )}
        </div>

        {/* Middle Section: Visual Tide Meter & Real Ocean Conditions & Temperatures */}
        <div className="flex flex-wrap items-center gap-3 py-2 px-3 border-2 border-black bg-[#f8f7f4] shadow-[2px_2px_0px_#000]">
          {/* REPRESENTAÇÃO VISUAL DA MARÉ (Mini Coluna de Água) */}
          <div className="pr-3 border-r-2 border-black/20 flex items-center gap-2.5">
            <div className="flex flex-col items-center">
              <div
                className="w-5 h-14 border-2 border-black bg-white relative flex flex-col justify-end overflow-hidden"
                title={`Nível da maré: ${tideHeight.toFixed(2)}m (${waterPercent}% da escala)`}
              >
                <div
                  className="w-full bg-[#3b82f6] border-t-2 border-black transition-all duration-500"
                  style={{ height: `${Math.min(100, Math.max(8, waterPercent))}%` }}
                />
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

        {/* Right Section: Temperature Unit Toggle, Search Beach & Arbitrary Coordinates */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Alternador Celsius / Fahrenheit */}
          <button
            onClick={onToggleTempUnit}
            aria-label="Alternar unidade entre Celsius (°C) e Fahrenheit (°F)"
            title="Alternar unidade entre Celsius (°C) e Fahrenheit (°F)"
            className="px-2.5 py-2 border-2 border-black bg-white hover:bg-[#eeebe6] text-black text-xs font-bold uppercase flex items-center gap-1 cursor-pointer shadow-[2px_2px_0px_#000] transition-colors"
          >
            <Thermometer className="w-3.5 h-3.5 text-[#d42020]" aria-hidden="true" />
            <span className="font-mono">
              <strong className={tempUnit === 'C' ? 'text-black underline' : 'text-[#888]'}>°C</strong>
              <span className="mx-0.5 text-[#aaa]">/</span>
              <strong className={tempUnit === 'F' ? 'text-black underline' : 'text-[#888]'}>°F</strong>
            </span>
          </button>

          {/* Botão de Coordenadas Arbitrárias (GPS) */}
          <button
            onClick={() => {
              setIsCoordModalOpen(true);
              if (!latInput && !lngInput && activeBeach) {
                setLatInput(activeBeach.lat.toFixed(4));
                setLngInput(activeBeach.lng.toFixed(4));
                setLabelInput(activeBeach.name);
              }
            }}
            aria-label="Pesquisar condições meteorológicas por coordenadas geográficas arbitrárias (GPS)"
            title="Consultar qualquer ponto marítimo/costeiro por Latitude e Longitude arbitrárias"
            className="px-3 py-2 bg-white hover:bg-[#f0f9ff] text-black border-2 border-black text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000] transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" />
            <span className="hidden sm:inline">COORDENADAS</span>
            <span className="sm:hidden">GPS</span>
          </button>

          {/* Botão Buscar Praia / Cidade */}
          <button
            onClick={onOpenSearch}
            aria-label="Buscar praia ou cidade costeira"
            className="px-3.5 sm:px-4 py-2 bg-black hover:bg-[#333] text-white text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000]"
          >
            <Search className="w-3.5 h-3.5 text-[#d42020]" aria-hidden="true" />
            <span>BUSCAR PRAIA</span>
          </button>
        </div>
      </div>

      {/* MODAL / PAINEL TÁTICO DE CONSULTA POR COORDENADAS ARBITRÁRIAS */}
      {isCoordModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="coord-modal-title"
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-2xl bg-white border-2 border-black p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-auto max-h-[92vh] flex flex-col font-mono">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b-2 border-black pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-[#0284c7]" />
                <div>
                  <h3 id="coord-modal-title" className="text-base sm:text-lg font-black uppercase tracking-tight text-black">
                    Previsão Meteorológica por Coordenadas Arbitrárias
                  </h3>
                  <span className="text-[10px] text-[#666] uppercase block">
                    Modelos Oceanográficos Globais NOAA & ECMWF (Open-Meteo)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsCoordModalOpen(false)}
                aria-label="Fechar consulta de coordenadas"
                className="p-1.5 border border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo rolável */}
            <div className="overflow-y-auto py-4 space-y-4 text-xs text-[#222]">
              <p className="text-[11px] text-[#555] leading-relaxed">
                Insira qualquer par de coordenadas de latitude e longitude decimais para obter condições
                instantâneas de tempo, temperatura da água do mar, ondulação oceânica e ventos em alto-mar ou zonas isoladas.
              </p>

              {/* Formulário de Coordenadas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[#f8f7f4] border border-black p-3">
                <div>
                  <label htmlFor="coord-lat-input" className="block text-[10px] font-bold uppercase text-[#666] mb-1">
                    Latitude (-90 a +90)
                  </label>
                  <input
                    id="coord-lat-input"
                    type="text"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    placeholder="Ex: -23.5505"
                    className="w-full p-2 border border-black bg-white text-black font-bold focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label htmlFor="coord-lng-input" className="block text-[10px] font-bold uppercase text-[#666] mb-1">
                    Longitude (-180 a +180)
                  </label>
                  <input
                    id="coord-lng-input"
                    type="text"
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value)}
                    placeholder="Ex: -45.0688"
                    className="w-full p-2 border border-black bg-white text-black font-bold focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label htmlFor="coord-label-input" className="block text-[10px] font-bold uppercase text-[#666] mb-1">
                    Identificação / Nome do Ponto
                  </label>
                  <input
                    id="coord-label-input"
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder="Ex: Ponto de Pesca Leste"
                    className="w-full p-2 border border-black bg-white text-black font-bold focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {userCoords && (
                    <button
                      type="button"
                      onClick={handleUseCurrentGPS}
                      className="px-2.5 py-1 text-[10px] font-bold uppercase bg-[#eeebe6] hover:bg-black hover:text-white border border-black transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3 text-emerald-600" />
                      Usar Meu GPS Atual
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => searchArbitraryCoordinates()}
                  disabled={isLoadingCoords}
                  className="px-4 py-2 bg-black hover:bg-[#333] text-white font-bold uppercase text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-[2px_2px_0px_#000]"
                >
                  {isLoadingCoords ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d42020]" />
                      <span>CONSULTANDO MODELOS...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5 text-[#d42020]" />
                      <span>CONSULTAR METEOROLOGIA</span>
                    </>
                  )}
                </button>
              </div>

              {/* Presets Náuticos Rápidos */}
              <div>
                <span className="text-[10px] font-bold uppercase text-[#888] block mb-1.5">
                  Pontos Marítimos & Offshore Pré-configurados:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COORDINATES.map((preset, pIdx) => (
                    <button
                      key={`preset-${pIdx}`}
                      type="button"
                      onClick={() => {
                        setLatInput(preset.lat.toFixed(4));
                        setLngInput(preset.lng.toFixed(4));
                        setLabelInput(preset.name);
                        searchArbitraryCoordinates(preset.lat, preset.lng, preset.name);
                      }}
                      className="px-2 py-1 text-[10px] font-bold uppercase border border-black/30 hover:border-black bg-white hover:bg-[#f0f9ff] text-black cursor-pointer transition-colors"
                      title={preset.desc}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensagem de Erro */}
              {coordError && (
                <div className="p-3 bg-[#fee2e2] border-2 border-[#d42020] text-[#991b1b] text-xs font-bold">
                  ⚠️ {coordError}
                </div>
              )}

              {/* RESULTADO DA CONSULTA EM TEMPO REAL */}
              {customResult && (
                <div className="border-2 border-black bg-[#f0f9ff] p-4 shadow-[4px_4px_0px_#000] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-black/20 flex-wrap gap-2">
                    <div>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#0284c7] text-white">
                        Resultado Meteorológico & Oceanográfico
                      </span>
                      <h4 className="text-base font-black uppercase text-black mt-1">
                        {customResult.name}
                      </h4>
                      <span className="text-[10px] text-[#555]">
                        {customResult.lat.toFixed(4)}°, {customResult.lng.toFixed(4)}° · Distância:{' '}
                        <strong>{customResult.distanceKm} km</strong> ({customResult.distanceMN} MN)
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-[#666] uppercase block">Estação de Maré Referência</span>
                      <span className="text-xs font-bold text-black uppercase">
                        {customResult.nearestStationName}
                      </span>
                    </div>
                  </div>

                  {/* Grid de Métricas Oceanográficas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                    {/* Clima & Temperatura do Ar */}
                    <div className="p-2 border border-black/20 bg-white">
                      <span className="text-[9px] font-bold text-[#666] uppercase block flex items-center justify-center gap-1">
                        <CloudSun className="w-3 h-3 text-[#d97706]" />
                        Clima & Ar
                      </span>
                      <span className="text-lg font-black text-black block mt-0.5 tabular-nums">
                        {formatTemperature(customResult.conditions.airTempCelsius, tempUnit)}
                      </span>
                      <span className="text-[9px] text-[#555] uppercase block truncate">
                        {customResult.conditions.weatherDescription || 'Estável'}
                      </span>
                    </div>

                    {/* Temperatura da Água do Mar (SST) */}
                    <div className="p-2 border border-black/20 bg-white">
                      <span className="text-[9px] font-bold text-[#666] uppercase block flex items-center justify-center gap-1">
                        <Droplets className="w-3 h-3 text-[#0284c7]" />
                        Temp. do Mar
                      </span>
                      <span className="text-lg font-black text-[#0284c7] block mt-0.5 tabular-nums">
                        {formatTemperature(customResult.conditions.oceanWaterTempCelsius, tempUnit)}
                      </span>
                      <span className="text-[9px] text-[#666] uppercase block">
                        Superfície
                      </span>
                    </div>

                    {/* Ondulação (Swell) */}
                    <div className="p-2 border border-black/20 bg-white">
                      <span className="text-[9px] font-bold text-[#666] uppercase block flex items-center justify-center gap-1">
                        <Waves className="w-3 h-3 text-black" />
                        Ondas
                      </span>
                      <span className="text-lg font-black text-black block mt-0.5 tabular-nums">
                        {customResult.conditions.waveHeightMeters}m
                      </span>
                      <span className="text-[9px] text-[#666] block">
                        Período: {customResult.conditions.wavePeriodSeconds}s
                      </span>
                    </div>

                    {/* Vento Costeiro */}
                    <div className="p-2 border border-black/20 bg-white">
                      <span className="text-[9px] font-bold text-[#666] uppercase block flex items-center justify-center gap-1">
                        <Wind className="w-3 h-3 text-[#16a34a]" />
                        Vento
                      </span>
                      <span className="text-lg font-black text-black block mt-0.5 tabular-nums">
                        {customResult.conditions.windSpeedKmH
                          ? `${Math.round(customResult.conditions.windSpeedKmH / 1.852)} kt`
                          : '--'}
                      </span>
                      <span className="text-[9px] text-[#666] block">
                        {customResult.conditions.windSpeedKmH ? `${customResult.conditions.windSpeedKmH} km/h` : 'Calmo'} · {customResult.conditions.waveDirectionDegrees}°
                      </span>
                    </div>
                  </div>

                  {/* Informação adicional de pressão */}
                  <div className="flex items-center justify-between text-[10px] text-[#555] pt-1 border-t border-black/15 flex-wrap gap-1">
                    <span>
                      Pressão Atmosférica: <strong>{customResult.conditions.surfacePressureHpa ? `${customResult.conditions.surfacePressureHpa} hPa` : '1013.2 hPa'}</strong>
                    </span>
                    <span>
                      Fonte: <strong>NOAA WaveWatch III & ECMWF</strong>
                    </span>
                  </div>

                  {/* Botão de Aplicação Global no App */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleApplyCoordinatesToApp}
                      className="w-full py-2.5 px-4 bg-[#0284c7] hover:bg-[#0369a1] text-white font-black uppercase text-xs flex items-center justify-center gap-2 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
                    >
                      <Check className="w-4 h-4 text-white" />
                      <span>DEFINIR COMO PONTO PRINCIPAL DO APLICATIVO</span>
                      <ArrowRight className="w-4 h-4 text-white" />
                    </button>
                    <p className="text-[9px] text-[#666] text-center mt-1">
                      Ao aplicar, a Tábua de Marés, Previsão de Ondas e Cartas Náuticas passarão a utilizar este ponto.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="border-t-2 border-black pt-3 flex justify-between items-center shrink-0">
              <span className="text-[10px] text-[#666]">
                Coordenadas Arbitrárias // Zero Hidrográfico DHN
              </span>
              <button
                onClick={() => setIsCoordModalOpen(false)}
                className="px-4 py-1.5 bg-[#eeebe6] hover:bg-black hover:text-white text-black font-bold text-xs uppercase border border-black cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearestBeachBanner;
