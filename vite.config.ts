import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function openGraphDynamicOriginPlugin() {
  return {
    name: 'og-dynamic-origin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url?.split('?')[0];
        
        // Atende requisições de og-image.jpg diretamente com headers adequados
        if (url === '/og-image.jpg' || url === '/og-preview.jpg') {
          try {
            const fs = await import('fs');
            const imgPath = path.resolve(__dirname, 'public/og-image.jpg');
            if (fs.existsSync(imgPath)) {
              const data = fs.readFileSync(imgPath);
              res.setHeader('Content-Type', 'image/jpeg');
              res.setHeader('Content-Length', data.length);
              res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(data);
              return;
            }
          } catch {}
        }

        // Ignora estritamente módulos, scripts, stylesheets e rotas internas do Vite
        if (
          !url ||
          url.startsWith('/src/') ||
          url.startsWith('/@') ||
          url.startsWith('/node_modules/') ||
          /\.(tsx?|jsx?|mjs|css|json|wasm|svg|png|jpg|jpeg|webp|ico|map)$/i.test(url)
        ) {
          return next();
        }

        // Apenas intercepta requisições à raiz do documento HTML (/ ou /index.html)
        const isHtml = url === '/' || url === '/index.html';
        if (!isHtml) return next();

        try {
          const fs = await import('fs');
          const rawHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
          let html = await server.transformIndexHtml(req.url || '/', rawHtml);

          const host = req.headers['x-forwarded-host'] || req.headers.host;
          const proto = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http') || 'https';
          if (host) {
            const origin = `${proto}://${host}`;
            const pathname = req.url || '/';
            const fullUrl = `${origin}${pathname}`;
            html = html
              .replace(/content="\/og-image\.jpg"/g, `content="${origin}/og-image.jpg"`)
              .replace(/href="\/og-image\.jpg"/g, `href="${origin}/og-image.jpg"`)
              .replace(/<meta property="og:url" content="[^"]*"\s*\/>/g, `<meta property="og:url" content="${fullUrl}" />`)
              .replace(/<link rel="canonical" href="[^"]*"\s*\/>/g, `<link rel="canonical" href="${fullUrl}" />`);
            
            if (!html.includes('property="og:url"')) {
              html = html.replace('</head>', `  <meta property="og:url" content="${fullUrl}" />\n  </head>`);
            }
          }

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), openGraphDynamicOriginPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      modulePreload: {
        resolveDependencies(_filename, deps) {
          // Do not preload heavy lazy chunks on initial page entry to keep WebAudit TBT/LCP minimal
          return deps.filter(
            (dep) =>
              !dep.includes('vendor-recharts') &&
              !dep.includes('vendor-leaflet') &&
              !dep.includes('LeafletNauticalMap')
          );
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/leaflet')) {
              return 'vendor-leaflet';
            }
            if (
              id.includes('node_modules/recharts') ||
              id.includes('node_modules/react-is') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-vendor')
            ) {
              return 'vendor-recharts';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-lucide';
            }
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
