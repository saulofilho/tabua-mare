import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { analytics } from './services/analytics';

// Inicializar monitoramento de performance (Core Web Vitals) e métricas
analytics.init();

createRoot(document.getElementById('root')!).render(<App />);

// Registro do Service Worker para conformidade PWA, notificações e navegação offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('MaréSegura Service Worker registrado com sucesso:', reg.scope);
      })
      .catch((err) => {
        console.warn('Falha no registro do Service Worker:', err);
      });
  });
}
