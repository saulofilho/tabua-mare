// MaréSegura Service Worker - Navegação & Suporte Offline
const CACHE_NAME = 'maresegura-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-180.png',
  '/icon-192.png',
  '/og-image.jpg',
  '/og-image.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Não interceptar requisições não-GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Requisições para o próprio app (HTML / assets locais)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Atualiza em background
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => {
          // Fallback para offline
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html') || caches.match('/');
          }
        });
      })
    );
    return;
  }

  // APIs externas (ex: Open-Meteo, Cartas Leaflet)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

// Eventos de Notificações do Navegador em Segundo Plano (PWA / Web Notification API)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Se o usuário clicou no botão "Dispensar", fecha silenciosamente
  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/?tab=alerts';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se houver uma aba aberta, foca nela e navega para a aba de alertas
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && client.url && !client.url.includes('tab=alerts')) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Se nenhuma janela estiver aberta (navegador fechado/background), abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Evento Web Push API - Recebimento de alertas críticos da MaréSegura mesmo com navegador fechado
self.addEventListener('push', (event) => {
  let payload = {
    title: '⚠️ MaréSegura - Alerta Crítico',
    message: 'Condição marítima severa detectada para a sua costa monitorada.',
    severity: 'danger',
    tag: 'maresegura-critical-alert',
    timestamp: Date.now(),
    url: '/?tab=alerts',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      const text = event.data.text();
      if (text) {
        payload.message = text;
      }
    }
  }

  const isDanger = payload.severity === 'danger';
  const notificationTitle = payload.title.startsWith('⚠️') || payload.title.startsWith('🚨')
    ? payload.title
    : `⚠️ ${payload.title}`;

  const options = {
    body: payload.message || payload.body || 'Alerta náutico crítico disparado.',
    icon: '/icon-192.png',
    badge: '/favicon.png',
    tag: payload.tag || `maresegura-push-${Date.now()}`,
    renotify: true,
    requireInteraction: isDanger,
    vibrate: isDanger ? [400, 150, 400, 150, 600] : [250, 100, 250],
    data: {
      url: payload.url || '/?tab=alerts',
      timestamp: payload.timestamp || Date.now(),
      alertId: payload.id || 'push-alert',
    },
    actions: [
      { action: 'open_alerts', title: '🚨 Ver Alertas' },
      { action: 'dismiss', title: '✖ Dispensar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, options)
  );
});

// Atualização automática da inscrição Push em caso de renovação pelo navegador
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((subscription) => {
        return clients.matchAll({ type: 'window' }).then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: 'PUSH_SUBSCRIPTION_CHANGED',
              subscription: subscription ? subscription.toJSON() : null,
            });
          });
        });
      })
      .catch((err) => {
        console.warn('Falha ao renovar subscrição push:', err);
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_ALERT_NOTIFICATION') {
    const { title, options } = event.data;
    if (self.registration && self.registration.showNotification) {
      self.registration.showNotification(title, options);
    }
  } else if (event.data && event.data.type === 'TRIGGER_PUSH_SIMULATION') {
    const { payload } = event.data;
    const isDanger = payload?.severity === 'danger';
    const notificationTitle = payload?.title || '⚠️ MaréSegura - Alerta Crítico (Web Push)';

    const options = {
      body: payload?.message || 'Alerta marítimo crítico recebido via Push mesmo com o navegador em segundo plano.',
      icon: '/icon-192.png',
      badge: '/favicon.png',
      tag: payload?.tag || `maresegura-push-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      vibrate: isDanger ? [400, 150, 400, 150, 600] : [250, 100, 250],
      data: {
        url: payload?.url || '/?tab=alerts',
        timestamp: Date.now(),
        alertId: payload?.id || 'push-alert',
      },
      actions: [
        { action: 'open_alerts', title: '🚨 Ver Alertas' },
        { action: 'dismiss', title: '✖ Dispensar' },
      ],
    };

    if (self.registration && self.registration.showNotification) {
      self.registration.showNotification(notificationTitle, options);
    }
  }
});
