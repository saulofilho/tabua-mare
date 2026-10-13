import React, { useState, useEffect, useMemo } from 'react';
import { BeachLocation, REAL_BRAZILIAN_BEACHES } from '../data/beaches';
import { TideStation } from '../types/tide';
import { TIDE_STATIONS } from '../data/tideStations';
import {
  GeocodedLocation,
  searchRealLocations,
  calculateDistanceKm,
  findNearestBeach,
} from '../services/realMarineApi';
import {
  MapPin,
  Search,
  Waves,
  X,
  Loader2,
  Building2,
  Anchor,
  Compass,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface LocationSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoords: { lat: number; lng: number };
  onSelectBeach: (beach: BeachLocation) => void;
  onSelectCustomLocation: (name: string, lat: number, lng: number) => void;
  onSelectLocation?: (beach: BeachLocation, station: TideStation) => void;
}

const POPULAR_COASTAL_LOCATIONS = [
  { label: 'Santos (SP)', query: 'Santos SP' },
  { label: 'Rio de Janeiro (RJ)', query: 'Rio de Janeiro' },
  { label: 'Salvador (BA)', query: 'Salvador BA' },
  { label: 'Florianópolis (SC)', query: 'Florianópolis' },
  { label: 'Ubatuba (SP)', query: 'Ubatuba SP' },
  { label: 'Recife (PE)', query: 'Recife PE' },
  { label: 'Angra dos Reis (RJ)', query: 'Angra dos Reis' },
  { label: 'Ilhabela (SP)', query: 'Ilhabela' },
  { label: 'Região dos Lagos (RJ)', query: 'Cabo Frio' },
  { label: 'Fortaleza (CE)', query: 'Fortaleza CE' },
];

