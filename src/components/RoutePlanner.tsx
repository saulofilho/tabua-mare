import React, { useState, useMemo } from 'react';
import {
  Waypoint,
  VesselProfile,
  TideStation,
} from '../types/tide';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Navigation,
  Compass,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  ArrowUpDown,
  Play,
  RotateCcw,
  Plus,
  Crosshair,
  Ship,
  Waves,
  MapPin,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

export interface RoutePlannerProps {
  routeWaypoints: Waypoint[];
  onUpdateWaypoints: (waypoints: Waypoint[]) => void;
  vessel: VesselProfile;
  currentTideHeight: number;
  vesselPosition: [number, number];
  station: TideStation;
  isDrawingMode: boolean;
  onToggleDrawingMode: (active: boolean) => void;
  isCompact?: boolean;
}

interface RouteLegCalculation {
  fromIndex: number;
  toIndex: number;
  fromName: string;
  toName: string;
  distanceNM: number;
  distanceKm: number;
  bearingDeg: number;
  bearingCardinal: string;
  eteMinutes: number;
  cumulativeDistNM: number;
  etaTimestamp: number;
  chartedDepth: number;
  actualDepth: number;
  ukc: number;
  depthStatus: 'safe' | 'warning' | 'critical';
}

// Cálculo geodésico de distância em metros (Fórmula de Haversine)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
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

// Cálculo de rumo verdadeiro em graus (0 - 360°)
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

function degreesToCardinal(deg: number): string {
  const cardinals = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'L',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSO',
    'SO',
    'OSO',
    'O',
    'ONO',
    'NO',
    'NNO',
  ];
  const idx = Math.round(deg / 22.5) % 16;
  return cardinals[idx];
}

function formatMinutesToHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hours === 0) return `${mins}min`;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

