import React from 'react';
import { Wifi, WifiOff, Download, Thermometer } from 'lucide-react';
import { TemperatureUnit } from '../types/tide';

interface TopBarProps {
  activeTab: 'tides' | 'map' | 'alerts' | 'offline';
  onSelectTab: (tab: 'tides' | 'map' | 'alerts' | 'offline') => void;
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  onOpenDownloadModal: () => void;
  timeRange: 24 | 168;
  onToggleTimeRange: (range: 24 | 168) => void;
  tempUnit: TemperatureUnit;
  onToggleTempUnit: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  isOfflineMode,
  onToggleOfflineMode,
  onOpenDownloadModal,
  timeRange,
  onToggleTimeRange,
  tempUnit,
  onToggleTempUnit,
}) => {
  return (
    <header className="border-b-2 border-black bg-[#f8f7f4] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
      {/* Brand Zone */}
      <div className="flex items-center gap-3">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('tides');
          }}
          className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] uppercase flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span>MaréSegura</span>
          <span className="font-mono text-[10px] font-bold border-2 border-black px-2 py-0.5 tracking-normal bg-white">
            {isOfflineMode ? 'MODO OFFLINE' : 'SISTEMA ONLINE'}
          </span>
        </a>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => onSelectTab('tides')}
          className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all cursor-pointer ${
            activeTab === 'tides'
              ? 'bg-black text-[#f8f7f4]'
              : 'border-2 border-black bg-white text-black hover:bg-[#eeebe6]'
          }`}
        >
          Tábua de Marés
        </button>

        <button
          onClick={() => onSelectTab('map')}
          className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'bg-black text-[#f8f7f4]'
              : 'border-2 border-black bg-white text-black hover:bg-[#eeebe6]'
          }`}
        >
          Mapa Náutico & GPS
        </button>

        <button
          onClick={() => onSelectTab('alerts')}
          className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all cursor-pointer ${
            activeTab === 'alerts'
              ? 'bg-black text-[#f8f7f4]'
              : 'border-2 border-black bg-white text-black hover:bg-[#eeebe6]'
          }`}
        >
          Meus Alertas
        </button>

        <button
          onClick={() => onSelectTab('offline')}
          className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all cursor-pointer ${
            activeTab === 'offline'
              ? 'bg-black text-[#f8f7f4]'
              : 'border-2 border-black bg-white text-black hover:bg-[#eeebe6]'
          }`}
        >
          Mapas Offline
        </button>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {activeTab === 'tides' && (
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onToggleTimeRange(24)}
              className={`px-2.5 py-1 font-mono text-xs font-bold uppercase border-2 border-black cursor-pointer transition-colors ${
                timeRange === 24 ? 'bg-black text-[#f8f7f4]' : 'bg-white text-black hover:bg-[#eeebe6]'
              }`}
            >
              24 Horas
            </button>
            <button
              onClick={() => onToggleTimeRange(168)}
              className={`px-2.5 py-1 font-mono text-xs font-bold uppercase border-2 border-black cursor-pointer transition-colors ${
                timeRange === 168 ? 'bg-black text-[#f8f7f4]' : 'bg-white text-black hover:bg-[#eeebe6]'
              }`}
            >
              Próximos 7 Dias
            </button>
          </div>
        )}

        <button
          onClick={onToggleTempUnit}
          title="Alternar unidade entre Celsius (°C) e Fahrenheit (°F)"
          className="px-2.5 py-1.5 border-2 border-black bg-white hover:bg-[#eeebe6] text-black font-mono text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Thermometer className="w-3.5 h-3.5 text-[#d42020]" />
          <span>
            <strong className={tempUnit === 'C' ? 'text-black underline' : 'text-[#888]'}>°C</strong>
            <span className="mx-0.5 text-[#aaa]">/</span>
            <strong className={tempUnit === 'F' ? 'text-black underline' : 'text-[#888]'}>°F</strong>
          </span>
        </button>

        <button
          onClick={onToggleOfflineMode}
          title="Alternar entre modo online e teste offline sem sinal no mar"
          className="px-2.5 py-1.5 border-2 border-black bg-white hover:bg-[#eeebe6] text-black font-mono text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer"
        >
          {isOfflineMode ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-[#d42020]" />
              <span className="hidden sm:inline">Modo Sem Sinal</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-[#008800]" />
              <span className="hidden sm:inline">Conectado</span>
            </>
          )}
        </button>

        <button
          onClick={onOpenDownloadModal}
          className="px-3.5 py-1.5 bg-black hover:bg-[#333] text-[#f8f7f4] font-mono text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-none"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Baixar Mapas</span>
        </button>
      </div>
    </header>
  );
};
