import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActiveAlertNotification,
  OfflineRegionStatus,
  TideAlertRule,
  TideStation,
  VesselProfile,
  TemperatureUnit,
} from './types/tide';
import { TIDE_STATIONS } from './data/tideStations';
import { REAL_BRAZILIAN_BEACHES, BeachLocation } from './data/beaches';
import {
  getCurrentTideStatus,
  findTideExtremes,
  calculateTideHeight,
  calculateTideRateOfChange,
} from './utils/tideHarmonics';
import {
  loadOfflineRegions,
  getOfflineModeActive,
  setOfflineModeActive,
} from './utils/offlineMapStorage';
import {
  fetchRealMarineConditions,
  findNearestBeach,
  RealMarineConditions,
  calculateDistanceKm,
  kmToNauticalMiles,
} from './services/realMarineApi';
import { TopBar } from './components/TopBar';
import { NearestBeachBanner } from './components/NearestBeachBanner';
import { TideDashboard } from './components/TideDashboard';
import { VisualTideGauge } from './components/VisualTideGauge';
import { TideCurveCanvas } from './components/TideCurveCanvas';
import { NauticalMapView } from './components/NauticalMapView';
import { AlertsManager } from './components/AlertsManager';
import { OfflineManagerModal } from './components/OfflineManagerModal';
import { VesselConfigModal } from './components/VesselConfigModal';
import { LocationSearchModal } from './components/LocationSearchModal';
import { Download } from 'lucide-react';

const DEFAULT_VESSEL: VesselProfile = {
  name: 'Albatroz',
  vesselType: 'veleiro',
  draft: 1.45,
  safetyMargin: 0.6,
  airDraft: 12.8,
};

