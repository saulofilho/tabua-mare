import React, { useState } from 'react';
import { VesselProfile } from '../types/tide';
import { X } from 'lucide-react';

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
              Vessel Draft Calibration
            </h3>
            <p className="text-xs text-[#888888] uppercase mt-0.5">
              Under-Keel Clearance Parameters (UKC)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 border-2 border-black hover:bg-black hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs font-bold">
          <div>
            <label className="block uppercase text-[11px] mb-1">
              VESSEL_NAME
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border-2 border-black bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block uppercase text-[11px] mb-1">
                HULL_TYPE
              </label>
              <select
                value={vesselType}
                onChange={(e) =>
                  setVesselType(e.target.value as VesselProfile['vesselType'])
                }
                className="w-full p-2 border-2 border-black bg-white cursor-pointer"
              >
                <option value="veleiro">Veleiro (Quilha Fixa)</option>
                <option value="lancha">Lancha / Fast Boat</option>
                <option value="pesqueiro">Pesqueiro / Trawler</option>
                <option value="catamara">Catamarã</option>
                <option value="escuna">Escuna</option>
              </select>
            </div>

            <div>
              <label className="block uppercase text-[11px] mb-1">
                DRAFT (CALADO) [M]
              </label>
              <input
                type="number"
                step="0.05"
                min="0.3"
                max="5.0"
                value={draft}
                onChange={(e) => setDraft(Number(e.target.value))}
                className="w-full p-2 border-2 border-black bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block uppercase text-[11px] mb-1">
                SAFETY_BUFFER (UKC) [M]
              </label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="2.0"
                value={safetyMargin}
                onChange={(e) => setSafetyMargin(Number(e.target.value))}
                className="w-full p-2 border-2 border-black bg-white"
              />
            </div>

            <div>
              <label className="block uppercase text-[11px] mb-1">
                AIR_DRAFT (MASTRO) [M]
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="25.0"
                value={airDraft}
                onChange={(e) => setAirDraft(Number(e.target.value))}
                className="w-full p-2 border-2 border-black bg-white"
              />
            </div>
          </div>

          <div className="p-3 border-2 border-black bg-[#eeebe6] text-[11px] text-black">
            <strong>TACTICAL MARITIME RULE:</strong> Alertas sonoros serão disparados se a lâmina d'água restante sobre a quilha cair abaixo de {safetyMargin.toFixed(2)}m em qualquer baixio ou canal.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t-2 border-black">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border-2 border-black bg-white text-black uppercase cursor-pointer hover:bg-[#eeebe6]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-black text-white uppercase cursor-pointer hover:bg-[#333]"
            >
              UPDATE VESSEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
