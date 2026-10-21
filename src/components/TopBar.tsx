import React, { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Download,
  Thermometer,
  BookOpen,
  Share2,
  Check,
  Moon,
  Sun,
  Compass,
  AlertOctagon,
  Waves,
  Navigation,
  Bell,
  ChevronDown,
  SlidersHorizontal,
  X,
  ExternalLink,
} from 'lucide-react';
import { TemperatureUnit } from '../types/tide';

export interface TopBarProps {
  activeTab: 'tides' | 'map' | 'logbook' | 'alerts' | 'offline' | 'converter';
  onSelectTab: (tab: 'tides' | 'map' | 'logbook' | 'alerts' | 'offline' | 'converter') => void;
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  onOpenDownloadModal: () => void;
  onOpenSOSModal: () => void;
  timeRange: 24 | 168;
  onToggleTimeRange: (range: 24 | 168) => void;
  tempUnit: TemperatureUnit;
  onToggleTempUnit: () => void;
  ongoingVoyagesCount?: number;
  activeAlertsCount?: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  isOfflineMode,
  onToggleOfflineMode,
  onOpenDownloadModal,
  onOpenSOSModal,
  timeRange,
  onToggleTimeRange,
  tempUnit,
  onToggleTempUnit,
  ongoingVoyagesCount = 0,
  activeAlertsCount = 0,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [copiedShare, setCopiedShare] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Fecha menu de ferramentas ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    if (isToolsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isToolsMenuOpen]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData: ShareData = {
      title: 'MaréSegura - Tábua de Marés e Navegação Offline',
      text: 'Confira as tábuas de marés em tempo real, curva astronômica, cartas náuticas e diário de navegação no MaréSegura!',
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        if (navigator.canShare && typeof fetch === 'function') {
          try {
            const imgRes = await fetch('/og-image.jpg');
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              const file = new File([blob], 'maresegura-thumb.jpg', { type: 'image/jpeg' });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                  ...shareData,
                  files: [file],
                });
                return;
              }
            }
          } catch {
            // Continua com shareData normal
          }
        }

        await navigator.share(shareData);
        return;
      } catch {
        // Fallback
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  // Mapeamento semântico dos módulos com agrupamento por tipo
  const TAB_DEFINITIONS = [
    {
      group: 'Navegação',
      items: [
        {
          id: 'tides' as const,
          label: 'Tábua de Marés',
          shortLabel: 'Tábua',
          icon: Waves,
          badge: null,
          pulse: false,
        },
        {
          id: 'map' as const,
          label: 'Carta Náutica & GPS',
          shortLabel: 'Carta & GPS',
          icon: Navigation,
          badge: null,
          pulse: false,
        },
      ],
    },
    {
      group: 'Instrumentos',
      items: [
        {
          id: 'logbook' as const,
          label: 'Diário de Bordo',
          shortLabel: 'Diário',
          icon: BookOpen,
          badge: ongoingVoyagesCount > 0 ? `${ongoingVoyagesCount} ativa` : null,
          pulse: ongoingVoyagesCount > 0,
        },
        {
          id: 'alerts' as const,
          label: 'Central de Alertas',
          shortLabel: 'Alertas',
          icon: Bell,
          badge: activeAlertsCount > 0 ? `${activeAlertsCount}` : null,
          pulse: activeAlertsCount > 0,
        },
        {
          id: 'converter' as const,
          label: 'Conversor Náutico',
          shortLabel: 'Conversor',
          icon: Compass,
          badge: null,
          pulse: false,
        },
      ],
    },
    {
      group: 'Sistema',
      items: [
        {
          id: 'offline' as const,
          label: 'Mapas Offline',
          shortLabel: 'Offline',
          icon: Download,
          badge: null,
          pulse: false,
        },
      ],
    },
  ];

  // Identifica o item atual para o Seletor Responsivo
  const currentTabItem = TAB_DEFINITIONS.flatMap((g) =>
    g.items.map((i) => ({ ...i, group: g.group }))
  ).find((i) => i.id === activeTab);

  return (
    <header className="border-b-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-40 transition-colors">
      {/* 1. BRAND ZONE (Logo + Título + Status Conexão) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('tides');
          }}
          aria-label="MaréSegura - Início"
          className="group flex items-center gap-2 hover:opacity-85 transition-opacity"
        >
          <div className="w-8 h-8 bg-black border-2 border-black dark:border-white flex items-center justify-center overflow-hidden shrink-0 shadow-[1px_1px_0px_#000]">
            <img
              src="/favicon.svg"
              alt="Logotipo MaréSegura"
              width={32}
              height={32}
              loading="eager"
              decoding="async"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#111111] dark:text-white uppercase m-0 leading-none">
              MaréSegura
            </h1>
            <span className="hidden sm:inline-block font-mono text-[9px] font-bold text-[#666] dark:text-[#8b949e] uppercase tracking-wider">
              {isOfflineMode ? 'Modo Offline Ativo' : 'Sistema Hidrográfico Online'}
            </span>
          </div>
        </a>
      </div>

      {/* 2. MENU NAVEGAÇÃO RESPONSIVO AGRUPADO POR TIPO */}
      <div className="flex-1 flex items-center justify-center max-w-3xl px-1">
        {/* A. VISÃO DESKTOP (Telas Grandes: Abas Agrupadas por Tipo em Linha Única) */}
        <nav
          className="hidden xl:flex items-center gap-2 bg-[#eeebe6] dark:bg-[#161b22] p-1 border-2 border-black dark:border-[#30363d]"
          aria-label="Navegação Principal Agrupada"
        >
          {TAB_DEFINITIONS.map((group, gIdx) => (
            <React.Fragment key={group.group}>
              {gIdx > 0 && (
                <div
                  className="w-[1.5px] h-5 bg-black/20 dark:bg-white/20 mx-0.5"
                  aria-hidden="true"
                />
              )}
              <div className="flex items-center gap-1">
                {group.items.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onSelectTab(tab.id)}
                      aria-label={`Aba ${tab.label}`}
                      aria-current={isActive ? 'page' : undefined}
                      className={`px-2.5 py-1 text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        isActive
                          ? 'bg-black text-white dark:bg-white dark:text-black shadow-[1px_1px_0px_#d42020]'
                          : 'bg-white dark:bg-[#21262d] text-black dark:text-white border border-black/30 dark:border-white/30 hover:bg-[#ddd] dark:hover:bg-[#30363d]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.shortLabel}</span>
                      {tab.badge && (
                        <span
                          className={`text-[9px] px-1 py-0.2 font-black ${
                            tab.pulse
                              ? 'bg-[#d42020] text-white animate-pulse'
                              : 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </nav>

        {/* B. VISÃO RESPONSIVA / COMPACTA (Mobile, Tablets e Telas Médias: SELECT TÁTICO AGRUPADO) */}
        <div className="xl:hidden w-full max-w-xs relative font-mono">
          <div className="relative flex items-center bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d] px-2.5 py-1.5">
            {/* Ícone e Indicador Visual da Aba Ativa */}
            <div className="flex items-center gap-2 flex-1 min-w-0 pr-6">
              {currentTabItem && (
                <>
                  <span className="text-[9px] font-black uppercase px-1 py-0.5 bg-black text-white dark:bg-white dark:text-black shrink-0">
                    {currentTabItem.group}
                  </span>
                  <span className="text-xs font-bold uppercase truncate text-black dark:text-white flex items-center gap-1.5">
                    <currentTabItem.icon className="w-3.5 h-3.5 text-[#d42020] shrink-0" />
                    <span className="truncate">{currentTabItem.label}</span>
                  </span>
                  {currentTabItem.badge && (
                    <span className="text-[9px] font-bold px-1 bg-[#d42020] text-white shrink-0">
                      {currentTabItem.badge}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Ícone Chevron Tático */}
            <ChevronDown className="w-4 h-4 text-black dark:text-white shrink-0 pointer-events-none absolute right-2.5" />

            {/* SELECT NATIVO TOTALMENTE AGRUPADO POR OPTGROUP */}
            <select
              value={activeTab}
              onChange={(e) => onSelectTab(e.target.value as any)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-mono"
              aria-label="Selecionar módulo da aplicação agrupado por categoria"
            >
              {TAB_DEFINITIONS.map((group) => (
                <optgroup key={group.group} label={`── ${group.group.toUpperCase()} ──`}>
                  {group.items.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label} {tab.badge ? `(${tab.badge})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. ACTIONS & QUICK TOOLS ZONE (Limpo, Alinhado e Sem Quebra de Linhas) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Toggle 24h / 7 Dias (Apenas quando a aba de Marés está ativa e tela ampla) */}
        {activeTab === 'tides' && (
          <div className="hidden 2xl:flex items-center border border-black dark:border-white p-0.5 bg-white dark:bg-[#161b22] text-xs font-mono font-bold">
            <button
              onClick={() => onToggleTimeRange(24)}
              className={`px-2 py-0.5 uppercase cursor-pointer ${
                timeRange === 24
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'text-black dark:text-white hover:bg-[#eee]'
              }`}
            >
              24h
            </button>
            <button
              onClick={() => onToggleTimeRange(168)}
              className={`px-2 py-0.5 uppercase cursor-pointer ${
                timeRange === 168
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'text-black dark:text-white hover:bg-[#eee]'
              }`}
            >
              7 Dias
            </button>
          </div>
        )}

        {/* Ferramentas em Linha para Desktop (lg+) */}
        <div className="hidden lg:flex items-center gap-1.5 font-mono text-xs font-bold">
          {/* Unidade °C / °F */}
          <button
            onClick={onToggleTempUnit}
            title="Alternar unidade (°C / °F)"
            aria-label="Alternar unidade entre Celsius e Fahrenheit"
            className="px-2 py-1.5 border-2 border-black dark:border-white bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#eee] dark:hover:bg-[#30363d] cursor-pointer flex items-center gap-1"
          >
            <Thermometer className="w-3.5 h-3.5 text-[#d42020]" />
            <span>{tempUnit === 'C' ? '°C' : '°F'}</span>
          </button>

          {/* Tema Diurno / Noturno */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Mudar para Modo Claro' : 'Ativar Modo Noturno Tático'}
            aria-label={isDarkMode ? 'Modo Claro' : 'Modo Noturno'}
            className="p-1.5 border-2 border-black dark:border-white bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#eee] dark:hover:bg-[#30363d] cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-900" />}
          </button>

          {/* Modo Offline Toggle */}
          <button
            onClick={onToggleOfflineMode}
            title="Simular teste de navegação sem sinal de internet"
            aria-label={isOfflineMode ? 'Desativar modo offline de teste' : 'Ativar modo offline de teste'}
            className={`px-2 py-1.5 border-2 border-black dark:border-white text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors ${
              isOfflineMode
                ? 'bg-[#d42020] text-white'
                : 'bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#eee] dark:hover:bg-[#30363d]'
            }`}
          >
            {isOfflineMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-emerald-600" />}
            <span className="hidden xl:inline">{isOfflineMode ? 'Sem Sinal' : 'Online'}</span>
          </button>

          {/* Compartilhar */}
          <button
            onClick={handleShare}
            title="Compartilhar link náutico"
            aria-label="Compartilhar link da página"
            className={`px-2.5 py-1.5 border-2 border-black dark:border-white text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors ${
              copiedShare
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#eee] dark:hover:bg-[#30363d]'
            }`}
          >
            {copiedShare ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden xl:inline">{copiedShare ? 'Copiado!' : 'Compartilhar'}</span>
          </button>

          {/* Baixar Mapas */}
          <button
            onClick={onOpenDownloadModal}
            title="Baixar pacotes de mapas e cartas náuticas offline"
            aria-label="Baixar cartas náuticas offline"
            className="px-2.5 py-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer hover:bg-[#333] dark:hover:bg-[#eee]"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Baixar Mapas</span>
          </button>
        </div>

        {/* MENU COMPACTO DE AJUSTES PARA MOBILE / TELAS MENORES (< lg) */}
        <div className="lg:hidden relative" ref={toolsMenuRef}>
          <button
            onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
            aria-label="Abrir menu de ajustes rápidos e configurações de bordo"
            aria-expanded={isToolsMenuOpen}
            className="p-1.5 border-2 border-black dark:border-white bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#eee] dark:hover:bg-[#30363d] cursor-pointer"
            title="Ajustes e Ferramentas de Bordo"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Popover Tático de Ferramentas Rápidas */}
          {isToolsMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#161b22] border-2 border-black dark:border-white p-3 font-mono text-xs shadow-[4px_4px_0px_#000] dark:shadow-[4px_4px_0px_#fff] z-50 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-black/20 dark:border-white/20">
                <span className="font-bold uppercase text-[10px] text-[#666] dark:text-[#8b949e]">
                  Ajustes Rápidos de Bordo
                </span>
                <button
                  onClick={() => setIsToolsMenuOpen(false)}
                  className="p-0.5 hover:bg-[#eee] dark:hover:bg-[#30363d] text-black dark:text-white cursor-pointer"
                  aria-label="Fechar menu de ferramentas"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Temperatura */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-[#d42020]" />
                  <span>Unidade Temp:</span>
                </span>
                <button
                  onClick={onToggleTempUnit}
                  className="px-2 py-0.5 border border-black dark:border-white font-bold"
                >
                  {tempUnit === 'C' ? '°C (Celsius)' : '°F (Fahrenheit)'}
                </button>
              </div>

              {/* Modo Noturno */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-900" />}
                  <span>Modo Visual:</span>
                </span>
                <button
                  onClick={onToggleDarkMode}
                  className="px-2 py-0.5 border border-black dark:border-white font-bold uppercase"
                >
                  {isDarkMode ? 'Noturno' : 'Diurno'}
                </button>
              </div>

              {/* Modo Offline */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {isOfflineMode ? <WifiOff className="w-3.5 h-3.5 text-[#d42020]" /> : <Wifi className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>Conexão:</span>
                </span>
                <button
                  onClick={onToggleOfflineMode}
                  className={`px-2 py-0.5 border border-black dark:border-white font-bold uppercase ${
                    isOfflineMode ? 'bg-[#d42020] text-white' : ''
                  }`}
                >
                  {isOfflineMode ? 'Sem Sinal' : 'Online'}
                </button>
              </div>

              {/* Compartilhar */}
              <button
                onClick={() => {
                  handleShare();
                  setIsToolsMenuOpen(false);
                }}
                className="w-full py-1.5 px-2 border border-black dark:border-white bg-[#f8f7f4] dark:bg-[#21262d] text-left font-bold uppercase flex items-center justify-between cursor-pointer hover:bg-[#eee]"
              >
                <span className="flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartilhar</span>
                </span>
                {copiedShare && <span className="text-[10px] text-emerald-600 font-bold">Copiado!</span>}
              </button>

              {/* Baixar Mapas */}
              <button
                onClick={() => {
                  onOpenDownloadModal();
                  setIsToolsMenuOpen(false);
                }}
                className="w-full py-1.5 px-2 bg-black text-white dark:bg-white dark:text-black font-bold uppercase flex items-center justify-between cursor-pointer hover:bg-[#333]"
              >
                <span className="flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Mapas</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* BOTÃO MESTRE DE EMERGÊNCIA: SINALIZAR SOS (Sempre visível com prioridade máxima) */}
        <button
          onClick={onOpenSOSModal}
          aria-label="Sinalizar SOS de Emergência Náutica e gerar coordenadas de resgate"
          title="Sinalizar socorro náutico de emergência com coordenadas GPS atuais e embarcação"
          className="px-2.5 sm:px-3 py-1.5 bg-[#d42020] hover:bg-[#b01010] text-white font-mono text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer border-2 border-black dark:border-white shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#fff] transition-colors shrink-0"
        >
          <AlertOctagon className="w-3.5 h-3.5 text-white animate-pulse" aria-hidden="true" />
          <span className="font-black tracking-wide">
            <span className="sm:inline">SOS</span>
            <span className="hidden sm:inline"> NÁUTICO</span>
          </span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
