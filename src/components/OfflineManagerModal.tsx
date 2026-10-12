import React, { useState } from 'react';
import { OfflineRegionStatus, TideStation } from '../types/tide';
import {
  downloadStationOfflinePack,
  removeStationOfflinePack,
  getTotalOfflineStorageUsed,
} from '../utils/offlineMapStorage';
import { Download, Trash2, Wifi, WifiOff, X } from 'lucide-react';

interface OfflineManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stations: TideStation[];
  offlineStatuses: Record<string, OfflineRegionStatus>;
  onRefreshStatuses: () => void;
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
}

export const OfflineManagerModal: React.FC<OfflineManagerModalProps> = ({
  isOpen,
  onClose,
  stations,
  offlineStatuses,
  onRefreshStatuses,
  isOfflineMode,
  onToggleOfflineMode,
}) => {
  const [downloadingStationId, setDownloadingStationId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  if (!isOpen) return null;

  const storageStats = getTotalOfflineStorageUsed(offlineStatuses);

  const handleDownload = async (station: TideStation) => {
    setDownloadingStationId(station.id);
    setDownloadProgress(0);

    try {
      await downloadStationOfflinePack(station, (pct) => {
        setDownloadProgress(pct);
      });
      onRefreshStatuses();
    } finally {
      setDownloadingStationId(null);
      setDownloadProgress(0);
    }
  };

  const handleRemove = async (stationId: string) => {
    await removeStationOfflinePack(stationId);
    onRefreshStatuses();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono">
      <div className="bg-[#f8f7f4] border-4 border-black w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[8px_8px_0px_#000] overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 border-b-2 border-black flex items-center justify-between bg-white">
          <div>
            <h3 className="font-display text-2xl font-bold uppercase text-black">
              Cartas Náuticas e Mapas Offline
            </h3>
            <p className="text-xs text-[#888888] uppercase mt-0.5">
              Navegação Segura em Alto-Mar Mesmo Sem Sinal de Internet
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar gerenciador de mapas offline"
            className="p-1 border-2 border-black hover:bg-black hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Faixa de estatísticas de armazenamento */}
        <div className="px-5 py-3 bg-[#eeebe6] border-b-2 border-black flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          <div>
            ESPAÇO UTILIZADO: <span className="text-black">{storageStats.totalMB} MB</span> ·{' '}
            <span>{storageStats.downloadedCount} REGIÕES SALVAS OFFLINE</span>
          </div>

          <button
            onClick={onToggleOfflineMode}
            className={`px-3 py-1 border-2 border-black uppercase text-xs cursor-pointer ${
              isOfflineMode ? 'bg-[#d42020] text-white' : 'bg-white text-black'
            }`}
          >
            {isOfflineMode ? 'MODO SEM INTERNET: ATIVO' : 'MODO ONLINE: CONECTADO'}
          </button>
        </div>

        {/* Lista de regiões para download */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 bg-[#f8f7f4]">
          {stations.map((st) => {
            const status = offlineStatuses[st.id];
            const isDownloaded = status?.isDownloaded;
            const isDownloading = downloadingStationId === st.id;

            return (
              <div
                key={st.id}
                className="p-3.5 border-2 border-black bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_#000]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase text-sm text-black">
                      {st.name} ({st.state})
                    </span>
                    {isDownloaded && (
                      <span className="bg-black text-white px-1.5 py-0.2 text-[10px] font-bold">
                        SALVO NO APARELHO
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#666] mt-0.5">{st.portName}</div>
                  <div className="text-[10px] text-[#888888] mt-1">
                    TAMANHO APROXIMADO: ~{st.offlineSizeMB} MB · {st.hazards.length} PONTOS CRÍTICOS NÁUTICOS
                  </div>

                  {isDownloading && (
                    <div className="mt-2 w-full max-w-xs">
                      <div className="flex justify-between text-[10px] font-bold text-black mb-1">
                        <span>BAIXANDO MAPAS NÁUTICOS...</span>
                        <span>{downloadProgress}%</span>
                      </div>
                      <div className="w-full h-2 border border-black bg-white">
                        <div
                          className="h-full bg-black transition-all duration-200"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isDownloaded ? (
                    <button
                      onClick={() => handleRemove(st.id)}
                      className="px-3 py-1.5 border-2 border-[#d42020] text-[#d42020] hover:bg-[#d42020] hover:text-white font-bold text-xs uppercase cursor-pointer transition-colors"
                    >
                      EXCLUIR DO APARELHO
                    </button>
                  ) : (
                    <button
                      disabled={isDownloading}
                      onClick={() => handleDownload(st)}
                      className="px-3.5 py-1.5 bg-black hover:bg-[#333] text-white font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
                    >
                      {isDownloading ? 'BAIXANDO...' : 'BAIXAR PACOTE OFFLINE'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-white border-t-2 border-black flex items-center justify-between text-xs">
          <span className="text-[#888888] uppercase">
            Mapas salvos na memória local do navegador para uso sem rede
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black text-white font-bold uppercase text-xs cursor-pointer hover:bg-[#333]"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineManagerModal;
