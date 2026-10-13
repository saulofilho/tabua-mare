import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertOctagon,
  X,
  Copy,
  Check,
  Share2,
  ExternalLink,
  PhoneCall,
  Volume2,
  VolumeX,
  Navigation,
  Anchor,
  MapPin,
  RefreshCw,
  Send,
  LifeBuoy,
  ShieldAlert,
} from 'lucide-react';
import { VesselProfile, TideStation } from '../types/tide';
import { maritimeAudio } from '../utils/audioAlerts';

interface EmergencySOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  vessel: VesselProfile;
  userCoords: { lat: number; lng: number };
  hasRealGPS: boolean;
  station: TideStation;
  selectedBeachName?: string;
  onRequestGPS: () => void;
}

// Converte graus decimais para formato náutico GMS (Graus, Minutos e Segundos)
function formatCoordDMS(decimal: number, isLatitude: boolean): string {
  const direction = isLatitude ? (decimal >= 0 ? 'N' : 'S') : decimal >= 0 ? 'E' : 'W';
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

  return `${degrees}°${String(minutes).padStart(2, '0')}'${String(seconds).padStart(2, '0')}"${direction}`;
}

export const EmergencySOSModal: React.FC<EmergencySOSModalProps> = ({
  isOpen,
  onClose,
  vessel,
  userCoords,
  hasRealGPS,
  station,
  selectedBeachName,
  onRequestGPS,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isUpdatingGPS, setIsUpdatingGPS] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [currentCoords, setCurrentCoords] = useState(userCoords);
  const [currentHasGPS, setCurrentHasGPS] = useState(hasRealGPS);

  // Sincroniza coordenadas quando o modal é aberto ou as props mudam
  useEffect(() => {
    if (isOpen) {
      setCurrentCoords(userCoords);
      setCurrentHasGPS(hasRealGPS);
    }
  }, [isOpen, userCoords, hasRealGPS]);

  // Atualiza GPS imediatamente ao abrir o modal para garantir a máxima precisão de resgate
  const handleRefreshGPS = useCallback(() => {
    setIsUpdatingGPS(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          setCurrentHasGPS(true);
          setIsUpdatingGPS(false);
          onRequestGPS();
        },
        (err) => {
          console.warn('Erro ao obter GPS de emergência:', err);
          setIsUpdatingGPS(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      setIsUpdatingGPS(false);
    }
  }, [onRequestGPS]);

  const mapLink = useMemo(() => {
    return `https://www.google.com/maps?q=${currentCoords.lat.toFixed(6)},${currentCoords.lng.toFixed(6)}`;
  }, [currentCoords]);

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR');
  const timeFormatted = now.toLocaleTimeString('pt-BR');
  const utcFormatted = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  const dmsLat = formatCoordDMS(currentCoords.lat, true);
  const dmsLng = formatCoordDMS(currentCoords.lng, false);

  // Mensagem padronizada de socorro náutico para resgate
  const sosMessage = useMemo(() => {
    return `🚨 [MENSAGEM DE SOCORRO / MAYDAY - MARÉSEGURA] 🚨
----------------------------------------
EMBARCAÇÃO: ${vessel.name.toUpperCase()} (${vessel.vesselType.toUpperCase()})
CALADO: ${vessel.draft.toFixed(2)}m | CALADO AÉREO: ${vessel.airDraft.toFixed(2)}m

COORDENADAS GPS ATUAIS:
• Decimais: ${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)}
• Náuticas (GMS): ${dmsLat} ${dmsLng}

LINK DIRETO PARA LOCALIZAÇÃO NO MAPA (RESGATE):
${mapLink}

REFERÊNCIA LOCAL: ${selectedBeachName || station.name} (${station.state})
DATA/HORA DO SINAL: ${dateFormatted} às ${timeFormatted} (${utcFormatted})
${additionalNotes.trim() ? `\nOBSERVAÇÕES DA TRIPULAÇÃO: ${additionalNotes.trim()}` : ''}
----------------------------------------
SOLICITAÇÃO: RESGATE / APOIO MARÍTIMO IMEDIATO
SALVAMAR BRASIL: TEL 185 | RÁDIO VHF CANAL 16`;
  }, [
    vessel,
    currentCoords,
    dmsLat,
    dmsLng,
    mapLink,
    selectedBeachName,
    station,
    dateFormatted,
    timeFormatted,
    utcFormatted,
    additionalNotes,
  ]);

  if (!isOpen) return null;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(sosMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleShareMessage = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `MAYDAY / SOCORRO - ${vessel.name}`,
          text: sosMessage,
          url: mapLink,
        });
        return;
      } catch {
        // Usuário cancelou ou navegador não compartilhou
      }
    }
    handleCopyMessage();
  };

  const handleWhatsAppShare = () => {
    const textEncoded = encodeURIComponent(sosMessage);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${textEncoded}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePlayMorseSOS = () => {
    if (isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }
    setIsPlayingAudio(true);
    maritimeAudio.playMorseSOS();
    setTimeout(() => {
      setIsPlayingAudio(false);
    }, 2800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sos-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs font-mono overflow-y-auto"
    >
      <div className="bg-[#f8f7f4] border-4 border-black w-full max-w-2xl shadow-[10px_10px_0px_#000] my-auto max-h-[92vh] flex flex-col">
        {/* Header Tático de Emergência */}
        <div className="bg-[#d42020] text-white p-4 border-b-4 border-black flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black border-2 border-white flex items-center justify-center shrink-0">
              <AlertOctagon className="w-6 h-6 text-[#d42020] animate-pulse" />
            </div>
            <div>
              <h2 id="sos-modal-title" className="font-display text-xl sm:text-2xl font-bold uppercase tracking-tight text-white leading-tight">
                SINALIZAR SOCORRO (MAYDAY)
              </h2>
              <p className="text-[11px] font-bold uppercase text-white/90">
                Alerta de Emergência Náutica & Dados de Resgate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar janela de SOS"
            className="p-1.5 border-2 border-white bg-black hover:bg-white hover:text-black text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Informações e Mensagem */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Banner de Status do GPS e Embarcação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Box Embarcação */}
            <div className="border-2 border-black bg-white p-3 shadow-[2px_2px_0px_#000]">
              <span className="block text-[10px] font-bold uppercase text-[#888] mb-1 flex items-center gap-1">
                <Anchor className="w-3.5 h-3.5 text-black" />
                Embarcação Cadastrada
              </span>
              <div className="font-bold text-sm text-black uppercase truncate">
                {vessel.name || 'EMBARCAÇÃO NÃO NOMEADA'}
              </div>
              <div className="text-[11px] text-[#555] uppercase mt-0.5">
                Tipo: <strong className="text-black">{vessel.vesselType}</strong> | Calado:{' '}
                <strong className="text-black">{vessel.draft.toFixed(2)}m</strong>
              </div>
            </div>

            {/* Box GPS */}
            <div className="border-2 border-black bg-white p-3 shadow-[2px_2px_0px_#000] flex flex-col justify-between">
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#888] mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-[#d42020]" />
                    Posição GPS Atual
                  </span>
                  <span
                    className={`px-1.5 py-0.2 text-[9px] font-bold uppercase border border-black ${
                      currentHasGPS ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef9c3] text-[#854d0e]'
                    }`}
                  >
                    {currentHasGPS ? 'GPS REAL ATIVO' : 'ESTIMAÇÃO COSTEIRA'}
                  </span>
                </span>
                <div className="font-bold text-xs text-black tabular-nums">
                  {currentCoords.lat.toFixed(6)}, {currentCoords.lng.toFixed(6)}
                </div>
                <div className="text-[10px] text-[#666] tabular-nums mt-0.5">
                  {dmsLat} • {dmsLng}
                </div>
              </div>

              <button
                onClick={handleRefreshGPS}
                disabled={isUpdatingGPS}
                className="mt-2 py-1 px-2 border border-black bg-[#eee] hover:bg-black hover:text-white text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isUpdatingGPS ? 'animate-spin' : ''}`} />
                <span>{isUpdatingGPS ? 'Obtendo GPS...' : 'Atualizar GPS Satélite'}</span>
              </button>
            </div>
          </div>

          {/* Link para Posição no Mapa */}
          <div className="border-2 border-black bg-[#f0fdf4] p-3 shadow-[2px_2px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#15803d] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs uppercase text-[#15803d]">
                  Link para Localização no Mapa (Resgate):
                </div>
                <div className="text-[11px] text-black font-mono break-all select-all">
                  {mapLink}
                </div>
              </div>
            </div>
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-3 py-1.5 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs uppercase flex items-center gap-1 cursor-pointer shadow-[2px_2px_0px_#000] border-2 border-black"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir no Mapa</span>
            </a>
          </div>

          {/* Campo de Observações Adicionais */}
          <div>
            <label htmlFor="sos-notes" className="block text-[11px] font-bold uppercase text-[#444] mb-1">
              Observação Adicional de Bordo (opcional, ex: motor em pane, água a bordo, 4 pessoas):
            </label>
            <input
              id="sos-notes"
              type="text"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Ex: Motor avariado, 3 tripulantes a bordo com coletes, sem propulsão"
              className="w-full p-2 border-2 border-black bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#d42020]"
            />
          </div>

          {/* Mensagem Gerada de Socorro */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold uppercase text-[11px] text-[#222] flex items-center gap-1.5">
                <LifeBuoy className="w-3.5 h-3.5 text-[#d42020]" />
                Texto Formatado para Transmissão de Emergência:
              </span>
              <span className="text-[10px] text-[#888] font-mono">
                {copied ? '✓ COPIADO PARA A ÁREA DE TRANSFERÊNCIA' : 'Pronto para envio'}
              </span>
            </div>

            <div className="relative">
              <textarea
                readOnly
                rows={9}
                value={sosMessage}
                className="w-full p-3 border-2 border-black bg-white text-[11px] font-mono select-all leading-relaxed resize-none shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06)] focus:outline-none"
              />
            </div>
          </div>

          {/* Ações Táticas de Disparo e Comunicação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
            {/* Copiar */}
            <button
              onClick={handleCopyMessage}
              className={`p-2.5 border-2 border-black font-bold uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-[2px_2px_0px_#000] ${
                copied
                  ? 'bg-[#15803d] text-white border-[#15803d]'
                  : 'bg-black text-white hover:bg-[#333]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Mensagem Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Mensagem</span>
                </>
              )}
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              className="p-2.5 border-2 border-black bg-[#25d366] hover:bg-[#20ba59] text-black font-bold uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-[2px_2px_0px_#000]"
            >
              <Send className="w-4 h-4 text-black" />
              <span>Enviar via WhatsApp</span>
            </button>

            {/* Compartilhar Geral */}
            <button
              onClick={handleShareMessage}
              className="p-2.5 border-2 border-black bg-white hover:bg-[#eee] text-black font-bold uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-[2px_2px_0px_#000]"
            >
              <Share2 className="w-4 h-4 text-black" />
              <span>Compartilhar SOS</span>
            </button>
          </div>

          {/* Seção Salvamar Brasil & Alarme Sonoro */}
          <div className="border-t-2 border-black pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#fff5f5] p-3 border-2 border-[#d42020]">
            <div className="flex items-center gap-2 text-xs">
              <PhoneCall className="w-4 h-4 text-[#d42020] shrink-0" />
              <div>
                <span className="font-bold text-[#d42020] uppercase block">
                  Salvamar Brasil (Marinha): Emergências Marítimas
                </span>
                <span className="text-[11px] text-[#444]">
                  Ligue <strong className="text-black">185</strong> ou chame no <strong className="text-black">VHF Canal 16</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href="tel:185"
                className="flex-1 sm:flex-none px-3 py-1.5 bg-[#d42020] hover:bg-[#b01010] text-white font-bold text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000]"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Ligar 185</span>
              </a>

              <button
                onClick={handlePlayMorseSOS}
                title="Sinal sonoro marítimo de socorro em código Morse (... --- ...)"
                className={`flex-1 sm:flex-none px-3 py-1.5 border-2 border-black font-bold text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-[2px_2px_0px_#000] ${
                  isPlayingAudio ? 'bg-[#d42020] text-white animate-pulse' : 'bg-white hover:bg-[#eee] text-black'
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Tocando SOS...</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-[#d42020]" />
                    <span>Alarme Morse</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#eeebe6] p-3 border-t-2 border-black flex items-center justify-between shrink-0 text-[10px] text-[#555]">
          <span className="flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-[#d42020]" />
            Mantenha a calma, vista coletes salva-vidas e mantenha o rádio VHF no canal 16.
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 border-2 border-black bg-white hover:bg-black hover:text-white font-bold uppercase cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmergencySOSModal;
