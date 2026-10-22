import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TideStation, VesselProfile, Waypoint } from '../types/tide';

export interface LeafletNauticalMapProps {
  station: TideStation;
  vessel: VesselProfile;
  currentTideHeight: number;
  vesselPosition: [number, number];
  vesselHeading: number;
  routeWaypoints: Waypoint[];
  onMapClickAddWaypoint: (wp: Waypoint) => void;
  showHazards: boolean;
  showSeamarks: boolean;
  anchorWatchActive: boolean;
  anchorPosition: [number, number] | null;
  anchorRadius: number;
  anchorStatus: 'safe' | 'warning' | 'alarm';
  driftTrail: Array<{ lat: number; lng: number }>;
  isSettingAnchorByClick?: boolean;
  onMapClickSetAnchor?: (pos: [number, number]) => void;
}

export const LeafletNauticalMap: React.FC<LeafletNauticalMapProps> = ({
  station,
  vessel,
  currentTideHeight,
  vesselPosition,
  vesselHeading,
  routeWaypoints,
  onMapClickAddWaypoint,
  showHazards,
  showSeamarks,
  anchorWatchActive,
  anchorPosition,
  anchorRadius,
  anchorStatus,
  driftTrail,
  isSettingAnchorByClick = false,
  onMapClickSetAnchor,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const seamarksLayerRef = useRef<L.TileLayer | null>(null);
  const anchorLayerRef = useRef<L.LayerGroup | null>(null);
  const vesselMarkerRef = useRef<L.Marker | null>(null);

  // Refs para manter valores atualizados dentro de listeners do Leaflet
  const isSettingAnchorRef = useRef(isSettingAnchorByClick);
  isSettingAnchorRef.current = isSettingAnchorByClick;

  const onMapClickSetAnchorRef = useRef(onMapClickSetAnchor);
  onMapClickSetAnchorRef.current = onMapClickSetAnchor;

  const onMapClickAddWaypointRef = useRef(onMapClickAddWaypoint);
  onMapClickAddWaypointRef.current = onMapClickAddWaypoint;

  const routeWaypointsCountRef = useRef(routeWaypoints.length);
  routeWaypointsCountRef.current = routeWaypoints.length;

  // Inicializar o Mapa Leaflet
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

      // Camada base cartográfica
      const baseTiles = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 18,
          subdomains: 'abcd',
        }
      );
      baseTiles.addTo(map);

      // Camada de sinalização náutica OpenSeaMap (bóias, faróis, balizas)
      const seamarkTiles = L.tileLayer(
        'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        {
          maxZoom: 18,
          opacity: 0.9,
        }
      );
      if (showSeamarks) {
        seamarkTiles.addTo(map);
      }
      seamarksLayerRef.current = seamarkTiles;

      const markersGroup = L.layerGroup().addTo(map);
      const routeGroup = L.layerGroup().addTo(map);
      const anchorGroup = L.layerGroup().addTo(map);

      markersLayerRef.current = markersGroup;
      routeLayerRef.current = routeGroup;
      anchorLayerRef.current = anchorGroup;
      mapInstanceRef.current = map;

      // Clique no mapa: se estiver no modo de definir âncora, define o ponto de fundeio; senão, adiciona waypoint
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (isSettingAnchorRef.current && onMapClickSetAnchorRef.current) {
          onMapClickSetAnchorRef.current([e.latlng.lat, e.latlng.lng]);
          return;
        }

        const newWp: Waypoint = {
          id: `wp-${Date.now()}`,
          name: `Ponto ${routeWaypointsCountRef.current + 1}`,
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          chartedDepth: Math.max(1.8, Math.round((2.5 + Math.random() * 8) * 10) / 10),
        };
        onMapClickAddWaypointRef.current(newWp);
      });
    } else {
      mapInstanceRef.current.setView([station.lat, station.lng], 13);
    }
  }, [station]);

  // Alternar camada de sinalização náutica OpenSeaMap
  useEffect(() => {
    if (!mapInstanceRef.current || !seamarksLayerRef.current) return;
    if (showSeamarks) {
      if (!mapInstanceRef.current.hasLayer(seamarksLayerRef.current)) {
        seamarksLayerRef.current.addTo(mapInstanceRef.current);
      }
    } else {
      if (mapInstanceRef.current.hasLayer(seamarksLayerRef.current)) {
        mapInstanceRef.current.removeLayer(seamarksLayerRef.current);
      }
    }
  }, [showSeamarks]);

  // Limpeza de recursos e instâncias do Leaflet ao desmontar
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        routeLayerRef.current = null;
        seamarksLayerRef.current = null;
        anchorLayerRef.current = null;
        vesselMarkerRef.current = null;
      }
    };
  }, []);

  // Marcadores de Perigos Náuticos (Pedras, baixios e faróis)
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
        <div style="font-family: monospace; font-size: 11px; min-width: 180px;">
          <div style="font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">${h.name}</div>
          <div style="color: #666; font-size: 10px; margin-bottom: 6px;">${h.description}</div>
          <div style="border-top: 1px solid #000; padding-top: 4px;">
            <div>PROF. NA CARTA: <b>${h.chartedDepth.toFixed(1)}m</b></div>
            <div>PROF. REAL COM MARÉ: <b>${actualD.toFixed(1)}m</b></div>
            <div style="color: ${ukc < 0.5 ? '#d42020' : '#008800'}; font-weight: bold; margin-top: 2px;">
              ESPAÇO SOB A QUILHA: ${ukc.toFixed(1)}m ${ukc < 0.5 ? '[ÁGUA RASA / PERIGO]' : '[ÁGUA SEGURA]'}
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      group.addLayer(marker);

      // Círculo de Geocerca de Segurança Náutica (Perímetro de 500 metros)
      const geofenceCircle = L.circle([h.lat, h.lng], {
        radius: 500, // 500 metros de raio de geocerca
        color: '#d42020',
        weight: 1.5,
        dashArray: '5, 5',
        fillColor: '#d42020',
        fillOpacity: 0.08,
      });
      geofenceCircle.bindTooltip(
        `🚨 Geocerca de Perigo (500m): ${h.name} [Prof: ${h.chartedDepth.toFixed(1)}m]`,
        { sticky: true }
      );
      group.addLayer(geofenceCircle);
    });
  }, [station, currentTideHeight, vessel.draft, showHazards]);

  // Atualizar Traçado da Rota e Pontos
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
          Prof. Carta: ${wp.chartedDepth.toFixed(1)}m<br/>
          Prof. Real com Maré: <b>${actualD.toFixed(1)}m</b><br/>
          Folga sob o Casco: <b style="color:${isSafe ? '#008800' : '#d42020'}">${ukc.toFixed(1)}m</b>
        </div>
      `);
      group.addLayer(wpMarker);
    });
  }, [routeWaypoints, currentTideHeight, vessel.draft, vessel.safetyMargin]);

  // Vigia de Âncora (Anchor Watch Layer: Ponto fixo, círculo de segurança, cabo e rastro de borneio)
  useEffect(() => {
    if (!mapInstanceRef.current || !anchorLayerRef.current) return;
    const group = anchorLayerRef.current;
    group.clearLayers();

    if (!anchorWatchActive) return;

    // Ponto fixo da âncora no fundo marinho
    const fixedAnchorPoint = anchorPosition || vesselPosition;

    // 1. Círculo de segurança do raio de borneio
    const circleColor =
      anchorStatus === 'alarm' ? '#d42020' : anchorStatus === 'warning' ? '#d97706' : '#008800';
    const circleFill =
      anchorStatus === 'alarm' ? '#ef4444' : anchorStatus === 'warning' ? '#f59e0b' : '#10b981';
    const circleFillOpacity = anchorStatus === 'alarm' ? 0.28 : anchorStatus === 'warning' ? 0.18 : 0.12;

    const circle = L.circle(fixedAnchorPoint, {
      radius: anchorRadius,
      color: circleColor,
      fillColor: circleFill,
      fillOpacity: circleFillOpacity,
      weight: anchorStatus === 'alarm' ? 3.5 : 2.5,
      dashArray: anchorStatus === 'alarm' ? '3 3' : '6 4',
    });
    group.addLayer(circle);

    // 2. Marcador visual da Âncora no leito marinho
    const anchorIconHtml = `
      <div style="
        background: #111111;
        color: #ffffff;
        width: 32px;
        height: 32px;
        border: 2px solid ${anchorStatus === 'alarm' ? '#d42020' : '#ffffff'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 2px 2px 0px #000000;
        cursor: pointer;
      ">
        ⚓
      </div>
    `;

    const anchorIcon = L.divIcon({
      html: anchorIconHtml,
      className: 'tactical-anchor-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const anchorMarker = L.marker(fixedAnchorPoint, { icon: anchorIcon });
    anchorMarker.bindPopup(`
      <div style="font-family: monospace; font-size: 11px; min-width: 170px;">
        <div style="font-weight: bold; text-transform: uppercase;">⚓ PONTO FIXO DA ÂNCORA</div>
        <div style="color: #666; font-size: 10px; margin-top: 2px;">
          LAT: ${fixedAnchorPoint[0].toFixed(5)}<br/>
          LNG: ${fixedAnchorPoint[1].toFixed(5)}
        </div>
        <div style="border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
          RAIO DE BORNEIO: <b>${anchorRadius} METROS</b>
        </div>
      </div>
    `);
    group.addLayer(anchorMarker);

    // 3. Linha de amarra (cabo/corrente do barco até a âncora)
    const rodeLine = L.polyline([fixedAnchorPoint, vesselPosition], {
      color: anchorStatus === 'alarm' ? '#d42020' : '#333333',
      weight: 2,
      dashArray: '3 4',
      opacity: 0.85,
    });
    group.addLayer(rodeLine);

    // 4. Rastro de borneio (drift trail) da embarcação ao redor da âncora
    if (driftTrail && driftTrail.length > 1) {
      const trailPoints = driftTrail.map((p) => [p.lat, p.lng] as [number, number]);
      const trailLine = L.polyline(trailPoints, {
        color: '#0284c7',
        weight: 2,
        opacity: 0.65,
      });
      group.addLayer(trailLine);
    }
  }, [anchorWatchActive, anchorPosition, anchorRadius, anchorStatus, vesselPosition, driftTrail]);

  // Marcador do Barco com Direção da Proa
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const vesselHtml = `
      <div style="transform: rotate(${vesselHeading}deg); transition: transform 0.4s ease;">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" fill="#ffffff" fill-opacity="0.8" stroke="#000000" stroke-width="2"/>
          <path d="M16 4 L24 24 L16 19 L8 24 Z" fill="${anchorStatus === 'alarm' ? '#d42020' : '#111111'}" stroke="#000000" stroke-width="1.8"/>
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
  }, [vesselPosition, vesselHeading, anchorStatus]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
};

export default LeafletNauticalMap;
