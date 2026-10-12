import React, { useState } from 'react';
import { Wifi, WifiOff, Download, Thermometer, BookOpen, Share2, Check, Moon, Sun } from 'lucide-react';
import { TemperatureUnit } from '../types/tide';

interface TopBarProps {
  activeTab: 'tides' | 'map' | 'logbook' | 'alerts' | 'offline';
  onSelectTab: (tab: 'tides' | 'map' | 'logbook' | 'alerts' | 'offline') => void;
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  onOpenDownloadModal: () => void;
  timeRange: 24 | 168;
  onToggleTimeRange: (range: 24 | 168) => void;
  tempUnit: TemperatureUnit;
  onToggleTempUnit: () => void;
  ongoingVoyagesCount?: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
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
  ongoingVoyagesCount = 0,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: 'MaréSegura - Tábua de Marés e Navegação Offline',
      text: 'Confira as tábuas de marés em tempo real, curva astronômica, cartas náuticas e diário de navegação no MaréSegura!',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        // User cancelled or failed, fallback to copy
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };
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
          aria-label="MaréSegura - Início e Tábua de Marés"
          className="group flex items-center gap-2.5 hover:opacity-85 transition-opacity"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-black border-2 border-black flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
            <img
              src="/apple-touch-icon.png"
              alt="Logotipo MaréSegura"
              width={36}
              height={36}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] uppercase m-0 leading-none">
            MaréSegura
          </h1>
          <span className="hidden sm:inline-block font-mono text-[10px] font-bold border-2 border-black px-2 py-0.5 tracking-normal bg-white">
            {isOfflineMode ? 'MODO OFFLINE' : 'SISTEMA ONLINE'}
          </span>
        </a>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Navegação Principal">
        <button
          onClick={() => onSelectTab('tides')}
          aria-label="Aba Tábua de Marés"
          aria-current={activeTab === 'tides' ? 'page' : undefined}
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
          aria-label="Aba Mapa Náutico e GPS"
          aria-current={activeTab === 'map' ? 'page' : undefined}
          className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'bg-black text-[#f8f7f4]'
              : 'border-2 border-black bg-white text-black hover:bg-[#eeebe6]'
          }`}
        >
          Mapa Náutico & GPS
        </button>

        <button
          onClick={() => onSelectTab('logbook')}
          aria-label="Aba Diário de Navegação"
          aria-current={activeTab === 'logbook' ? 'page' : undefined}
          className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'logbook'
              ? 'bg-black text-[#f8f7f4]'
              : 'border-2 border-black bg-white text-black hover:bg-[#eeebe6]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-[#d42020]" aria-hidden="true" />
          <span>Diário de Navegação</span>
          {ongoingVoyagesCount > 0 && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5"
              title={`${ongoingVoyagesCount} viagem em curso`}
              aria-label={`${ongoingVoyagesCount} viagem em andamento`}
            />
          )}
        </button>

        <button
          onClick={() => onSelectTab('alerts')}
          aria-label="Aba Meus Alertas"
          aria-current={activeTab === 'alerts' ? 'page' : undefined}
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
          aria-label="Aba Mapas Offline"
          aria-current={activeTab === 'offline' ? 'page' : undefined}
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
          <div className="hidden md:flex items-center gap-1" role="group" aria-label="Intervalo de Previsão de Maré">
            <button
              onClick={() => onToggleTimeRange(24)}
              aria-label="Visualizar próximas 24 horas"
              aria-pressed={timeRange === 24}
              className={`px-2.5 py-1 font-mono text-xs font-bold uppercase border-2 border-black cursor-pointer transition-colors ${
                timeRange === 24 ? 'bg-black text-[#f8f7f4]' : 'bg-white text-black hover:bg-[#eeebe6]'
              }`}
            >
              24 Horas
            </button>
            <button
              onClick={() => onToggleTimeRange(168)}
              aria-label="Visualizar próximos 7 dias"
              aria-pressed={timeRange === 168}
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
          aria-label="Alternar unidade de temperatura entre Celsius (°C) e Fahrenheit (°F)"
          title="Alternar unidade entre Celsius (°C) e Fahrenheit (°F)"
          className="px-2.5 py-1.5 border-2 border-black bg-white hover:bg-[#eeebe6] text-black font-mono text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Thermometer className="w-3.5 h-3.5 text-[#d42020]" aria-hidden="true" />
          <span>
            <strong className={tempUnit === 'C' ? 'text-black underline' : 'text-[#888]'}>°C</strong>
            <span className="mx-0.5 text-[#aaa]">/</span>
            <strong className={tempUnit === 'F' ? 'text-black underline' : 'text-[#888]'}>°F</strong>
          </span>
        </button>

        {/* Tactical Dark Mode Toggle */}
        <button
          onClick={onToggleDarkMode}
          aria-label={isDarkMode ? 'Alternar para Modo Diurno Claro' : 'Ativar Modo Noturno Tático'}
          title={isDarkMode ? 'Alternar para Modo Diurno / Claro' : 'Ativar Modo Noturno / Inversão Tática de Alta Visibilidade'}
          className="px-2.5 py-1.5 border-2 border-black bg-white hover:bg-[#eeebe6] text-black font-mono text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          {isDarkMode ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span className="hidden sm:inline">Dia</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-900" aria-hidden="true" />
              <span className="hidden sm:inline">Noturno</span>
            </>
          )}
        </button>

        <button
          onClick={onToggleOfflineMode}
          aria-label={isOfflineMode ? 'Desativar modo offline de teste' : 'Ativar modo offline de teste'}
          title="Alternar entre modo online e teste offline sem sinal no mar"
          className="px-2.5 py-1.5 border-2 border-black bg-white hover:bg-[#eeebe6] text-black font-mono text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer"
        >
          {isOfflineMode ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-[#d42020]" aria-hidden="true" />
              <span className="hidden sm:inline">Modo Sem Sinal</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-[#008800]" aria-hidden="true" />
              <span className="hidden sm:inline">Conectado</span>
            </>
          )}
        </button>

        <button
          onClick={handleShare}
          aria-label="Compartilhar link do site com preview de imagem"
          title="Compartilhar link do site com imagem preview (WhatsApp, Telegram, Redes Sociais)"
          className={`px-3 py-1.5 border-2 border-black font-mono text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-colors ${
            copiedShare
              ? 'bg-[#008800] text-white border-[#008800]'
              : 'bg-white hover:bg-[#eeebe6] text-black'
          }`}
        >
          {copiedShare ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              <span>Link Copiado!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-[#111]" aria-hidden="true" />
              <span className="hidden sm:inline">Compartilhar</span>
            </>
          )}
        </button>

        <button
          onClick={onOpenDownloadModal}
          aria-label="Abrir modal para baixar cartas náuticas offline"
          className="px-3.5 py-1.5 bg-black hover:bg-[#333] text-[#f8f7f4] font-mono text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-none"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Baixar Mapas</span>
        </button>
      </div>
    </header>
  );
};
