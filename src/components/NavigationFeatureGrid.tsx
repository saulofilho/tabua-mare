import React from 'react';
import {
  Waves,
  Wind,
  Navigation,
  BellRing,
  BookOpen,
  Activity,
  Compass,
  Download,
  Ship,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Thermometer,
} from 'lucide-react';
import { CurrentTideStatus } from '../types/tide';
import { RealMarineConditions, formatTemperature } from '../services/realMarineApi';

export type NavTabId =
  | 'tides'
  | 'forecast'
  | 'map'
  | 'logbook'
  | 'alerts'
  | 'history'
  | 'converter'
  | 'offline';

interface NavigationFeatureGridProps {
  onNavigate: (tab: NavTabId) => void;
  onOpenVesselModal: () => void;
  status: CurrentTideStatus;
  marineConditions?: RealMarineConditions | null;
  activeAlertsCount: number;
  logbookEntriesCount: number;
  stationName: string;
  vesselName: string;
  vesselDraft: number;
  isOfflineMode: boolean;
}

export const NavigationFeatureGrid: React.FC<NavigationFeatureGridProps> = ({
  onNavigate,
  onOpenVesselModal,
  status,
  marineConditions,
  activeAlertsCount,
  logbookEntriesCount,
  stationName,
  vesselName,
  vesselDraft,
  isOfflineMode,
}) => {
  const waveHeight = marineConditions?.waveHeightMeters;
  const windKnots =
    marineConditions?.windSpeedKmH !== undefined
      ? Math.round(marineConditions.windSpeedKmH / 1.852)
      : undefined;
  const waveDir = marineConditions?.waveDirectionDegrees;

  const featureCards = [
    {
      id: 'forecast' as NavTabId,
      tag: 'Oceanografia & Meteorologia 24h',
      title: 'Previsão de Ondas & Rosa dos Ventos',
      desc: 'Gráficos de altura e período de ondas, telemetria do vento e Rosa dos Ventos interativa de 16 rumos.',
      icon: Wind,
      iconColor: 'text-[#0284c7]',
      liveMetric:
        waveHeight !== undefined && windKnots !== undefined
          ? `Ondas: ${waveHeight.toFixed(1)}m • Vento: ${windKnots} nós (${waveDir ?? 0}°)`
          : 'Telemetria 24h • Rosa dos Ventos',
      metricBadge: 'Telemetria 24h',
      ctaText: 'ABRIR PREVISÃO DE ONDAS & VENTOS',
      action: () => onNavigate('forecast'),
      primary: true,
    },
    {
      id: 'map' as NavTabId,
      tag: 'Cartografia Náutica (DHN) & GPS',
      title: 'Carta Náutica & Radar GNSS',
      desc: 'Visualização cartográfica com linhas batimétricas, balizamento marítimo, perigos e geocerca preventiva de 500m.',
      icon: Navigation,
      iconColor: 'text-[#16a34a]',
      liveMetric: isOfflineMode ? 'Modo Offline Ativo' : 'Posicionamento em Tempo Real',
      metricBadge: 'Geocerca 500m',
      ctaText: 'ABRIR CARTA NÁUTICA & GPS',
      action: () => onNavigate('map'),
      primary: true,
    },
    {
      id: 'alerts' as NavTabId,
      tag: 'Vigia Preventiva & Sirenes de Bordo',
      title: 'Central de Alertas & Toques Náuticos',
      desc: 'Monitoramento contínuo de baixa-mar e folga de quilha com seleção de toques: Sirene, Sino de Navio ou Buzina de Neblina.',
      icon: BellRing,
      iconColor: activeAlertsCount > 0 ? 'text-[#d42020]' : 'text-amber-500',
      liveMetric:
        activeAlertsCount > 0
          ? `${activeAlertsCount} ALERTA(S) DISPARADO(S)`
          : 'Vigia Ativa • Toques Náuticos Configurados',
      metricBadge: activeAlertsCount > 0 ? 'ATENÇÃO' : 'Segurança',
      ctaText: 'CONFIGURAR ALERTAS & SONS',
      action: () => onNavigate('alerts'),
      highlight: activeAlertsCount > 0,
    },
    {
      id: 'history' as NavTabId,
      tag: 'Análise Hidrográfica Comparativa',
      title: 'Histórico 24h (Real vs. Astronômica)',
      desc: 'Gráfico comparativo entre maré observada em tempo real e previsão astronômica da Marinha, além de histórico de 7 dias.',
      icon: Activity,
      iconColor: 'text-[#0284c7]',
      liveMetric: 'Últimas 24h • Curva Real vs. Astro',
      metricBadge: 'Recharts 24h',
      ctaText: 'VER HISTÓRICO COMPARATIVO',
      action: () => onNavigate('history'),
    },
    {
      id: 'logbook' as NavTabId,
      tag: 'Livro de Bordo Oficial',
      title: 'Diário de Navegação & Singraduras',
      desc: 'Registro oficial de travessias, waypoints, anotações de quarto e cálculo de folga de quilha.',
      icon: BookOpen,
      iconColor: 'text-indigo-600',
      liveMetric: `${logbookEntriesCount} registro(s) arquivado(s)`,
      metricBadge: 'Diário Oficial',
      ctaText: 'ACESSAR LIVRO DE BORDO',
      action: () => onNavigate('logbook'),
    },
    {
      id: 'converter' as NavTabId,
      tag: 'Instrumentação de Bordo',
      title: 'Calculadora & Conversor Náutico',
      desc: 'Conversão instantânea de nós, milhas náuticas, metros, braças, pés e pressão barométrica (hPa/mbar).',
      icon: Compass,
      iconColor: 'text-[#d97706]',
      liveMetric: 'Nós ↔ Km/h • MN ↔ Km • Braças',
      metricBadge: 'Ferramenta Rápida',
      ctaText: 'ABRIR CONVERSOR NÁUTICO',
      action: () => onNavigate('converter'),
    },
    {
      id: 'offline' as NavTabId,
      tag: 'Operação Sem Conexão',
      title: 'Gerenciador de Cartas Offline',
      desc: 'Download e gerenciamento de cartas náuticas em cache para navegação segura em zonas sem cobertura celular.',
      icon: Download,
      iconColor: 'text-emerald-600',
      liveMetric: isOfflineMode ? 'Cartas em Memória Local' : 'Armazenamento Offline Disponível',
      metricBadge: 'Zero Internet',
      ctaText: 'GERENCIAR MAPAS OFFLINE',
      action: () => onNavigate('offline'),
    },
    {
      id: 'vessel' as any,
      tag: 'Perfil da Embarcação & Calado',
      title: 'Embarcação & Margem de Quilha (UKC)',
      desc: `Ajuste calado (${vesselDraft.toFixed(2)}m), calado aéreo e margem de segurança sob a quilha para a embarcação ${vesselName}.`,
      icon: Ship,
      iconColor: 'text-black dark:text-white',
      liveMetric: `${vesselName} • Calado: ${vesselDraft.toFixed(2)}m`,
      metricBadge: 'Configuração',
      ctaText: 'AJUSTAR EMBARCAÇÃO',
      action: onOpenVesselModal,
    },
  ];

  return (
    <div className="border-t-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] p-4 sm:p-6 font-mono space-y-4">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black dark:border-[#30363d]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#888] dark:text-[#8b949e] block">
              Módulos de Navegação & Ferramentas de Bordo
            </span>
            <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-black text-white dark:bg-white dark:text-black">
              Carregamento Sob Demanda
            </span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold uppercase text-black dark:text-white mt-0.5">
            Recursos Especializados da Embarcação
          </h3>
          <p className="text-xs text-[#555] dark:text-[#8b949e] mt-1 max-w-2xl leading-relaxed">
            Selecione o módulo desejado abaixo para abrir sua página exclusiva. A tábua de marés permanece rápida e leve, carregando gráficos pesados apenas quando solicitados.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <span className="text-[10px] font-bold uppercase bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-2.5 py-1 text-black dark:text-white shadow-[1px_1px_0px_#000]">
            8 Recursos Prontos
          </span>
        </div>
      </div>

      {/* Grid de Cards Táticos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
        {featureCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`border-2 border-black dark:border-[#30363d] flex flex-col justify-between p-4 transition-all ${
                card.highlight
                  ? 'bg-[#fff5f5] dark:bg-[#2d1214] border-[#d42020] shadow-[3px_3px_0px_#d42020]'
                  : 'bg-white dark:bg-[#161b22] shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d] hover:translate-x-[-1px] hover:translate-y-[-1px]'
              }`}
            >
              <div>
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-black/10 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="p-2 border border-black dark:border-white bg-[#f8f7f4] dark:bg-[#0d1117] shrink-0">
                      <Icon className={`w-4 h-4 ${card.iconColor}`} />
                    </div>
                    <span className="text-[9px] font-black uppercase text-[#666] dark:text-[#8b949e] tracking-tight">
                      {card.tag}
                    </span>
                  </div>
                  <span
                    className={`text-[8px] font-black uppercase px-1.5 py-0.5 border border-black shrink-0 ${
                      card.highlight
                        ? 'bg-[#d42020] text-white'
                        : 'bg-[#eee] dark:bg-[#21262d] text-black dark:text-white'
                    }`}
                  >
                    {card.metricBadge}
                  </span>
                </div>

                {/* Título & Descrição */}
                <h4 className="font-display text-sm font-bold uppercase text-black dark:text-white mt-2.5 leading-snug">
                  {card.title}
                </h4>
                <p className="text-[11px] text-[#666] dark:text-[#8b949e] mt-1.5 leading-relaxed">
                  {card.desc}
                </p>

                {/* Métrica ao Vivo */}
                <div className="mt-3 pt-2 border-t border-dashed border-[#ccc] dark:border-[#30363d] text-[10px] text-[#444] dark:text-[#c9d1d9] flex items-center justify-between">
                  <span className="truncate font-semibold">{card.liveMetric}</span>
                </div>
              </div>

              {/* Botão de Ação Direta */}
              <button
                type="button"
                onClick={card.action}
                className={`w-full mt-3.5 py-2 px-3 text-[11px] font-bold uppercase border-2 border-black dark:border-white flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs active:translate-x-0.5 active:translate-y-0.5 ${
                  card.highlight
                    ? 'bg-[#d42020] text-white hover:bg-black'
                    : 'bg-black text-white hover:bg-[#333] dark:bg-white dark:text-black dark:hover:bg-[#eee]'
                }`}
              >
                <span>{card.ctaText}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NavigationFeatureGrid;
