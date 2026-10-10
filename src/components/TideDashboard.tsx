import React from 'react';
import {
  CurrentTideStatus,
  TideExtreme,
  TideStation,
  VesselProfile,
} from '../types/tide';
import { calculateUKC } from '../utils/tideHarmonics';
import { ArrowDownRight, ArrowUpRight, ShieldCheck, ShieldAlert } from 'lucide-react';

interface TideDashboardProps {
  station: TideStation;
  allStations: TideStation[];
  onSelectStation: (station: TideStation) => void;
  status: CurrentTideStatus;
  todayExtremes: TideExtreme[];
  vessel: VesselProfile;
  onOpenVesselModal: () => void;
  onOpenAlertsModal: () => void;
}

export const TideDashboard: React.FC<TideDashboardProps> = ({
  station,
  allStations,
  onSelectStation,
  status,
  todayExtremes,
  vessel,
  onOpenVesselModal,
  onOpenAlertsModal,
}) => {
  // Reference shallow channel (2.5m charted depth)
  const refChartedDepth = 2.5;
  const ukcResult = calculateUKC(refChartedDepth, status.currentHeight, vessel.draft);

  return (
    <div className="w-full">
      {/* 3 Top Tactical Cells */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-black">
        {/* Cell 1: Altitude Realtime */}
        <div className="p-6 border-b-2 md:border-b-0 md:border-r-2 border-black bg-[#f8f7f4]">
          <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-2">
            Altitude Realtime // {station.name.split(' ')[0]}
          </span>
          <div className="font-display text-6xl lg:text-7xl font-bold leading-none tracking-tight text-[#111111] tabular-nums">
            {status.currentHeight.toFixed(2)}
            <span className="text-2xl font-display ml-1">M</span>
          </div>
          <div
            className={`font-mono text-xs font-bold uppercase mt-2 flex items-center gap-1.5 ${
              status.tendency === 'enchente'
                ? 'text-[#111111]'
                : status.tendency === 'vazante'
                ? 'text-[#d42020]'
                : 'text-[#888888]'
            }`}
          >
            {status.tendency === 'enchente' ? (
              <>
                <ArrowUpRight className="w-4 h-4 text-[#111111]" />
                <span>RISING / +{status.rateCmPerHour} CM/H</span>
              </>
            ) : status.tendency === 'vazante' ? (
              <>
                <ArrowDownRight className="w-4 h-4 text-[#d42020]" />
                <span>FALLING / {status.rateCmPerHour} CM/H</span>
              </>
            ) : (
              <span>STAGNANT / 0.0 CM/H</span>
            )}
          </div>
        </div>

        {/* Cell 2: Next Extreme Event */}
        <div className="p-6 border-b-2 md:border-b-0 md:border-r-2 border-black bg-[#f8f7f4]">
          <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-2">
            Next Extreme Event
          </span>
          <div className="font-display text-6xl lg:text-7xl font-bold leading-none tracking-tight text-[#111111] tabular-nums">
            {status.nextExtreme.timeString}
          </div>
          <div className="font-mono text-xs font-bold uppercase mt-2 text-[#111111]">
            {status.nextExtreme.type === 'preia-mar' ? 'HIGH_TIDE' : 'LOW_TIDE'} @{' '}
            {status.nextExtreme.height.toFixed(2)}M
          </div>
        </div>

        {/* Cell 3: Keel Clearance (UKC) */}
        <div className="p-6 bg-[#f8f7f4]">
          <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-2">
            Keel Clearance (UKC)
          </span>
          <div className="font-display text-6xl lg:text-7xl font-bold leading-none tracking-tight text-[#111111] tabular-nums">
            {ukcResult.ukc >= 0 ? `+${ukcResult.ukc.toFixed(2)}` : ukcResult.ukc.toFixed(2)}
          </div>
          <div
            className={`font-mono text-xs font-bold uppercase mt-2 ${
              ukcResult.safetyStatus === 'safe'
                ? 'text-[#008800]'
                : ukcResult.safetyStatus === 'caution'
                ? 'text-[#b45309]'
                : 'text-[#d42020]'
            }`}
          >
            {ukcResult.safetyStatus === 'safe'
              ? `SAFE_ZONE // ${ukcResult.actualDepth.toFixed(2)}M EFF.`
              : ukcResult.safetyStatus === 'caution'
              ? `CAUTION // ${ukcResult.actualDepth.toFixed(2)}M EFF.`
              : `CRITICAL_SHALLOW // ${ukcResult.actualDepth.toFixed(2)}M EFF.`}
          </div>
        </div>
      </div>

      {/* Split Mid Section: Daily Data Log + Sidebar Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 border-b-2 border-black">
        {/* Daily Data Log / DHN Standard Table (2 Columns) */}
        <div className="lg:col-span-2 p-6 border-b-2 lg:border-b-0 lg:border-r-2 border-black bg-white">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888]">
              Daily Data Log / DHN Standard
            </span>
            <span className="font-mono text-[10px] font-bold text-black border border-black px-1.5 py-0.5">
              DATUM: 0.00M
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="pb-2 font-bold uppercase text-[11px]">EVENT_TYPE</th>
                  <th className="pb-2 font-bold uppercase text-[11px]">TIME</th>
                  <th className="pb-2 font-bold uppercase text-[11px]">HEIGHT</th>
                  <th className="pb-2 font-bold uppercase text-[11px]">KEEL_CLEAR</th>
                  <th className="pb-2 font-bold uppercase text-[11px] text-right">OPS_STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {todayExtremes.map((ext, idx) => {
                  const actD = ext.height + refChartedDepth;
                  const clearance = actD - vessel.draft;
                  const isSafe = clearance >= vessel.safetyMargin;

                  return (
                    <tr key={`${ext.timeString}-${idx}`} className="hover:bg-[#f8f7f4] transition-colors">
                      <td className="py-2.5 font-bold">
                        {ext.type === 'preia-mar' ? 'HIGH_TIDE' : 'LOW_TIDE'}
                      </td>
                      <td className="py-2.5 font-bold tabular-nums">{ext.timeString}</td>
                      <td className="py-2.5 tabular-nums">{ext.height.toFixed(2)}m</td>
                      <td className="py-2.5 tabular-nums">
                        {clearance >= 0 ? `+${clearance.toFixed(2)}m` : `${clearance.toFixed(2)}m`}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`font-mono font-bold text-[10px] px-2 py-0.5 uppercase ${
                            isSafe
                              ? 'bg-black text-white'
                              : 'bg-[#d42020] text-white'
                          }`}
                        >
                          {isSafe ? 'DEEP_WATER' : 'RESTRICTED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Controls (1 Column) */}
        <div className="p-6 bg-[#eeebe6] flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div>
              <label
                htmlFor="tactical-station-select"
                className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-1.5"
              >
                Station Selection
              </label>
              <select
                id="tactical-station-select"
                value={station.id}
                onChange={(e) => {
                  const found = allStations.find((s) => s.id === e.target.value);
                  if (found) onSelectStation(found);
                }}
                className="w-full border-2 border-black p-2 font-mono text-xs font-bold bg-white text-black focus:outline-none cursor-pointer"
              >
                {allStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-1.5">
                Active Vessel
              </span>
              <button
                onClick={onOpenVesselModal}
                className="w-full border-2 border-black p-2 font-mono text-xs font-bold bg-white text-black hover:bg-[#f8f7f4] text-left flex items-center justify-between cursor-pointer"
              >
                <span>{vessel.name} ({vessel.draft.toFixed(2)}m Draft)</span>
                <span className="text-[10px] uppercase underline">EDIT</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-black/20">
            <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#888888] mb-1">
              Gravitational Phase
            </span>
            <div className="font-mono font-bold text-sm text-[#111111] uppercase">
              {status.moon.phaseName} // {status.moon.illumination}% ILLUM.
            </div>
            {status.moon.isSpringTide && (
              <div className="font-mono text-xs font-bold text-[#d42020] uppercase mt-1">
                SIZIGY ALERT: MAX_VAR ({status.moon.springTideName})
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
