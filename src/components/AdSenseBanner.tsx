import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdSenseBannerProps {
  clientId?: string;
  slotId?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  responsive?: boolean;
  className?: string;
  label?: string;
}

/**
 * Componente tático de banner do Google AdSense para React SPA / PWA.
 * Suporta injeção automática e resiliente do script oficial do Google,
 * execução segura do push() com tratamento contra bloqueadores de anúncios (adblock),
 * e renderização limpa e não invasiva na interface marítima.
 */
export const AdSenseBanner: React.FC<AdSenseBannerProps> = ({
  clientId = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT_ID || '',
  slotId = import.meta.env.VITE_GOOGLE_ADSENSE_SLOT_ID || '',
  format = 'auto',
  responsive = true,
  className = '',
  label = 'PUBLICIDADE',
}) => {
  const adRef = useRef<HTMLModElement | null>(null);
  const isPushed = useRef(false);

  // Injeta o script do Google AdSense dinamicamente no head caso ainda não esteja presente
  useEffect(() => {
    if (!clientId) return;

    const scriptId = 'google-adsense-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
  }, [clientId]);

  // Dispara o carregamento do anúncio após montagem do elemento ins
  useEffect(() => {
    if (!clientId || !slotId || isPushed.current) return;

    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && adRef.current) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          isPushed.current = true;
        }
      } catch (err) {
        // Bloqueadores de anúncio (AdBlock / Brave Shields) normalmente bloqueiam sem causar erro fatal
        console.debug('AdSense push suprimido por adblocker ou ambiente de dev:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [clientId, slotId]);

  // Se não houver clientId configurado, exibe um placeholder tático informativo
  if (!clientId || !slotId) {
    return (
      <aside
        aria-label="Espaço publicitário reservado"
        className={`border border-dashed border-[#ccc] bg-[#fdfdfc] p-3 text-center my-4 ${className}`}
      >
        <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-dashed border-[#e0e0e0]">
          <span className="text-[9px] font-mono font-bold uppercase text-[#888] tracking-wider">
            {label} // GOOGLE ADSENSE
          </span>
          <span className="text-[8px] font-mono font-bold bg-[#eee] text-[#666] px-1.5 py-0.5 rounded-xs uppercase">
            Slot Pronto
          </span>
        </div>
        <p className="text-[11px] font-mono text-[#666] mb-1">
          Espaço reservado para banner de anúncios (AdSense).
        </p>
        <p className="text-[9px] font-mono text-[#999]">
          Para ativar, informe <code className="bg-[#f0ede6] px-1 py-0.5 text-black">VITE_GOOGLE_ADSENSE_CLIENT_ID</code> e <code className="bg-[#f0ede6] px-1 py-0.5 text-black">VITE_GOOGLE_ADSENSE_SLOT_ID</code>.
        </p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Anúncio publicitário"
      className={`border border-black bg-white p-2 text-center my-4 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between mb-1 pb-1 border-b border-[#eee]">
        <span className="text-[8px] font-mono font-bold uppercase text-[#999] tracking-wider">
          {label}
        </span>
      </div>
      <div className="min-h-[90px] flex items-center justify-center overflow-hidden">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive={responsive ? 'true' : 'false'}
        />
      </div>
    </aside>
  );
};

export default AdSenseBanner;
