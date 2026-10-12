/**
 * MaréSegura Analytics & Performance Metrics Engine
 * 
 * Sistema de métricas de performance (Core Web Vitals) e análise de eventos
 * de navegação respeitando a privacidade do usuário (sem dados pessoais).
 */

export interface WebVitalsMetric {
  name: 'CLS' | 'LCP' | 'FCP' | 'FID' | 'INP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

export interface AnalyticsEvent {
  category: 'navigation' | 'tides' | 'weather' | 'safety' | 'offline' | 'preferences';
  action: string;
  label?: string;
  value?: number;
  timestamp: number;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private isInitialized = false;
  private gaMeasurementId: string | null = null;
  private vitals: Record<string, WebVitalsMetric> = {};
  private eventsQueue: AnalyticsEvent[] = [];

  private constructor() {
    this.gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || null;
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Inicializa o monitoramento de Core Web Vitals e Analytics
   */
  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Iniciar monitoramento de Web Vitals nativo
    this.observeWebVitals();

    // 2. Inicializar Google Analytics se configurado
    if (this.gaMeasurementId) {
      this.initGoogleAnalytics(this.gaMeasurementId);
    }

    // 3. Registrar visualização inicial de página
    this.trackPageView(window.location.pathname + window.location.search);
  }

  /**
   * Coleta métricas de Web Vitals usando PerformanceObserver nativo (sem libs pesadas)
   */
  private observeWebVitals() {
    if (!('PerformanceObserver' in window)) return;

    // FCP (First Contentful Paint)
    try {
      const fcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          const entry = entries[entries.length - 1];
          const val = Math.round(entry.startTime);
          this.recordMetric('FCP', val, val <= 1800 ? 'good' : val <= 3000 ? 'needs-improvement' : 'poor');
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
    } catch (_) {}

    // LCP (Largest Contentful Paint)
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          const entry = entries[entries.length - 1];
          const val = Math.round(entry.startTime);
          this.recordMetric('LCP', val, val <= 2500 ? 'good' : val <= 4000 ? 'needs-improvement' : 'poor');
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_) {}

    // CLS (Cumulative Layout Shift)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          // Apenas somar se não houver interação recente do usuário
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        const val = Math.round(clsValue * 1000) / 1000;
        this.recordMetric('CLS', val, val <= 0.1 ? 'good' : val <= 0.25 ? 'needs-improvement' : 'poor');
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (_) {}

    // TTFB (Time to First Byte)
    try {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        const nav = navEntries[0] as PerformanceNavigationTiming;
        const val = Math.round(nav.responseStart - nav.requestStart);
        if (val > 0) {
          this.recordMetric('TTFB', val, val <= 800 ? 'good' : val <= 1800 ? 'needs-improvement' : 'poor');
        }
      }
    } catch (_) {}
  }

  private recordMetric(name: WebVitalsMetric['name'], value: number, rating: WebVitalsMetric['rating']) {
    const metric: WebVitalsMetric = {
      name,
      value,
      rating,
      timestamp: Date.now(),
    };
    this.vitals[name] = metric;

    // Disparar evento para Analytics externo se disponível
    if (this.gaMeasurementId && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', name, {
        event_category: 'Web Vitals',
        event_label: rating,
        value: Math.round(name === 'CLS' ? value * 1000 : value),
        non_interaction: true,
      });
    }

    // Armazenar sumário localmente para auditorias
    try {
      localStorage.setItem('maresegura_web_vitals', JSON.stringify(this.vitals));
    } catch (_) {}
  }

  /**
   * Rastreia eventos náuticos e de interação
   */
  public trackEvent(
    category: AnalyticsEvent['category'],
    action: string,
    label?: string,
    value?: number
  ) {
    const event: AnalyticsEvent = {
      category,
      action,
      label,
      value,
      timestamp: Date.now(),
    };

    this.eventsQueue.push(event);
    if (this.eventsQueue.length > 50) this.eventsQueue.shift();

    if (this.gaMeasurementId && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', action, {
        event_category: category,
        event_label: label,
        value,
      });
    }
  }

  /**
   * Rastreia visualização de página / mudança de aba
   */
  public trackPageView(path: string, title?: string) {
    const pageTitle = title || document.title;
    if (this.gaMeasurementId && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'page_view', {
        page_path: path,
        page_title: pageTitle,
      });
    }

    this.trackEvent('navigation', 'page_view', `${path} (${pageTitle})`);
  }

  /**
   * Inicializa o script oficial do Google Analytics 4 de forma assíncrona
   */
  private initGoogleAnalytics(measurementId: string) {
    try {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);

      (window as any).dataLayer = (window as any).dataLayer || [];
      function gtag(...args: any[]) {
        (window as any).dataLayer.push(args);
      }
      (window as any).gtag = gtag;
      gtag('js', new Date());
      gtag('config', measurementId, {
        send_page_view: false, // Gerenciado manualmente pelo SPA
        anonymize_ip: true,
      });
    } catch (_) {}
  }

  /**
   * Retorna as métricas atuais de performance (para testes ou inspeção)
   */
  public getVitals(): Record<string, WebVitalsMetric> {
    return { ...this.vitals };
  }
}

export const analytics = AnalyticsService.getInstance();
