import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { TideStation, VesselProfile, Waypoint } from '../types/tide';
import {
  Anchor,
  Compass,
  Trash2,
  WifiOff,
  Navigation,
  AlertTriangle,
  Volume2,
  VolumeX,
  ShieldCheck,
  ShieldAlert,
  Crosshair,
  MapPin,
  RefreshCw,
  BellRing,
  HelpCircle,
  Clock,
  Radio,
  Layers,
} from 'lucide-react';
import { RadarMapSkeleton } from './TacticalSkeletons';
import { maritimeAudio } from '../utils/audioAlerts';
import { alertNotificationService } from '../services/alertNotificationService';
import { DigitalCompass } from './DigitalCompass';
import { RoutePlanner } from './RoutePlanner';

// Code-splitting via React.lazy() da biblioteca e camadas cartográficas Leaflet
const LeafletNauticalMap = lazy(() => import('./LeafletNauticalMap'));

interface NauticalMapViewProps {
  station: TideStation;
  vessel: VesselProfile;
  currentTideHeight: number;
  isOfflineMode: boolean;
  onOpenDownloadModal: () => void;
  vesselCoords?: { lat: number; lng: number };
  onVesselPositionChange?: (pos: [number, number]) => void;
}

// Cálculo geodésico de distância em metros (Fórmula de Haversine)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Cálculo de rumo / marcação em graus (0 - 360°)
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

// Converte graus para ponto cardeal náutico
function degreesToCardinal(deg: number): string {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const idx = Math.round(deg / 22.5) % 16;
  return cardinals[idx];
}

