import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import {
  ActiveAlertNotification,
  OfflineRegionStatus,
  TideAlertRule,
  TideStation,
  VesselProfile,
  TemperatureUnit,
  NavigationLogEntry,
} from './types/tide';
import { TIDE_STATIONS } from './data/tideStations';
import { REAL_BRAZILIAN_BEACHES, BeachLocation } from './data/beaches';
import { INITIAL_LOGBOOK_ENTRIES } from './data/defaultLogbook';
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
import {
  RadarMapSkeleton,
  WaveWindChartSkeleton,
  TabModuleSkeleton,
} from './components/TacticalSkeletons';
import { analytics } from './services/analytics';
import { alertNotificationService } from './services/alertNotificationService';
import { Download } from 'lucide-react';
import WaveWindForecastBarChart from './components/WaveWindForecastBarChart';
import TacticalErrorBoundary from './components/TacticalErrorBoundary';

// Code-splitting via React.lazy() para abas secundárias sob demanda e performance WebAudit
const NauticalMapView = lazy(() => import('./components/NauticalMapView'));
const NavigationLogbook = lazy(() => import('./components/NavigationLogbook'));
const AlertsManager = lazy(() => import('./components/AlertsManager'));
const NauticalUnitConverter = lazy(() => import('./components/NauticalUnitConverter'));
const OfflineManagerModal = lazy(() => import('./components/OfflineManagerModal'));
const VesselConfigModal = lazy(() => import('./components/VesselConfigModal'));
const LocationSearchModal = lazy(() => import('./components/LocationSearchModal'));
const EmergencySOSModal = lazy(() => import('./components/EmergencySOSModal'));

const DEFAULT_VESSEL: VesselProfile = {
  name: 'Albatroz',
  vesselType: 'veleiro',
  draft: 1.45,
  safetyMargin: 0.6,
  airDraft: 12.8,
};

