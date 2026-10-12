import React, { useState } from 'react';
import { VesselProfile } from '../types/tide';
import { X, HelpCircle } from 'lucide-react';

interface VesselConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  vessel: VesselProfile;
  onSave: (profile: VesselProfile) => void;
}

export const VesselConfigModal: React.FC<VesselConfigModalProps> = ({
  isOpen,
  onClose,
  vessel,
  onSave,
}) => {
  const [name, setName] = useState<string>(vessel.name);
  const [vesselType, setVesselType] = useState<VesselProfile['vesselType']>(vessel.vesselType);
  const [draft, setDraft] = useState<number>(vessel.draft);
  const [safetyMargin, setSafetyMargin] = useState<number>(vessel.safetyMargin);
  const [airDraft, setAirDraft] = useState<number>(vessel.airDraft);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim() || 'Albatroz',
      vesselType,
      draft,
      safetyMargin,
      airDraft,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono">
      <div className="bg-[#f8f7f4] border-4 border-black w-full max-w-lg p-6 shadow-[8px_8px_0px_#000] overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b-2 border-black">
          <div>
            <h3 className="font-display text-2xl font-bold uppercase text-black">
              Calibrar Dados do Barco
            </h3>
            <p className="text-xs text-[#888888] uppercase mt-0.5">
              Medidas para Não Encalhar e Navegar com Segurança
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar configuração da embarcação"
            className="p-1 border-2 border-black hover:bg-black hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs font-bold">
          <div>
            <label htmlFor="vessel-name-input" className="block uppercase text-[11px] mb-1">
              Nome da Embarcação
            </label>
            <input
              id="vessel-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border-2 border-black bg-white"
              placeholder="Ex: Albatroz, Marujo..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="vessel-type-select" className="block uppercase text-[11px] mb-1">
                Tipo de Embarcação
              </label>
              <select
                id="vessel-type-select"
                value={vesselType}
                onChange={(e) =>
                  setVesselType(e.target.value as VesselProfile['vesselType'])
                }
                className="w-full p-2 border-2 border-black bg-white cursor-pointer"
              >
                <option value="veleiro">Veleiro (Quilha Fixa)</option>
                <option value="lancha">Lancha / Bote Motorizado</option>
                <option value="pesqueiro">Barco de Pesca / Traineira</option>
                <option value="catamara">Catamarã (Dois Cascos)</option>
                <option value="escuna">Escuna de Passeio</option>
              </select>
            </div>

            <div>
              <label htmlFor="vessel-draft-input" className="block uppercase text-[11px] mb-1">
                Calado (Profundidade Submersa) [m]
              </label>
              <input
                id="vessel-draft-input"
                type="number"
                step="0.05"
                min="0.3"
                max="5.0"
                value={draft}
                onChange={(e) => setDraft(Number(e.target.value))}
                className="w-full p-2 border-2 border-black bg-white"
              />
              <span className="text-[10px] text-[#666] font-normal block mt-0.5">
                Quanto o barco afunda na água
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="vessel-safety-margin-input" className="block uppercase text-[11px] mb-1">
                Folga Mínima Sob o Barco (UKC) [m]
              </label>
              <input
                id="vessel-safety-margin-input"
                type="number"
                step="0.05"
                min="0.1"
                max="2.0"
                value={safetyMargin}
                onChange={(e) => setSafetyMargin(Number(e.target.value))}
                className="w-full p-2 border-2 border-black bg-white"
              />
              <span className="text-[10px] text-[#666] font-normal block mt-0.5">
                Espaço reserva entre a quilha e o fundo
              </span>
            </div>

            <div>
              <label htmlFor="vessel-air-draft-input" className="block uppercase text-[11px] mb-1">
                Altura Total / Mastro [m]
              </label>
              <input
                id="vessel-air-draft-input"
                type="number"
                step="0.1"
                min="1.0"
                max="25.0"
                value={airDraft}
                onChange={(e) => setAirDraft(Number(e.target.value))}
                className="w-full p-2 border-2 border-black bg-white"
              />
              <span className="text-[10px] text-[#666] font-normal block mt-0.5">
                Para passar sob pontes e cabos
              </span>
            </div>
          </div>

          <div className="p-3 border-2 border-black bg-[#eeebe6] text-[11px] text-black leading-relaxed">
            <strong>Regra de Segurança da Maré:</strong> O aplicativo calculará automaticamente se a profundidade da água no momento é suficiente para o calado do seu barco ({draft.toFixed(2)}m) mais a folga de segurança ({safetyMargin.toFixed(2)}m), avisando se houver risco de raspar ou encalhar.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t-2 border-black">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border-2 border-black bg-white text-black uppercase cursor-pointer hover:bg-[#eeebe6]"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-black text-white uppercase cursor-pointer hover:bg-[#333]"
            >
              SALVAR CONFIGURAÇÃO
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