const INITIAL_RULES: TideAlertRule[] = [
  {
    id: 'rule-low-tide',
    title: 'Alerta de Baixa-mar Rasa (Perigo de Encalhe)',
    type: 'low_tide',
    thresholdValue: 0.55,
    operator: 'less_than',
    enabled: true,
    soundAlert: true,
    soundType: 'danger',
    unit: 'm',
    description: 'Avisa se o nível da água descer abaixo de 0.55m sobre o Datum da carta.',
  },
  {
    id: 'rule-high-tide',
    title: 'Preia-mar Máxima (Alagamento de Cais & Píer)',
    type: 'high_tide',
    thresholdValue: 2.15,
    operator: 'greater_than',
    enabled: true,
    soundAlert: true,
    soundType: 'foghorn',
    unit: 'm',
    description: 'Avisa se o nível da água subir além de 2.15m (risco em rampas e trapiches).',
  },
  {
    id: 'rule-ukc',
    title: 'Folga sob a Quilha Crítica (UKC < 0.50m)',
    type: 'ukc_clearance',
    thresholdValue: 0.5,
    operator: 'less_than',
    enabled: true,
    soundAlert: true,
    soundType: 'sonar',
    unit: 'm',
    description: 'Alerta imediato quando a distância da quilha ao fundo for inferior a 50cm.',
  },
  {
    id: 'rule-spring',
    title: 'Maré de Sizígia (Lua Nova / Cheia)',
    type: 'spring_tide',
    thresholdValue: 0,
    operator: 'greater_than',
    enabled: true,
    soundAlert: false,
    soundType: 'shipbell',
    unit: '',
    description: 'Informa período de variação máxima de maré e correntes acentuadas.',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'tides' | 'map' | 'alerts' | 'offline'>('tides');
  const [station, setStation] = useState<TideStation>(TIDE_STATIONS[0]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(getOfflineModeActive());
  const [timeRange, setTimeRange] = useState<24 | 168>(24);
  const [tempUnit, setTempUnit] = useState<TemperatureUnit>(() => {
    try {
      const saved = localStorage.getItem('maresegura_temp_unit');
      return (saved === 'F' ? 'F' : 'C') as TemperatureUnit;
    } catch {
      return 'C';
    }
  });

  const handleToggleTempUnit = () => {
    setTempUnit((prev) => {
      const next: TemperatureUnit = prev === 'C' ? 'F' : 'C';
      try {
        localStorage.setItem('maresegura_temp_unit', next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  // User GPS coordinates (Real device position)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: -13.0031, // Default Salvador coastal coordinate
    lng: -38.5322,
  });
  const [hasRealGPS, setHasRealGPS] = useState<boolean>(false);

  // Real Marine conditions from Open-Meteo Marine API
  const [marineConditions, setMarineConditions] = useState<RealMarineConditions | null>(null);

  // Selected Beach
  const [selectedBeach, setSelectedBeach] = useState<BeachLocation>(REAL_BRAZILIAN_BEACHES[0]);

  // Modals
  const [isVesselModalOpen, setIsVesselModalOpen] = useState<boolean>(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  // Vessel Profile state
  const [vessel, setVessel] = useState<VesselProfile>(() => {
    try {
      const saved = localStorage.getItem('maresegura_vessel');
      return saved ? JSON.parse(saved) : DEFAULT_VESSEL;
    } catch {
      return DEFAULT_VESSEL;
    }
  });

  // Alert Rules state
  const [rules, setRules] = useState<TideAlertRule[]>(() => {
    try {
      const saved = localStorage.getItem('maresegura_rules');
      return saved ? JSON.parse(saved) : INITIAL_RULES;
    } catch {
      return INITIAL_RULES;
    }
  });

  // Offline regions cache tracking
  const [offlineStatuses, setOfflineStatuses] = useState<Record<string, OfflineRegionStatus>>(
    loadOfflineRegions()
  );

  // Detect Real Device Geolocation on Mount
  const handleRequestGPS = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCoords({ lat, lng });
          setHasRealGPS(true);

          // Find closest beach to user coordinates
          const { beach } = findNearestBeach(lat, lng, REAL_BRAZILIAN_BEACHES);
          setSelectedBeach(beach);

          // Match nearest station
          const st = TIDE_STATIONS.find((s) => s.id === beach.nearestStationId) || TIDE_STATIONS[0];
          setStation(st);
        },
        (err) => {
          console.warn('Geolocation prompt:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  useEffect(() => {
    handleRequestGPS();
  }, [handleRequestGPS]);

  // Real-time clock update (every 5 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Compute Nearest Beach based on userCoords
  const nearestInfo = useMemo(() => {
    return findNearestBeach(userCoords.lat, userCoords.lng, REAL_BRAZILIAN_BEACHES);
  }, [userCoords]);

  // Fetch real oceanographic conditions whenever the nearest beach or station changes
  useEffect(() => {
    let isMounted = true;
    const targetLat = selectedBeach ? selectedBeach.lat : station.lat;
    const targetLng = selectedBeach ? selectedBeach.lng : station.lng;

    fetchRealMarineConditions(targetLat, targetLng).then((cond) => {
      if (isMounted) {
        setMarineConditions(cond);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedBeach, station]);

  // Compute Current Tide Status
  const status = useMemo(() => {
    return getCurrentTideStatus(station, currentTime);
  }, [station, currentTime]);

  // Real tide height at the nearest beach
  const nearestBeachTide = useMemo(() => {
    const nearestSt =
      TIDE_STATIONS.find((s) => s.id === nearestInfo.beach.nearestStationId) || station;
    const h = calculateTideHeight(nearestSt, currentTime);
    const rate = calculateTideRateOfChange(nearestSt, currentTime);
    const tendency: 'enchente' | 'vazante' | 'estofo' =
      rate > 2 ? 'enchente' : rate < -2 ? 'vazante' : 'estofo';
    return { height: h, tendency };
  }, [nearestInfo.beach, station, currentTime]);

  // Compute Today Extremes
  const todayExtremes = useMemo(() => {
    const dayStart = new Date(currentTime);
    dayStart.setHours(0, 0, 0, 0);
    return findTideExtremes(station, dayStart.getTime(), 24);
  }, [station, currentTime]);

  // Evaluate Active Alerts
  const activeAlerts = useMemo<ActiveAlertNotification[]>(() => {
    const alerts: ActiveAlertNotification[] = [];
    const refDepth = 2.5;
    const ukc = status.currentHeight + refDepth - vessel.draft;

    rules.forEach((rule) => {
      if (!rule.enabled) return;

      if (rule.type === 'low_tide' && status.currentHeight < rule.thresholdValue) {
        alerts.push({
          id: `alt-${rule.id}`,
          ruleId: rule.id,
          title: rule.title,
          message: `Nível atual da maré (${status.currentHeight.toFixed(2)}m) está abaixo do limite (${rule.thresholdValue.toFixed(2)}m).`,
          severity: 'danger',
          timestamp: Date.now(),
          value: `${status.currentHeight.toFixed(2)}m`,
        });
      } else if (rule.type === 'high_tide' && status.currentHeight > rule.thresholdValue) {
        alerts.push({
          id: `alt-${rule.id}`,
          ruleId: rule.id,
          title: rule.title,
          message: `Nível atual da maré (${status.currentHeight.toFixed(2)}m) ultrapassou o alerta (${rule.thresholdValue.toFixed(2)}m).`,
          severity: 'warning',
          timestamp: Date.now(),
          value: `${status.currentHeight.toFixed(2)}m`,
        });
      } else if (rule.type === 'ukc_clearance' && ukc < rule.thresholdValue) {
        alerts.push({
          id: `alt-${rule.id}`,
          ruleId: rule.id,
          title: rule.title,
          message: `Folga de quilha no canal raso (${ukc.toFixed(2)}m) inferior ao limite (${rule.thresholdValue.toFixed(2)}m).`,
          severity: 'danger',
          timestamp: Date.now(),
          value: `UKC ${ukc.toFixed(2)}m`,
        });
      } else if (rule.type === 'spring_tide' && status.moon.isSpringTide) {
        alerts.push({
          id: `alt-${rule.id}`,
          ruleId: rule.id,
          title: rule.title,
          message: `Maré de Sizígia em vigor (${status.moon.phaseName}). Variação vertical extrema e correntes acentuadas.`,
          severity: 'info',
          timestamp: Date.now(),
          value: 'Sizígia',
        });
      } else if (rule.type === 'strong_current' && status.estimatedCurrentKnots > rule.thresholdValue) {
        alerts.push({
          id: `alt-${rule.id}`,
          ruleId: rule.id,
          title: rule.title,
          message: `Correnteza de maré estimada em ~${status.estimatedCurrentKnots} nós. Cuidado em canais estreitos.`,
          severity: 'warning',
          timestamp: Date.now(),
          value: `${status.estimatedCurrentKnots} nós`,
        });
      }
    });

    return alerts;
  }, [rules, status, vessel]);

  const handleSelectBeach = (beach: BeachLocation) => {
    setSelectedBeach(beach);
    const matchedSt =
      TIDE_STATIONS.find((s) => s.id === beach.nearestStationId) || TIDE_STATIONS[0];
    setStation(matchedSt);
  };

  const handleSelectCustomLocation = (name: string, lat: number, lng: number) => {
    // Find closest station to this custom coordinate
    let closestSt = TIDE_STATIONS[0];
    let minD = Infinity;
    TIDE_STATIONS.forEach((s) => {
      const d = calculateDistanceKm(lat, lng, s.lat, s.lng);
      if (d < minD) {
        minD = d;
        closestSt = s;
      }
    });

    const customBeach: BeachLocation = {
      id: `custom-${Date.now()}`,
      name: name,
      city: name,
      state: 'BR',
      lat,
      lng,
      description: `Ponto costeiro selecionado via geocodificação (${lat.toFixed(4)}°, ${lng.toFixed(4)}°).`,
      nearestStationId: closestSt.id,
      waterType: 'oceano_aberto',
    };

    setSelectedBeach(customBeach);
    setStation(closestSt);
  };

  const handleSaveVessel = useCallback((newProfile: VesselProfile) => {
    setVessel(newProfile);
    try {
      localStorage.setItem('maresegura_vessel', JSON.stringify(newProfile));
    } catch {
      // ignore
    }
  }, []);

  const handleUpdateRules = useCallback((newRules: TideAlertRule[]) => {
    setRules(newRules);
    try {
      localStorage.setItem('maresegura_rules', JSON.stringify(newRules));
    } catch {
      // ignore
    }
  }, []);

  const handleToggleOfflineMode = () => {
    const next = !isOfflineMode;
    setIsOfflineMode(next);
    setOfflineModeActive(next);
  };

  const refreshOfflineStatuses = () => {
    setOfflineStatuses(loadOfflineRegions());
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#111111] font-mono border-4 sm:border-8 border-black flex flex-col justify-between selection:bg-[#d42020] selection:text-white">
      <div>
        {/* Tactical Top Bar */}
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isOfflineMode={isOfflineMode}
          onToggleOfflineMode={handleToggleOfflineMode}
          onOpenDownloadModal={() => setIsOfflineModalOpen(true)}
          timeRange={timeRange}
          onToggleTimeRange={setTimeRange}
          tempUnit={tempUnit}
          onToggleTempUnit={handleToggleTempUnit}
        />

        {/* COMPONENTE SEMPRE NO TOPO: PRAIA EM DESTAQUE E AVISO DA MAIS PRÓXIMA */}
        <NearestBeachBanner
          activeBeach={selectedBeach}
          nearestBeach={nearestInfo.beach}
          isNearestBeach={selectedBeach.id === nearestInfo.beach.id}
          distanceToActiveKm={calculateDistanceKm(userCoords.lat, userCoords.lng, selectedBeach.lat, selectedBeach.lng)}
          distanceToNearestKm={nearestInfo.distanceKm}
          realMarineConditions={marineConditions}
          tideHeight={status.currentHeight}
          tendency={status.tendency}
          hasRealGPS={hasRealGPS}
          tempUnit={tempUnit}
          onToggleTempUnit={handleToggleTempUnit}
          onRequestGPS={handleRequestGPS}
          onResetToNearest={() => handleSelectBeach(nearestInfo.beach)}
          onOpenSearch={() => setIsSearchModalOpen(true)}
        />

        {/* Tab 1: Tábua de Marés */}
        {activeTab === 'tides' && (
          <div>
            <TideDashboard
              station={station}
              allStations={TIDE_STATIONS}
              onSelectStation={(st) => {
                setStation(st);
                // Also update selected beach to correspond to station
                const matchingBeach = REAL_BRAZILIAN_BEACHES.find(b => b.nearestStationId === st.id);
                if (matchingBeach) setSelectedBeach(matchingBeach);
              }}
              status={status}
              todayExtremes={todayExtremes}
              vessel={vessel}
              realMarineConditions={marineConditions}
              tempUnit={tempUnit}
              onToggleTempUnit={handleToggleTempUnit}
              onOpenVesselModal={() => setIsVesselModalOpen(true)}
              onOpenAlertsModal={() => setActiveTab('alerts')}
            />

            {/* REPRESENTAÇÃO VISUAL DA MARÉ (Corte Transversal & Coluna d'Água) */}
            <VisualTideGauge
              currentHeight={status.currentHeight}
              maxTideRange={station.averageRange}
              status={status}
              todayExtremes={todayExtremes}
              vessel={vessel}
              stationName={selectedBeach.name}
            />

            <TideCurveCanvas
              station={station}
              vessel={vessel}
              currentTime={currentTime}
              lowTideAlertThreshold={0.55}
              timeRange={timeRange}
            />
          </div>
        )}

        {/* Tab 2: Carta Náutica & GPS */}
        {activeTab === 'map' && (
          <div>
            <NauticalMapView
              station={station}
              vessel={vessel}
              currentTideHeight={status.currentHeight}
              isOfflineMode={isOfflineMode}
              onOpenDownloadModal={() => setIsOfflineModalOpen(true)}
            />
          </div>
        )}

        {/* Tab 3: Alertas */}
        {activeTab === 'alerts' && (
          <div>
            <AlertsManager
              rules={rules}
              onUpdateRules={handleUpdateRules}
              activeAlerts={activeAlerts}
              currentStatus={status}
              vessel={vessel}
            />
          </div>
        )}

        {/* Tab 4: Cartas Offline */}
        {activeTab === 'offline' && (
          <div className="p-6 bg-white border-b-2 border-black space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888] block">
                  Navegação Segura Sem Sinal
                </span>
                <h3 className="font-display text-2xl font-bold uppercase text-black">
                  Gerenciador de Cartas e Mapas Offline
                </h3>
              </div>

              <button
                onClick={() => setIsOfflineModalOpen(true)}
                className="px-4 py-2 bg-black hover:bg-[#333] text-white text-xs font-bold uppercase flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_#000]"
              >
                <Download className="w-4 h-4" />
                <span>BAIXAR PACOTE DE MAPAS</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TIDE_STATIONS.map((st) => {
                const off = offlineStatuses[st.id];
                const isSaved = off?.isDownloaded;

                return (
                  <div
                    key={st.id}
                    className="p-4 border-2 border-black bg-[#f8f7f4] flex items-center justify-between gap-4 shadow-[2px_2px_0px_#000]"
                  >
                    <div>
                      <div className="font-bold text-sm text-black uppercase">
                        {st.name} ({st.state})
                      </div>
                      <div className="text-xs text-[#666]">{st.portName}</div>
                      <div className="text-[10px] text-[#888888] mt-1">
                        TAMANHO: ~{st.offlineSizeMB} MB · {st.hazards.length} PONTOS CRÍTICOS NÁUTICOS
                      </div>
                    </div>

                    <div>
                      {isSaved ? (
                        <span className="px-2 py-1 bg-black text-white text-[10px] font-bold uppercase">
                          SALVO NO APARELHO
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setStation(st);
                            setIsOfflineModalOpen(true);
                          }}
                          className="px-3 py-1 border-2 border-black bg-white hover:bg-black hover:text-white text-xs font-bold uppercase cursor-pointer"
                        >
                          BAIXAR AGORA
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Fixed Bottom Nav */}
      <div className="md:hidden sticky bottom-0 z-40 bg-[#f8f7f4] border-t-2 border-black p-1 grid grid-cols-4 gap-1 text-center font-mono">
        <button
          onClick={() => setActiveTab('tides')}
          className={`py-2 text-[10px] font-bold uppercase cursor-pointer ${
            activeTab === 'tides' ? 'bg-black text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          TÁBUA
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`py-2 text-[10px] font-bold uppercase cursor-pointer ${
            activeTab === 'map' ? 'bg-black text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          MAPA
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`py-2 text-[10px] font-bold uppercase cursor-pointer ${
            activeTab === 'alerts' ? 'bg-black text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          ALERTAS
        </button>
        <button
          onClick={() => setActiveTab('offline')}
          className={`py-2 text-[10px] font-bold uppercase cursor-pointer ${
            activeTab === 'offline' ? 'bg-black text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          OFFLINE
        </button>
      </div>

      {/* Rodapé Marítimo com Informações Claras */}
      <footer className="border-t-2 border-black px-4 sm:px-6 py-2.5 bg-[#f8f7f4] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-bold uppercase text-[#111111]">
        <div>
          FONTE OFICIAL: MARINHA DO BRASIL (DHN) // COORDENADAS: {selectedBeach ? selectedBeach.lat.toFixed(4) : station.lat.toFixed(4)}°,{' '}
          {selectedBeach ? selectedBeach.lng.toFixed(4) : station.lng.toFixed(4)}°
        </div>
        <div>
          LOCAL: {selectedBeach ? selectedBeach.name.toUpperCase() : station.id.toUpperCase().replace('-', '_')} // HORÁRIO LOCAL:{' '}
          {new Date(currentTime).toLocaleTimeString('pt-BR')}
        </div>
        <div>ONDAS AO VIVO: OPEN-METEO MARINE // VERSÃO 2.5</div>
      </footer>

      {/* Modals */}
      <VesselConfigModal
        isOpen={isVesselModalOpen}
        onClose={() => setIsVesselModalOpen(false)}
        vessel={vessel}
        onSave={handleSaveVessel}
      />

      <OfflineManagerModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        stations={TIDE_STATIONS}
        offlineStatuses={offlineStatuses}
        onRefreshStatuses={refreshOfflineStatuses}
        isOfflineMode={isOfflineMode}
        onToggleOfflineMode={handleToggleOfflineMode}
      />

      <LocationSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        userCoords={userCoords}
        onSelectBeach={handleSelectBeach}
        onSelectCustomLocation={handleSelectCustomLocation}
      />
    </div>
  );
}
