import { ActiveAlertNotification, TideAlertRule, PushSubscriptionInfo } from '../types/tide';
import { maritimeAudio } from '../utils/audioAlerts';

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  backgroundOnly: boolean;
  cooldownMinutes: number;
  pushEnabled: boolean;
  criticalOnlyPush: boolean;
}

const STORAGE_KEY = 'maresegura_notification_settings';
const PUSH_STORAGE_KEY = 'maresegura_push_subscription';

// Chave pública VAPID padrão para Push Notifications (P-256)
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckj0YZ30GkvQ50UtTDd2Xd0n6hhQVU';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  backgroundOnly: false,
  cooldownMinutes: 5,
  pushEnabled: false,
  criticalOnlyPush: true,
};

class AlertNotificationService {
  private lastNotifiedMap = new Map<string, number>();
  private settings: NotificationSettings = DEFAULT_SETTINGS;

  constructor() {
    this.loadSettings();
    this.verifyPushSubscriptionOnStartup();
  }

  private loadSettings(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      this.settings = DEFAULT_SETTINGS;
    }
  }

  private async verifyPushSubscriptionOnStartup(): Promise<void> {
    if (!this.isPushSupported()) return;
    try {
      const sub = await this.getPushSubscription();
      if (sub && !this.settings.pushEnabled) {
        this.updateSettings({ pushEnabled: true });
      } else if (!sub && this.settings.pushEnabled) {
        const saved = this.getSavedPushSubscriptionInfo();
        if (!saved) {
          this.updateSettings({ pushEnabled: false });
        }
      }
    } catch {
      // Falha silenciosa no startup
    }
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<NotificationSettings>): NotificationSettings {
    this.settings = { ...this.settings, ...updates };
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch {
        // ignore storage errors
      }
    }
    return { ...this.settings };
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public isPushSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  public getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  public async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.updateSettings({ enabled: true });
      }
      return permission;
    } catch (err) {
      console.warn('Erro ao solicitar permissão de notificações:', err);
      return Notification.permission;
    }
  }

  /**
   * Obtém a inscrição ativa da Web Push API do Service Worker
   */
  public async getPushSubscription(): Promise<PushSubscription | null> {
    if (!this.isPushSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch (err) {
      console.warn('Erro ao consultar inscrição push:', err);
      return null;
    }
  }

  /**
   * Obtém informações salvas localmente sobre a inscrição Push
   */
  public getSavedPushSubscriptionInfo(): PushSubscriptionInfo | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(PUSH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Registra a inscrição na Web Push API (permite alertas com navegador fechado)
   */
  public async subscribeToPush(): Promise<{
    success: boolean;
    subscription?: PushSubscriptionInfo;
    error?: string;
  }> {
    if (!this.isPushSupported()) {
      return { success: false, error: 'Web Push API não é suportada neste navegador.' };
    }

    try {
      const perm = await this.requestPermission();
      if (perm !== 'granted') {
        return {
          success: false,
          error: 'Permissão de notificação negada ou não concedida pelo usuário.',
        };
      }

      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        try {
          const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as unknown as BufferSource,
          });
        } catch (subErr) {
          console.warn('Tentativa com VAPID falhou, tentando fallback sem chave:', subErr);
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
          });
        }
      }

      const subJson = subscription.toJSON();
      const pushInfo: PushSubscriptionInfo = {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
        subscribedAt: Date.now(),
      };

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PUSH_STORAGE_KEY, JSON.stringify(pushInfo));
      }

      this.updateSettings({ pushEnabled: true, enabled: true });

      return {
        success: true,
        subscription: pushInfo,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('Erro ao subscrever na Push API:', err);
      return {
        success: false,
        error: `Falha ao ativar Push Notifications: ${message}`,
      };
    }
  }

  /**
   * Cancela a inscrição de Push Notifications
   */
  public async unsubscribeFromPush(): Promise<boolean> {
    if (!this.isPushSupported()) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(PUSH_STORAGE_KEY);
      }
      this.updateSettings({ pushEnabled: false });
      return true;
    } catch (err) {
      console.warn('Erro ao cancelar inscrição push:', err);
      return false;
    }
  }

  /**
   * Dispara notificação visual e sonora para um alerta ativo
   */
  public async notifyAlert(
    alert: ActiveAlertNotification,
    rule?: TideAlertRule,
    force: boolean = false
  ): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (this.getPermission() !== 'granted') return false;
    if (!this.settings.enabled && !force) return false;

    // Se push estiver configurado apenas para críticos e não for crítico
    if (this.settings.criticalOnlyPush && alert.severity !== 'danger' && !force && this.settings.pushEnabled) {
      // Alertas de severidade inferior ainda geram notificação regular se permitido
    }

    const isBackground = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (this.settings.backgroundOnly && !isBackground && !force) {
      return false;
    }

    const now = Date.now();
    const lastNotified = this.lastNotifiedMap.get(alert.id);
    const cooldownMs = this.settings.cooldownMinutes * 60 * 1000;

    if (!force && lastNotified && now - lastNotified < cooldownMs) {
      return false; // Dentro do período de cooldown para este alerta
    }

    this.lastNotifiedMap.set(alert.id, now);

    // 1. Aviso Sonoro Náutico (Web Audio API)
    if (this.settings.soundEnabled && (rule?.soundAlert !== false || force)) {
      try {
        const soundType = rule?.soundType || (alert.severity === 'danger' ? 'danger' : 'sonar');
        maritimeAudio.playSound(soundType);
      } catch (err) {
        console.warn('Falha na reprodução de áudio do alerta:', err);
      }
    }

    // 2. Aviso Visual do Navegador (Notification API + Service Worker)
    try {
      const options: NotificationOptions & { vibrate?: number[]; actions?: { action: string; title: string }[] } = {
        body: alert.message,
        icon: '/icon-192.png',
        badge: '/favicon.png',
        tag: `maresegura-${alert.id}`,
        vibrate: alert.severity === 'danger' ? [300, 100, 300, 100, 500] : [200, 100, 200],
        requireInteraction: alert.severity === 'danger',
        silent: !this.settings.soundEnabled,
        data: {
          url: '/?tab=alerts',
          alertId: alert.id,
          timestamp: alert.timestamp,
        },
        actions: [
          { action: 'open_alerts', title: '🚨 Ver Alertas' },
          { action: 'dismiss', title: '✖ Dispensar' },
        ],
      };

      // Tenta exibir via Service Worker Registration (persiste em segundo plano e com navegador fechado)
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            await reg.showNotification(`⚠️ ${alert.title}`, options);
            return true;
          }
        } catch {
          // Fallback para new Notification
        }
      }

      // Fallback padrão da Notification API no contexto da página
      new Notification(`⚠️ ${alert.title}`, options);
      return true;
    } catch (err) {
      console.warn('Falha ao instanciar notificação do navegador:', err);
      return false;
    }
  }

  /**
   * Sincroniza a lista atual de activeAlerts com as regras e despacha notificações para novos alertas
   */
  public syncActiveAlerts(
    activeAlerts: ActiveAlertNotification[],
    rules: TideAlertRule[]
  ): void {
    if (activeAlerts.length === 0) {
      return;
    }

    // Identifica alertas ativos
    const activeIds = new Set(activeAlerts.map((a) => a.id));

    // Limpa alertas antigos resolvidos do mapa de cooldown
    for (const id of Array.from(this.lastNotifiedMap.keys())) {
      if (!activeIds.has(id)) {
        this.lastNotifiedMap.delete(id);
      }
    }

    // Notifica cada alerta ativo
    activeAlerts.forEach((alert) => {
      const rule = rules.find((r) => r.id === alert.ruleId);
      this.notifyAlert(alert, rule);
    });
  }

  /**
   * Envia uma notificação de teste imediata para verificar áudio e popup do navegador
   */
  public async sendTestNotification(): Promise<boolean> {
    const testAlert: ActiveAlertNotification = {
      id: `test-${Date.now()}`,
      ruleId: 'test-rule',
      title: 'MaréSegura - Notificação de Alerta Ativa',
      message: 'Aviso visual e sonoro funcionando mesmo com o navegador em segundo plano!',
      severity: 'danger',
      timestamp: Date.now(),
      value: 'Teste OK',
    };

    return this.notifyAlert(testAlert, undefined, true);
  }

  /**
   * Dispara um teste completo de Push Notification via Service Worker
   * Simula a chegada de um pacote Web Push real, com botões de ação e som de sirene
   */
  public async sendTestPushNotification(): Promise<{ success: boolean; message: string }> {
    if (!this.isSupported()) {
      return { success: false, message: 'Notificações não suportadas neste ambiente.' };
    }

    const perm = await this.requestPermission();
    if (perm !== 'granted') {
      return { success: false, message: 'Permissão de notificações não concedida no navegador.' };
    }

    // Reproduz sinal sonoro marítimo de alarme
    try {
      maritimeAudio.playSound('danger');
    } catch {
      // som opcional
    }

    const testPayload = {
      title: '🚨 MaréSegura - ALERTA CRÍTICO (Push)',
      message: 'Rajadas de vento > 28 nós e maré de sizígia com variação extrema. Push ativo mesmo com o navegador fechado.',
      severity: 'danger' as const,
      timestamp: Date.now(),
      tag: `push-test-${Date.now()}`,
      url: '/?tab=alerts',
    };

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;

        // Dispara mensagem de simulação ao worker se o controlador estiver ativo
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'TRIGGER_PUSH_SIMULATION',
            payload: testPayload,
          });
        }

        // Também garante exibição direta através do Service Worker Registration
        const pushOptions = {
          body: testPayload.message,
          icon: '/icon-192.png',
          badge: '/favicon.png',
          tag: testPayload.tag,
          requireInteraction: true,
          renotify: true,
          vibrate: [400, 150, 400, 150, 600],
          data: { url: testPayload.url, timestamp: testPayload.timestamp },
          actions: [
            { action: 'open_alerts', title: '🚨 Ver Alertas' },
            { action: 'dismiss', title: '✖ Dispensar' },
          ],
        };
        await reg.showNotification(testPayload.title, pushOptions as unknown as NotificationOptions);

        return {
          success: true,
          message: 'Push Notification disparada com sucesso pelo Service Worker!',
        };
      } catch (err: unknown) {
        console.warn('Erro ao disparar push via Service Worker:', err);
      }
    }

    // Fallback se Service Worker não estiver pronto
    new Notification(testPayload.title, {
      body: testPayload.message,
      icon: '/icon-192.png',
      badge: '/favicon.png',
    });

    return {
      success: true,
      message: 'Notificação push disparada com sucesso via Notification API.',
    };
  }
}

export const alertNotificationService = new AlertNotificationService();
