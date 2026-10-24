import React, { useState, useEffect } from 'react';
import {
  ActiveAlertNotification,
  AlertType,
  CurrentTideStatus,
  TideAlertRule,
  VesselProfile,
  TideStation,
  NauticalHazard,
} from '../types/tide';
import { maritimeAudio } from '../utils/audioAlerts';
import {
  alertNotificationService,
  NotificationSettings,
} from '../services/alertNotificationService';
import { calculateDistanceMeters } from '../services/realMarineApi';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Info,
  Radio,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  Smartphone,
  Zap,
  Loader2,
  Compass,
  Navigation,
  RotateCcw,
  BatteryCharging,
  BatteryMedium,
  Gauge,
  Music,
  Check,
  Play,
  Sliders,
} from 'lucide-react';

export interface MaritimeRingtoneOption {
  id: 'danger' | 'shipbell' | 'foghorn' | 'sonar';
  name: string;
  shortName: string;
  icon: string;
  badge: string;
  description: string;
  recommendedFor: string;
  frequency: string;
}

export const NAUTICAL_RINGTONES: MaritimeRingtoneOption[] = [
  {
    id: 'danger',
    name: 'Sirene de Emergência',
    shortName: 'Sirene',
    icon: '🚨',
    badge: 'Urgência Crítica',
    description: 'Pulsos rápidos de 880Hz em onda quadrada de alta intensidade para emergência de encalhe',
    recommendedFor: 'Baixa-mar crítica, folga nula de quilha e perigos imediatos',
    frequency: '880 Hz (A5)',
  },
  {
    id: 'shipbell',
    name: 'Sino de Navio',
    shortName: 'Sino de Navio',
    icon: '🔔',
    badge: 'Tradição Náutica',
    description: 'Dupla badalada de sino de bronze naval com rica ressonância harmônica',
    recommendedFor: 'Marés de sizígia, mudança de quarto de vigia e avisos operacionais',
    frequency: '840 - 3150 Hz',
  },
  {
    id: 'foghorn',
    name: 'Buzina de Neblina',
    shortName: 'Buzina de Neblina',
    icon: '📯',
    badge: 'Baixa Visibilidade',
    description: 'Tom grave de 120Hz em dente-de-serra simulando buzina de navio em nevoeiro costeiro',
    recommendedFor: 'Ventos fortes, cerração marítima e correntezas violentas',
    frequency: '120 Hz (Grave)',
  },
  {
    id: 'sonar',
    name: 'Sonar Náutico',
    shortName: 'Sonar',
    icon: '📡',
    badge: 'Sonda Acústica',
    description: 'Ping acústico senoidal com reverberação exponencial de ecobatímetro naval',
    recommendedFor: 'Folga sob a quilha (UKC) e aproximação de perigos submersos',
    frequency: '1400 → 1100 Hz',
  },
];

export const GPS_INTERVAL_OPTIONS = [
  {
    value: 5,
    icon: '⚡',
    label: '5s',
    title: 'Alta Precisão',
    desc: 'Entrada de barra, canais estreitos & aproximação de perigos',
    batteryTag: 'Alto consumo GNSS',
    savingsTag: 'Precisão máxima',
  },
  {
    value: 10,
    icon: '🧭',
    label: '10s',
    title: 'Padrão Náutico',
    desc: 'Cruzeiro costeiro balanceado & vigia preventiva',
    batteryTag: 'Consumo moderado',
    savingsTag: 'Recomendado',
  },
  {
    value: 30,
    icon: '🔋',
    label: '30s',
    title: 'Modo Econômico',
    desc: 'Navegação aberta & pernas prolongadas de viagem',
    batteryTag: 'Baixo consumo',
    savingsTag: 'Economiza ~45% de bateria',
  },
  {
    value: 60,
    icon: '⚓',
    label: '60s',
    title: 'Longa Travessia',
    desc: 'Alto-mar, fundeios noturnos & máxima autonomia',
    batteryTag: 'Consumo mínimo',
    savingsTag: 'Economiza até 70% de bateria',
  },
];