export const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
  isOpen,
  onClose,
  userCoords,
  onSelectBeach,
  onSelectCustomLocation,
  onSelectLocation,
}) => {
  const [query, setQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'cities' | 'beaches'>('all');
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Inicializa com praias e cidades litorâneas recomendadas
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setFilterType('all');
      return;
    }

    // Default inicial: praias populares de destaque no Brasil
    const defaultBeaches: GeocodedLocation[] = REAL_BRAZILIAN_BEACHES.slice(0, 10).map((b) => ({
      id: b.id,
      name: `${b.name} (${b.city})`,
      latitude: b.lat,
      longitude: b.lng,
      country: 'Brasil',
      admin1: b.state,
      isBeach: true,
    }));
    setResults(defaultBeaches);
  }, [isOpen]);

  // Consulta à API de Geocodificação Open-Meteo e catálogo de praias em tempo real com debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      const defaultBeaches: GeocodedLocation[] = REAL_BRAZILIAN_BEACHES.slice(0, 10).map((b) => ({
        id: b.id,
        name: `${b.name} (${b.city})`,
        latitude: b.lat,
        longitude: b.lng,
        country: 'Brasil',
        admin1: b.state,
        isBeach: true,
      }));
      setResults(defaultBeaches);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await searchRealLocations(trimmed);
        setResults(data);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Filtragem dos resultados de acordo com a aba selecionada
  const filteredResults = useMemo(() => {
    if (filterType === 'all') return results;
    if (filterType === 'cities') return results.filter((r) => !r.isBeach);
    if (filterType === 'beaches') return results.filter((r) => r.isBeach);
    return results;
  }, [results, filterType]);

  if (!isOpen) return null;

  // Seleciona o resultado e atualiza tanto o estado da praia quanto o da estação de marés
  const handlePickResult = (loc: GeocodedLocation) => {
    // 1. Verifica se corresponde diretamente a uma praia do catálogo
    const matchingBeach = REAL_BRAZILIAN_BEACHES.find(
      (b) =>
        b.id === loc.id ||
        (Math.abs(b.lat - loc.latitude) < 0.04 && Math.abs(b.lng - loc.longitude) < 0.04)
    );

    let targetBeach: BeachLocation;
    let targetStation: TideStation;

    if (matchingBeach) {
      targetBeach = matchingBeach;
      targetStation =
        TIDE_STATIONS.find((s) => s.id === matchingBeach.nearestStationId) || TIDE_STATIONS[0];
    } else {
      // 2. Calcula a estação maregráfica mais próxima na costa (DHN)
      let closestSt = TIDE_STATIONS[0];
      let minD = Infinity;
      TIDE_STATIONS.forEach((s) => {
        const d = calculateDistanceKm(loc.latitude, loc.longitude, s.lat, s.lng);
        if (d < minD) {
          minD = d;
          closestSt = s;
        }
      });

      // 3. Localiza a praia mais próxima desta cidade ou região
      const nearestBeachResult = findNearestBeach(loc.latitude, loc.longitude);

      targetBeach = {
        id: `city-${loc.id || Date.now()}`,
        name: loc.name,
        city: loc.admin2 ? `${loc.name} (${loc.admin2})` : loc.name,
        state: loc.admin1 || 'BR',
        lat: loc.latitude,
        lng: loc.longitude,
        description: `Cidade/Região geocodificada via Open-Meteo. Praia mais próxima: ${nearestBeachResult.beach.name} (${nearestBeachResult.distanceKm.toFixed(1)} km). Estação: ${closestSt.name}.`,
        nearestStationId: closestSt.id,
        waterType: 'oceano_aberto',
      };
      targetStation = closestSt;
    }

    // Atualiza ambos os estados: praia e estação de marés
    if (onSelectLocation) {
      onSelectLocation(targetBeach, targetStation);
    } else {
      onSelectBeach(targetBeach);
      onSelectCustomLocation(targetBeach.name, targetBeach.lat, targetBeach.lng);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono">
      <div className="bg-[#f8f7f4] border-4 border-black w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[8px_8px_0px_#000] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-2 border-black flex items-center justify-between bg-white">
          <div>
            <h3 className="font-display text-xl sm:text-2xl font-bold uppercase text-black flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#d42020] shrink-0" />
              <span>Busca de Cidade, Região ou Praia</span>
            </h3>
            <p className="text-xs text-[#666] uppercase mt-0.5">
              Geocodificação Oficial em Tempo Real // Atualiza Praia e Estação de Marés (DHN)
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar busca de praias e cidades"
            className="p-1.5 border-2 border-black hover:bg-black hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Search input & Filter section */}
        <div className="p-4 bg-[#eeebe6] border-b-2 border-black space-y-3">
          <div>
            <label
              htmlFor="beach-search-input"
              className="block font-bold uppercase text-[11px] text-black mb-1 flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-[#d42020]" />
              <span>Pesquisar por Nome de Cidade, Região ou Praia:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                id="beach-search-input"
                aria-label="Digite o nome da cidade, região ou praia"
                placeholder="Ex: Santos, Ubatuba, Salvador, Florianópolis, Região dos Lagos, Baixada Santista..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full p-3 pl-10 pr-10 border-2 border-black bg-white font-bold text-sm text-black placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-black"
              />
              <Search className="w-5 h-5 text-black absolute left-3 top-3.5" aria-hidden="true" />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Limpar campo de busca"
                  className="absolute right-3 top-3.5 text-[#888] hover:text-black cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              {isLoading && (
                <Loader2 className="w-5 h-5 text-black animate-spin absolute right-9 top-3.5" aria-hidden="true" />
              )}
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1 text-[11px] font-bold">
              <span className="text-[#666] uppercase mr-1">Filtrar:</span>
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 border border-black cursor-pointer uppercase transition-colors ${
                  filterType === 'all' ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#ddd]'
                }`}
              >
                Todos ({results.length})
              </button>
              <button
                onClick={() => setFilterType('cities')}
                className={`px-2.5 py-1 border border-black cursor-pointer uppercase transition-colors flex items-center gap-1 ${
                  filterType === 'cities' ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#ddd]'
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>Cidades/Regiões</span>
              </button>
              <button
                onClick={() => setFilterType('beaches')}
                className={`px-2.5 py-1 border border-black cursor-pointer uppercase transition-colors flex items-center gap-1 ${
                  filterType === 'beaches' ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#ddd]'
                }`}
              >
                <Waves className="w-3 h-3" />
                <span>Praias</span>
              </button>
            </div>
          </div>

          {/* Popular Coastal Cities Chips */}
          <div className="pt-1">
            <span className="block text-[10px] font-bold uppercase text-[#666] mb-1">
              Sugestões Rápidas de Cidades & Regiões Costeiras:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_COASTAL_LOCATIONS.map((c) => (
                <button
                  key={c.label}
                  onClick={() => setQuery(c.query)}
                  className="px-2 py-0.5 bg-white hover:bg-black hover:text-white border border-black text-[10px] font-bold text-black uppercase cursor-pointer transition-colors shadow-[1px_1px_0px_#000]"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 bg-[#f8f7f4]">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#666]">
            <span>
              {query.trim().length >= 2
                ? `Resultados Geocodificados Encontrados (${filteredResults.length})`
                : 'Localizações e Praias Recomendadas'}
            </span>
            {isLoading && (
              <span className="flex items-center gap-1 text-black">
                <Loader2 className="w-3 h-3 animate-spin" />
                Consultando API de Geocodificação...
              </span>
            )}
          </div>

          {filteredResults.length === 0 && !isLoading ? (
            <div className="p-8 text-center text-xs font-bold text-[#666] uppercase border-2 border-dashed border-black/30 bg-white">
              <Building2 className="w-8 h-8 text-[#aaa] mx-auto mb-2" />
              Nenhuma cidade, região ou praia encontrada para "{query}".
              <span className="block text-[11px] text-[#888] font-normal normal-case mt-1">
                Tente buscar pelo nome da cidade (ex: Santos, Ubatuba, Salvador) ou da unidade federativa.
              </span>
            </div>
          ) : (
            filteredResults.map((item) => {
              const distance = calculateDistanceKm(
                userCoords.lat,
                userCoords.lng,
                item.latitude,
                item.longitude
              );

              // Calcula em tempo real a praia e a estação mais próximas da cidade/região
              const nearestBeachInfo = findNearestBeach(item.latitude, item.longitude);
              let closestStation = TIDE_STATIONS[0];
              let minStDist = Infinity;
              TIDE_STATIONS.forEach((s) => {
                const d = calculateDistanceKm(item.latitude, item.longitude, s.lat, s.lng);
                if (d < minStDist) {
                  minStDist = d;
                  closestStation = s;
                }
              });

              return (
                <button
                  key={`${item.id}-${item.latitude}-${item.longitude}`}
                  onClick={() => handlePickResult(item)}
                  className="w-full text-left p-3.5 border-2 border-black bg-white hover:bg-[#f1ede6] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_#000] cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 border-2 border-black flex items-center justify-center shrink-0 mt-0.5 ${
                        item.isBeach ? 'bg-[#fee2e2]' : 'bg-[#e0f2fe]'
                      }`}
                    >
                      {item.isBeach ? (
                        <Waves className="w-4 h-4 text-[#d42020]" />
                      ) : (
                        <Building2 className="w-4 h-4 text-[#0284c7]" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-black uppercase flex flex-wrap items-center gap-1.5">
                        <span className="group-hover:text-[#d42020] transition-colors">
                          {item.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-bold uppercase border border-black ${
                            item.isBeach ? 'bg-[#d42020] text-white' : 'bg-black text-white'
                          }`}
                        >
                          {item.isBeach ? 'Praia' : 'Cidade / Região'}
                        </span>
                        {item.admin1 && (
                          <span className="bg-[#eeebe6] text-black border border-black px-1.5 py-0.2 text-[9px]">
                            {item.admin1}
                          </span>
                        )}
                        {item.admin2 && (
                          <span className="bg-white text-[#666] border border-black/40 px-1.5 py-0.2 text-[9px]">
                            {item.admin2}
                          </span>
                        )}
                      </div>

                      {/* Informações oceanográficas vinculadas */}
                      <div className="mt-1.5 space-y-0.5 text-[11px] text-[#444]">
                        <div className="flex items-center gap-1.5">
                          <Waves className="w-3 h-3 text-[#d42020] shrink-0" />
                          <span>
                            Praia de Referência:{' '}
                            <strong className="text-black">{nearestBeachInfo.beach.name}</strong>{' '}
                            <span className="text-[#666]">
                              ({nearestBeachInfo.distanceKm.toFixed(1)} km)
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Anchor className="w-3 h-3 text-black shrink-0" />
                          <span>
                            Estação de Maré (DHN):{' '}
                            <strong className="text-black">{closestStation.name}</strong>{' '}
                            <span className="text-[#666]">
                              (~{minStDist.toFixed(1)} km · Variação {closestStation.averageRange}m)
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-[#888] mt-1">
                        {item.country} · Coordenadas: {item.latitude.toFixed(4)}°, {item.longitude.toFixed(4)}°
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-black/20 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                    <div>
                      <span className="text-[10px] text-[#666] uppercase block font-bold">
                        Do seu GPS:
                      </span>
                      <span className="font-bold text-xs text-black block tabular-nums">
                        {distance} km
                      </span>
                    </div>
                    <div className="mt-1 px-2.5 py-1 bg-black group-hover:bg-[#d42020] text-white text-[10px] font-bold uppercase transition-colors flex items-center gap-1">
                      <span>SELECIONAR</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-white border-t-2 border-black flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-[#666] text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-[#008800] shrink-0" />
            <span>Atualiza simultaneamente a praia ativa e as tábuas astronômicas da DHN.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-black text-white font-bold uppercase text-xs cursor-pointer hover:bg-[#333]"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationSearchModal;
