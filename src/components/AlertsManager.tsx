import React, { useState } from 'react';
import {
  ActiveAlertNotification,
  AlertType,
  CurrentTideStatus,
  TideAlertRule,
  VesselProfile,
} from '../types/tide';
import { maritimeAudio } from '../utils/audioAlerts';
import { AlertTriangle, Bell, CheckCircle, Plus, Trash2, Volume2 } from 'lucide-react';

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
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const [isCreatingRule, setIsCreatingRule] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<AlertType>('low_tide');
  const [newThreshold, setNewThreshold] = useState<number>(0.6);
  const [newSound, setNewSound] = useState<'sonar' | 'foghorn' | 'shipbell' | 'danger'>('danger');

  const requestNotificationPerm = async () => {
    if (typeof Notification !== 'undefined') {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
      } catch {
        // ignore
      }
    }
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
      desc = `TRIGGER: Altura > ${newThreshold.toFixed(2)}m (Píers e atracadouros).`;
    } else if (newType === 'low_tide') {
      operator = 'less_than';
      unit = 'm';
      desc = `TRIGGER: Altura < ${newThreshold.toFixed(2)}m (Baixios e encalhe).`;
    } else if (newType === 'ukc_clearance') {
      operator = 'less_than';
      unit = 'm';
      desc = `TRIGGER: UKC < ${newThreshold.toFixed(2)}m sob a quilha.`;
    } else if (newType === 'spring_tide') {
      operator = 'greater_than';
      unit = '';
      desc = 'TRIGGER: Luas Nova e Cheia com ampliação de maré.';
    } else if (newType === 'strong_current') {
      operator = 'greater_than';
      unit = 'nós';
      desc = `TRIGGER: Correnteza > ${newThreshold.toFixed(1)} nós.`;
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

  return (
    <div className="p-6 bg-white border-b-2 border-black space-y-6 font-mono">
      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 ? (
        <div className="border-2 border-[#d42020] bg-[#fff5f5] p-4 shadow-[3px_3px_0px_#d42020]">
          <div className="flex items-center gap-2 mb-2 text-[#d42020] font-bold text-xs uppercase">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>CRITICAL TACTICAL ALARMS ACTIVE ({activeAlerts.length})</span>
          </div>
          <div className="space-y-2">
            {activeAlerts.map((alt) => (
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
                <button
                  onClick={() => maritimeAudio.playDangerAlarm()}
                  className="px-3 py-1 bg-black text-white hover:bg-[#333] text-[11px] font-bold uppercase flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#d42020]" />
                  <span>TEST ALARM</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-2 border-black bg-[#f8f7f4] p-3 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2 text-black">
            <CheckCircle className="w-4 h-4 text-[#008800] shrink-0" />
            <span>OPERATIONAL STATUS: NOMINAL // ALL TIDE TOLERANCES WITHIN SAFETY MARGIN</span>
          </div>
        </div>
      )}

      {/* Rules Header & Form */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b-2 border-black">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888] block">
              Safety Trigger Rules
            </span>
            <h3 className="font-display text-2xl font-bold uppercase text-black">
              Regras de Alerta Personalizadas
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {notificationPermission !== 'granted' && (
              <button
                onClick={requestNotificationPerm}
                className="px-3 py-1.5 border-2 border-black bg-white hover:bg-[#eeebe6] text-black text-xs font-bold uppercase cursor-pointer"
              >
                ENABLE WEB PUSH
              </button>
            )}

            <button
              onClick={() => setIsCreatingRule(!isCreatingRule)}
              className="px-3.5 py-1.5 bg-black hover:bg-[#333] text-white text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>NEW RULE</span>
            </button>
          </div>
        </div>

        {/* Create Rule Form */}
        {isCreatingRule && (
          <form
            onSubmit={handleCreateRule}
            className="mb-6 p-4 border-2 border-black bg-[#eeebe6] space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold uppercase text-[11px] mb-1">
                  RULE_NAME
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Baixa-mar Canal Rasante"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2 border-2 border-black bg-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[11px] mb-1">
                  TRIGGER_TYPE
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
                  }}
                  className="w-full p-2 border-2 border-black bg-white font-bold cursor-pointer"
                >
                  <option value="low_tide">Baixa-mar Crítica (Encalhe)</option>
                  <option value="high_tide">Preia-mar Máxima (Inundação)</option>
                  <option value="ukc_clearance">Folga de Quilha Mínima (UKC)</option>
                  <option value="spring_tide">Maré de Sizígia (Lua Cheia/Nova)</option>
                  <option value="strong_current">Correnteza Forte (Nós)</option>
                </select>
              </div>

              {newType !== 'spring_tide' && (
                <div>
                  <label className="block font-bold uppercase text-[11px] mb-1">
                    THRESHOLD ({newType === 'strong_current' ? 'KTS' : 'METERS'})
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
                  ACOUSTIC_SIGNAL
                </label>
                <div className="flex items-center gap-1">
                  <select
                    value={newSound}
                    onChange={(e) =>
                      setNewSound(e.target.value as 'sonar' | 'foghorn' | 'shipbell' | 'danger')
                    }
                    className="flex-1 p-2 border-2 border-black bg-white font-bold cursor-pointer"
                  >
                    <option value="danger">Alarme Perigo</option>
                    <option value="sonar">Sonar Ping</option>
                    <option value="foghorn">Buzina Nevoeiro</option>
                    <option value="shipbell">Sino de Bordo</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => maritimeAudio.playSound(newSound)}
                    className="p-2 border-2 border-black bg-white hover:bg-black hover:text-white cursor-pointer"
                    title="Test Sound"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black">
              <button
                type="button"
                onClick={() => setIsCreatingRule(false)}
                className="px-3 py-1.5 border-2 border-black bg-white text-black font-bold uppercase cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-black text-white font-bold uppercase cursor-pointer"
              >
                SAVE RULE
              </button>
            </div>
          </form>
        )}

        {/* Rules Table */}
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
                >
                  <Volume2 className="w-3 h-3" />
                  <span>{rule.soundType}</span>
                </button>

                <button
                  onClick={() => handleToggleRule(rule.id)}
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase border-2 border-black cursor-pointer ${
                    rule.enabled ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  {rule.enabled ? 'ARMED' : 'MUTED'}
                </button>

                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-1 text-black hover:text-[#d42020] cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
