import React, { useState, useEffect } from 'react';
import { BeachLocation, REAL_BRAZILIAN_BEACHES } from '../data/beaches';
import {
  GeocodedLocation,
  searchRealLocations,
  calculateDistanceKm,
} from '../services/realMarineApi';
import { MapPin, Search, Waves, X, Loader2 } from 'lucide-react';

interface LocationSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoords: { lat: number; lng: number };
  onSelectBeach: (beach: BeachLocation) => void;
  onSelectCustomLocation: (name: string, lat: number, lng: number) => void;
}

export const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
  isOpen,
  onClose,
  userCoords,
  onSelectBeach,
  onSelectCustomLocation,
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }

    // Initial default: popular beaches
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

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
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
        const data = await searchRealLocations(query);
        setResults(data);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handlePickResult = (loc: GeocodedLocation) => {
    // Check if it matches a known beach
    const matchingBeach = REAL_BRAZILIAN_BEACHES.find(
      (b) =>
        b.id === loc.id ||
        (Math.abs(b.lat - loc.latitude) < 0.04 && Math.abs(b.lng - loc.longitude) < 0.04)
    );

    if (matchingBeach) {
      onSelectBeach(matchingBeach);
    } else {
      onSelectCustomLocation(loc.name, loc.latitude, loc.longitude);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono">
      <div className="bg-[#f8f7f4] border-4 border-black w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[8px_8px_0px_#000] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b-2 border-black flex items-center justify-between bg-white">
          <div>
            <h3 className="font-display text-2xl font-bold uppercase text-black">
              Busca de Cidade, Praia ou Litoral
            </h3>
            <p className="text-xs text-[#888888] uppercase mt-0.5">
              Geocodificação Oficial em Tempo Real // Open-Meteo & Base DHN
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar busca de praias e cidades"
            className="p-1 border-2 border-black hover:bg-black hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 bg-[#eeebe6] border-b-2 border-black">
          <div className="relative">
            <input
              type="text"
              autoFocus
              id="beach-search-input"
              aria-label="Digite o nome da praia ou cidade"
              placeholder="Digite o nome da praia ou cidade (ex: Copacabana, Maresias, Salvador, Jericoacoara...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full p-3 pl-10 border-2 border-black bg-white font-bold text-sm text-black placeholder:text-[#888888] focus:outline-none"
            />
            <Search className="w-5 h-5 text-black absolute left-3 top-3.5" aria-hidden="true" />
            {isLoading && (
              <Loader2 className="w-5 h-5 text-black animate-spin absolute right-3 top-3.5" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1 bg-[#f8f7f4]">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[#888888] mb-2">
            {query.trim().length >= 2
              ? `Resultados encontrados (${results.length})`
              : 'Praias em destaque'}
          </span>

          {results.length === 0 && !isLoading ? (
            <div className="p-8 text-center text-xs font-bold text-[#888888] uppercase border-2 border-dashed border-black/30">
              Nenhuma praia ou cidade costeira encontrada para "{query}". Tente buscar por cidade ou estado.
            </div>
          ) : (
            results.map((item) => {
              const distance = calculateDistanceKm(
                userCoords.lat,
                userCoords.lng,
                item.latitude,
                item.longitude
              );

              return (
                <button
                  key={`${item.id}-${item.latitude}-${item.longitude}`}
                  onClick={() => handlePickResult(item)}
                  className="w-full text-left p-3 border-2 border-black bg-white hover:bg-[#eeebe6] transition-colors flex items-center justify-between gap-3 shadow-[2px_2px_0px_#000] cursor-pointer"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 border-2 border-black bg-[#f8f7f4] flex items-center justify-center shrink-0 mt-0.5">
                      {item.isBeach ? (
                        <Waves className="w-4 h-4 text-[#d42020]" />
                      ) : (
                        <MapPin className="w-4 h-4 text-black" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-black uppercase flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.admin1 && (
                          <span className="bg-black text-white px-1.5 py-0.2 text-[10px]">
                            {item.admin1}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#666] mt-0.5">
                        {item.country} · Coordenadas: {item.latitude.toFixed(4)}°, {item.longitude.toFixed(4)}°
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs text-black block tabular-nums">
                      {distance} km
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#d42020]">
                      SELECIONAR →
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t-2 border-black flex items-center justify-between text-xs">
          <span className="text-[#888888] uppercase">
            Dados geográficos e oceanográficos ao vivo
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black text-white font-bold uppercase text-xs cursor-pointer hover:bg-[#333]"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};
