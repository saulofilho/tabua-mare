import React, { useState, useEffect } from 'react';
import {
  ActiveAlertNotification,
  AlertType,
  CurrentTideStatus,
  TideAlertRule,
  VesselProfile,
} from '../types/tide';
import { maritimeAudio } from '../utils/audioAlerts';
import {
  alertNotificationService,
  NotificationSettings,
} from '../services/alertNotificationService';
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
} from 'lucide-react';

interface AlertsManagerProps {
  rules: TideAlertRule[];
  onUpdateRules: (rules: TideAlertRule[]) => void;
  activeAlerts: ActiveAlertNotification[];
  currentStatus: CurrentTideStatus;
  vessel: VesselProfile;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  rules,
  onUpdateRules,
  activeAlerts,
  currentStatus,
  vessel,
}) => {
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

  const getSoundLabel = (type: string) => {
    switch (type) {
      case 'danger':
        return 'Alarme de Perigo';
      case 'sonar':
        return 'Sonar Náutico';
      case 'foghorn':
        return 'Buzina de Nevoeiro';
      case 'shipbell':
        return 'Sino de Bordo';
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
                  }}
                  className="w-full p-2 border-2 border-black bg-white font-bold cursor-pointer"
                >
                  <option value="low_tide">Maré Baixa Crítica (Perigo de Encalhe)</option>
                  <option value="high_tide">Maré Alta Máxima (Risco de Inundação)</option>
                  <option value="ukc_clearance">Espaço Mínimo Sob o Barco (Folga da Quilha)</option>
                  <option value="spring_tide">Maré de Sizígia (Lua Cheia ou Nova)</option>
                  <option value="strong_current">Correnteza Forte (Velocidade do Fluxo)</option>
                  <option value="excessive_wind">Vento Excessivo (Velocidade do Vento)</option>
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
                    <option value="danger">Alarme de Perigo</option>
                    <option value="sonar">Sonar Náutico</option>
                    <option value="foghorn">Buzina de Nevoeiro</option>
                    <option value="shipbell">Sino de Bordo</option>
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

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => maritimeAudio.playSound(rule.soundType)}
                  className="px-2 py-1 text-[11px] font-bold uppercase border-2 border-black bg-white hover:bg-[#eeebe6] flex items-center gap-1 cursor-pointer"
                  title="Ouvir som deste alerta"
                >
                  <Volume2 className="w-3 h-3 text-[#d42020]" />
                  <span>{getSoundLabel(rule.soundType)}</span>
                </button>

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
    </div>
  );
};

export default AlertsManager;