// Container com IntersectionObserver para postergar carregamento de componentes pesados fora da dobra
const LazyViewportContainer: React.FC<{
  children: React.ReactNode;
  fallback: React.ReactNode;
  rootMargin?: string;
}> = ({ children, fallback, rootMargin = '250px 0px' }) => {
  const [inView, setInView] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const timer = setTimeout(() => {
      setInView(true);
    }, 3200);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [rootMargin]);

  return <div ref={containerRef}>{inView ? children : fallback}</div>;
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
  {
    id: 'rule-strong-current',
    title: 'Correnteza Forte (> 2.5 nós)',
    type: 'strong_current',
    thresholdValue: 2.5,
    operator: 'greater_than',
    enabled: true,
    soundAlert: false,
    soundType: 'foghorn',
    unit: 'nós',
    description: 'Monitora a velocidade estimada da correnteza de maré e dispara alerta visual quando exceder 2.5 nós.',
  },
  {
    id: 'rule-excessive-wind',
    title: 'Vento Excessivo (> 25 nós)',
    type: 'excessive_wind',
    thresholdValue: 25,
    operator: 'greater_than',
    enabled: true,
    soundAlert: false,
    soundType: 'foghorn',
    unit: 'nós',
    description: 'Monitora a velocidade do vento via condições meteomarinhas e dispara alerta visual quando exceder 25 nós.',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'tides' | 'map' | 'logbook' | 'alerts' | 'offline' | 'converter'>('tides');
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

  // Dark Mode (Inversão Tática Noturna de Alta Visibilidade)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('maresegura_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('maresegura_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('maresegura_theme', 'light');
      }
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

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
  const [isSOSModalOpen, setIsSOSModalOpen] = useState<boolean>(false);

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
      if (saved) {
        const parsed: TideAlertRule[] = JSON.parse(saved);
        const missingInitial = INITIAL_RULES.filter(
          (initR) => !parsed.some((pR) => pR.id === initR.id || pR.type === initR.type)
        );
        return missingInitial.length > 0 ? [...parsed, ...missingInitial] : parsed;
      }
      return INITIAL_RULES;
    } catch {
      return INITIAL_RULES;
    }
  });

  // Offline regions cache tracking
  const [offlineStatuses, setOfflineStatuses] = useState<Record<string, OfflineRegionStatus>>(
    loadOfflineRegions()
  );

  // Diário de Navegação (Navigation Logbook) state
  const [logbookEntries, setLogbookEntries] = useState<NavigationLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('maresegura_logbook');
      return saved ? JSON.parse(saved) : INITIAL_LOGBOOK_ENTRIES;
    } catch {
      return INITIAL_LOGBOOK_ENTRIES;
    }
  });

  const handleAddLogEntry = (entry: NavigationLogEntry) => {
    setLogbookEntries((prev) => {
      const updated = [entry, ...prev];
      try {
        localStorage.setItem('maresegura_logbook', JSON.stringify(updated));
      } catch (err) {
        console.error('Erro salvando diário:', err);
      }
      return updated;
    });
  };

  const handleUpdateLogEntry = (entry: NavigationLogEntry) => {
    setLogbookEntries((prev) => {
      const updated = prev.map((item) => (item.id === entry.id ? entry : item));
      try {
        localStorage.setItem('maresegura_logbook', JSON.stringify(updated));
      } catch (err) {
        console.error('Erro atualizando diário:', err);
      }
      return updated;
    });
  };

  const handleDeleteLogEntry = (id: string) => {
    setLogbookEntries((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('maresegura_logbook', JSON.stringify(updated));
      } catch (err) {
        console.error('Erro excluindo diário:', err);
      }
      return updated;
    });
  };

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

    // Velocidade estimada do vento em nós a partir de marineConditions (1 nós = 1.852 km/h)
    const currentWindKnots = marineConditions?.windSpeedKmH
      ? Math.round((marineConditions.windSpeedKmH / 1.852) * 10) / 10
      : undefined;

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
      } else if (
        rule.type === 'excessive_wind' &&
        currentWindKnots !== undefined &&
        currentWindKnots > rule.thresholdValue
      ) {
        alerts.push({
          id: `alt-${rule.id}`,
          ruleId: rule.id,
          title: rule.title,
          message: `Velocidade do vento registrada em ${currentWindKnots} nós (excede o limite de ${rule.thresholdValue} nós). Risco para navegação e fundeio.`,
          severity: 'warning',
          timestamp: Date.now(),
          value: `${currentWindKnots} nós`,
        });
      }
    });

    return alerts;
  }, [rules, status, vessel, marineConditions]);

  // Disparo contínuo e inteligente de notificações de alerta no navegador (primeiro e segundo plano)
  useEffect(() => {
    if (activeAlerts.length > 0) {
      alertNotificationService.syncActiveAlerts(activeAlerts, rules);
    }
  }, [activeAlerts, rules]);

  // Listener para segundo plano: monitora quando o usuário minimiza o navegador ou muda de aba
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeAlerts.length > 0) {
        alertNotificationService.syncActiveAlerts(activeAlerts, rules);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeAlerts, rules]);

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
    analytics.trackEvent('offline', 'mode_toggled', next ? 'offline' : 'online');
  };

  const refreshOfflineStatuses = () => {
    setOfflineStatuses(loadOfflineRegions());
  };

  // Atualização dinâmica de Título (SEO), Meta Description e rastreamento de métricas SPA
  useEffect(() => {
    let title = 'MaréSegura - Tábua de Marés e Navegação Offline';
    let description = 'Tábua de marés em tempo real, curva astronômica, alertas personalizados de segurança e cartas náuticas offline com cálculo de folga de quilha.';
    const loc = selectedBeach?.name || station.name;

    switch (activeTab) {
      case 'tides':
        title = `Tábua de Marés em ${loc} (${station.state}) | MaréSegura`;
        description = `Consulte a tábua de marés astronômica em tempo real para ${loc} (${station.state}), previsão oficial DHN, histórico de 7 dias, curva horária e ondulação do mar.`;
        break;
      case 'map':
        title = `Carta Náutica, Bússola & Rotas – ${loc} | MaréSegura`;
        description = `Cartas náuticas eletrônicas com sinalização OpenSeaMap, vigia de âncora com alarme, planejador de rotas com waypoints e bússola digital para ${loc}.`;
        break;
      case 'logbook':
        title = 'Diário de Bordo Náutico & Registro de Viagens | MaréSegura';
        description = 'Livro de registro e diário de bordo eletrônico de navegação com telemetria automática de vento, maré, waypoints e condições marítimas.';
        break;
      case 'alerts':
        title = 'Central de Alertas & Folga sob a Quilha (UKC) | MaréSegura';
        description = 'Configuração de alarmes náuticos sonoros para profundidade mínima, folga sob a quilha (UKC), correnteza e picos de maré alta.';
        break;
      case 'offline':
        title = 'Gerenciador de Cartas e Mapas Offline | MaréSegura';
        description = 'Baixe cartas náuticas e tábuas astronômicas para navegação segura 100% offline em alto-mar sem necessidade de sinal celular.';
        break;
      case 'converter':
        title = 'Conversor de Unidades Náuticas & Histórico de Ventos 24h | MaréSegura';
        description = 'Conversor de nós para km/h, milhas náuticas, hPa, régua Beaufort e histórico retrospectivo de 24h com rajadas máximas registradas.';
        break;
    }

    document.title = title;
    
    // Atualizar meta tags para auditores e crawlers
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);

    analytics.trackPageView(`/?tab=${activeTab}`, title);
  }, [activeTab, station, selectedBeach]);

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
          onOpenSOSModal={() => setIsSOSModalOpen(true)}
          timeRange={timeRange}
          onToggleTimeRange={setTimeRange}
          tempUnit={tempUnit}
          onToggleTempUnit={handleToggleTempUnit}
          ongoingVoyagesCount={logbookEntries.filter((e) => e.status === 'ongoing').length}
          activeAlertsCount={activeAlerts.length}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
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

        {/* Banner Visual de Alertas de Navegação Ativos */}
        {activeAlerts.length > 0 && (
          <div className="bg-[#fee2e2] border-b-2 border-black p-2.5 px-4 font-mono flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#d42020] font-bold">
              <span className="w-2.5 h-2.5 bg-[#d42020] rounded-full animate-ping shrink-0" />
              <span>{activeAlerts.length} ALERTA(S) ATIVO(S):</span>
              <span className="text-black font-semibold">
                {activeAlerts.map((a) => `${a.title} (${a.value})`).join(' • ')}
              </span>
            </div>
            <button
              onClick={() => setActiveTab('alerts')}
              className="px-2.5 py-1 bg-black text-white text-[10px] font-bold uppercase hover:bg-[#333] cursor-pointer"
            >
              VER DETALHES
            </button>
          </div>
        )}

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
              onOpenLogbook={() => setActiveTab('logbook')}
              onOpenConverter={() => setActiveTab('converter')}
              currentTime={currentTime}
            />

            {/* PREVISÃO DE ONDAS E VELOCIDADE DO VENTO 24H (TELEMETRIA OCEÂNICA) */}
            <TacticalErrorBoundary fallbackTitle="Previsão de Ondas e Ventos">
              <LazyViewportContainer fallback={<WaveWindChartSkeleton />}>
                <WaveWindForecastBarChart
                  station={station}
                  beachLat={selectedBeach?.lat}
                  beachLng={selectedBeach?.lng}
                  locationName={selectedBeach?.name || station.name}
                  isOfflineMode={isOfflineMode}
                />
              </LazyViewportContainer>
            </TacticalErrorBoundary>

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

        {/* Tab 2: Carta Náutica & GPS (Leaflet code-split) */}
        {activeTab === 'map' && (
          <TacticalErrorBoundary fallbackTitle="Falha ao carregar Carta Náutica">
            <Suspense fallback={<RadarMapSkeleton />}>
              <NauticalMapView
                station={station}
                vessel={vessel}
                currentTideHeight={status.currentHeight}
                isOfflineMode={isOfflineMode}
                onOpenDownloadModal={() => setIsOfflineModalOpen(true)}
              />
            </Suspense>
          </TacticalErrorBoundary>
        )}

        {/* Tab 3: Diário de Navegação */}
        {activeTab === 'logbook' && (
          <TacticalErrorBoundary fallbackTitle="Falha ao carregar Diário de Bordo">
            <Suspense
              fallback={
                <TabModuleSkeleton
                  title="Diário de Bordo Náutico"
                  subtitle="Carregando livro de registro e travessias..."
                />
              }
            >
              <NavigationLogbook
                entries={logbookEntries}
                onAddEntry={handleAddLogEntry}
                onUpdateEntry={handleUpdateLogEntry}
                onDeleteEntry={handleDeleteLogEntry}
                currentStation={station}
                currentStatus={status}
                currentVessel={vessel}
                realMarineConditions={marineConditions}
                tempUnit={tempUnit}
                activeBeachName={selectedBeach.name}
              />
            </Suspense>
          </TacticalErrorBoundary>
        )}

        {/* Tab 4: Alertas */}
        {activeTab === 'alerts' && (
          <TacticalErrorBoundary fallbackTitle="Falha ao carregar Central de Alertas">
            <Suspense
              fallback={
                <TabModuleSkeleton
                  title="Central de Alertas & Notificações"
                  subtitle="Sincronizando regras de segurança e sensores de folga sob a quilha..."
                />
              }
            >
              <AlertsManager
                rules={rules}
                onUpdateRules={handleUpdateRules}
                activeAlerts={activeAlerts}
                currentStatus={status}
                vessel={vessel}
              />
            </Suspense>
          </TacticalErrorBoundary>
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

        {/* Tab 5: Conversor de Unidades Náuticas */}
        {activeTab === 'converter' && (
          <TacticalErrorBoundary fallbackTitle="Falha ao carregar Conversor de Unidades">
            <Suspense
              fallback={
                <TabModuleSkeleton
                  title="Conversor de Unidades Náuticas"
                  subtitle="Calculando conversões de velocidade, distância, pressão barométrica e profundidade..."
                />
              }
            >
              <NauticalUnitConverter
                currentWindSpeedKnots={
                  marineConditions?.windSpeedKmH
                    ? Math.round((marineConditions.windSpeedKmH / 1.852) * 10) / 10
                    : undefined
                }
                currentPressureHpa={1013.25}
                station={station}
                userCoords={userCoords}
                onNavigateToTides={() => setActiveTab('tides')}
              />
            </Suspense>
          </TacticalErrorBoundary>
        )}
      </div>

      {/* Mobile Fixed Bottom Nav */}
      <nav aria-label="Navegação móvel inferior" className="md:hidden sticky bottom-0 z-40 bg-[#f8f7f4] border-t-2 border-black p-1 grid grid-cols-6 gap-0.5 text-center font-mono">
        <button
          onClick={() => setActiveTab('tides')}
          aria-label="Aba Tábua de Marés"
          aria-current={activeTab === 'tides' ? 'page' : undefined}
          className={`py-2 text-[9px] font-bold uppercase cursor-pointer ${
            activeTab === 'tides' ? 'bg-black text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          TÁBUA
        </button>
        <button
          onClick={() => setActiveTab('map')}
          aria-label="Aba Mapa Náutico"
          aria-current={activeTab === 'map' ? 'page' : undefined}
          className={`py-2 text-[9px] font-bold uppercase cursor-pointer ${
            activeTab === 'map' ? 'bg-black text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          MAPA
        </button>
        <button
          onClick={() => setActiveTab('logbook')}
          aria-label="Aba Diário de Bordo"
          aria-current={activeTab === 'logbook' ? 'page' : undefined}
          className={`py-2 text-[9px] font-bold uppercase cursor-pointer ${
            activeTab === 'logbook' ? 'bg-black text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          DIÁRIO
        </button>
        <button
          onClick={() => setActiveTab('converter')}
          aria-label="Aba Conversor Náutico"
          aria-current={activeTab === 'converter' ? 'page' : undefined}
          className={`py-2 text-[9px] font-bold uppercase cursor-pointer ${
            activeTab === 'converter' ? 'bg-[#d42020] text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          CONVERSOR
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          aria-label="Aba Alertas"
          aria-current={activeTab === 'alerts' ? 'page' : undefined}
          className={`py-2 text-[9px] font-bold uppercase cursor-pointer relative ${
            activeTab === 'alerts' ? 'bg-black text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          <span>ALERTAS</span>
          {activeAlerts.length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#d42020] animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('offline')}
          aria-label="Aba Offline"
          aria-current={activeTab === 'offline' ? 'page' : undefined}
          className={`py-2 text-[9px] font-bold uppercase cursor-pointer ${
            activeTab === 'offline' ? 'bg-black text-white' : 'text-black hover:bg-[#eeebe6]'
          }`}
        >
          OFFLINE
        </button>
      </nav>

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

      {/* Modais carregados sob demanda via React.lazy */}
      {isVesselModalOpen && (
        <Suspense fallback={null}>
          <VesselConfigModal
            isOpen={isVesselModalOpen}
            onClose={() => setIsVesselModalOpen(false)}
            vessel={vessel}
            onSave={handleSaveVessel}
          />
        </Suspense>
      )}

      {isOfflineModalOpen && (
        <Suspense fallback={null}>
          <OfflineManagerModal
            isOpen={isOfflineModalOpen}
            onClose={() => setIsOfflineModalOpen(false)}
            stations={TIDE_STATIONS}
            offlineStatuses={offlineStatuses}
            onRefreshStatuses={refreshOfflineStatuses}
            isOfflineMode={isOfflineMode}
            onToggleOfflineMode={handleToggleOfflineMode}
          />
        </Suspense>
      )}

      {isSearchModalOpen && (
        <Suspense fallback={null}>
          <LocationSearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
            userCoords={userCoords}
            onSelectBeach={handleSelectBeach}
            onSelectCustomLocation={handleSelectCustomLocation}
            onSelectLocation={(beach, st) => {
              setSelectedBeach(beach);
              setStation(st);
            }}
          />
        </Suspense>
      )}

      {/* Modal Tático de Sinalização de Socorro SOS (MAYDAY) */}
      {isSOSModalOpen && (
        <Suspense fallback={null}>
          <EmergencySOSModal
            isOpen={isSOSModalOpen}
            onClose={() => setIsSOSModalOpen(false)}
            vessel={vessel}
            userCoords={userCoords}
            hasRealGPS={hasRealGPS}
            station={station}
            selectedBeachName={selectedBeach?.name}
            onRequestGPS={handleRequestGPS}
          />
        </Suspense>
      )}
    </div>
  );
}