interface AlertsManagerProps {
  rules: TideAlertRule[];
  onUpdateRules: (rules: TideAlertRule[]) => void;
  activeAlerts: ActiveAlertNotification[];
  currentStatus: CurrentTideStatus;
  vessel: VesselProfile;
  station?: TideStation;
  vesselCoords?: { lat: number; lng: number };
  onSimulateVesselApproach?: (hazard: NauticalHazard) => void;
  onResetVesselPosition?: () => void;
  gpsInterval?: number;
  onUpdateGpsInterval?: (intervalSeconds: number) => void;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  rules,
  onUpdateRules,
  activeAlerts,
  currentStatus,
  vessel,
  station,
  vesselCoords,
  onSimulateVesselApproach,
  onResetVesselPosition,
  gpsInterval,
  onUpdateGpsInterval,
}) => {
  const [internalGpsInterval, setInternalGpsInterval] = useState<number>(() => {
    if (gpsInterval !== undefined) return gpsInterval;
    try {
      const saved = localStorage.getItem('maresegura_gps_interval');
      return saved ? parseInt(saved, 10) : 10;
    } catch {
      return 10;
    }
  });

  const currentGpsRate = gpsInterval ?? internalGpsInterval;

  const handleChangeGpsInterval = (newSec: number) => {
    setInternalGpsInterval(newSec);
    try {
      localStorage.setItem('maresegura_gps_interval', String(newSec));
    } catch {
      // ignore
    }
    onUpdateGpsInterval?.(newSec);
  };
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(alertNotificationService.getPermission());

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    alertNotificationService.getSettings()
  );

  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const [isPushSupported] = useState<boolean>(alertNotificationService.isPushSupported());
  const [isSubscribingPush, setIsSubscribingPush] = useState<boolean>(false);
  const [pushInfo, setPushInfo] = useState<any>(() =>
    alertNotificationService.getSavedPushSubscriptionInfo()
  );

  const [isCreatingRule, setIsCreatingRule] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<AlertType>('low_tide');
  const [newThreshold, setNewThreshold] = useState<number>(0.6);
  const [newSound, setNewSound] = useState<'sonar' | 'foghorn' | 'shipbell' | 'danger'>('danger');

  // Atualiza status de permissão e inscrição Push caso mude
  useEffect(() => {
    setNotificationPermission(alertNotificationService.getPermission());
    if (alertNotificationService.isPushSupported()) {
      alertNotificationService.getPushSubscription().then((sub) => {
        if (sub) {
          const info = alertNotificationService.getSavedPushSubscriptionInfo();
          setPushInfo(info || { endpoint: sub.endpoint, subscribedAt: Date.now() });
        }
      });
    }
  }, []);

  const handleRequestPermission = async () => {
    const perm = await alertNotificationService.requestPermission();
    setNotificationPermission(perm);
    setNotificationSettings(alertNotificationService.getSettings());
  };

  const handleToggleSetting = (key: keyof NotificationSettings, value: boolean | number) => {
    const updated = alertNotificationService.updateSettings({ [key]: value });
    setNotificationSettings(updated);
  };

  const handleSendTestNotification = async () => {
    setTestFeedback(null);
    if (notificationPermission !== 'granted') {
      const perm = await alertNotificationService.requestPermission();
      setNotificationPermission(perm);
      if (perm !== 'granted') {
        setTestFeedback('Permissão de notificações não foi concedida pelo navegador.');
        return;
      }
    }

    const ok = await alertNotificationService.sendTestNotification();
    if (ok) {
      setTestFeedback('Disparado! Verifique a notificação e o sinal sonoro.');
    } else {
      setTestFeedback('Alerta de teste enviado via sirene sonora.');
    }

    setTimeout(() => {
      setTestFeedback(null);
    }, 4000);
  };

  const handleTogglePushSubscription = async () => {
    setTestFeedback(null);
    setIsSubscribingPush(true);
    try {
      if (notificationSettings.pushEnabled) {
        await alertNotificationService.unsubscribeFromPush();
        setPushInfo(null);
        setNotificationSettings(alertNotificationService.getSettings());
        setTestFeedback('Inscrição Web Push desativada com sucesso.');
      } else {
        const res = await alertNotificationService.subscribeToPush();
        setNotificationPermission(alertNotificationService.getPermission());
        setNotificationSettings(alertNotificationService.getSettings());
        if (res.success && res.subscription) {
          setPushInfo(res.subscription);
          setTestFeedback('Web Push ativado! Alertas críticos serão recebidos mesmo com o navegador fechado.');
        } else {
          setTestFeedback(res.error || 'Não foi possível registrar a inscrição push.');
        }
      }
    } finally {
      setIsSubscribingPush(false);
      setTimeout(() => {
        setTestFeedback(null);
      }, 5000);
    }
  };

  const handleSendTestPushNotification = async () => {
    setTestFeedback(null);
    const res = await alertNotificationService.sendTestPushNotification();
    setNotificationPermission(alertNotificationService.getPermission());
    setTestFeedback(res.message);
    setTimeout(() => {
      setTestFeedback(null);
    }, 5000);
  };

  const handleToggleRule = (ruleId: string) => {
    const updated = rules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    onUpdateRules(updated);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = rules.filter((r) => r.id !== ruleId);
    onUpdateRules(updated);
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let unit = 'm';
    let operator: 'greater_than' | 'less_than' = 'less_than';
    let desc = '';

    if (newType === 'high_tide') {
      operator = 'greater_than';
      unit = 'm';
      desc = `Dispara quando o nível da água ultrapassar ${newThreshold.toFixed(2)}m (risco para píers e rampas).`;
    } else if (newType === 'low_tide') {
      operator = 'less_than';
      unit = 'm';
      desc = `Dispara se o nível da água cair abaixo de ${newThreshold.toFixed(2)}m (risco de encalhe em bancos de areia).`;
    } else if (newType === 'ukc_clearance') {
      operator = 'less_than';
      unit = 'm';
      desc = `Dispara quando a distância livre sob a quilha for menor que ${newThreshold.toFixed(2)}m.`;
    } else if (newType === 'spring_tide') {
      operator = 'greater_than';
      unit = '';
      desc = 'Avisa nas luas Cheia e Nova sobre a variação máxima de maré e correntes fortes.';
    } else if (newType === 'strong_current') {
      operator = 'greater_than';
      unit = 'nós';
      desc = `Dispara quando a correnteza estimada for maior que ${newThreshold.toFixed(1)} nós.`;
    } else if (newType === 'excessive_wind') {
      operator = 'greater_than';
      unit = 'nós';
      desc = `Dispara quando a velocidade do vento exceder ${newThreshold.toFixed(1)} nós.`;
    } else if (newType === 'hazard_proximity') {
      operator = 'less_than';
      unit = 'm';
      desc = `Dispara alerta de geocerca náutica e sirene quando a embarcação estiver a menos de ${newThreshold.toFixed(0)}m de qualquer perigo ou ponto crítico cadastrado na estação.`;
    }

    const created: TideAlertRule = {
      id: `rule-${Date.now()}`,
      title: newTitle.trim(),
      type: newType,
      thresholdValue: newThreshold,
      operator,
      enabled: true,
      soundAlert: true,
      soundType: newSound,
      unit,
      description: desc,
    };

    onUpdateRules([...rules, created]);
    setNewTitle('');
    setIsCreatingRule(false);
  };

  const handleUpdateRuleSound = (
    ruleId: string,
    soundType: 'sonar' | 'foghorn' | 'shipbell' | 'danger'
  ) => {
    const updated = rules.map((r) =>
      r.id === ruleId ? { ...r, soundType } : r
    );
    onUpdateRules(updated);
    maritimeAudio.playSound(soundType);
  };

  const getSoundLabel = (type: string) => {
    switch (type) {
      case 'danger':
        return 'Sirene de Emergência';
      case 'sonar':
        return 'Sonar Náutico';
      case 'foghorn':
        return 'Buzina de Neblina';
      case 'shipbell':
        return 'Sino de Navio';
      default:
        return type;
    }
  };

  return (
    <div className="p-5 sm:p-6 bg-white border-b-2 border-black space-y-6 font-mono">
      {/* 1. FAIXA DE ALERTAS ATIVOS (activeAlerts) */}
      {activeAlerts.length > 0 ? (
        <div className="border-2 border-[#d42020] bg-[#fff5f5] p-4 shadow-[3px_3px_0px_#d42020]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[#d42020] font-bold text-xs uppercase">
              <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
              <span>ALERTAS DE SEGURANÇA EMITIDOS AGORA ({activeAlerts.length})</span>
            </div>
            {notificationSettings.enabled && notificationPermission === 'granted' && (
              <span className="text-[10px] font-bold bg-[#d42020] text-white px-2 py-0.5 uppercase flex items-center gap-1">
                <Radio className="w-3 h-3 animate-spin" />
                NOTIFICAÇÕES EM SEGUNDO PLANO ATIVAS
              </span>
            )}
          </div>

          <div className="space-y-2">
            {activeAlerts.map((alt) => {
              const rule = rules.find((r) => r.id === alt.ruleId);
              return (
                <div
                  key={alt.id}
                  className="border-2 border-black bg-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-black uppercase flex items-center gap-2">
                      <span>{alt.title}</span>
                      <span className="bg-[#d42020] text-white px-1.5 py-0.2 text-[10px]">
                        {alt.value}
                      </span>
                    </div>
                    <div className="text-[#666] text-[11px] mt-1">{alt.message}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => alertNotificationService.notifyAlert(alt, rule, true)}
                      className="px-3 py-1.5 bg-[#d42020] hover:bg-black text-white text-[11px] font-bold uppercase flex items-center gap-1.5 cursor-pointer border border-black shadow-[2px_2px_0px_#000]"
                      title="Disparar aviso sonoro e notificação no navegador imediatamente"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      <span>DISPARAR AVISO</span>
                    </button>

                    <button
                      onClick={() => maritimeAudio.playSound(rule?.soundType || 'danger')}
                      className="px-3 py-1.5 bg-black text-white hover:bg-[#333] text-[11px] font-bold uppercase flex items-center gap-1.5 cursor-pointer border border-black"
                      title="Ouvir som deste alarme"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-white" />
                      <span>OUVIR SOM</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border-2 border-black bg-[#f8f7f4] p-3.5 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2 text-black">
            <CheckCircle className="w-4 h-4 text-[#008800] shrink-0" />
            <span>SITUAÇÃO NORMAL // NENHUM ALERTA DISPARADO NO MOMENTO</span>
          </div>
          {notificationSettings.enabled && notificationPermission === 'granted' && (
            <span className="text-[10px] text-[#666] font-bold uppercase hidden sm:inline">
              Vigia em segundo plano ativa
            </span>
          )}
        </div>
      )}

      {/* 2. PAINEL TÁTICO: NOTIFICAÇÕES & WEB PUSH API (SEGUNDO PLANO E NAVEGADOR FECHADO) */}
      <div className="border-2 border-black bg-[#f8f7f4] p-4 sm:p-5 shadow-[3px_3px_0px_#000] space-y-4">
        {/* Notificações em Segundo Plano */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b-2 border-black">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Bell className="w-4 h-4 text-black" />
              <span className="font-bold uppercase text-xs">
                NOTIFICAÇÕES DO NAVEGADOR (NOTIFICATION API)
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border border-black ${
                  notificationPermission === 'granted'
                    ? 'bg-[#008800] text-white'
                    : notificationPermission === 'denied'
                    ? 'bg-[#d42020] text-white'
                    : 'bg-[#eab308] text-black'
                }`}
              >
                {notificationPermission === 'granted'
                  ? 'PERMISSÃO CONCEDIDA'
                  : notificationPermission === 'denied'
                  ? 'BLOQUEADO NO NAVEGADOR'
                  : 'PERMISSÃO PENDENTE'}
              </span>
            </div>
            <p className="text-[11px] text-[#666] mt-1">
              Dispara avisos sonoros marítimos e notificações visuais baseados na lista de alertas ativos quando o navegador estiver minimizado ou com outra aba aberta.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {notificationPermission !== 'granted' && (
              <button
                onClick={handleRequestPermission}
                className="px-3.5 py-1.5 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase border-2 border-black cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
              >
                ATIVAR NO NAVEGADOR
              </button>
            )}

            <button
              onClick={handleSendTestNotification}
              className="px-3 py-1.5 bg-white hover:bg-[#eee] text-black text-xs font-bold uppercase border-2 border-black cursor-pointer shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-colors"
              title="Dispara uma notificação de demonstração e sinal sonoro imediatamente"
            >
              <BellRing className="w-3.5 h-3.5 text-[#d42020]" />
              <span>TESTAR NOTIFICAÇÃO</span>
            </button>
          </div>
        </div>

        {/* MÓDULO WEB PUSH NOTIFICATIONS API (NAVEGADOR FECHADO) */}
        <div className="bg-white border-2 border-black p-3.5 sm:p-4 shadow-[2px_2px_0px_#000]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-black">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Radio className="w-4 h-4 text-[#0066cc]" />
                <span className="font-bold uppercase text-xs tracking-wide text-black">
                  WEB PUSH NOTIFICATIONS API (NAVEGADOR FECHADO)
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold uppercase border border-black ${
                    notificationSettings.pushEnabled
                      ? 'bg-[#008800] text-white'
                      : !isPushSupported
                      ? 'bg-[#888] text-white'
                      : 'bg-[#eee] text-black'
                  }`}
                >
                  {notificationSettings.pushEnabled
                    ? 'PUSH ATIVO (24/7)'
                    : !isPushSupported
                    ? 'PUSH NÃO SUPORTADO'
                    : 'PUSH DESATIVADO'}
                </span>
                {notificationSettings.pushEnabled && (
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-[#e0f2fe] text-[#0369a1] border border-[#0284c7]">
                    SERVICE WORKER VIGIA
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#444] mt-1.5 leading-relaxed">
                Utiliza a <strong>API de Push do Service Worker (PushManager)</strong>. Permite receber alertas críticos da MaréSegura (maré extrema, ventania &gt; 25 nós e correnteza perigosa) mesmo se o navegador estiver <strong>completamente fechado</strong> ou o aparelho em repouso.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isPushSupported && (
                <button
                  onClick={handleTogglePushSubscription}
                  disabled={isSubscribingPush}
                  className={`px-3.5 py-1.5 text-xs font-bold uppercase border-2 border-black cursor-pointer shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-colors ${
                    notificationSettings.pushEnabled
                      ? 'bg-[#fff] hover:bg-[#fee2e2] text-[#d42020]'
                      : 'bg-[#0066cc] hover:bg-[#0052a3] text-white'
                  }`}
                >
                  {isSubscribingPush ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>CONFIGURANDO...</span>
                    </>
                  ) : notificationSettings.pushEnabled ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>DESATIVAR PUSH</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>ATIVAR WEB PUSH</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleSendTestPushNotification}
                className="px-3 py-1.5 bg-[#d42020] hover:bg-[#b01a1a] text-white text-xs font-bold uppercase border-2 border-black cursor-pointer shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-colors"
                title="Dispara uma notificação de alerta crítico via Service Worker com vibração e botões de ação"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>TESTAR PUSH CRÍTICO</span>
              </button>
            </div>
          </div>

          {/* Detalhes da Subscrição Push */}
          {pushInfo && notificationSettings.pushEnabled && (
            <div className="mt-2.5 pt-2 border-t border-dashed border-[#ccc] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#555]">
              <div className="flex items-center gap-1.5 truncate max-w-full">
                <Wifi className="w-3 h-3 text-[#008800] shrink-0" />
                <span className="font-semibold">Endpoint Push:</span>
                <span className="font-mono truncate bg-[#f0f0f0] px-1 py-0.5 border border-[#ddd]">
                  {pushInfo.endpoint ? pushInfo.endpoint.slice(0, 48) + '...' : 'Subscrição local ativa'}
                </span>
              </div>
              <span className="text-[#888]">
                Ativo desde {new Date(pushInfo.subscribedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* Feedback de Operação */}
        {testFeedback && (
          <div className="p-2.5 bg-white border-2 border-black text-xs font-bold text-[#008800] flex items-center gap-2 shadow-[2px_2px_0px_#000]">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{testFeedback}</span>
          </div>
        )}

        {/* Configurações Adicionais de Notificação & Push */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <label className="flex items-center justify-between p-3 bg-white border-2 border-black cursor-pointer shadow-[2px_2px_0px_#000]">
            <div>
              <span className="font-bold block uppercase text-[11px]">Avisos do Navegador</span>
              <span className="text-[10px] text-[#666]">Pop-ups da aba ativa</span>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.enabled}
              onChange={(e) => handleToggleSetting('enabled', e.target.checked)}
              className="w-4 h-4 accent-black cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-white border-2 border-black cursor-pointer shadow-[2px_2px_0px_#000]">
            <div>
              <span className="font-bold block uppercase text-[11px]">Sinais Sonoros</span>
              <span className="text-[10px] text-[#666]">Sirene/sonar via áudio</span>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.soundEnabled}
              onChange={(e) => handleToggleSetting('soundEnabled', e.target.checked)}
              className="w-4 h-4 accent-black cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-white border-2 border-black cursor-pointer shadow-[2px_2px_0px_#000]">
            <div>
              <span className="font-bold block uppercase text-[11px]">Somente em Segundo Plano</span>
              <span className="text-[10px] text-[#666]">Apenas se a aba estiver oculta</span>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.backgroundOnly}
              onChange={(e) => handleToggleSetting('backgroundOnly', e.target.checked)}
              className="w-4 h-4 accent-black cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-white border-2 border-black cursor-pointer shadow-[2px_2px_0px_#000]">
            <div>
              <span className="font-bold block uppercase text-[11px]">Push: Apenas Críticos</span>
              <span className="text-[10px] text-[#666]">Filtra apenas perigo severo</span>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.criticalOnlyPush}
              onChange={(e) => handleToggleSetting('criticalOnlyPush', e.target.checked)}
              className="w-4 h-4 accent-black cursor-pointer"
            />
          </label>
        </div>

        {/* SELETOR DE TAXA DE ATUALIZAÇÃO DO GPS (ECONOMIA DE BATERIA EM NAVEGAÇÕES LONGAS) */}
        <div className="bg-white border-2 border-black p-3.5 sm:p-4 shadow-[2px_2px_0px_#000] space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2.5 border-b-2 border-black">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <BatteryCharging className="w-4 h-4 text-[#16a34a]" />
                <span className="font-bold uppercase text-xs tracking-wide text-black">
                  TAXA DE ATUALIZAÇÃO DO GPS (ECONOMIA DE BATERIA)
                </span>
                <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-[#dcfce7] text-[#15803d] border border-[#16a34a]">
                  Navegações Longas
                </span>
              </div>
              <p className="text-[11px] text-[#555] mt-1 leading-relaxed">
                Define a frequência com que o sensor GNSS do aparelho calcula a posição da embarcação. Taxas maiores (30s e 60s) reduzem o uso contínuo de hardware, evitando aquecimento e estendendo a autonomia da bateria durante travessias prolongadas.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
              <span className="text-[10px] text-[#777] uppercase font-bold hidden sm:inline">Intervalo Ativo:</span>
              <div className="px-3 py-1 bg-black text-white text-xs font-mono font-black uppercase shadow-xs flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#fbbf24]" />
                <span>{currentGpsRate} SEGUNDOS</span>
              </div>
            </div>
          </div>

          {/* Opções de Seleção Rápida */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            {GPS_INTERVAL_OPTIONS.map((opt) => {
              const isSelected = currentGpsRate === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChangeGpsInterval(opt.value)}
                  className={`p-3 border-2 border-black text-left cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-black text-white shadow-[2px_2px_0px_#d42020]'
                      : 'bg-[#f8f7f4] hover:bg-white text-black'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-black/15">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{opt.icon}</span>
                        <strong className="font-display text-lg font-bold tabular-nums">
                          {opt.label}
                        </strong>
                      </div>
                      {isSelected ? (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-[#d42020] text-white">
                          SELECIONADO
                        </span>
                      ) : (
                        <span className="text-[9px] text-[#777] uppercase font-bold">
                          {opt.batteryTag}
                        </span>
                      )}
                    </div>

                    <div className={`text-[11px] font-bold uppercase mt-2 ${isSelected ? 'text-[#facc15]' : 'text-black'}`}>
                      {opt.title}
                    </div>
                    <p className={`text-[10px] mt-0.5 leading-snug ${isSelected ? 'text-[#ddd]' : 'text-[#666]'}`}>
                      {opt.desc}
                    </p>
                  </div>

                  <div className={`mt-2.5 pt-1.5 border-t text-[10px] font-bold uppercase flex items-center justify-between ${
                    isSelected ? 'border-white/20 text-[#4ade80]' : 'border-black/10 text-[#16a34a]'
                  }`}>
                    <span>{opt.savingsTag}</span>
                    <span>{isSelected ? '✓ ATIVO' : 'ESCOLHER'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dica Náutica e Diretriz da Marinha */}
          <div className="flex items-start gap-2 bg-[#f8f7f4] p-2.5 border border-black/20 text-[11px] text-[#444] mt-1">
            <Compass className="w-3.5 h-3.5 text-black shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Diretriz de Consumo de Bordo:</strong> Use <strong>5s</strong> em aproximações críticas de barra, lajes e atracação. Ao iniciar pernada longa de alto-mar ou fundear, selecione <strong>30s</strong> ou <strong>60s</strong> para garantir que o aparelho mantenha carga para emergências e comunicações VHF.
            </div>
          </div>
        </div>
      </div>

      {/* 3. CABEÇALHO DE REGRAS E BOTÃO NOVO ALERTA */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b-2 border-black">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888] block">
              Configuração de Avisos Preventivos
            </span>
            <h3 className="font-display text-2xl font-bold uppercase text-black">
              Meus Alertas e Regras de Segurança
            </h3>
            <p className="text-xs text-[#666] mt-0.5">
              Defina os limites de maré, folga de quilha e correntes para monitoramento contínuo
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCreatingRule(!isCreatingRule)}
              className="px-3.5 py-1.5 bg-black hover:bg-[#333] text-white text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>CRIAR NOVO ALERTA</span>
            </button>
          </div>
        </div>

        {/* Formulário de Criação de Regra */}
        {isCreatingRule && (
          <form
            onSubmit={handleCreateRule}
            className="mb-6 p-4 border-2 border-black bg-[#eeebe6] space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold uppercase text-[11px] mb-1">
                  Nome do Alerta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maré Baixa Crítica"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2 border-2 border-black bg-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[11px] mb-1">
                  Quando Disparar o Alerta
                </label>
                <select
                  value={newType}
                  onChange={(e) => {
                    const t = e.target.value as AlertType;
                    setNewType(t);
                    if (t === 'high_tide') setNewThreshold(2.0);
                    if (t === 'low_tide') setNewThreshold(0.6);
                    if (t === 'ukc_clearance') setNewThreshold(0.5);
                    if (t === 'strong_current') setNewThreshold(2.5);
                    if (t === 'excessive_wind') setNewThreshold(25);
                    if (t === 'hazard_proximity') {
                      setNewThreshold(500);
                      setNewSound('danger');
                    }
                  }}
                  className="w-full p-2 border-2 border-black bg-white font-bold cursor-pointer"
                >
                  <option value="low_tide">Maré Baixa Crítica (Perigo de Encalhe)</option>
                  <option value="high_tide">Maré Alta Máxima (Risco de Inundação)</option>
                  <option value="ukc_clearance">Espaço Mínimo Sob o Barco (Folga da Quilha)</option>
                  <option value="spring_tide">Maré de Sizígia (Lua Cheia ou Nova)</option>
                  <option value="strong_current">Correnteza Forte (Velocidade do Fluxo)</option>
                  <option value="excessive_wind">Vento Excessivo (Velocidade do Vento)</option>
                  <option value="hazard_proximity">Aproximação de Perigo (Geocerca Náutica 500m)</option>
                </select>
              </div>

              {newType !== 'spring_tide' && (
                <div>
                  <label className="block font-bold uppercase text-[11px] mb-1">
                    Valor Limite ({newType === 'strong_current' || newType === 'excessive_wind' ? 'Nós' : 'Metros'})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(Number(e.target.value))}
                    className="w-full p-2 border-2 border-black bg-white font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold uppercase text-[11px] mb-1">
                  Som de Alerta
                </label>
                <div className="flex items-center gap-1">
                  <select
                    value={newSound}
                    onChange={(e) =>
                      setNewSound(e.target.value as 'sonar' | 'foghorn' | 'shipbell' | 'danger')
                    }
                    className="flex-1 p-2 border-2 border-black bg-white font-bold cursor-pointer"
                  >
                    <option value="danger">🚨 Sirene de Emergência (Sirene)</option>
                    <option value="shipbell">🔔 Sino de Navio (Badalada)</option>
                    <option value="foghorn">📯 Buzina de Neblina (Foghorn)</option>
                    <option value="sonar">📡 Sonar Náutico (Ping)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => maritimeAudio.playSound(newSound)}
                    aria-label="Testar reprodução deste som de alerta"
                    className="p-2 border-2 border-black bg-white hover:bg-black hover:text-white cursor-pointer"
                    title="Testar este som"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black">
              <button
                type="button"
                onClick={() => setIsCreatingRule(false)}
                className="px-3 py-1.5 border-2 border-black bg-white text-black font-bold uppercase cursor-pointer hover:bg-[#ddd]"
              >
                CANCELAR
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-black text-white font-bold uppercase cursor-pointer hover:bg-[#333]"
              >
                SALVAR ALERTA
              </button>
            </div>
          </form>
        )}

        {/* 4. LISTA DE REGRAS CONFIGURADAS */}
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-3.5 border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_#000] ${
                rule.enabled ? 'bg-white' : 'bg-[#eeebe6] opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-black uppercase text-xs">
                    {rule.title}
                  </span>
                  <span className="bg-black text-white px-1.5 py-0.2 text-[10px] font-bold">
                    {rule.operator === 'greater_than' ? '>' : '<'} {rule.thresholdValue} {rule.unit}
                  </span>
                </div>
                <div className="text-[11px] text-[#666] mt-0.5">{rule.description}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Seletor Rápido de Toque Náutico na Regra */}
                <div
                  className="flex items-center border-2 border-black bg-white"
                  title="Alterar toque náutico atribuído a esta regra"
                >
                  <select
                    value={rule.soundType}
                    onChange={(e) =>
                      handleUpdateRuleSound(
                        rule.id,
                        e.target.value as 'sonar' | 'foghorn' | 'shipbell' | 'danger'
                      )
                    }
                    className="px-2 py-1 text-[11px] font-bold uppercase bg-transparent cursor-pointer border-none outline-none"
                    aria-label={`Toque náutico da regra ${rule.title}`}
                  >
                    <option value="danger">🚨 Sirene</option>
                    <option value="shipbell">🔔 Sino de Navio</option>
                    <option value="foghorn">📯 Buzina de Neblina</option>
                    <option value="sonar">📡 Sonar Náutico</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => maritimeAudio.playSound(rule.soundType)}
                    className="p-1 hover:bg-[#eee] border-l border-black cursor-pointer text-[#d42020]"
                    title={`Testar toque (${getSoundLabel(rule.soundType)})`}
                    aria-label={`Testar som da regra ${rule.title}`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => handleToggleRule(rule.id)}
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase border-2 border-black cursor-pointer ${
                    rule.enabled ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  {rule.enabled ? 'ATIVADO' : 'PAUSADO'}
                </button>

                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  aria-label={`Excluir regra de alerta ${rule.title}`}
                  className="p-1 text-black hover:text-[#d42020] cursor-pointer"
                  title="Excluir alerta"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4.5. SEÇÃO EXCLUSIVA: SELEÇÃO DE TOQUES NÁUTICOS POR REGRA DE ALERTA */}
      <div className="border-2 border-black bg-white p-4 sm:p-5 shadow-[3px_3px_0px_#000] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b-2 border-black">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Music className="w-5 h-5 text-black" />
              <h4 className="font-display text-lg font-bold uppercase text-black tracking-wide">
                Toques Náuticos por Regra de Alerta
              </h4>
              <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-black text-white">
                Síntese Acústica Marítima
              </span>
            </div>
            <p className="text-[11px] text-[#555] mt-1.5 leading-relaxed">
              Personalize o padrão acústico sintetizado em tempo real via <strong>Web Audio API</strong> para cada regra de monitoramento. Alterne entre <strong>Sirene</strong>, <strong>Sino de Navio</strong>, <strong>Buzina de Neblina</strong> e <strong>Sonar</strong> para reconhecer a severidade do evento auditivamente sem desviar o olhar do leme.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-[#555] font-bold uppercase bg-[#f5f5f5] px-2.5 py-1 border border-black/20">
              {rules.length} {rules.length === 1 ? 'REGRA CADASTRADA' : 'REGRAS CADASTRADAS'}
            </span>
          </div>
        </div>

        {/* BANCADA ACÚSTICA: DEMONSTRAÇÃO E PRÉ-ESCUTA DOS TOQUES NÁUTICOS */}
        <div className="bg-[#f8f7f4] border-2 border-black p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1.5 border-b border-black/15">
            <span className="text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[#d42020]" />
              Bancada Acústica // Demonstração dos Toques Disponíveis
            </span>
            <span className="text-[9px] text-[#777] font-mono">
              Clique em "Ouvir" para escutar o timbre de cada sinal antes de associar
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {NAUTICAL_RINGTONES.map((rt) => (
              <div
                key={`bench-${rt.id}`}
                className="p-3 bg-white border-2 border-black flex flex-col justify-between gap-2.5 shadow-[2px_2px_0px_#000]"
              >
                <div>
                  <div className="flex items-center justify-between pb-1.5 border-b border-black/10">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{rt.icon}</span>
                      <span className="text-xs font-bold text-black uppercase">
                        {rt.shortName}
                      </span>
                    </div>
                    <span
                      className={`text-[8px] font-black px-1.5 py-0.5 border border-black uppercase ${
                        rt.id === 'danger'
                          ? 'bg-[#fee2e2] text-[#b91c1c]'
                          : rt.id === 'shipbell'
                          ? 'bg-[#fef3c7] text-[#92400e]'
                          : rt.id === 'foghorn'
                          ? 'bg-[#e0e7ff] text-[#3730a3]'
                          : 'bg-[#e0f2fe] text-[#0369a1]'
                      }`}
                    >
                      {rt.badge}
                    </span>
                  </div>

                  <p className="text-[10px] text-[#444] mt-2 leading-relaxed">
                    {rt.description}
                  </p>

                  <div className="mt-2 text-[9px] text-[#666] border-t border-dashed border-[#ccc] pt-1.5">
                    <span className="font-bold text-black">Ideal para:</span> {rt.recommendedFor}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => maritimeAudio.playSound(rt.id)}
                  className="w-full py-1.5 px-2 bg-black hover:bg-[#333] text-white text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:translate-x-0.5 active:translate-y-0.5 transition-colors"
                  title={`Ouvir toque sonoro de ${rt.name}`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>OUVIR {rt.shortName.toUpperCase()}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SELETOR INTERATIVO DE TOQUE PARA CADA REGRA ESPECÍFICA */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-black" />
              Associação de Toques por Regra de Alerta Específica:
            </span>
            <span className="text-[10px] text-[#777] hidden sm:inline">
              O toque toca imediatamente ao ser selecionado
            </span>
          </div>

          {rules.length === 0 ? (
            <div className="p-4 border-2 border-dashed border-black/30 text-center text-xs text-[#777] bg-[#fdfdfd]">
              Nenhuma regra de alerta cadastrada no momento. Clique em <strong>"Criar Novo Alerta"</strong> acima para adicionar regras e associar seus toques náuticos.
            </div>
          ) : (
            <div className="space-y-2.5">
              {rules.map((rule) => {
                const currentRingtone =
                  NAUTICAL_RINGTONES.find((r) => r.id === rule.soundType) || NAUTICAL_RINGTONES[0];
                return (
                  <div
                    key={`sound-assignment-${rule.id}`}
                    className={`p-3.5 border-2 border-black flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 shadow-[2px_2px_0px_#000] transition-colors ${
                      rule.enabled ? 'bg-white' : 'bg-[#eeebe6] opacity-75'
                    }`}
                  >
                    {/* Detalhes da Regra */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs uppercase text-black">
                          {rule.title}
                        </span>
                        <span className="bg-black text-white px-1.5 py-0.2 text-[10px] font-bold">
                          {rule.operator === 'greater_than' ? '>' : '<'} {rule.thresholdValue}{' '}
                          {rule.unit}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 border border-black uppercase flex items-center gap-1 ${
                            rule.soundType === 'danger'
                              ? 'bg-[#d42020] text-white'
                              : 'bg-[#f0f0f0] text-black'
                          }`}
                        >
                          <span>{currentRingtone.icon}</span>
                          <span>Ativo: {currentRingtone.name}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-[#555] mt-1 leading-snug">
                        {rule.description}
                      </p>
                    </div>

                    {/* Botões dos 3 Toques Náuticos Principais (+ Sonar) */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {NAUTICAL_RINGTONES.map((tone) => {
                        const isSelected = rule.soundType === tone.id;
                        return (
                          <button
                            key={tone.id}
                            type="button"
                            onClick={() => handleUpdateRuleSound(rule.id, tone.id)}
                            className={`px-3 py-1.5 text-xs font-bold uppercase border-2 border-black cursor-pointer flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 ${
                              isSelected
                                ? tone.id === 'danger'
                                  ? 'bg-[#d42020] text-white shadow-[2px_2px_0px_#000]'
                                  : 'bg-black text-white shadow-[2px_2px_0px_#000]'
                                : 'bg-white hover:bg-[#f0ede6] text-black shadow-[1px_1px_0px_#000]'
                            }`}
                            title={`Atribuir ${tone.name} à regra "${rule.title}" (toca demonstração)`}
                          >
                            <span>{tone.icon}</span>
                            <span>{tone.shortName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        );
                      })}

                      {/* Botão de Testar Toque desta Regra */}
                      <button
                        type="button"
                        onClick={() => maritimeAudio.playSound(rule.soundType)}
                        aria-label={`Testar toque sonoro atribuído à regra ${rule.title}`}
                        className="px-2.5 py-1.5 bg-[#f8f7f4] hover:bg-black hover:text-white text-black text-xs font-bold uppercase border-2 border-black cursor-pointer flex items-center gap-1 transition-colors shadow-[1px_1px_0px_#000]"
                        title={`Ouvir o toque atual desta regra (${currentRingtone.name})`}
                      >
                        <Volume2 className="w-3.5 h-3.5 text-[#d42020]" />
                        <span className="hidden sm:inline">TESTAR</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé Informativo: Boas Práticas Marinheiras */}
        <div className="flex items-start gap-2 bg-[#f8f7f4] p-2.5 border border-black/20 text-[11px] text-[#444] mt-1">
          <Info className="w-3.5 h-3.5 text-black shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Recomendação de Bordo (NORMAM):</strong> Utilize a <strong>Sirene</strong> para riscos de encalhe físico e colisão com pedras/lajes; reserve o <strong>Sino de Navio</strong> para lembretes de maré de sizígia e rotinas de vigia; e destine a <strong>Buzina de Neblina</strong> para ventanias severas (&gt; 25 nós) e correntezas de barra para simular o sinal fônico de baixa visibilidade marítima.
          </div>
        </div>
      </div>

      {/* 5. PONTOS CRÍTICOS & GEOCERCA NÁUTICA (500M) */}
      {station && station.hazards && station.hazards.length > 0 && (
        <div className="border-2 border-black bg-white p-4 sm:p-5 shadow-[3px_3px_0px_#000] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#d42020]" />
                <h4 className="font-display text-lg font-bold uppercase text-black">
                  Perigos Registrados na Estação & Geocerca Náutica
                </h4>
              </div>
              <p className="text-xs text-[#666] mt-0.5">
                Estação: <strong className="text-black">{station.name}</strong> · Geocerca preventiva ativa a <strong>500 metros</strong> de pedras, baixios e naufrágios.
              </p>
            </div>

            {onResetVesselPosition && (
              <button
                onClick={onResetVesselPosition}
                className="px-3 py-1.5 border-2 border-black bg-[#eeebe6] hover:bg-black hover:text-white text-xs font-bold uppercase cursor-pointer flex items-center gap-1.5 transition-colors shrink-0"
                title="Restaura a posição da embarcação para as coordenadas normais da estação"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESTAURAR POSIÇÃO</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {station.hazards.map((h) => {
              const distM = vesselCoords
                ? calculateDistanceMeters(vesselCoords.lat, vesselCoords.lng, h.lat, h.lng)
                : null;
              const isInsideGeofence = distM !== null && distM <= 500;

              const hazardTypeLabels: Record<string, string> = {
                rock: 'Pedra / Laje Submersa',
                shallow: 'Baixio Rochoso',
                wreck: 'Naufrágio Submerso',
                sandbank: 'Banco de Areia',
                buoy: 'Balizamento / Bóia',
                lighthouse: 'Farol / Costão',
              };

              return (
                <div
                  key={h.id}
                  className={`p-3.5 border-2 border-black flex flex-col justify-between gap-3 ${
                    isInsideGeofence
                      ? 'bg-[#fff5f5] border-[#d42020] shadow-[2px_2px_0px_#d42020]'
                      : 'bg-[#f8f7f4] shadow-[2px_2px_0px_#000]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-xs uppercase text-black block">
                          {h.name}
                        </span>
                        <span className="text-[10px] text-[#666] uppercase">
                          {hazardTypeLabels[h.type] || h.type}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold uppercase border border-black shrink-0 ${
                          isInsideGeofence
                            ? 'bg-[#d42020] text-white animate-pulse'
                            : 'bg-white text-black'
                        }`}
                      >
                        {isInsideGeofence ? 'DENTRO DA GEOCERCA (< 500m)' : 'FORA DA GEOCERCA'}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-[#444] border-t border-[#ddd] pt-2 flex items-center justify-between">
                      <span>Prof. Carta: <b>{h.chartedDepth.toFixed(1)}m</b></span>
                      <span>
                        Distância Atual:{' '}
                        <b className={isInsideGeofence ? 'text-[#d42020]' : 'text-black'}>
                          {distM !== null ? `${Math.round(distM)}m` : '--'}
                        </b>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-black/10">
                    {onSimulateVesselApproach && (
                      <button
                        onClick={() => {
                          onSimulateVesselApproach(h);
                          maritimeAudio.playSound('danger');
                        }}
                        className={`w-full py-1.5 px-2 text-xs font-bold uppercase border-2 border-black cursor-pointer flex items-center justify-center gap-1.5 shadow-[1px_1px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 ${
                          isInsideGeofence
                            ? 'bg-[#d42020] text-white'
                            : 'bg-white hover:bg-[#d42020] hover:text-white text-black transition-colors'
                        }`}
                        title="Simula a aproximação da embarcação a ~330m para testar a notificação de Aproximação de Perigo"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {isInsideGeofence
                            ? 'SIMULAÇÃO ATIVA (< 500m)'
                            : 'TESTAR APROXIMAÇÃO (< 500m)'}
                        </span>
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
  );
};

export default AlertsManager;