export const RoutePlanner: React.FC<RoutePlannerProps> = ({
  routeWaypoints,
  onUpdateWaypoints,
  vessel,
  currentTideHeight,
  vesselPosition,
  station,
  isDrawingMode,
  onToggleDrawingMode,
  isCompact = false,
}) => {
  // Velocidade planejada de cruzeiro (em nós)
  const [speedKnots, setSpeedKnots] = useState<number>(6.0);
  // Horário planejado de partida
  const [departureOffsetMinutes, setDepartureOffsetMinutes] = useState<number>(0);
  // Modo de visualização do perfil batimétrico
  const [showBathymetryChart, setShowBathymetryChart] = useState<boolean>(true);
  const [showLegTable, setShowLegTable] = useState<boolean>(true);

  // Presets rápidos de velocidade por tipo de embarcação
  const speedPresets = [
    { label: 'Veleiro (5.5 nós)', speed: 5.5 },
    { label: 'Traineira (7 nós)', speed: 7.0 },
    { label: 'Catamarã (8.5 nós)', speed: 8.5 },
    { label: 'Lancha (18 nós)', speed: 18.0 },
  ];

  // Cálculo da rota, pernadas, distâncias, ETA e pontos críticos de calado
  const {
    legs,
    totalDistanceNM,
    totalDistanceKm,
    totalDurationMinutes,
    departureTimestamp,
    finalEtaTimestamp,
    criticalPoints,
    warningPoints,
    minUKC,
    bathymetryData,
  } = useMemo(() => {
    const depTime = Date.now() + departureOffsetMinutes * 60 * 1000;
    const computedLegs: RouteLegCalculation[] = [];
    const chartPoints: Array<{
      name: string;
      distNM: number;
      actualDepth: number;
      draftLine: number;
      ukc: number;
      isCritical: boolean;
      status: string;
    }> = [];

    let cumDistMeters = 0;
    let cumMinutes = 0;
    let lowestUKC = 999;
    const critPts: Waypoint[] = [];
    const warnPts: Waypoint[] = [];

    routeWaypoints.forEach((wp, idx) => {
      const actD = Math.round((wp.chartedDepth + currentTideHeight) * 10) / 10;
      const ukc = Math.round((actD - vessel.draft) * 10) / 10;
      if (ukc < lowestUKC) lowestUKC = ukc;

      let depthStatus: 'safe' | 'warning' | 'critical' = 'safe';
      if (ukc < 0.4 || ukc < vessel.draft * 0.15) {
        depthStatus = 'critical';
        critPts.push(wp);
      } else if (ukc < vessel.safetyMargin) {
        depthStatus = 'warning';
        warnPts.push(wp);
      }

      if (idx > 0) {
        const prev = routeWaypoints[idx - 1];
        const distM = calculateDistanceMeters(prev.lat, prev.lng, wp.lat, wp.lng);
        const distNM = Math.round((distM / 1852) * 100) / 100;
        const distKm = Math.round((distM / 1000) * 10) / 10;
        const bearing = calculateBearing(prev.lat, prev.lng, wp.lat, wp.lng);

        cumDistMeters += distM;
        const legMinutes = speedKnots > 0 ? (distNM / speedKnots) * 60 : 0;
        cumMinutes += legMinutes;

        computedLegs.push({
          fromIndex: idx - 1,
          toIndex: idx,
          fromName: prev.name,
          toName: wp.name,
          distanceNM: distNM,
          distanceKm: distKm,
          bearingDeg: bearing,
          bearingCardinal: degreesToCardinal(bearing),
          eteMinutes: Math.round(legMinutes),
          cumulativeDistNM: Math.round((cumDistMeters / 1852) * 100) / 100,
          etaTimestamp: depTime + cumMinutes * 60 * 1000,
          chartedDepth: wp.chartedDepth,
          actualDepth: actD,
          ukc,
          depthStatus,
        });
      }

      // Pontos para o gráfico de perfil batimétrico
      chartPoints.push({
        name: `WP ${idx + 1}`,
        distNM: Math.round((cumDistMeters / 1852) * 10) / 10,
        actualDepth: actD,
        draftLine: vessel.draft,
        ukc,
        isCritical: depthStatus === 'critical',
        status: depthStatus === 'critical' ? 'CRÍTICO' : depthStatus === 'warning' ? 'ATENÇÃO' : 'SEGURO',
      });
    });

    const totNM = Math.round((cumDistMeters / 1852) * 100) / 100;
    const totKm = Math.round((cumDistMeters / 1000) * 10) / 10;
    const finalEta = depTime + cumMinutes * 60 * 1000;

    return {
      legs: computedLegs,
      totalDistanceNM: totNM,
      totalDistanceKm: totKm,
      totalDurationMinutes: Math.round(cumMinutes),
      departureTimestamp: depTime,
      finalEtaTimestamp: finalEta,
      criticalPoints: critPts,
      warningPoints: warnPts,
      minUKC: lowestUKC === 999 ? 0 : lowestUKC,
      bathymetryData: chartPoints,
    };
  }, [routeWaypoints, currentTideHeight, vessel.draft, vessel.safetyMargin, speedKnots, departureOffsetMinutes]);

  // Ações de gerenciamento de waypoints
  const handleAddVesselAsStart = () => {
    const newWp: Waypoint = {
      id: `wp-${Date.now()}`,
      name: 'Posição Atual do Barco',
      lat: vesselPosition[0],
      lng: vesselPosition[1],
      chartedDepth: 7.2,
    };
    onUpdateWaypoints([newWp, ...routeWaypoints]);
  };

  const handleReverseRoute = () => {
    const reversed = [...routeWaypoints].reverse().map((wp, idx) => ({
      ...wp,
      name: wp.name.replace(/Ponto \d+/, `Ponto ${idx + 1}`),
    }));
    onUpdateWaypoints(reversed);
  };

  const handleClearRoute = () => {
    onUpdateWaypoints([]);
  };

  const handleRemoveWaypoint = (id: string) => {
    onUpdateWaypoints(routeWaypoints.filter((w) => w.id !== id));
  };


  return (
    <div className="font-mono text-xs space-y-3">
      {/* Barra de Status e Ações de Desenho */}
      <div className="border-2 border-black bg-white p-3 shadow-[2px_2px_0px_#000] space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-black/20">
          <div className="flex items-center gap-1.5 font-bold uppercase">
            <Navigation className="w-4 h-4 text-[#d42020]" />
            <span className="font-display text-sm tracking-tight text-black">
              Planejador de Rotas & ETA
            </span>
          </div>

          <button
            onClick={() => onToggleDrawingMode(!isDrawingMode)}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase border-2 border-black cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs ${
              isDrawingMode
                ? 'bg-[#d42020] text-white animate-pulse'
                : 'bg-black text-white hover:bg-[#333]'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isDrawingMode ? 'Clique na Carta Ativo' : '+ Adicionar Waypoints'}</span>
          </button>
        </div>

        {/* Resumo da Rota: Distância Total, Tempo Estimado & ETA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="border border-black p-2 bg-[#f8f7f4]">
            <span className="block text-[10px] text-[#777] uppercase font-bold">Distância Total</span>
            <div className="font-display text-base font-black text-black tabular-nums">
              {totalDistanceNM.toFixed(2)} NM
            </div>
            <span className="text-[10px] text-[#555]">{totalDistanceKm.toFixed(1)} km</span>
          </div>

          <div className="border border-black p-2 bg-[#f8f7f4]">
            <span className="block text-[10px] text-[#777] uppercase font-bold">Tempo em Rota (ETE)</span>
            <div className="font-display text-base font-black text-black tabular-nums">
              {formatMinutesToHoursMinutes(totalDurationMinutes)}
            </div>
            <span className="text-[10px] text-[#555]">a {speedKnots} nós</span>
          </div>

          <div className="border border-black p-2 bg-[#f8f7f4]">
            <span className="block text-[10px] text-[#777] uppercase font-bold">Previsão Chegada (ETA)</span>
            <div className="font-display text-base font-black text-black tabular-nums">
              {routeWaypoints.length > 1
                ? new Date(finalEtaTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '--:--'}
            </div>
            <span className="text-[10px] text-[#555]">
              {routeWaypoints.length > 1 ? new Date(finalEtaTimestamp).toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : 'Sem rota'}
            </span>
          </div>

          <div
            className={`border border-black p-2 transition-colors ${
              criticalPoints.length > 0
                ? 'bg-[#fee2e2] text-[#d42020]'
                : warningPoints.length > 0
                ? 'bg-[#fef3c7] text-[#854d0e]'
                : 'bg-[#dcfce7] text-[#15803d]'
            }`}
          >
            <span className="block text-[10px] uppercase font-bold">Folga Mínima (UKC)</span>
            <div className="font-display text-base font-black tabular-nums">
              {minUKC > 0 ? `+${minUKC.toFixed(2)}m` : `${minUKC.toFixed(2)}m`}
            </div>
            <span className="text-[10px] font-bold uppercase">
              {criticalPoints.length > 0 ? '⚠️ RISCO ENCALHE' : warningPoints.length > 0 ? 'Atenção' : '✓ Água Segura'}
            </span>
          </div>
        </div>

        {/* ALERTA CRÍTICO DE CALADO SE DETECTADO PONTO RASO */}
        {criticalPoints.length > 0 && (
          <div className="bg-[#fee2e2] border-2 border-[#d42020] p-2.5 text-[#d42020] flex items-start gap-2 shadow-[2px_2px_0px_#000]">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <div className="font-bold uppercase text-[11px]">
                🚨 {criticalPoints.length} PONTO(S) CRÍTICO(S) DE CALADO DETECTADO(S)!
              </div>
              <p className="text-[10px] text-black mt-0.5 leading-snug">
                Trecho(s) com folga sob a quilha inferior a <strong>0.4m</strong> (Calado do barco: {vessel.draft}m). Risco de encalhe ou colisão com fundo arenoso/rochoso!
              </p>
            </div>
          </div>
        )}

        {/* Controles de Velocidade de Cruzeiro e Partida */}
        <div className="pt-2 border-t border-black/15 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold uppercase text-[#666]">Velocidade Planejada:</span>
            <input
              type="number"
              min="1"
              max="45"
              step="0.5"
              value={speedKnots}
              onChange={(e) => setSpeedKnots(Math.max(1, Number(e.target.value)))}
              className="w-14 px-1 py-0.5 border border-black font-mono font-bold text-center tabular-nums"
            />
            <span className="font-bold">Nós</span>

            <div className="hidden sm:flex items-center gap-1">
              {[5.5, 7, 8.5, 18].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeedKnots(s)}
                  className={`px-1.5 py-0.5 border border-black text-[9px] font-bold uppercase cursor-pointer ${
                    speedKnots === s ? 'bg-black text-white' : 'bg-white hover:bg-[#eee] text-black'
                  }`}
                >
                  {s}knt
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold uppercase text-[#666]">Partida:</span>
            <select
              value={departureOffsetMinutes}
              onChange={(e) => setDepartureOffsetMinutes(Number(e.target.value))}
              className="p-1 border border-black font-mono text-[10px] bg-white cursor-pointer font-bold"
            >
              <option value={0}>Partida Imediata (Agora)</option>
              <option value={30}>Em +30 minutos</option>
              <option value={60}>Em +1 hora</option>
              <option value={120}>Em +2 horas</option>
            </select>
          </div>
        </div>

        {/* Botões Rápidos de Manipulação de Waypoints */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
          <button
            onClick={handleAddVesselAsStart}
            className="p-1.5 border border-black bg-white hover:bg-[#eee] text-black font-bold uppercase text-[10px] flex items-center justify-center gap-1 cursor-pointer"
            title="Adiciona a posição do barco no GPS como Ponto 1"
          >
            <Ship className="w-3 h-3 text-[#0284c7]" />
            <span>Usar Barco Início</span>
          </button>

          <button
            onClick={handleReverseRoute}
            disabled={routeWaypoints.length < 2}
            className="p-1.5 border border-black bg-white hover:bg-[#eee] text-black font-bold uppercase text-[10px] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            title="Inverter a sequência de waypoints para rota de retorno"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>Inverter Rota</span>
          </button>

          <button
            onClick={handleClearRoute}
            disabled={routeWaypoints.length === 0}
            className="p-1.5 border border-black bg-white hover:bg-[#fee2e2] text-[#d42020] font-bold uppercase text-[10px] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3 h-3" />
            <span>Limpar Rota</span>
          </button>
        </div>
      </div>

      {/* GRÁFICO DO PERFIL BATIMÉTRICO / CORTE DE CALADO DA ROTA */}
      {routeWaypoints.length >= 2 && (
        <div className="border-2 border-black bg-white p-3 shadow-[2px_2px_0px_#000]">
          <div
            onClick={() => setShowBathymetryChart(!showBathymetryChart)}
            className="flex items-center justify-between cursor-pointer pb-2 border-b border-black/20"
          >
            <div className="flex items-center gap-1.5 font-bold uppercase text-xs">
              <Waves className="w-3.5 h-3.5 text-[#0284c7]" />
              <span>Perfil Batimétrico de Calado ao Longo da Rota</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#666]">
              <span>{showBathymetryChart ? 'Recolher' : 'Expandir'}</span>
              {showBathymetryChart ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>

          {showBathymetryChart && (
            <div className="pt-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[#666] mb-1">
                <span>Corte do Fundo Marinho (Profundidade Total) vs Calado ({vessel.draft}m)</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-[#0284c7] inline-block" />
                    Fundo d'Água
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-[#d42020] inline-block border-t border-dashed" />
                    Quilha ({vessel.draft}m)
                  </span>
                </div>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={bathymetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                    <YAxis
                      domain={[0, (max: number) => Math.max(8, Math.ceil(max + 2))]}
                      tick={{ fontSize: 9, fontFamily: 'monospace' }}
                      tickFormatter={(v) => `${v}m`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-black text-white p-2 border-2 border-white text-[10px] font-mono shadow-[2px_2px_0px_#000]">
                            <div className="font-bold uppercase text-[#d42020] mb-0.5">
                              {data.name} ({data.distNM} NM)
                            </div>
                            <div>Profundidade Real: <b>{data.actualDepth}m</b></div>
                            <div>Calado do Barco: <b>{data.draftLine}m</b></div>
                            <div className={`font-bold ${data.isCritical ? 'text-[#ef4444]' : 'text-emerald-400'}`}>
                              Folga sob Quilha: +{data.ukc}m [{data.status}]
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      y={vessel.draft}
                      stroke="#d42020"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: `Quilha (${vessel.draft}m)`, fill: '#d42020', fontSize: 9, position: 'insideTopLeft' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="actualDepth"
                      fill="#0284c7"
                      fillOpacity={0.3}
                      stroke="#0284c7"
                      strokeWidth={2}
                      name="Profundidade Real"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LISTA DETALHADA DE PERNADAS & WAYPOINTS (TABELA DE NAVEGAÇÃO) */}
      <div className="border-2 border-black bg-white p-3 shadow-[2px_2px_0px_#000]">
        <div
          onClick={() => setShowLegTable(!showLegTable)}
          className="flex items-center justify-between cursor-pointer pb-2 border-b border-black/20"
        >
          <div className="flex items-center gap-1.5 font-bold uppercase text-xs">
            <Compass className="w-3.5 h-3.5 text-[#15803d]" />
            <span>Tabela de Navegação por Pernada ({legs.length} Trechos)</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#666]">
            <span>{showLegTable ? 'Recolher' : 'Expandir'}</span>
            {showLegTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </div>

        {showLegTable && (
          <div className="pt-2 space-y-2">
            {legs.length === 0 ? (
              <div className="p-3 text-center text-[#888] text-[11px]">
                Adicione pelo menos 2 waypoints para gerar as pernadas de navegação e horários estimados de chegada (ETA).
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {legs.map((leg) => (
                  <div
                    key={`${leg.fromIndex}-${leg.toIndex}`}
                    className={`p-2 border-2 border-black text-[11px] font-mono flex items-center justify-between shadow-xs ${
                      leg.depthStatus === 'critical'
                        ? 'bg-[#fee2e2] border-[#d42020]'
                        : leg.depthStatus === 'warning'
                        ? 'bg-[#fef3c7] border-[#d97706]'
                        : 'bg-white'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5 text-black">
                        <span className="bg-black text-white px-1 py-0.2 text-[9px]">
                          TRECHO {leg.toIndex}
                        </span>
                        <span className="truncate max-w-[150px]">
                          {leg.fromName} → {leg.toName}
                        </span>
                      </div>

                      <div className="text-[10px] text-[#555] mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>
                          Rumo: <strong>{leg.bearingDeg}° ({leg.bearingCardinal})</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Dist: <strong>{leg.distanceNM} NM</strong>
                        </span>
                        <span>•</span>
                        <span>
                          ETE: <strong>{leg.eteMinutes}m</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-black tabular-nums text-xs">
                        ETA: {new Date(leg.etaTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          leg.depthStatus === 'critical'
                            ? 'text-[#d42020]'
                            : leg.depthStatus === 'warning'
                            ? 'text-[#d97706]'
                            : 'text-[#15803d]'
                        }`}
                      >
                        UKC: +{leg.ukc.toFixed(1)}m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoutePlanner;