export const NauticalMapView: React.FC<NauticalMapViewProps> = ({
  station,
  vessel,
  currentTideHeight,
  isOfflineMode,
  onOpenDownloadModal,
  vesselCoords,
  onVesselPositionChange,
}) => {
  // Posição e movimento da embarcação
  const [vesselPosition, setVesselPosition] = useState<[number, number]>(() => {
    if (vesselCoords) return [vesselCoords.lat, vesselCoords.lng];
    return [station.lat, station.lng];
  });

  useEffect(() => {
    if (vesselCoords) {
      setVesselPosition((prev) => {
        if (Math.abs(prev[0] - vesselCoords.lat) > 0.00001 || Math.abs(prev[1] - vesselCoords.lng) > 0.00001) {
          return [vesselCoords.lat, vesselCoords.lng];
        }
        return prev;
      });
    }
  }, [vesselCoords?.lat, vesselCoords?.lng]);

  useEffect(() => {
    onVesselPositionChange?.(vesselPosition);
  }, [vesselPosition, onVesselPositionChange]);
  const [vesselHeading, setVesselHeading] = useState<number>(45);
  const [vesselSpeed, setVesselSpeed] = useState<number>(0.2);
  const [isSimulatingCruise, setIsSimulatingCruise] = useState<boolean>(false);
  const [isLiveGPSActive, setIsLiveGPSActive] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Rota e Waypoints (pontos de passagem reais traçados pelo navegador)
  const [routeWaypoints, setRouteWaypoints] = useState<Waypoint[]>(() => {
    try {
      const saved = localStorage.getItem(`maresegura_waypoints_${station.id}`);
      if (saved) {
        const parsed: Waypoint[] = JSON.parse(saved);
        return parsed.filter((w) => !['wp-1', 'wp-2', 'wp-3'].includes(w.id));
      }
      return [];
    } catch {
      return [];
    }
  });

  // Salva waypoints traçados na estação atual
  useEffect(() => {
    try {
      localStorage.setItem(`maresegura_waypoints_${station.id}`, JSON.stringify(routeWaypoints));
    } catch (e) {
      console.error('Erro salvando waypoints:', e);
    }
  }, [routeWaypoints, station.id]);

  // Vigia de Âncora (Anchor Watch - Alarme de Garreio)
  const [anchorWatchActive, setAnchorWatchActive] = useState<boolean>(false);
  const [anchorPosition, setAnchorPosition] = useState<[number, number] | null>(null);
  const [anchorRadius, setAnchorRadius] = useState<number>(35); // metros
  const [anchorDroppedAt, setAnchorDroppedAt] = useState<number | null>(null);
  const [isAlarmSilenced, setIsAlarmSilenced] = useState<boolean>(false);
  const [isSettingAnchorByClick, setIsSettingAnchorByClick] = useState<boolean>(false);
  const [driftTrail, setDriftTrail] = useState<Array<{ lat: number; lng: number }>>([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'anchor' | 'waypoints' | 'compass' | 'layers'>('anchor');
  const [isCompassOverlayOpen, setIsCompassOverlayOpen] = useState<boolean>(false);
  const [targetCourse, setTargetCourse] = useState<number | null>(null);
  const [isDrawingRouteMode, setIsDrawingRouteMode] = useState<boolean>(false);

  // Coordenadas manuais de fundeio
  const [manualAnchorLat, setManualAnchorLat] = useState<string>('');
  const [manualAnchorLng, setManualAnchorLng] = useState<string>('');
  const [isManualAnchorOpen, setIsManualAnchorOpen] = useState<boolean>(false);

  // Camadas ativas no mapa
  const [showSeamarks, setShowSeamarks] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(true);

  // Refs de controle
  const gpsWatchIdRef = useRef<number | null>(null);
  const prevStatusRef = useRef<'safe' | 'warning' | 'alarm'>('safe');

  // Cálculos dinâmicos da Vigia de Âncora
  const currentAnchorPoint: [number, number] = anchorPosition || vesselPosition;
  const currentAnchorDistance = anchorWatchActive && anchorPosition
    ? calculateDistanceMeters(vesselPosition[0], vesselPosition[1], anchorPosition[0], anchorPosition[1])
    : 0;

  const bearingToAnchor = anchorWatchActive && anchorPosition
    ? calculateBearing(vesselPosition[0], vesselPosition[1], anchorPosition[0], anchorPosition[1])
    : 0;

  let anchorStatus: 'safe' | 'warning' | 'alarm' = 'safe';
  if (anchorWatchActive && anchorPosition) {
    if (currentAnchorDistance > anchorRadius) {
      anchorStatus = 'alarm';
    } else if (currentAnchorDistance >= anchorRadius * 0.75) {
      anchorStatus = 'warning';
    }
  }

  // Percentual da distância em relação ao raio
  const radiusPercentage = anchorRadius > 0 ? Math.min(150, Math.round((currentAnchorDistance / anchorRadius) * 100)) : 0;

  // Profundidade e folga sob a quilha
  const currentChartedSounding = 6.4;
  const currentActualWaterDepth = currentChartedSounding + currentTideHeight;
  const vesselUKC = currentActualWaterDepth - vessel.draft;

  // Recomendação de Amarra (Razão náutica 5:1 recomendada pela Marinha)
  const recommendedRodeLength = Math.round(currentActualWaterDepth * 5 + vessel.draft);

  // Limpar observação do GPS ao desmontar
  useEffect(() => {
    return () => {
      if (gpsWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
    };
  }, []);

  // Efeito Sonoro e Notificação de Alerta da Vigia de Âncora (Alarme de Garreio)
  useEffect(() => {
    if (!anchorWatchActive || anchorStatus !== 'alarm' || isAlarmSilenced) {
      return;
    }

    // Dispara notificação no navegador para segundo plano
    alertNotificationService.notifyAlert({
      id: 'anchor-drag-alarm',
      ruleId: 'anchor-watch',
      title: '🚨 ALARME DE GARREIO DE ÂNCORA!',
      message: `A embarcação ultrapassou o raio de segurança (${anchorRadius}m), afastada a ${currentAnchorDistance}m da âncora!`,
      severity: 'danger',
      timestamp: Date.now(),
      value: `${currentAnchorDistance}m`,
    });

    // Toca o alarme imediatamente ao ultrapassar o raio
    maritimeAudio.playAnchorDragAlarm();

    // Repete a cada 2.5 segundos enquanto a âncora estiver garreando
    const interval = setInterval(() => {
      maritimeAudio.playAnchorDragAlarm();
    }, 2500);

    return () => clearInterval(interval);
  }, [anchorWatchActive, anchorStatus, isAlarmSilenced, anchorRadius, currentAnchorDistance]);

  // Efeito Sonoro ao entrar na zona de atenção (75% do raio)
  useEffect(() => {
    if (!anchorWatchActive) return;
    if (anchorStatus === 'warning' && prevStatusRef.current === 'safe') {
      maritimeAudio.playWarningBeep();
    }
    prevStatusRef.current = anchorStatus;
  }, [anchorWatchActive, anchorStatus]);

  // Simulação de navegação / cruzeiro (quando ativo)
  useEffect(() => {
    if (!isSimulatingCruise || anchorWatchActive) return;

    let step = 0;
    const interval = setInterval(() => {
      step += 0.05;
      const radiusLat = 0.012;
      const radiusLng = 0.015;
      const lat = station.lat + Math.sin(step) * radiusLat;
      const lng = station.lng + Math.cos(step) * radiusLng;
      const heading = (Math.atan2(Math.cos(step) * radiusLng, -Math.sin(step) * radiusLat) * 180) / Math.PI;

      setVesselPosition([lat, lng]);
      setVesselHeading(Math.round((heading + 360) % 360));
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulatingCruise, anchorWatchActive, station]);

  // Simulação leve de borneio (oscilação natural ao redor da âncora) quando fundeado
  useEffect(() => {
    if (!anchorWatchActive || !anchorPosition) return;
    if (isLiveGPSActive) return; // Se GPS real estiver ativo, utiliza dados do sensor

    let swingAngle = 0;
    const interval = setInterval(() => {
      swingAngle += 0.08;
      // Pequeno movimento pendular natural de maré/vento (8 a 14 metros)
      const swingRadiusMeters = Math.min(anchorRadius * 0.45, 14);
      const dLat = (Math.sin(swingAngle) * swingRadiusMeters) / 111320;
      const dLng = (Math.cos(swingAngle) * swingRadiusMeters) / (111320 * Math.cos((anchorPosition[0] * Math.PI) / 180));

      const newPos: [number, number] = [anchorPosition[0] + dLat, anchorPosition[1] + dLng];
      setVesselPosition(newPos);
      setVesselHeading(Math.round((swingAngle * (180 / Math.PI) + 90) % 360));
      setVesselSpeed(0.4);

      setDriftTrail((prev) => {
        const updated = [...prev, { lat: newPos[0], lng: newPos[1] }];
        return updated.slice(-30);
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [anchorWatchActive, anchorPosition, anchorRadius, isLiveGPSActive]);

  // Iniciar rastreamento contínuo do GPS real do aparelho
  const startLiveGPSWatch = (onSuccessCoords?: (coords: [number, number]) => void) => {
    if (!('geolocation' in navigator)) {
      return;
    }

    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
    }

    setIsLiveGPSActive(true);
    setIsSimulatingCruise(false);

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;
        const coords: [number, number] = [latitude, longitude];
        setVesselPosition(coords);
        setGpsAccuracy(Math.round(accuracy));
        if (heading !== null && !isNaN(heading)) setVesselHeading(Math.round(heading));
        if (speed !== null && !isNaN(speed)) {
          setVesselSpeed(Math.round(speed * 1.94384 * 10) / 10);
        }

        if (onSuccessCoords) {
          onSuccessCoords(coords);
          onSuccessCoords = undefined;
        }

        if (anchorWatchActive) {
          setDriftTrail((prev) => {
            const updated = [...prev, { lat: latitude, lng: longitude }];
            return updated.slice(-30);
          });
        }
      },
      (err) => {
        console.warn('Erro ao obter posição GPS:', err);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
    );
  };

  // Alternar GPS do Aparelho
  const handleToggleLiveGPS = () => {
    if (isLiveGPSActive) {
      if (gpsWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      setIsLiveGPSActive(false);
      return;
    }

    startLiveGPSWatch();
  };

  // Lançar Âncora no GPS Real do Aparelho ou na posição atual
  const handleDropAnchor = () => {
    setIsSimulatingCruise(false);
    setIsAlarmSilenced(false);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setVesselPosition(coords);
          setAnchorPosition(coords);
          setGpsAccuracy(Math.round(pos.coords.accuracy));
          setAnchorWatchActive(true);
          setAnchorDroppedAt(Date.now());
          setDriftTrail([{ lat: coords[0], lng: coords[1] }]);
          setIsSettingAnchorByClick(false);
          maritimeAudio.playAnchorDropChime();
          startLiveGPSWatch();
        },
        () => {
          // Fallback caso usuário recuse ou GPS falhe
          setAnchorPosition(vesselPosition);
          setAnchorWatchActive(true);
          setAnchorDroppedAt(Date.now());
          setDriftTrail([{ lat: vesselPosition[0], lng: vesselPosition[1] }]);
          setIsSettingAnchorByClick(false);
          maritimeAudio.playAnchorDropChime();
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setAnchorPosition(vesselPosition);
      setAnchorWatchActive(true);
      setAnchorDroppedAt(Date.now());
      setDriftTrail([{ lat: vesselPosition[0], lng: vesselPosition[1] }]);
      setIsSettingAnchorByClick(false);
      maritimeAudio.playAnchorDropChime();
    }
  };

  // Levantar Âncora (Encerrar Vigia)
  const handleRaiseAnchor = () => {
    setAnchorWatchActive(false);
    setAnchorPosition(null);
    setAnchorDroppedAt(null);
    setDriftTrail([]);
    setIsSettingAnchorByClick(false);
    setIsAlarmSilenced(false);
    setIsManualAnchorOpen(false);
  };

  // Definir Ponto de Fundeio através de coordenadas manuais
  const handleApplyManualAnchor = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(manualAnchorLat);
    const lng = parseFloat(manualAnchorLng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setAnchorPosition([lat, lng]);
      setAnchorWatchActive(true);
      setAnchorDroppedAt(Date.now());
      setDriftTrail([{ lat, lng }]);
      setIsManualAnchorOpen(false);
      maritimeAudio.playAnchorDropChime();
      startLiveGPSWatch();
    }
  };

  // Simular Garreio de Âncora (Teste imediato de disparo visual e sonoro)
  const handleSimulateDrag = () => {
    if (!anchorPosition) return;
    setIsSimulatingCruise(false);
    setIsAlarmSilenced(false);

    // Desloca a embarcação 15 metros para fora do raio de segurança
    const dragDistance = anchorRadius + 18;
    const dLat = dragDistance / 111320;
    const newPos: [number, number] = [anchorPosition[0] + dLat, anchorPosition[1]];
    setVesselPosition(newPos);
  };

  // Restabelecer Embarcação dentro do raio seguro
  const handleResetToCenter = () => {
    if (!anchorPosition) return;
    const safeDistance = Math.min(anchorRadius * 0.3, 10);
    const dLat = safeDistance / 111320;
    setVesselPosition([anchorPosition[0] + dLat, anchorPosition[1]]);
  };

  // Distância total da rota em Milhas Náuticas (NM)
  const totalRouteNM = routeWaypoints.reduce((acc, wp, idx) => {
    if (idx === 0) return 0;
    const prev = routeWaypoints[idx - 1];
    const dLat = (wp.lat - prev.lat) * 111320;
    const dLng = (wp.lng - prev.lng) * 111320 * Math.cos((prev.lat * Math.PI) / 180);
    const meters = Math.sqrt(dLat * dLat + dLng * dLng);
    return acc + meters / 1852;
  }, 0);

  return (
    <div className="w-full">
      {/* Alerta de Modo Offline */}
      {isOfflineMode && (
        <div className="p-3 bg-[#eeebe6] border-b-2 border-black flex items-center justify-between gap-3 text-xs font-mono font-bold">
          <div className="flex items-center gap-2 text-black">
            <WifiOff className="w-4 h-4 text-[#d42020] shrink-0" />
            <span>MODO DE NAVEGAÇÃO OFFLINE // OPERAÇÃO 100% SEM SINAL DE INTERNET</span>
          </div>
          <button
            onClick={onOpenDownloadModal}
            className="border-2 border-black bg-white px-2 py-0.5 text-[10px] uppercase cursor-pointer hover:bg-black hover:text-white transition-colors"
          >
            GERENCIAR CARTAS
          </button>
        </div>
      )}

      {/* BANNER CRÍTICO DE EMERGÊNCIA: DISPARO DE GARREIO DE ÂNCORA */}
      {anchorWatchActive && anchorStatus === 'alarm' && (
        <div className="bg-[#d42020] text-white border-b-2 border-black p-3.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 animate-pulse shadow-[0px_4px_0px_#000]">
          <div className="flex items-center gap-3">
            <div className="bg-white text-[#d42020] p-1.5 border-2 border-black">
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-mono text-sm sm:text-base font-black uppercase tracking-wider flex items-center gap-2">
                <span>ALARME DE GARREIO! ÂNCORA EM DESLOCAMENTO CRÍTICO</span>
                <span className="bg-black text-white text-[10px] px-1.5 py-0.5 border border-white">
                  EMERGÊNCIA
                </span>
              </div>
              <div className="font-mono text-xs text-white/90 font-bold mt-0.5">
                Barco afastado <strong className="text-white underline">{currentAnchorDistance}m</strong> do ponto fixo (Raio limite: {anchorRadius}m // Excesso: +{(currentAnchorDistance - anchorRadius).toFixed(1)}m)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAlarmSilenced(!isAlarmSilenced)}
              className="bg-black text-white hover:bg-white hover:text-black border-2 border-white px-3 py-1.5 font-mono text-xs font-bold uppercase cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              {isAlarmSilenced ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              {isAlarmSilenced ? 'REATIVAR SOM' : 'SILENCIAR SOM'}
            </button>

            <button
              onClick={handleResetToCenter}
              className="bg-white text-black hover:bg-black hover:text-white border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase cursor-pointer transition-colors"
            >
              CENTRALIZAR
            </button>
          </div>
        </div>
      )}

      {/* Grid Principal: Mapa e Painel Lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-4 border-b-2 border-black">
        {/* Painel do Mapa (3 Colunas) */}
        <div className={`lg:col-span-3 border-b-2 lg:border-b-0 lg:border-r-2 border-black relative h-[600px] bg-[#e5e5df] ${anchorStatus === 'alarm' ? 'ring-4 ring-[#d42020] ring-inset' : ''}`}>
          
          {/* Fita Superior de Instrumentos Táticos */}
          <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
              <div className="bg-white border-2 border-black px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-black shadow-[2px_2px_0px_#000]">
                <Compass className="w-3.5 h-3.5 text-[#d42020]" />
                <span>
                  RUMO: <strong className="tabular-nums">{vesselHeading}°</strong> ({degreesToCardinal(vesselHeading)})
                </span>
                <span>|</span>
                <span>VELOCIDADE: <strong className="tabular-nums">{vesselSpeed} NÓS</strong></span>
                <button
                  onClick={() => setIsCompassOverlayOpen(!isCompassOverlayOpen)}
                  className={`ml-1 px-2 py-0.5 text-[10px] uppercase font-bold border border-black cursor-pointer transition-colors ${
                    isCompassOverlayOpen ? 'bg-black text-white' : 'bg-[#d42020] text-white hover:bg-black'
                  }`}
                  title="Abrir/Fechar Bússola Digital com sensor de orientação do aparelho sobre a carta náutica"
                >
                  {isCompassOverlayOpen ? 'OCULTAR BÚSSOLA' : 'BÚSSOLA DIGITAL'}
                </button>
              </div>

              <div className="bg-white border-2 border-black px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-black shadow-[2px_2px_0px_#000]">
                <Anchor className="w-3.5 h-3.5" />
                <span>PROFUNDIDADE: <strong className="tabular-nums">{currentActualWaterDepth.toFixed(1)}M</strong></span>
                <span>|</span>
                <span>
                  FOLGA:{' '}
                  <strong
                    className={`tabular-nums ${
                      vesselUKC > 1.0 ? 'text-[#008800]' : vesselUKC > 0.4 ? 'text-[#b45309]' : 'text-[#d42020]'
                    }`}
                  >
                    +{vesselUKC.toFixed(1)}M
                  </strong>
                </span>
              </div>
            </div>

            {/* HUD DA VIGIA DE ÂNCORA (QUANDO ATIVA) */}
            {anchorWatchActive && (
              <div className="pointer-events-auto">
                <div
                  className={`border-2 border-black px-3 py-1.5 font-mono text-xs font-bold flex items-center gap-2.5 shadow-[2px_2px_0px_#000] ${
                    anchorStatus === 'alarm'
                      ? 'bg-[#d42020] text-white animate-bounce'
                      : anchorStatus === 'warning'
                      ? 'bg-[#f59e0b] text-black'
                      : 'bg-[#10b981] text-white'
                  }`}
                >
                  <Anchor className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    VIGIA: <strong className="tabular-nums">{currentAnchorDistance}m</strong> / {anchorRadius}m
                  </span>
                  <span className="text-[10px] uppercase px-1 py-0.2 border border-current">
                    {anchorStatus === 'alarm' ? 'GARREANDO' : anchorStatus === 'warning' ? 'ATENÇÃO' : 'SEGURA'}
                  </span>
                  {gpsAccuracy !== null && (
                    <span className="text-[10px] opacity-90">GPS ±{gpsAccuracy}m</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Banner de Ajuda ao Clicar para Marcar Âncora no Mapa */}
          {isSettingAnchorByClick && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-black text-white px-4 py-2 border-2 border-white shadow-[3px_3px_0px_#000] font-mono text-xs font-bold flex items-center gap-3">
              <Crosshair className="w-4 h-4 text-[#d42020] animate-spin" />
              <span>CLIQUE EM QUALQUER LUGAR DO MAPA PARA POSICIONAR A ÂNCORA</span>
              <button
                onClick={() => setIsSettingAnchorByClick(false)}
                className="bg-white text-black px-1.5 py-0.5 text-[10px] uppercase border border-black cursor-pointer hover:bg-[#eee]"
              >
                CANCELAR
              </button>
            </div>
          )}

          {/* Banner de Modo Desenho de Waypoints da Rota */}
          {isDrawingRouteMode && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-[#111] text-white px-4 py-2.5 border-2 border-[#10b981] shadow-[4px_4px_0px_#000] font-mono text-xs font-bold flex items-center gap-3">
              <Navigation className="w-4 h-4 text-[#10b981] animate-pulse" />
              <span>MODO DESENHO ATIVO: CLIQUE NA CARTA PARA ADICIONAR WAYPOINTS ({routeWaypoints.length} MARCADOS)</span>
              <button
                onClick={() => setIsDrawingRouteMode(false)}
                className="bg-[#10b981] text-black px-2 py-0.5 text-[10px] uppercase font-bold border border-black cursor-pointer hover:bg-white"
              >
                CONCLUIR
              </button>
            </div>
          )}

          {/* Overlay Flutuante da Bússola Digital sobre o Mapa */}
          {isCompassOverlayOpen && (
            <div className="absolute top-14 right-3 z-30 pointer-events-auto w-80 max-w-[calc(100vw-32px)]">
              <DigitalCompass
                currentHeading={vesselHeading}
                onHeadingChange={(h) => setVesselHeading(h)}
                targetHeading={targetCourse}
                onSetTargetHeading={setTargetCourse}
                isCompact={true}
              />
            </div>
          )}

          {/* Controles Flutuantes de Ação Rápida no Rodapé do Mapa */}
          <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleLiveGPS}
              className={`px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors flex items-center gap-1.5 ${
                isLiveGPSActive ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#eeebe6]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {isLiveGPSActive ? 'GPS AO VIVO ATIVO' : 'USAR GPS DO APARELHO'}
            </button>

            {/* Botão Rápido de Vigia de Âncora (Anchor Watch) */}
            {!anchorWatchActive ? (
              <button
                onClick={() => {
                  setActiveSidebarTab('anchor');
                  handleDropAnchor();
                }}
                className="px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black bg-[#10b981] hover:bg-[#059669] text-white shadow-[2px_2px_0px_#000] cursor-pointer transition-colors flex items-center gap-1.5"
                title="Ativar Modo Vigia de Âncora e fundear no GPS atual"
              >
                <Anchor className="w-3.5 h-3.5" />
                <span>ATIVAR VIGIA DE ÂNCORA</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveSidebarTab('anchor')}
                className={`px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors flex items-center gap-1.5 ${
                  anchorStatus === 'alarm'
                    ? 'bg-[#d42020] text-white animate-pulse'
                    : anchorStatus === 'warning'
                    ? 'bg-[#f59e0b] text-black'
                    : 'bg-black text-white'
                }`}
                title="Visualizar status da Vigia de Âncora"
              >
                <Anchor className="w-3.5 h-3.5" />
                <span>VIGIA: {currentAnchorDistance}m / {anchorRadius}m</span>
              </button>
            )}

            {anchorWatchActive ? (
              <>
                <button
                  onClick={handleSimulateDrag}
                  className="px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black bg-white hover:bg-[#eeebe6] text-[#d42020] shadow-[2px_2px_0px_#000] cursor-pointer transition-colors flex items-center gap-1"
                  title="Testar disparo do alarme sonoro e visual deslocando o barco para fora do raio"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  SIMULAR GARREIO (TESTE)
                </button>

                <button
                  onClick={() => {
                    if (anchorPosition) setVesselPosition(anchorPosition);
                  }}
                  className="px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black bg-white hover:bg-[#eeebe6] text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
                >
                  CENTRALIZAR NA ÂNCORA
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsSimulatingCruise(!isSimulatingCruise)}
                className="px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black bg-white hover:bg-[#eeebe6] text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
              >
                {isSimulatingCruise ? 'PAUSAR SIMULAÇÃO' : 'SIMULAR CRUZEIRO'}
              </button>
            )}

            {/* Botão Rápido de Planejador de Rotas */}
            <button
              onClick={() => {
                setActiveSidebarTab('waypoints');
                setIsDrawingRouteMode(!isDrawingRouteMode);
              }}
              className={`px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors flex items-center gap-1.5 ${
                isDrawingRouteMode
                  ? 'bg-[#10b981] text-black animate-pulse'
                  : 'bg-white text-black hover:bg-[#eeebe6]'
              }`}
              title="Ativar modo de desenho de waypoints na carta náutica"
            >
              <Navigation className="w-3.5 h-3.5 text-[#d42020]" />
              <span>{isDrawingRouteMode ? 'DESENHANDO ROTA...' : 'PLANEJAR ROTA'}</span>
            </button>

            <button
              onClick={() => setVesselPosition([station.lat, station.lng])}
              className="px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black bg-white hover:bg-[#eeebe6] text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
            >
              CENTRALIZAR BARCO
            </button>
          </div>

          {/* Renderização do mapa Leaflet encapsulado com Suspense */}
          <Suspense fallback={<RadarMapSkeleton />}>
            <LeafletNauticalMap
              station={station}
              vessel={vessel}
              currentTideHeight={currentTideHeight}
              vesselPosition={vesselPosition}
              vesselHeading={vesselHeading}
              routeWaypoints={routeWaypoints}
              onMapClickAddWaypoint={(wp) => {
                setRouteWaypoints((prev) => (prev.length >= 30 ? prev : [...prev, wp]));
              }}
              showHazards={showHazards}
              showSeamarks={showSeamarks}
              anchorWatchActive={anchorWatchActive}
              anchorPosition={anchorPosition}
              anchorRadius={anchorRadius}
              anchorStatus={anchorStatus}
              driftTrail={driftTrail}
              isSettingAnchorByClick={isSettingAnchorByClick}
              onMapClickSetAnchor={(pos) => {
                setAnchorPosition(pos);
                setAnchorWatchActive(true);
                setAnchorDroppedAt(Date.now());
                setIsSettingAnchorByClick(false);
                maritimeAudio.playAnchorDropChime();
              }}
            />
          </Suspense>
        </div>

        {/* Controles Laterais da Navegação (1 Coluna) */}
        <div className="p-4 sm:p-5 bg-[#eeebe6] flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Seletor de Abas Táticas Laterais */}
            <div className="grid grid-cols-4 border-2 border-black bg-white text-xs font-mono font-bold">
              <button
                onClick={() => setActiveSidebarTab('anchor')}
                className={`py-2 px-1 text-center cursor-pointer transition-colors border-r-2 border-black flex items-center justify-center gap-1 ${
                  activeSidebarTab === 'anchor' ? 'bg-black text-white' : 'hover:bg-[#f2efe9] text-black'
                }`}
              >
                <Anchor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ÂNCORA</span>
              </button>

              <button
                onClick={() => setActiveSidebarTab('waypoints')}
                className={`py-2 px-1 text-center cursor-pointer transition-colors border-r-2 border-black flex items-center justify-center gap-1 ${
                  activeSidebarTab === 'waypoints' ? 'bg-black text-white' : 'hover:bg-[#f2efe9] text-black'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ROTAS</span>
              </button>

              <button
                onClick={() => setActiveSidebarTab('compass')}
                className={`py-2 px-1 text-center cursor-pointer transition-colors border-r-2 border-black flex items-center justify-center gap-1 ${
                  activeSidebarTab === 'compass' ? 'bg-black text-white' : 'hover:bg-[#f2efe9] text-black'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-[#d42020]" />
                <span className="hidden sm:inline">BÚSSOLA</span>
              </button>

              <button
                onClick={() => setActiveSidebarTab('layers')}
                className={`py-2 px-1 text-center cursor-pointer transition-colors flex items-center justify-center gap-1 ${
                  activeSidebarTab === 'layers' ? 'bg-black text-white' : 'hover:bg-[#f2efe9] text-black'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CAMADAS</span>
              </button>
            </div>

            {/* ABA 1: VIGIA DE ÂNCORA (ANCHOR WATCH & ALARME DE GARREIO) */}
            {activeSidebarTab === 'anchor' && (
              <div className="space-y-4">
                {/* Configuração do Raio de Tolerância (Visível sempre) */}
                <div className="p-3 border-2 border-black bg-white shadow-[2px_2px_0px_#000] space-y-2.5">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold uppercase tracking-wider text-[#666] text-[11px] flex items-center gap-1">
                      <Crosshair className="w-3.5 h-3.5 text-[#d42020]" />
                      Raio de Tolerância:
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="5"
                        max="300"
                        step="1"
                        value={anchorRadius}
                        onChange={(e) => setAnchorRadius(Math.max(5, Math.min(300, Number(e.target.value) || 20)))}
                        className="w-16 px-1.5 py-0.5 border-2 border-black font-mono text-xs font-bold text-center tabular-nums focus:outline-none"
                        aria-label="Raio de tolerância da âncora em metros"
                      />
                      <span className="font-bold text-xs">m</span>
                    </div>
                  </div>

                  {/* Presets Rápidos */}
                  <div className="grid grid-cols-5 gap-1 font-mono text-xs font-bold">
                    {[15, 25, 35, 50, 75].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAnchorRadius(preset)}
                        className={`py-1 border border-black cursor-pointer transition-colors ${
                          anchorRadius === preset
                            ? 'bg-black text-white'
                            : 'bg-white hover:bg-[#eee] text-black'
                        }`}
                      >
                        {preset}m
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="5"
                    value={anchorRadius}
                    onChange={(e) => setAnchorRadius(Number(e.target.value))}
                    className="w-full accent-black cursor-pointer"
                    aria-label="Ajustar raio de tolerância do fundeio"
                  />
                </div>

                {/* Botões de Ação para Definir o Ponto de Fundeio */}
                {!anchorWatchActive ? (
                  <div className="space-y-2">
                    <button
                      onClick={handleDropAnchor}
                      className="w-full bg-[#111111] hover:bg-black text-white border-2 border-black p-3 font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
                    >
                      <Anchor className="w-4 h-4 text-[#10b981]" />
                      <span>LANÇAR NO GPS ATUAL (INICIAR VIGIA)</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setIsSettingAnchorByClick(!isSettingAnchorByClick)}
                        className={`border-2 border-black p-2 font-mono text-[11px] font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5 transition-colors ${
                          isSettingAnchorByClick ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#eee]'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>MARCAR NO MAPA</span>
                      </button>

                      <button
                        onClick={() => setIsManualAnchorOpen(!isManualAnchorOpen)}
                        className={`border-2 border-black p-2 font-mono text-[11px] font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5 transition-colors ${
                          isManualAnchorOpen ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#eee]'
                        }`}
                      >
                        <Crosshair className="w-3.5 h-3.5 text-black" />
                        <span>INSERIR COORDENADAS</span>
                      </button>
                    </div>

                    {/* Formulário de Coordenadas Manuais de Fundeio */}
                    {isManualAnchorOpen && (
                      <form onSubmit={handleApplyManualAnchor} className="p-3 border-2 border-black bg-white space-y-2">
                        <span className="block font-bold uppercase text-[10px] text-[#666]">
                          Definir Ponto de Fundeio Manual:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-[#888]">Latitude:</label>
                            <input
                              type="text"
                              value={manualAnchorLat}
                              onChange={(e) => setManualAnchorLat(e.target.value)}
                              placeholder={vesselPosition[0].toFixed(5)}
                              className="w-full p-1 border border-black font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-[#888]">Longitude:</label>
                            <input
                              type="text"
                              value={manualAnchorLng}
                              onChange={(e) => setManualAnchorLng(e.target.value)}
                              placeholder={vesselPosition[1].toFixed(5)}
                              className="w-full p-1 border border-black font-mono text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="submit"
                            className="flex-1 bg-black text-white py-1 text-xs font-bold uppercase border border-black hover:bg-[#333] cursor-pointer"
                          >
                            Fixar Âncora
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setManualAnchorLat(vesselPosition[0].toFixed(5));
                              setManualAnchorLng(vesselPosition[1].toFixed(5));
                            }}
                            className="px-2 bg-white text-black py-1 text-[10px] font-bold uppercase border border-black hover:bg-[#eee] cursor-pointer"
                          >
                            Usar GPS Barco
                          </button>
                        </div>
                      </form>
                    )}

                    <button
                      onClick={() => maritimeAudio.playAnchorDragAlarm()}
                      className="w-full border-2 border-black bg-white hover:bg-[#eee] p-2 font-mono text-[11px] font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5 text-black"
                      title="Testar reprodução da sirene de alarme de garreio"
                    >
                      <BellRing className="w-3.5 h-3.5 text-[#d42020]" />
                      <span>TESTAR SIRENE SONORA (ALARME)</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Card de Status da Vigia Ativa */}
                    <div
                      className={`p-3.5 border-2 border-black font-mono text-xs shadow-[3px_3px_0px_#000] transition-colors ${
                        anchorStatus === 'alarm'
                          ? 'bg-[#fee2e2] border-[#d42020]'
                          : anchorStatus === 'warning'
                          ? 'bg-[#fef3c7] border-[#d97706]'
                          : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-black/20">
                        <div className="flex items-center gap-1.5 font-bold uppercase">
                          {anchorStatus === 'alarm' ? (
                            <ShieldAlert className="w-4 h-4 text-[#d42020] animate-bounce" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-[#008800]" />
                          )}
                          <span>STATUS:</span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] text-white ${
                              anchorStatus === 'alarm'
                                ? 'bg-[#d42020] animate-pulse font-black'
                                : anchorStatus === 'warning'
                                ? 'bg-[#d97706]'
                                : 'bg-[#008800]'
                            }`}
                          >
                            {anchorStatus === 'alarm' ? 'FORA DO RAIO (GARREANDO!)' : anchorStatus === 'warning' ? 'EM ATENÇÃO' : 'DENTRO DO RAIO (SEGURA)'}
                          </span>
                        </div>

                        <button
                          onClick={() => setIsAlarmSilenced(!isAlarmSilenced)}
                          className="text-[10px] uppercase font-bold flex items-center gap-1 text-[#444] hover:text-black cursor-pointer"
                          title={isAlarmSilenced ? 'Ativar som do alarme' : 'Silenciar som do alarme'}
                        >
                          {isAlarmSilenced ? <VolumeX className="w-3.5 h-3.5 text-[#d42020]" /> : <Volume2 className="w-3.5 h-3.5 text-[#008800]" />}
                          <span>{isAlarmSilenced ? 'MUTADO' : 'SOM ATIVO'}</span>
                        </button>
                      </div>

                      {/* Telemetria em Tempo Real */}
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[#666]">Distância da Âncora:</span>
                          <strong className={`tabular-nums text-sm ${anchorStatus === 'alarm' ? 'text-[#d42020] font-black' : 'text-black'}`}>
                            {currentAnchorDistance}m
                          </strong>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[#666]">Raio Limite Tolerado:</span>
                          <strong className="tabular-nums">{anchorRadius}m</strong>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[#666]">Marcação (Bearing):</span>
                          <strong className="tabular-nums">{bearingToAnchor}° ({degreesToCardinal(bearingToAnchor)})</strong>
                        </div>

                        {anchorPosition && (
                          <div className="text-[10px] text-[#666] pt-1 border-t border-black/10">
                            Ponto de Fundeio: {anchorPosition[0].toFixed(5)}°, {anchorPosition[1].toFixed(5)}°
                          </div>
                        )}

                        <div className="text-[10px] text-[#666]">
                          GPS do Barco: {vesselPosition[0].toFixed(5)}°, {vesselPosition[1].toFixed(5)}°
                        </div>

                        {gpsAccuracy !== null && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#666]">Precisão do GPS:</span>
                            <span className="font-bold text-[#008800]">±{gpsAccuracy}m</span>
                          </div>
                        )}

                        {anchorDroppedAt && (
                          <div className="flex items-center justify-between text-[10px] text-[#777] pt-1 border-t border-black/10">
                            <span>Fundeado às:</span>
                            <span>{new Date(anchorDroppedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                        )}
                      </div>

                      {/* Barra Visual de Proximidade do Raio */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span>BORNEIO:</span>
                          <span className={radiusPercentage > 100 ? 'text-[#d42020] font-black' : 'text-black'}>
                            {radiusPercentage}% DO LIMITE {radiusPercentage > 100 && '⚠️'}
                          </span>
                        </div>
                        <div className="w-full bg-[#ddd] h-2.5 border border-black overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              anchorStatus === 'alarm'
                                ? 'bg-[#d42020]'
                                : anchorStatus === 'warning'
                                ? 'bg-[#f59e0b]'
                                : 'bg-[#10b981]'
                            }`}
                            style={{ width: `${Math.min(100, radiusPercentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleSimulateDrag}
                        className="border-2 border-black bg-white hover:bg-[#fee2e2] text-[#d42020] p-2 font-mono text-[11px] font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>SIMULAR GARREIO</span>
                      </button>

                      <button
                        onClick={() => maritimeAudio.playAnchorDragAlarm()}
                        className="border-2 border-black bg-white hover:bg-[#eee] text-black p-2 font-mono text-[11px] font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <BellRing className="w-3.5 h-3.5 text-[#d42020]" />
                        <span>TOCAR ALARME</span>
                      </button>
                    </div>

                    {/* Botão de Encerrar Vigia / Levantar Âncora */}
                    <button
                      onClick={handleRaiseAnchor}
                      className="w-full border-2 border-black bg-white hover:bg-black hover:text-white text-black p-2.5 font-mono text-xs font-bold uppercase cursor-pointer transition-colors shadow-[2px_2px_0px_#000]"
                    >
                      LEVANTAR ÂNCORA (DESLIGAR VIGIA)
                    </button>
                  </div>
                )}

                {/* Recomendação Náutica de Amarra */}
                <div className="mt-2.5 p-2 bg-white border border-black text-[11px] font-mono text-[#555] leading-tight flex items-start gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-black shrink-0 mt-0.5" />
                  <div>
                    <span>Profundidade local com maré: <strong>{currentActualWaterDepth.toFixed(1)}m</strong>. </span>
                    <span>Recomendação de amarra 5:1 = <strong>~{recommendedRodeLength}m</strong> de corrente/cabo.</span>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: PLANEJADOR DE ROTAS & BATIMETRIA */}
            {activeSidebarTab === 'waypoints' && (
              <RoutePlanner
                routeWaypoints={routeWaypoints}
                onUpdateWaypoints={setRouteWaypoints}
                vessel={vessel}
                currentTideHeight={currentTideHeight}
                vesselPosition={vesselPosition}
                station={station}
                isDrawingMode={isDrawingRouteMode}
                onToggleDrawingMode={setIsDrawingRouteMode}
              />
            )}

            {/* ABA 3: CAMADAS CARTOGRÁFICAS */}
            {activeSidebarTab === 'layers' && (
              <div className="space-y-3 font-mono text-xs">
                <span className="block font-bold uppercase tracking-wider text-[#666] text-[11px]">
                  Sinalização Náutica & Relevo
                </span>
                <div className="space-y-2 font-bold bg-white p-3 border-2 border-black">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>Sinais Náuticos (OpenSeaMap)</span>
                    <input
                      type="checkbox"
                      checked={showSeamarks}
                      onChange={(e) => setShowSeamarks(e.target.checked)}
                      className="accent-black w-4 h-4 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>Pedras, Baixios e Naufrágios</span>
                    <input
                      type="checkbox"
                      checked={showHazards}
                      onChange={(e) => setShowHazards(e.target.checked)}
                      className="accent-black w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="p-2.5 bg-white border border-black text-[11px] text-[#666]">
                  A camada OpenSeaMap exibe bóias cardeais, faróis, balizas e perigos isolados catalogados pela comunidade hidrográfica internacional.
                </div>
              </div>
            )}

            {/* ABA 4: BÚSSOLA DIGITAL NÁUTICA (DEVICE ORIENTATION API) */}
            {activeSidebarTab === 'compass' && (
              <div className="space-y-3">
                <DigitalCompass
                  currentHeading={vesselHeading}
                  onHeadingChange={(h) => setVesselHeading(h)}
                  targetHeading={targetCourse}
                  onSetTargetHeading={setTargetCourse}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NauticalMapView;
