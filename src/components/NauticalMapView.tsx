import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { NauticalHazard, TideStation, VesselProfile, Waypoint } from '../types/tide';
import { calculateUKC } from '../utils/tideHarmonics';
import {
  Anchor,
  Compass,
  Download,
  Layers,
  MapPin,
  Navigation,
  RotateCcw,
  Trash2,
  WifiOff,
} from 'lucide-react';

interface NauticalMapViewProps {
  station: TideStation;
  vessel: VesselProfile;
  currentTideHeight: number;
  isOfflineMode: boolean;
  onOpenDownloadModal: () => void;
}

export const NauticalMapView: React.FC<NauticalMapViewProps> = ({
  station,
  vessel,
  currentTideHeight,
  isOfflineMode,
  onOpenDownloadModal,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const vesselMarkerRef = useRef<L.Marker | null>(null);

  // Vessel state
  const [vesselPosition, setVesselPosition] = useState<[number, number]>([
    station.lat,
    station.lng,
  ]);
  const [vesselHeading, setVesselHeading] = useState<number>(45);
  const [vesselSpeed, setVesselSpeed] = useState<number>(6.2);
  const [isSimulatingCruise, setIsSimulatingCruise] = useState<boolean>(true);
  const [isLiveGPSActive, setIsLiveGPSActive] = useState<boolean>(false);

  // Route & Waypoints
  const [routeWaypoints, setRouteWaypoints] = useState<Waypoint[]>([
    {
      id: 'wp-1',
      name: 'WP1 - Canal de Acesso',
      lat: station.lat - 0.015,
      lng: station.lng - 0.012,
      chartedDepth: 14.5,
    },
    {
      id: 'wp-2',
      name: 'WP2 - Bóia de Meio Canal',
      lat: station.lat - 0.005,
      lng: station.lng - 0.008,
      chartedDepth: 8.2,
    },
    {
      id: 'wp-3',
      name: 'WP3 - Fondeadouro Principal',
      lat: station.lat + 0.008,
      lng: station.lng + 0.005,
      chartedDepth: 4.8,
    },
  ]);

  // Anchor Watch
  const [anchorWatchActive, setAnchorWatchActive] = useState<boolean>(false);
  const [anchorRadius, setAnchorRadius] = useState<number>(60);

  // Layer toggles
  const [showSeamarks, setShowSeamarks] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [station.lat, station.lng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Base tile layer
      const baseTiles = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 18,
          subdomains: 'abcd',
        }
      );
      baseTiles.addTo(map);

      // OpenSeaMap layer
      const seamarkTiles = L.tileLayer(
        'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        {
          maxZoom: 18,
          opacity: 0.9,
        }
      );
      seamarkTiles.addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      const routeGroup = L.layerGroup().addTo(map);

      markersLayerRef.current = markersGroup;
      routeLayerRef.current = routeGroup;
      mapInstanceRef.current = map;

      // Click to add waypoint
      map.on('click', (e: L.LeafletMouseEvent) => {
        setRouteWaypoints((prev) => {
          if (prev.length >= 8) return prev;
          const newWp: Waypoint = {
            id: `wp-${Date.now()}`,
            name: `WP${prev.length + 1}`,
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            chartedDepth: Math.max(1.8, Math.round((2.5 + Math.random() * 8) * 10) / 10),
          };
          return [...prev, newWp];
        });
      });
    } else {
      mapInstanceRef.current.setView([station.lat, station.lng], 13);
    }
  }, [station]);

  // Update Hazard Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const group = markersLayerRef.current;
    group.clearLayers();

    if (!showHazards) return;

    station.hazards.forEach((h) => {
      const actualD = Math.round((h.chartedDepth + currentTideHeight) * 10) / 10;
      const ukc = Math.round((actualD - vessel.draft) * 10) / 10;
      const isDangerous = ukc < 0.5;

      const iconHtml = `
        <div style="
          background: ${h.type === 'lighthouse' ? '#111111' : isDangerous ? '#d42020' : '#444444'};
          color: white;
          width: 26px;
          height: 26px;
          border: 2px solid #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: monospace;
          font-weight: bold;
          font-size: 11px;
          box-shadow: 2px 2px 0px #000000;
          cursor: pointer;
        ">
          ${h.type === 'lighthouse' ? 'FL' : h.type === 'rock' ? '▲' : '●'}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'tactical-hazard-pin',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([h.lat, h.lng], { icon: customIcon });

      const popupContent = `
        <div style="font-family: monospace; font-size: 11px; min-width: 170px;">
          <div style="font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">${h.name}</div>
          <div style="color: #666; font-size: 10px; margin-bottom: 6px;">${h.description}</div>
          <div style="border-top: 1px solid #000; padding-top: 4px;">
            <div>CHART_DATUM: <b>${h.chartedDepth.toFixed(1)}m</b></div>
            <div>ACTUAL_DEPTH: <b>${actualD.toFixed(1)}m</b></div>
            <div style="color: ${ukc < 0.5 ? '#d42020' : '#008800'}; font-weight: bold; margin-top: 2px;">
              UKC_CLEAR: ${ukc.toFixed(1)}m ${ukc < 0.5 ? '[CRITICAL]' : '[SAFE]'}
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      group.addLayer(marker);
    });
  }, [station, currentTideHeight, vessel.draft, showHazards]);

  // Update Route Polyline & Waypoint Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;
    const group = routeLayerRef.current;
    group.clearLayers();

    if (routeWaypoints.length === 0) return;

    const latlngs = routeWaypoints.map((wp) => [wp.lat, wp.lng] as [number, number]);

    const polyline = L.polyline(latlngs, {
      color: '#000000',
      weight: 3,
      dashArray: '6 4',
      opacity: 0.9,
    });
    group.addLayer(polyline);

    routeWaypoints.forEach((wp, index) => {
      const actualD = Math.round((wp.chartedDepth + currentTideHeight) * 10) / 10;
      const ukc = Math.round((actualD - vessel.draft) * 10) / 10;
      const isSafe = ukc >= vessel.safetyMargin;

      const wpIcon = L.divIcon({
        html: `
          <div style="
            background: ${isSafe ? '#111111' : '#d42020'};
            color: white;
            font-size: 10px;
            font-weight: bold;
            font-family: monospace;
            width: 20px;
            height: 20px;
            border: 2px solid #000000;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 2px 2px 0px #000;
          ">
            ${index + 1}
          </div>
        `,
        className: 'tactical-wp-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const wpMarker = L.marker([wp.lat, wp.lng], { icon: wpIcon });
      wpMarker.bindPopup(`
        <div style="font-family: monospace; font-size: 11px;">
          <b>${wp.name}</b><br/>
          CHART: ${wp.chartedDepth.toFixed(1)}m<br/>
          ACTUAL: <b>${actualD.toFixed(1)}m</b><br/>
          UKC: <b style="color:${isSafe ? '#008800' : '#d42020'}">${ukc.toFixed(1)}m</b>
        </div>
      `);
      group.addLayer(wpMarker);
    });
  }, [routeWaypoints, currentTideHeight, vessel.draft, vessel.safetyMargin]);

  // Simulation loop
  useEffect(() => {
    if (!isSimulatingCruise) return;

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
  }, [isSimulatingCruise, station]);

  // Live GPS Tracking Handler
  const handleToggleLiveGPS = () => {
    if (isLiveGPSActive) {
      setIsLiveGPSActive(false);
      setIsSimulatingCruise(true);
      return;
    }

    if (!('geolocation' in navigator)) {
      alert('Geolocalização não disponível no navegador.');
      return;
    }

    setIsSimulatingCruise(false);
    setIsLiveGPSActive(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, heading, speed } = pos.coords;
        setVesselPosition([latitude, longitude]);
        if (heading !== null && !isNaN(heading)) setVesselHeading(heading);
        if (speed !== null && !isNaN(speed)) {
          setVesselSpeed(Math.round(speed * 1.94384 * 10) / 10);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([latitude, longitude]);
        }
      },
      () => {
        setIsLiveGPSActive(false);
        setIsSimulatingCruise(true);
      },
      { enableHighAccuracy: true }
    );
  };

  // Vessel Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const vesselHtml = `
      <div style="transform: rotate(${vesselHeading}deg); transition: transform 0.4s ease;">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" fill="#ffffff" fill-opacity="0.8" stroke="#000000" stroke-width="2"/>
          <path d="M16 4 L24 24 L16 19 L8 24 Z" fill="#d42020" stroke="#000000" stroke-width="1.8"/>
        </svg>
      </div>
    `;

    const icon = L.divIcon({
      html: vesselHtml,
      className: 'tactical-vessel-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (vesselMarkerRef.current) {
      vesselMarkerRef.current.setLatLng(vesselPosition);
      vesselMarkerRef.current.setIcon(icon);
    } else {
      const marker = L.marker(vesselPosition, { icon, zIndexOffset: 1000 }).addTo(
        mapInstanceRef.current
      );
      vesselMarkerRef.current = marker;
    }
  }, [vesselPosition, vesselHeading]);

  const currentChartedSounding = 6.4;
  const currentActualWaterDepth = currentChartedSounding + currentTideHeight;
  const vesselUKC = currentActualWaterDepth - vessel.draft;

  // Route length in NM
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
      {/* Offline Alert Strip */}
      {isOfflineMode && (
        <div className="p-3 bg-[#eeebe6] border-b-2 border-black flex items-center justify-between gap-3 text-xs font-mono font-bold">
          <div className="flex items-center gap-2 text-black">
            <WifiOff className="w-4 h-4 text-[#d42020] shrink-0" />
            <span>TACTICAL OFFLINE CACHE ENGAGED // ZERO_NET OPERATION</span>
          </div>
          <button
            onClick={onOpenDownloadModal}
            className="border-2 border-black bg-white px-2 py-0.5 text-[10px] uppercase cursor-pointer hover:bg-black hover:text-white transition-colors"
          >
            MANAGE TILES
          </button>
        </div>
      )}

      {/* Main Grid: Map + Tactical Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 border-b-2 border-black">
        {/* Map Canvas (3 Columns) */}
        <div className="lg:col-span-3 border-b-2 lg:border-b-0 lg:border-r-2 border-black relative h-[600px] bg-[#e5e5df]">
          {/* Top Tactical HUD Ribbon */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2">
            <div className="bg-white border-2 border-black px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-black shadow-[2px_2px_0px_#000]">
              <Compass className="w-3.5 h-3.5" />
              <span>COG: <strong className="tabular-nums">{vesselHeading}°</strong></span>
              <span>|</span>
              <span>SOG: <strong className="tabular-nums">{vesselSpeed} KTS</strong></span>
            </div>

            <div className="bg-white border-2 border-black px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-black shadow-[2px_2px_0px_#000]">
              <Anchor className="w-3.5 h-3.5" />
              <span>DEPTH: <strong className="tabular-nums">{currentActualWaterDepth.toFixed(1)}M</strong></span>
              <span>|</span>
              <span>
                UKC:{' '}
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

          {/* Map Controls (Bottom Left) */}
          <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleLiveGPS}
              className={`px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors ${
                isLiveGPSActive ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#eeebe6]'
              }`}
            >
              {isLiveGPSActive ? 'LIVE GPS ACTIVE' : 'USE DEVICE GPS'}
            </button>

            <button
              onClick={() => setIsSimulatingCruise(!isSimulatingCruise)}
              className="px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black bg-white hover:bg-[#eeebe6] text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
            >
              {isSimulatingCruise ? 'PAUSE CRUISE' : 'RESUME CRUISE'}
            </button>

            <button
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView(vesselPosition, 14);
                }
              }}
              className="px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 border-black bg-white hover:bg-[#eeebe6] text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
            >
              CENTER BOAT
            </button>
          </div>

          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* Sidebar Controls (1 Column) */}
        <div className="p-5 bg-[#eeebe6] space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Route & Waypoint Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888]">
                  Tactical Route Log
                </span>
                <span className="font-mono text-xs font-bold text-black border border-black px-1.5 py-0.5 bg-white">
                  {totalRouteNM.toFixed(2)} NM
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {routeWaypoints.map((wp, index) => {
                  const actD = wp.chartedDepth + currentTideHeight;
                  const ukc = actD - vessel.draft;
                  const isSafe = ukc >= vessel.safetyMargin;

                  return (
                    <div
                      key={wp.id}
                      className="p-2 border-2 border-black bg-white text-xs font-mono flex items-center justify-between shadow-[2px_2px_0px_#000]"
                    >
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="bg-black text-white px-1 py-0.2 text-[10px]">
                            {index + 1}
                          </span>
                          <span className="truncate max-w-[130px]">{wp.name}</span>
                        </div>
                        <div className="text-[10px] text-[#888888] mt-0.5">
                          D: {actD.toFixed(1)}m · UKC:{' '}
                          <span className={isSafe ? 'text-[#008800] font-bold' : 'text-[#d42020] font-bold'}>
                            {ukc.toFixed(1)}m
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setRouteWaypoints(routeWaypoints.filter((w) => w.id !== wp.id))
                        }
                        className="text-black hover:text-[#d42020] p-1 cursor-pointer"
                        title="Remove waypoint"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setRouteWaypoints([])}
                className="mt-2 text-[10px] font-mono font-bold uppercase text-[#888888] hover:text-black underline cursor-pointer"
              >
                CLEAR ALL WAYPOINTS
              </button>
            </div>

            {/* Anchor Watch */}
            <div className="border-t-2 border-black pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888]">
                  Anchor Watch (Garreio)
                </span>
                <button
                  onClick={() => setAnchorWatchActive(!anchorWatchActive)}
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border border-black cursor-pointer uppercase ${
                    anchorWatchActive ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  {anchorWatchActive ? 'ARMED' : 'DISARMED'}
                </button>
              </div>

              <div className="font-mono text-xs text-black">
                RADIUS: <strong>{anchorRadius}M</strong>
              </div>
              <input
                type="range"
                min="20"
                max="150"
                step="5"
                value={anchorRadius}
                onChange={(e) => setAnchorRadius(Number(e.target.value))}
                className="w-full accent-black cursor-pointer mt-1"
              />
            </div>

            {/* Nautical Layers */}
            <div className="border-t-2 border-black pt-3 font-mono text-xs">
              <span className="block font-bold uppercase tracking-wider text-[#888888] mb-2 text-[11px]">
                Nautical Layers
              </span>
              <div className="space-y-1.5 font-bold">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>OpenSeaMap Seamarks</span>
                  <input
                    type="checkbox"
                    checked={showSeamarks}
                    onChange={(e) => setShowSeamarks(e.target.checked)}
                    className="accent-black"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Hazards & Rocks</span>
                  <input
                    type="checkbox"
                    checked={showHazards}
                    onChange={(e) => setShowHazards(e.target.checked)}
                    className="accent-black"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
