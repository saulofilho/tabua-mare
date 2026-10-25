import React from 'react';
import { X, ShieldCheck, Cookie, Lock, FileText, CheckCircle2 } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-white border-2 border-black p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-auto max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-black" />
            <div>
              <h2 id="privacy-modal-title" className="text-base sm:text-lg font-black uppercase tracking-tight">
                Política de Privacidade & Termos de Uso
              </h2>
              <span className="text-[10px] font-mono uppercase text-[#666]">
                Conformidade LGPD, GDPR e Políticas Google AdSense
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar modal de privacidade"
            className="p-1.5 border border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="overflow-y-auto py-4 pr-1 text-xs text-[#222] space-y-4 font-sans leading-relaxed">
          <section className="bg-[#f8f7f4] border border-black p-3">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-[#d42020]" />
              <h3 className="font-bold uppercase text-[11px] font-mono">1. Compromisso com a Privacidade Náutica</h3>
            </div>
            <p>
              O <strong>MaréSegura</strong> respeita a privacidade de seus usuários. Esta aplicação foi desenvolvida
              para fornecer previsões astronômicas e navegação tática sem rastreamento invasivo de dados pessoais.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-black" />
              <h3 className="font-bold uppercase text-[11px] font-mono">2. Dados de Geolocalização (GPS)</h3>
            </div>
            <p>
              O acesso ao GPS do seu dispositivo (`navigator.geolocation`) é utilizado <strong>exclusivamente de forma local</strong> no seu navegador para:
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-[#444]">
              <li>Calcular a distância geodésica até a praia ou estação maregráfica mais próxima.</li>
              <li>Exibir a sua posição na Carta Náutica e calcular rumo (COG) e velocidade (SOG).</li>
              <li>Monitorar o fundeio na Vigia de Âncora e formatar coordenadas de socorro SOS.</li>
            </ul>
            <p className="mt-1 text-[11px] text-[#666]">
              Suas coordenadas geográficas <em>nunca são enviadas ou armazenadas em servidores externos</em>.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-1">
              <Cookie className="w-4 h-4 text-black" />
              <h3 className="font-bold uppercase text-[11px] font-mono">3. Cookies & Publicidade (Google AdSense)</h3>
            </div>
            <p>
              Para viabilizar financeiramente a manutenção gratuita e contínua do aplicativo, o MaréSegura pode exibir anúncios
              fornecidos pelo <strong>Google AdSense</strong>.
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-[#444]">
              <li>
                O Google, como fornecedor terceirizado, utiliza cookies para veicular anúncios com base nas visitas anteriores dos usuários a este ou a outros sites.
              </li>
              <li>
                O uso de cookies de publicidade permite ao Google e a seus parceiros veicular anúncios relevantes aos usuários com base em sua navegação na Internet.
              </li>
              <li>
                Os usuários podem desativar a publicidade personalizada acessando as{' '}
                <a
                  href="https://adssettings.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-black font-semibold hover:text-[#d42020]"
                >
                  Configurações de Anúncios do Google
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-black" />
              <h3 className="font-bold uppercase text-[11px] font-mono">4. Armazenamento Local (Offline & Diário de Bordo)</h3>
            </div>
            <p>
              Todas as preferências de embarcação, histórico do Diário de Navegação (Logbook), regras de alertas sonoros
              e pacotes de cartas offline são salvos estritamente na memória do seu navegador (`localStorage` e `CacheStorage`).
              Você pode limpá-los a qualquer momento nas configurações do seu navegador ou no menu do sistema.
            </p>
          </section>

          <section className="text-[11px] text-[#666] border-t border-[#ddd] pt-2">
            <p>
              <strong>Aviso de Navegação:</strong> Os cálculos de marés utilizam os modelos harmônicos da DHN e modelos globais meteorológicos.
              Em situações de manobra crítica em barras e canais restritos, consulte sempre as publicações náuticas oficiais da autoridade marítima local.
            </p>
            <p className="mt-1">
              Última atualização: Outubro de 2026.
            </p>
          </section>
        </div>

        {/* Rodapé com botão de fechar */}
        <div className="border-t-2 border-black pt-3 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-black text-white font-mono font-bold text-xs uppercase hover:bg-[#d42020] transition-colors cursor-pointer"
          >
            Entendido // Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyModal;
