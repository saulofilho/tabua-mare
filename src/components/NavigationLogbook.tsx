import React, { useState } from 'react';
import {
  NavigationLogEntry,
  CurrentTideStatus,
  TideStation,
  VesselProfile,
  TemperatureUnit,
} from '../types/tide';
import { RealMarineConditions, formatTemperature } from '../services/realMarineApi';
import {
  Anchor,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Compass,
  Download,
  Edit2,
  FileSpreadsheet,
  Flag,
  MapPin,
  Navigation,
  Plus,
  Ship,
  Trash2,
  Users,
  Waves,
  Wind,
  Droplets,
  CloudSun,
  AlertCircle,
  Search,
} from 'lucide-react';

interface NavigationLogbookProps {
  entries: NavigationLogEntry[];
  onAddEntry: (entry: NavigationLogEntry) => void;
  onUpdateEntry: (entry: NavigationLogEntry) => void;
  onDeleteEntry: (id: string) => void;
  currentStation: TideStation;
  currentStatus: CurrentTideStatus;
  currentVessel: VesselProfile;
  realMarineConditions?: RealMarineConditions | null;
  tempUnit: TemperatureUnit;
  activeBeachName: string;
}

export const NavigationLogbook: React.FC<NavigationLogbookProps> = ({
  entries,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  currentStation,
  currentStatus,
  currentVessel,
  realMarineConditions,
  tempUnit,
  activeBeachName,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ongoing' | 'completed'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<NavigationLogEntry>>({
    title: '',
    vesselName: currentVessel.name,
    vesselType: currentVessel.vesselType,
    status: 'completed',
    departureLocation: activeBeachName || currentStation.name,
    departureTime: new Date().toTimeString().slice(0, 5),
    departureTideHeight: Number(currentStatus.currentHeight.toFixed(2)),
    departureTideTendency: currentStatus.tendency,
    arrivalLocation: '',
    arrivalTime: '',
    arrivalTideHeight: undefined,
    arrivalTideTendency: undefined,
    date: new Date().toISOString().slice(0, 10),
    crewCount: 2,
    distanceNm: 5,
    vesselDraft: currentVessel.draft,
    ukcClearance: Number((2.5 + currentStatus.currentHeight - currentVessel.draft).toFixed(2)),
    waterTempCelsius: realMarineConditions?.oceanWaterTempCelsius,
    airTempCelsius: realMarineConditions?.airTempCelsius,
    waveHeightMeters: realMarineConditions?.waveHeightMeters,
    windSpeedKmH: realMarineConditions?.windSpeedKmH,
    notes: '',
  });

  const ongoingEntries = entries.filter((e) => e.status === 'ongoing');

  // Handle Quick departure logging right now
  const handleQuickLogDeparture = () => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    const dateStr = now.toISOString().slice(0, 10);
    const estUkc = Number((2.5 + currentStatus.currentHeight - currentVessel.draft).toFixed(2));

    const newLog: NavigationLogEntry = {
      id: `log-${Date.now()}`,
      createdAt: Date.now(),
      date: dateStr,
      title: `Saída de ${activeBeachName || currentStation.name}`,
      vesselName: currentVessel.name,
      vesselType: currentVessel.vesselType,
      status: 'ongoing',
      departureLocation: activeBeachName || currentStation.name,
      departureTime: timeStr,
      departureTideHeight: Number(currentStatus.currentHeight.toFixed(2)),
      departureTideTendency: currentStatus.tendency,
      waterTempCelsius: realMarineConditions?.oceanWaterTempCelsius,
      airTempCelsius: realMarineConditions?.airTempCelsius,
      waveHeightMeters: realMarineConditions?.waveHeightMeters,
      windSpeedKmH: realMarineConditions?.windSpeedKmH,
      vesselDraft: currentVessel.draft,
      ukcClearance: estUkc,
      crewCount: 2,
      notes: `Saída registrada em tempo real com maré a ${currentStatus.currentHeight.toFixed(2)}m (${currentStatus.tendency}).`,
    };

    onAddEntry(newLog);
  };

  // Complete an ongoing voyage right now
  const handleCompleteVoyageNow = (entry: NavigationLogEntry) => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);

    const updated: NavigationLogEntry = {
      ...entry,
      status: 'completed',
      arrivalLocation: entry.arrivalLocation || activeBeachName || currentStation.name,
      arrivalTime: timeStr,
      arrivalTideHeight: Number(currentStatus.currentHeight.toFixed(2)),
      arrivalTideTendency: currentStatus.tendency,
      notes: entry.notes
        ? `${entry.notes} Chegada concluída às ${timeStr} com maré a ${currentStatus.currentHeight.toFixed(2)}m.`
        : `Chegada concluída às ${timeStr} com maré a ${currentStatus.currentHeight.toFixed(2)}m (${currentStatus.tendency}).`,
    };

    onUpdateEntry(updated);
  };

  const openNewEntryModal = () => {
    const now = new Date();
    setEditingEntryId(null);
    setFormData({
      title: `Navegação em ${activeBeachName || currentStation.name}`,
      vesselName: currentVessel.name,
      vesselType: currentVessel.vesselType,
      status: 'completed',
      departureLocation: activeBeachName || currentStation.name,
      departureTime: now.toTimeString().slice(0, 5),
      departureTideHeight: Number(currentStatus.currentHeight.toFixed(2)),
      departureTideTendency: currentStatus.tendency,
      arrivalLocation: '',
      arrivalTime: '',
      arrivalTideHeight: undefined,
      arrivalTideTendency: undefined,
      date: now.toISOString().slice(0, 10),
      crewCount: 2,
      distanceNm: 8,
      vesselDraft: currentVessel.draft,
      ukcClearance: Number((2.5 + currentStatus.currentHeight - currentVessel.draft).toFixed(2)),
      waterTempCelsius: realMarineConditions?.oceanWaterTempCelsius,
      airTempCelsius: realMarineConditions?.airTempCelsius,
      waveHeightMeters: realMarineConditions?.waveHeightMeters,
      windSpeedKmH: realMarineConditions?.windSpeedKmH,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (entry: NavigationLogEntry) => {
    setEditingEntryId(entry.id);
    setFormData({ ...entry });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.departureLocation || !formData.departureTime) return;

    if (editingEntryId) {
      const existing = entries.find((item) => item.id === editingEntryId);
      if (existing) {
        onUpdateEntry({
          ...existing,
          ...(formData as NavigationLogEntry),
        });
      }
    } else {
      const newEntry: NavigationLogEntry = {
        id: `log-${Date.now()}`,
        createdAt: Date.now(),
        date: formData.date || new Date().toISOString().slice(0, 10),
        title: formData.title || 'Navegação sem título',
        vesselName: formData.vesselName || currentVessel.name,
        vesselType: formData.vesselType || currentVessel.vesselType,
        status: formData.status || 'completed',
        departureLocation: formData.departureLocation || activeBeachName,
        departureTime: formData.departureTime || '08:00',
        departureTideHeight: Number(formData.departureTideHeight ?? currentStatus.currentHeight),
        departureTideTendency: formData.departureTideTendency,
        arrivalLocation: formData.arrivalLocation,
        arrivalTime: formData.arrivalTime,
        arrivalTideHeight: formData.arrivalTideHeight !== undefined ? Number(formData.arrivalTideHeight) : undefined,
        arrivalTideTendency: formData.arrivalTideTendency,
        waterTempCelsius: formData.waterTempCelsius,
        airTempCelsius: formData.airTempCelsius,
        waveHeightMeters: formData.waveHeightMeters,
        windSpeedKmH: formData.windSpeedKmH,
        vesselDraft: formData.vesselDraft,
        ukcClearance: formData.ukcClearance,
        crewCount: formData.crewCount,
        distanceNm: formData.distanceNm,
        notes: formData.notes,
      };
      onAddEntry(newEntry);
    }

    setIsModalOpen(false);
  };

  // Helper to fill current real-time tide in form
  const fillRealtimeDeparture = () => {
    const now = new Date();
    setFormData((prev) => ({
      ...prev,
      departureLocation: activeBeachName || currentStation.name,
      departureTime: now.toTimeString().slice(0, 5),
      departureTideHeight: Number(currentStatus.currentHeight.toFixed(2)),
      departureTideTendency: currentStatus.tendency,
      waterTempCelsius: realMarineConditions?.oceanWaterTempCelsius,
      airTempCelsius: realMarineConditions?.airTempCelsius,
      waveHeightMeters: realMarineConditions?.waveHeightMeters,
      windSpeedKmH: realMarineConditions?.windSpeedKmH,
    }));
  };

  const fillRealtimeArrival = () => {
    const now = new Date();
    setFormData((prev) => ({
      ...prev,
      arrivalLocation: activeBeachName || currentStation.name,
      arrivalTime: now.toTimeString().slice(0, 5),
      arrivalTideHeight: Number(currentStatus.currentHeight.toFixed(2)),
      arrivalTideTendency: currentStatus.tendency,
      status: 'completed',
    }));
  };

  // Export entries as CSV
  const handleExportCSV = () => {
    if (entries.length === 0) return;
    const headers = [
      'Data',
      'Titulo',
      'Status',
      'Embarcacao',
      'Local_Saida',
      'Hora_Saida',
      'Mare_Saida_m',
      'Tendencia_Saida',
      'Local_Chegada',
      'Hora_Chegada',
      'Mare_Chegada_m',
      'Tendencia_Chegada',
      'Distancia_NM',
      'Tripulacao',
      'Temp_Agua_C',
      'Temp_Ar_C',
      'Notas',
    ];

    const rows = entries.map((e) => [
      `"${e.date}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.status}"`,
      `"${e.vesselName}"`,
      `"${e.departureLocation}"`,
      `"${e.departureTime}"`,
      e.departureTideHeight,
      `"${e.departureTideTendency || ''}"`,
      `"${e.arrivalLocation || ''}"`,
      `"${e.arrivalTime || ''}"`,
      e.arrivalTideHeight ?? '',
      `"${e.arrivalTideTendency || ''}"`,
      e.distanceNm ?? '',
      e.crewCount ?? '',
      e.waterTempCelsius ?? '',
      e.airTempCelsius ?? '',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `diario_navegacao_maresegura_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered entries
  const filteredEntries = entries
    .filter((e) => {
      if (filterStatus === 'ongoing') return e.status === 'ongoing';
      if (filterStatus === 'completed') return e.status === 'completed';
      return true;
    })
    .filter((e) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        e.title.toLowerCase().includes(term) ||
        e.departureLocation.toLowerCase().includes(term) ||
        (e.arrivalLocation && e.arrivalLocation.toLowerCase().includes(term)) ||
        e.vesselName.toLowerCase().includes(term) ||
        (e.notes && e.notes.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  // Statistics
  const totalTrips = entries.length;
  const completedTrips = entries.filter((e) => e.status === 'completed').length;
  const avgDepartureTide =
    entries.length > 0
      ? (entries.reduce((acc, curr) => acc + curr.departureTideHeight, 0) / entries.length).toFixed(2)
      : '0.00';
  const totalDistanceNm = entries.reduce((acc, curr) => acc + (curr.distanceNm || 0), 0);

  // Calculate duration between two HH:MM strings
  const calculateDuration = (depTime: string, arrTime?: string): string => {
    if (!arrTime) return 'Em navegação';
    const [dh, dm] = depTime.split(':').map(Number);
    const [ah, am] = arrTime.split(':').map(Number);
    if (isNaN(dh) || isNaN(dm) || isNaN(ah) || isNaN(am)) return '--';
    let depTotal = dh * 60 + dm;
    let arrTotal = ah * 60 + am;
    if (arrTotal < depTotal) {
      arrTotal += 24 * 60; // Next day
    }
    const diff = arrTotal - depTotal;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  return (
    <div className="w-full font-mono bg-[#f8f7f4] min-h-[600px] p-4 sm:p-6 space-y-6">
      {/* Top Header Section */}
      <div className="border-2 border-black bg-white p-5 sm:p-6 shadow-[3px_3px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-black text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-wider flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-[#d42020]" />
              LIVRO DE BORDO DIGITAL
            </span>
            <span className="text-[11px] font-bold text-[#666] uppercase">
              // HISTÓRICO NÁUTICO & MARÉS
            </span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-black">
            Diário de Navegação
          </h2>
          <p className="text-xs text-[#555] max-w-2xl mt-1">
            Registre suas partidas e chegadas com a cota exata da maré em cada momento, condições marítimas e histórico de folga sob a quilha. Armazenado localmente e seguro para navegações sem internet.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleQuickLogDeparture}
            title="Registrar saída imediata com a maré e horário atual da praia ativa"
            className="px-4 py-2.5 bg-black hover:bg-[#333] text-white text-xs font-bold uppercase flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_#000] transition-colors"
          >
            <Anchor className="w-4 h-4 text-[#d42020]" />
            <span>REGISTRAR SAÍDA AGORA ({currentStatus.currentHeight.toFixed(2)}M)</span>
          </button>

          <button
            onClick={openNewEntryModal}
            className="px-3.5 py-2.5 border-2 border-black bg-[#eeebe6] hover:bg-black hover:text-white text-black text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>NOVO REGISTRO MANUAL</span>
          </button>

          {entries.length > 0 && (
            <button
              onClick={handleExportCSV}
              title="Baixar histórico do diário em formato CSV"
              className="px-3 py-2.5 border-2 border-black bg-white hover:bg-[#eeebe6] text-black text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORTAR CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Ongoing Trips Alert Banner */}
      {ongoingEntries.length > 0 && (
        <div className="space-y-3">
          {ongoingEntries.map((ongoing) => (
            <div
              key={ongoing.id}
              className="border-2 border-black bg-[#fffbeb] p-4 sm:p-5 shadow-[3px_3px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 border-2 border-black bg-[#fef3c7] flex items-center justify-center shrink-0">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 animate-ping inline-block" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-black text-white text-[10px] font-bold uppercase px-2 py-0.5">
                      VIAGEM EM CURSO
                    </span>
                    <span className="text-xs text-[#888] font-bold">
                      INICIADA ÀS {ongoing.departureTime}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold uppercase text-black mt-0.5">
                    {ongoing.title}
                  </h3>
                  <div className="text-xs text-[#555] flex flex-wrap items-center gap-3 mt-1">
                    <span>
                      Saída: <strong>{ongoing.departureLocation}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Maré na Saída:{' '}
                      <strong className="text-black font-bold">
                        {ongoing.departureTideHeight.toFixed(2)}m ({ongoing.departureTideTendency || 'maré'})
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Embarcação: <strong>{ongoing.vesselName}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Complete arrival action */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCompleteVoyageNow(ongoing)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase flex items-center gap-2 cursor-pointer shadow-[2px_2px_0px_#000] transition-colors"
                >
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span>
                    CONCLUIR CHEGADA AGORA (MARÉ: {currentStatus.currentHeight.toFixed(2)}M)
                  </span>
                </button>
                <button
                  onClick={() => openEditModal(ongoing)}
                  className="p-2 border-2 border-black bg-white hover:bg-[#eeebe6] text-black cursor-pointer"
                  title="Editar viagem"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Telemetry Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="border-2 border-black bg-white p-4 shadow-[2px_2px_0px_#000]">
          <span className="text-[10px] font-bold uppercase text-[#888] block">Total de Viagens</span>
          <div className="font-display text-3xl font-bold text-black mt-1 tabular-nums">
            {totalTrips}
          </div>
          <span className="text-[10px] text-[#666] block mt-0.5">
            {completedTrips} concluídas · {ongoingEntries.length} em curso
          </span>
        </div>

        <div className="border-2 border-black bg-white p-4 shadow-[2px_2px_0px_#000]">
          <span className="text-[10px] font-bold uppercase text-[#888] block">Maré Média de Saída</span>
          <div className="font-display text-3xl font-bold text-black mt-1 tabular-nums">
            {avgDepartureTide}
            <span className="text-base font-normal ml-0.5">m</span>
          </div>
          <span className="text-[10px] text-[#666] block mt-0.5">Média das cotas na partida</span>
        </div>

        <div className="border-2 border-black bg-white p-4 shadow-[2px_2px_0px_#000]">
          <span className="text-[10px] font-bold uppercase text-[#888] block">Distância Total</span>
          <div className="font-display text-3xl font-bold text-black mt-1 tabular-nums">
            {totalDistanceNm.toFixed(1)}
            <span className="text-base font-normal ml-0.5">NM</span>
          </div>
          <span className="text-[10px] text-[#666] block mt-0.5">Milhas náuticas navegadas</span>
        </div>

        <div className="border-2 border-black bg-white p-4 shadow-[2px_2px_0px_#000]">
          <span className="text-[10px] font-bold uppercase text-[#888] block">Embarcação Padrão</span>
          <div className="font-display text-xl sm:text-2xl font-bold text-black mt-1 truncate">
            {currentVessel.name}
          </div>
          <span className="text-[10px] text-[#666] block mt-0.5">
            Calado: {currentVessel.draft}m · {currentVessel.vesselType.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="border-2 border-black bg-white p-3 sm:p-4 shadow-[2px_2px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#888] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por praia, título, barco ou nota..."
            className="w-full pl-9 pr-3 py-1.5 border-2 border-black bg-[#f8f7f4] text-xs font-bold text-black placeholder:text-[#999] focus:outline-none"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 self-start sm:self-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 font-mono text-xs font-bold uppercase border-2 border-black cursor-pointer transition-colors ${
              filterStatus === 'all'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-[#eeebe6]'
            }`}
          >
            Todas ({entries.length})
          </button>
          <button
            onClick={() => setFilterStatus('ongoing')}
            className={`px-3 py-1 font-mono text-xs font-bold uppercase border-2 border-black cursor-pointer transition-colors ${
              filterStatus === 'ongoing'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-[#eeebe6]'
            }`}
          >
            Em Curso ({ongoingEntries.length})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1 font-mono text-xs font-bold uppercase border-2 border-black cursor-pointer transition-colors ${
              filterStatus === 'completed'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-[#eeebe6]'
            }`}
          >
            Concluídas ({completedTrips})
          </button>
        </div>
      </div>

      {/* Log Entries List */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="border-2 border-dashed border-black/40 bg-white p-12 text-center">
            <BookOpen className="w-10 h-10 text-[#888] mx-auto mb-3" />
            <h4 className="font-display text-lg font-bold uppercase text-black">
              Nenhum registro encontrado
            </h4>
            <p className="text-xs text-[#666] max-w-md mx-auto mt-1 mb-4">
              {searchTerm
                ? 'Nenhuma navegação corresponde ao termo de busca.'
                : 'Você ainda não registrou viagens. Clique no botão abaixo para começar seu histórico náutico.'}
            </p>
            <button
              onClick={handleQuickLogDeparture}
              className="px-4 py-2 bg-black text-white text-xs font-bold uppercase inline-flex items-center gap-2 cursor-pointer"
            >
              <Anchor className="w-4 h-4 text-[#d42020]" />
              <span>REGISTRAR MINHA PRIMEIRA SAÍDA AGORA</span>
            </button>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isOngoing = entry.status === 'ongoing';
            const tideDelta =
              entry.arrivalTideHeight !== undefined
                ? (entry.arrivalTideHeight - entry.departureTideHeight).toFixed(2)
                : null;
            const durationStr = calculateDuration(entry.departureTime, entry.arrivalTime);

            return (
              <div
                key={entry.id}
                className="border-2 border-black bg-white p-5 shadow-[3px_3px_0px_#000] space-y-4 hover:border-black transition-all"
              >
                {/* Header line of log entry */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black/10 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 border border-black ${
                        isOngoing
                          ? 'bg-amber-300 text-black animate-pulse'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {isOngoing ? 'EM NAVEGAÇÃO' : 'VIAGEM CONCLUÍDA'}
                    </span>
                    <span className="text-xs font-bold text-black flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#888]" />
                      {entry.date}
                    </span>
                    <span className="text-xs text-[#666]">
                      // Barco: <strong className="text-black">{entry.vesselName}</strong> ({entry.vesselType || 'embarcação'})
                    </span>
                  </div>

                  {/* Actions for entry */}
                  <div className="flex items-center gap-1.5">
                    {isOngoing && (
                      <button
                        onClick={() => handleCompleteVoyageNow(entry)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Concluir</span>
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(entry)}
                      aria-label={`Editar registro ${entry.title}`}
                      className="p-1.5 border border-black hover:bg-[#eeebe6] text-black cursor-pointer"
                      title="Editar registro"
                    >
                      <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deseja realmente excluir este registro do diário de navegação?')) {
                          onDeleteEntry(entry.id);
                        }
                      }}
                      aria-label={`Excluir registro ${entry.title}`}
                      className="p-1.5 border border-black hover:bg-red-50 text-red-600 cursor-pointer"
                      title="Excluir registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <h3 className="font-display text-xl font-bold uppercase text-black tracking-tight">
                    {entry.title}
                  </h3>
                </div>

                {/* Nautical Passage Grid: Departure vs Arrival */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#f8f7f4] border-2 border-black p-4">
                  {/* SAÍDA */}
                  <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-black/20 pb-3 md:pb-0 md:pr-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-[#d42020] flex items-center gap-1">
                        <Flag className="w-3 h-3" />
                        SAÍDA / PARTIDA
                      </span>
                      <span className="font-mono text-xs font-bold text-black bg-white px-2 py-0.5 border border-black">
                        {entry.departureTime}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-black flex items-center gap-1.5 pt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#888] shrink-0" />
                      <span>{entry.departureLocation}</span>
                    </div>

                    <div className="pt-2">
                      <span className="text-[10px] text-[#666] uppercase block font-bold">
                        Altura da Maré na Saída:
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-3xl font-bold text-black tabular-nums">
                          {entry.departureTideHeight.toFixed(2)}
                          <span className="text-sm font-normal ml-0.5">m</span>
                        </span>
                        {entry.departureTideTendency && (
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 flex items-center gap-0.5 ${
                              entry.departureTideTendency === 'enchente'
                                ? 'text-emerald-700 bg-emerald-100'
                                : entry.departureTideTendency === 'vazante'
                                ? 'text-red-700 bg-red-100'
                                : 'text-gray-700 bg-gray-100'
                            }`}
                          >
                            {entry.departureTideTendency === 'enchente' ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {entry.departureTideTendency}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CHEGADA */}
                  <div className="space-y-1.5 md:pl-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-1">
                        <Anchor className="w-3 h-3" />
                        CHEGADA / DESTINO
                      </span>
                      <span className="font-mono text-xs font-bold text-black bg-white px-2 py-0.5 border border-black">
                        {entry.arrivalTime || (isOngoing ? 'EM NAVEGAÇÃO...' : '--:--')}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-black flex items-center gap-1.5 pt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#888] shrink-0" />
                      <span>{entry.arrivalLocation || (isOngoing ? 'A caminho...' : 'Não especificado')}</span>
                    </div>

                    <div className="pt-2">
                      <span className="text-[10px] text-[#666] uppercase block font-bold">
                        Altura da Maré na Chegada:
                      </span>
                      {entry.arrivalTideHeight !== undefined ? (
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-3xl font-bold text-black tabular-nums">
                            {entry.arrivalTideHeight.toFixed(2)}
                            <span className="text-sm font-normal ml-0.5">m</span>
                          </span>
                          {entry.arrivalTideTendency && (
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 flex items-center gap-0.5 ${
                                entry.arrivalTideTendency === 'enchente'
                                  ? 'text-emerald-700 bg-emerald-100'
                                  : entry.arrivalTideTendency === 'vazante'
                                  ? 'text-red-700 bg-red-100'
                                  : 'text-gray-700 bg-gray-100'
                              }`}
                            >
                              {entry.arrivalTideTendency === 'enchente' ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {entry.arrivalTideTendency}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-[#888] italic pt-1">
                          {isOngoing ? 'Aguardando registro de chegada' : 'Não informada'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tide Variation & Voyage Summary Pill Bar */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {tideDelta !== null && (
                    <div className="border border-black bg-white px-2.5 py-1 flex items-center gap-1.5">
                      <span className="text-[#888] font-bold">Variação de Maré:</span>
                      <strong className={`font-mono ${Number(tideDelta) >= 0 ? 'text-emerald-700' : 'text-[#d42020]'}`}>
                        {Number(tideDelta) > 0 ? `+${tideDelta}m` : `${tideDelta}m`}
                      </strong>
                    </div>
                  )}

                  <div className="border border-black bg-white px-2.5 py-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#888]" />
                    <span className="text-[#888] font-bold">Duração:</span>
                    <strong className="text-black font-mono">{durationStr}</strong>
                  </div>

                  {entry.distanceNm !== undefined && (
                    <div className="border border-black bg-white px-2.5 py-1 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-[#888]" />
                      <span className="text-[#888] font-bold">Distância:</span>
                      <strong className="text-black font-mono">{entry.distanceNm} NM</strong>
                    </div>
                  )}

                  {entry.crewCount !== undefined && (
                    <div className="border border-black bg-white px-2.5 py-1 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#888]" />
                      <span className="text-[#888] font-bold">Tripulação:</span>
                      <strong className="text-black font-mono">{entry.crewCount} a bordo</strong>
                    </div>
                  )}

                  {entry.waterTempCelsius !== undefined && (
                    <div className="border border-black bg-white px-2.5 py-1 flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-[#0284c7]" />
                      <span className="text-[#888] font-bold">Água:</span>
                      <strong className="text-black font-mono">
                        {formatTemperature(entry.waterTempCelsius, tempUnit)}
                      </strong>
                    </div>
                  )}

                  {entry.airTempCelsius !== undefined && (
                    <div className="border border-black bg-white px-2.5 py-1 flex items-center gap-1.5">
                      <CloudSun className="w-3.5 h-3.5 text-[#d97706]" />
                      <span className="text-[#888] font-bold">Clima:</span>
                      <strong className="text-black font-mono">
                        {formatTemperature(entry.airTempCelsius, tempUnit)}
                      </strong>
                    </div>
                  )}

                  {entry.waveHeightMeters !== undefined && (
                    <div className="border border-black bg-white px-2.5 py-1 flex items-center gap-1.5">
                      <Waves className="w-3.5 h-3.5 text-black" />
                      <span className="text-[#888] font-bold">Ondulação:</span>
                      <strong className="text-black font-mono">{entry.waveHeightMeters}m</strong>
                    </div>
                  )}
                </div>

                {/* Notes and Log Comments */}
                {entry.notes && (
                  <div className="bg-[#fffdf8] border-l-4 border-black p-3 text-xs text-[#222]">
                    <span className="font-bold text-[10px] uppercase text-[#888] block mb-1">
                      Anotações de Bordo:
                    </span>
                    <p className="whitespace-pre-line leading-relaxed">{entry.notes}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal for Creating / Editing Logbook Entry */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="border-2 border-black bg-white w-full max-w-2xl p-5 sm:p-6 shadow-[6px_6px_0px_#000] my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#888] block">
                  {editingEntryId ? 'EDITAR NAVEGAÇÃO' : 'NOVO REGISTRO'}
                </span>
                <h3 className="font-display text-xl font-bold uppercase text-black">
                  {editingEntryId ? 'Alterar Diário de Bordo' : 'Cadastrar Saída e Marés'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-2.5 py-1 border-2 border-black bg-[#eeebe6] hover:bg-black hover:text-white font-mono text-xs font-bold cursor-pointer"
              >
                FECHAR ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4 font-mono text-xs">
              {/* Autofill helpers banner */}
              <div className="bg-[#f8f7f4] border-2 border-black p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-black block">Atalhos em Tempo Real</span>
                  <span className="text-[10px] text-[#666]">
                    Praia: <strong>{activeBeachName}</strong> · Maré Atual: <strong>{currentStatus.currentHeight.toFixed(2)}m</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fillRealtimeDeparture}
                    className="px-2 py-1 bg-black text-white text-[10px] font-bold uppercase cursor-pointer"
                  >
                    Copiar para Saída
                  </button>
                  <button
                    type="button"
                    onClick={fillRealtimeArrival}
                    className="px-2 py-1 bg-[#eeebe6] border border-black text-black text-[10px] font-bold uppercase cursor-pointer hover:bg-black hover:text-white"
                  >
                    Copiar para Chegada
                  </button>
                </div>
              </div>

              {/* Title & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-black uppercase block">Título da Viagem / Rota *</label>
                  <input
                    type="text"
                    required
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Travessia Salvador -> Ilha dos Frades"
                    className="w-full p-2 border-2 border-black bg-[#f8f7f4] text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-black uppercase block">Data *</label>
                  <input
                    type="date"
                    required
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full p-2 border-2 border-black bg-[#f8f7f4] text-xs font-bold"
                  />
                </div>
              </div>

              {/* Status & Vessel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-black uppercase block">Status da Viagem *</label>
                  <select
                    value={formData.status || 'completed'}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as 'ongoing' | 'completed' })
                    }
                    className="w-full p-2 border-2 border-black bg-[#f8f7f4] text-xs font-bold"
                  >
                    <option value="completed">Concluída (Saída e Chegada)</option>
                    <option value="ongoing">Em Curso (Apenas Saída Registrada)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-black uppercase block">Embarcação *</label>
                  <input
                    type="text"
                    required
                    value={formData.vesselName || ''}
                    onChange={(e) => setFormData({ ...formData, vesselName: e.target.value })}
                    placeholder="Nome do barco"
                    className="w-full p-2 border-2 border-black bg-[#f8f7f4] text-xs font-bold"
                  />
                </div>
              </div>

              {/* BLOC: SAÍDA */}
              <div className="border-2 border-black p-3 bg-[#fffafa] space-y-3">
                <span className="font-bold text-xs uppercase text-[#d42020] block">
                  1. DADOS DE SAÍDA (PARTIDA)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1 space-y-1">
                    <label className="font-bold text-black uppercase block">Local de Saída *</label>
                    <input
                      type="text"
                      required
                      value={formData.departureLocation || ''}
                      onChange={(e) => setFormData({ ...formData, departureLocation: e.target.value })}
                      placeholder="Praia / Marina"
                      className="w-full p-2 border-2 border-black bg-white text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-black uppercase block">Horário de Saída *</label>
                    <input
                      type="time"
                      required
                      value={formData.departureTime || ''}
                      onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                      className="w-full p-2 border-2 border-black bg-white text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-black uppercase block">
                      Altura da Maré (m) *
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.departureTideHeight ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, departureTideHeight: parseFloat(e.target.value) || 0 })
                        }
                        className="w-24 p-2 border-2 border-black bg-white text-xs font-bold tabular-nums"
                      />
                      <select
                        value={formData.departureTideTendency || 'enchente'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            departureTideTendency: e.target.value as 'enchente' | 'vazante' | 'estofo',
                          })
                        }
                        className="flex-1 p-2 border-2 border-black bg-white text-xs font-bold"
                      >
                        <option value="enchente">Enchente</option>
                        <option value="vazante">Vazante</option>
                        <option value="estofo">Estofo</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOC: CHEGADA */}
              <div className="border-2 border-black p-3 bg-[#f0fdf4] space-y-3">
                <span className="font-bold text-xs uppercase text-emerald-800 block">
                  2. DADOS DE CHEGADA (DESTINO)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1 space-y-1">
                    <label className="font-bold text-black uppercase block">Local de Chegada</label>
                    <input
                      type="text"
                      value={formData.arrivalLocation || ''}
                      onChange={(e) => setFormData({ ...formData, arrivalLocation: e.target.value })}
                      placeholder="Destino / Fim da rota"
                      className="w-full p-2 border-2 border-black bg-white text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-black uppercase block">Horário de Chegada</label>
                    <input
                      type="time"
                      value={formData.arrivalTime || ''}
                      onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })}
                      className="w-full p-2 border-2 border-black bg-white text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-black uppercase block">
                      Altura da Maré (m)
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.arrivalTideHeight ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            arrivalTideHeight: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        placeholder="Ex: 1.10"
                        className="w-24 p-2 border-2 border-black bg-white text-xs font-bold tabular-nums"
                      />
                      <select
                        value={formData.arrivalTideTendency || 'vazante'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            arrivalTideTendency: e.target.value as 'enchente' | 'vazante' | 'estofo',
                          })
                        }
                        className="flex-1 p-2 border-2 border-black bg-white text-xs font-bold"
                      >
                        <option value="vazante">Vazante</option>
                        <option value="enchente">Enchente</option>
                        <option value="estofo">Estofo</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Condições & Telemetria */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-black uppercase block">Distância (NM)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.distanceNm ?? ''}
                    onChange={(e) => setFormData({ ...formData, distanceNm: parseFloat(e.target.value) || 0 })}
                    placeholder="Milhas"
                    className="w-full p-2 border-2 border-black bg-[#f8f7f4] text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-black uppercase block">Tripulantes</label>
                  <input
                    type="number"
                    value={formData.crewCount ?? ''}
                    onChange={(e) => setFormData({ ...formData, crewCount: parseInt(e.target.value, 10) || 1 })}
                    placeholder="Pessoas"
                    className="w-full p-2 border-2 border-black bg-[#f8f7f4] text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-black uppercase block">Temp. Água (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.waterTempCelsius ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        waterTempCelsius: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="Ex: 27.5"
                    className="w-full p-2 border-2 border-black bg-[#f8f7f4] text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-black uppercase block">Temp. Ar (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.airTempCelsius ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        airTempCelsius: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="Ex: 29.0"
                    className="w-full p-2 border-2 border-black bg-[#f8f7f4] text-xs font-bold"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-bold text-black uppercase block">
                  Anotações Náuticas / Livro de Bordo
                </label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações da rota: vento, folga da quilha sobre as lajes, faróis avistados, ancoragem..."
                  className="w-full p-2 border-2 border-black bg-[#f8f7f4] text-xs"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t-2 border-black flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border-2 border-black bg-white hover:bg-[#eeebe6] text-black font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-black hover:bg-[#333] text-white font-bold uppercase cursor-pointer shadow-[2px_2px_0px_#000]"
                >
                  {editingEntryId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR VIAGEM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavigationLogbook;
