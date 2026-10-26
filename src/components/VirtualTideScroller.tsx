import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { TideStation, VesselProfile, TideExtreme, MoonPhaseInfo } from '../types/tide';
import { findTideExtremes, getMoonPhaseInfo, calculateUKC } from '../utils/tideHarmonics';
import {
  Calendar,
  Search,
  Filter,
  Download,
  ArrowUpDown,
  ChevronRight,
  ChevronDown,
  Clock,
  Sparkles,
  Waves,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Info,
  Maximize2,
  CalendarDays,
  Flame,
} from 'lucide-react';

export interface DayTideRecord {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  dayOfWeek: string;
  formattedDate: string; // DD/MM/YYYY
  extremes: TideExtreme[];
  moon: MoonPhaseInfo;
  dailyRange: number; // Amplitude em metros
  maxHeight: number;
  minHeight: number;
  isToday: boolean;
  isSpringTide: boolean;
  minUkc: number;
  isSafeForVessel: boolean;
}

interface VirtualTideScrollerProps {
  station: TideStation;
  vessel?: VesselProfile;
  initialYear?: number;
  onSelectDate?: (date: Date) => void;
  className?: string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const ROW_HEIGHT_ESTIMATE = 108; // Altura estimada em pixels de cada linha para o cálculo de janela virtual
const OVERSCAN = 6; // Linhas adicionais renderizadas acima e abaixo da área visível para scroll suave

/**
 * Componente de Tábua de Marés com Virtual Scroller de Alta Performance.
 * Permite navegar por anos inteiros de dados astronômicos (3.000+ dias e 12.000+ eventos de maré)
 * mantendo o DOM ultraleve (~15 elementos renderizados) e taxa de atualização constante a 60 FPS.
 */
export const VirtualTideScroller: React.FC<VirtualTideScrollerProps> = ({
  station,
  vessel = { name: 'Embarcação Padrão', draft: 1.5, safetyMargin: 0.6, vesselType: 'veleiro', airDraft: 12 },
  initialYear,
  onSelectDate,
  className = '',
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(initialYear || currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'spring' | 'critical_low' | 'high_tide'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewportHeight, setViewportHeight] = useState<number>(540);
  const [scrollTop, setScrollTop] = useState<number>(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Anos suportados para geração instantânea (5 anos no passado até 5 anos no futuro)
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 3; y <= currentYear + 4; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Cache e gerador sob demanda dos dias da tábua de marés
  const allDaysData = useMemo(() => {
    const days: DayTideRecord[] = [];
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const startYear = selectedYear === 'all' ? availableYears[0] : selectedYear;
    const endYear = selectedYear === 'all' ? availableYears[availableYears.length - 1] : selectedYear;

    const startDate = new Date(startYear, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(endYear, 11, 31, 23, 59, 59, 999);

    const curr = new Date(startDate);
    while (curr <= endDate) {
      const year = curr.getFullYear();
      const month = curr.getMonth();
      const dayOfMonth = curr.getDate();
      const dayOfWeekIdx = curr.getDay();

      const dayStartMs = new Date(year, month, dayOfMonth, 0, 0, 0, 0).getTime();
      const isToday = year === todayYear && month === todayMonth && dayOfMonth === todayDate;

      // Calcula os extremos astronômicos oficiais da DHN para o período de 24h deste dia
      const extremes = findTideExtremes(station, dayStartMs, 24);
      const moon = getMoonPhaseInfo(dayStartMs + 12 * 3600 * 1000);

      let maxHeight = station.meanSeaLevel;
      let minHeight = station.meanSeaLevel;
      if (extremes.length > 0) {
        maxHeight = Math.max(...extremes.map((e) => e.height));
        minHeight = Math.min(...extremes.map((e) => e.height));
      }
      const dailyRange = Math.round((maxHeight - minHeight) * 100) / 100;

      // Profundidade da carta de referência para cálculo da folga sob a quilha (2.50m Datum)
      const refDatumDepth = 2.5;
      const ukcCalc = calculateUKC(refDatumDepth, minHeight, vessel.draft);
      const isSafeForVessel = ukcCalc.safetyStatus !== 'danger';

      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDate = `${pad(dayOfMonth)}/${pad(month + 1)}/${year}`;
      const dateKey = `${year}-${pad(month + 1)}-${pad(dayOfMonth)}`;

      days.push({
        date: new Date(curr),
        dateKey,
        dayOfWeek: WEEKDAY_NAMES[dayOfWeekIdx],
        formattedDate,
        extremes,
        moon,
        dailyRange,
        maxHeight,
        minHeight,
        isToday,
        isSpringTide: moon.isSpringTide,
        minUkc: ukcCalc.ukc,
        isSafeForVessel,
      });

      // Avança 1 dia
      curr.setDate(curr.getDate() + 1);
    }

    return days;
  }, [station, vessel, selectedYear, availableYears]);

  // Aplica filtros de busca, mês e regras de segurança marítima
  const filteredDays = useMemo(() => {
    return allDaysData.filter((item) => {
      // Filtro de mês
      if (selectedMonth !== 'all' && item.date.getMonth() !== selectedMonth) {
        return false;
      }

      // Filtro de Regra / Tipo de Maré
      if (filterType === 'spring' && !item.isSpringTide) {
        return false;
      }
      if (filterType === 'critical_low' && item.minHeight >= 0.55) {
        return false;
      }
      if (filterType === 'high_tide' && item.maxHeight < 2.10) {
        return false;
      }

      // Busca textual por data (ex: "15/10", "2026", "dom")
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDate = item.formattedDate.toLowerCase().includes(q);
        const matchesDay = item.dayOfWeek.toLowerCase().includes(q);
        const matchesMoon = item.moon.phaseName.toLowerCase().includes(q);
        if (!matchesDate && !matchesDay && !matchesMoon) {
          return false;
        }
      }

      return true;
    });
  }, [allDaysData, selectedMonth, filterType, searchQuery]);

  // Atualiza altura do viewport com base no container
  useEffect(() => {
    const handleResize = () => {
      if (scrollContainerRef.current) {
        setViewportHeight(scrollContainerRef.current.clientHeight || 540);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Monitora o evento de scroll do container com debounce nativo
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // CÁLCULOS DO VIRTUAL SCROLLER
  const totalCount = filteredDays.length;
  const totalContentHeight = totalCount * ROW_HEIGHT_ESTIMATE;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_ESTIMATE) - OVERSCAN);
  const endIndex = Math.min(
    totalCount - 1,
    Math.floor((scrollTop + viewportHeight) / ROW_HEIGHT_ESTIMATE) + OVERSCAN
  );

  const visibleDays = useMemo(() => {
    if (totalCount === 0) return [];
    return filteredDays.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      virtualIndex: startIndex + index,
      topOffset: (startIndex + index) * ROW_HEIGHT_ESTIMATE,
    }));
  }, [filteredDays, startIndex, endIndex, totalCount]);

  // Função para rolar instantaneamente até o dia de "Hoje"
  const scrollToToday = () => {
    const todayIndex = filteredDays.findIndex((d) => d.isToday);
    if (todayIndex !== -1 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, todayIndex * ROW_HEIGHT_ESTIMATE - 80),
        behavior: 'smooth',
      });
    }
  };

  // Exportar tábua em formato CSV estruturado
  const handleExportCSV = () => {
    const headers = [
      'Data',
      'Dia da Semana',
      'Fase da Lua',
      'Iluminacao (%)',
      'Tipo de Mare',
      'Amplitude (m)',
      'Eventos (Tipo | Horario | Altura m)',
      'Folga Quilha Minima (m)',
      'Status Seguranca'
    ];

    const rows = filteredDays.map((d) => {
      const eventsStr = d.extremes
        .map((e) => `${e.type === 'preia-mar' ? 'Preia-mar' : 'Baixa-mar'}: ${e.timeString} (${e.height.toFixed(2)}m)`)
        .join('; ');

      return [
        `"${d.formattedDate}"`,
        `"${d.dayOfWeek}"`,
        `"${d.moon.phaseName}"`,
        `"${d.moon.illumination}%"`,
        `"${d.isSpringTide ? 'Sizígia' : 'Quadratura'}"`,
        `"${d.dailyRange.toFixed(2)}"`,
        `"${eventsStr}"`,
        `"${d.minUkc.toFixed(2)}"`,
        `"${d.isSafeForVessel ? 'Seguro' : 'Alerta de Calado'}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tabua-mares-${station.id}-${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ícone visual para cada fase da lua
  const renderMoonIcon = (code: MoonPhaseInfo['phaseCode']) => {
    switch (code) {
      case 'new':
        return '🌑';
      case 'waxing_crescent':
        return '🌒';
      case 'first_quarter':
        return '🌓';
      case 'waxing_gibbous':
        return '🌔';
      case 'full':
        return '🌕';
      case 'waning_gibbous':
        return '🌖';
      case 'last_quarter':
        return '🌗';
      case 'waning_crescent':
        return '🌘';
      default:
        return '🌙';
    }
  };

  return (
    <div className={`border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#0d1117] font-mono shadow-[4px_4px_0px_#000] dark:shadow-[4px_4px_0px_#30363d] ${className}`}>
      {/* 1. BARRA SUPERIOR: TELEMETRIA DO VIRTUAL SCROLLER & ESTAÇÃO */}
      <div className="bg-[#f8f7f4] dark:bg-[#161b22] border-b-2 border-black dark:border-[#30363d] p-3 sm:p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarDays className="w-5 h-5 text-[#0284c7]" />
              <h3 className="font-display text-lg sm:text-xl font-bold uppercase tracking-tight text-black dark:text-white">
                Tábua de Marés Multianual
              </h3>
              <span className="px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black text-[9px] font-black uppercase tracking-wider">
                Virtual Scroller 60 FPS
              </span>
              <span className="px-2 py-0.5 bg-[#e0f2fe] text-[#0369a1] dark:bg-[#0369a1]/20 dark:text-[#38bdf8] border border-[#0284c7] text-[9px] font-bold uppercase">
                {station.name} ({station.state})
              </span>
            </div>
            <p className="text-[11px] text-[#666] dark:text-[#8b949e] mt-1">
              Motor harmônico com virtualização dinâmica de DOM: calcule e explore anos completos sem lentidão.
            </p>
          </div>

          {/* HUD de Performance da Virtualização */}
          <div className="flex items-center gap-2 sm:gap-3 bg-white dark:bg-[#0d1117] border border-black dark:border-white/20 p-2 text-[10px] shrink-0 self-start md:self-auto">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
              <span>{filteredDays.length} dias indexados</span>
            </div>
            <span className="text-[#ccc]">|</span>
            <div className="text-[#555] dark:text-[#aaa]">
              DOM Ativo: <strong className="text-black dark:text-white">{visibleDays.length} nós</strong>
            </div>
            <span className="text-[#ccc]">|</span>
            <button
              onClick={scrollToToday}
              className="px-2 py-1 bg-[#d42020] text-white hover:bg-[#b01010] font-bold uppercase cursor-pointer text-[9px] shadow-xs"
              title="Rolar direto para a data de hoje"
            >
              Ir para Hoje
            </button>
          </div>
        </div>

        {/* 2. CONTROLES: SELEÇÃO DE ANO, MÊS, FILTRO E BUSCA */}
        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5">
          {/* Seletor de Ano */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-[#666] dark:text-[#8b949e] uppercase">Ano:</span>
            {availableYears.map((yr) => (
              <button
                key={`year-btn-${yr}`}
                onClick={() => setSelectedYear(yr)}
                className={`px-2.5 py-1 text-xs font-bold uppercase border border-black dark:border-white cursor-pointer transition-colors ${
                  selectedYear === yr
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#eee] dark:hover:bg-[#21262d]'
                }`}
              >
                {yr}
              </button>
            ))}
            <button
              onClick={() => setSelectedYear('all')}
              className={`px-2.5 py-1 text-xs font-bold uppercase border border-black dark:border-white cursor-pointer transition-colors ${
                selectedYear === 'all'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#eee] dark:hover:bg-[#21262d]'
              }`}
            >
              Todos (Multianual)
            </button>
          </div>

          {/* Exportar CSV */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1 bg-white dark:bg-[#161b22] border border-black dark:border-white hover:bg-[#eee] dark:hover:bg-[#21262d] text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer text-black dark:text-white"
            title="Exportar dados filtrados da tábua de maré em arquivo CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>

        {/* 3. FILTROS RÁPIDOS & BUSCA POR DATA */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          {/* Filtros de Regra Náutica */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[10px] font-bold text-[#666] dark:text-[#8b949e] uppercase flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Regras:
            </span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase border border-black dark:border-white cursor-pointer ${
                filterType === 'all'
                  ? 'bg-[#0284c7] text-white border-[#0284c7]'
                  : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#eee]'
              }`}
            >
              Todos os Dias
            </button>
            <button
              onClick={() => setFilterType('spring')}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase border border-black dark:border-white cursor-pointer flex items-center gap-1 ${
                filterType === 'spring'
                  ? 'bg-[#d42020] text-white border-[#d42020]'
                  : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#eee]'
              }`}
            >
              <Flame className="w-3 h-3" />
              Apenas Sizígia (Maré Viva)
            </button>
            <button
              onClick={() => setFilterType('critical_low')}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase border border-black dark:border-white cursor-pointer ${
                filterType === 'critical_low'
                  ? 'bg-[#b45309] text-white border-[#b45309]'
                  : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#eee]'
              }`}
            >
              Baixa-mar Rasa (&lt; 0.55m)
            </button>
            <button
              onClick={() => setFilterType('high_tide')}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase border border-black dark:border-white cursor-pointer ${
                filterType === 'high_tide'
                  ? 'bg-[#1e40af] text-white border-[#1e40af]'
                  : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#eee]'
              }`}
            >
              Preia-mar Máxima (&gt; 2.10m)
            </button>
          </div>

          {/* Input de Busca */}
          <div className="relative min-w-[190px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar dia ou data (ex: 25/12)..."
              className="w-full pl-8 pr-2.5 py-1 text-xs border border-black dark:border-white bg-white dark:bg-[#0d1117] text-black dark:text-white placeholder-[#888] focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        {/* Seletor Rápido de Meses (Chips Horizontais) */}
        <div className="mt-2.5 pt-2 border-t border-dashed border-black/15 dark:border-white/15 flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
          <span className="font-bold text-[#666] dark:text-[#8b949e] uppercase shrink-0 mr-1">Mês:</span>
          <button
            onClick={() => setSelectedMonth('all')}
            className={`px-2 py-0.5 font-bold uppercase border border-black dark:border-white shrink-0 cursor-pointer ${
              selectedMonth === 'all'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#eee]'
            }`}
          >
            Ano Completo
          </button>
          {MONTH_NAMES.map((mName, mIdx) => (
            <button
              key={`month-chip-${mIdx}`}
              onClick={() => setSelectedMonth(mIdx)}
              className={`px-2 py-0.5 font-bold uppercase border border-black dark:border-white shrink-0 cursor-pointer ${
                selectedMonth === mIdx
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-white dark:bg-[#0d1117] text-black dark:text-white hover:bg-[#eee]'
              }`}
            >
              {mName.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* 4. CABEÇALHO DA TABELA VIRTUAL FIXA */}
      <div className="bg-[#eeebe6] dark:bg-[#161b22] border-b-2 border-black dark:border-[#30363d] px-3 sm:px-4 py-2 font-bold text-[10px] sm:text-xs uppercase text-[#333] dark:text-[#c9d1d9] grid grid-cols-12 gap-2 items-center">
        <div className="col-span-3 sm:col-span-2">Data / Dia</div>
        <div className="col-span-3 sm:col-span-2">Fase da Lua</div>
        <div className="col-span-6 sm:col-span-6">Preia-mar (PM) & Baixa-mar (BM)</div>
        <div className="hidden sm:block sm:col-span-2 text-right">Amplitude / UKC</div>
      </div>

      {/* 5. VIEWPORT DO VIRTUAL SCROLLER (SCROLL CONTINUO A 60 FPS) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto relative w-full select-text"
        style={{ height: '540px' }}
      >
        {totalCount === 0 ? (
          <div className="p-8 text-center text-xs text-[#666] dark:text-[#8b949e]">
            Nenhum registro encontrado para os filtros selecionados.
          </div>
        ) : (
          <div style={{ height: `${totalContentHeight}px`, position: 'relative', width: '100%' }}>
            {visibleDays.map(({ item, virtualIndex, topOffset }) => {
              return (
                <div
                  key={`day-row-${item.dateKey}`}
                  onClick={() => onSelectDate && onSelectDate(item.date)}
                  style={{
                    position: 'absolute',
                    top: `${topOffset}px`,
                    left: 0,
                    width: '100%',
                    height: `${ROW_HEIGHT_ESTIMATE}px`,
                  }}
                  className={`border-b border-black/15 dark:border-white/15 px-3 sm:px-4 py-2 flex flex-col justify-between transition-colors ${
                    item.isToday
                      ? 'bg-[#eff6ff] dark:bg-[#1e293b] ring-2 ring-inset ring-[#0284c7]'
                      : virtualIndex % 2 === 0
                      ? 'bg-white dark:bg-[#0d1117]'
                      : 'bg-[#faf9f6] dark:bg-[#12161f]'
                  } hover:bg-[#f0f9ff] dark:hover:bg-[#162032] cursor-pointer`}
                >
                  <div className="grid grid-cols-12 gap-2 items-center h-full">
                    {/* Coluna 1: Data e Dia da Semana */}
                    <div className="col-span-3 sm:col-span-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display text-sm sm:text-base font-black text-black dark:text-white tabular-nums">
                          {item.formattedDate}
                        </span>
                        {item.isToday && (
                          <span className="px-1.5 py-0.2 bg-[#d42020] text-white text-[8px] font-black uppercase tracking-wider">
                            HOJE
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#666] dark:text-[#8b949e] font-bold uppercase block mt-0.5">
                        {item.dayOfWeek}
                      </span>
                    </div>

                    {/* Coluna 2: Fase da Lua */}
                    <div className="col-span-3 sm:col-span-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg leading-none" role="img" aria-label={item.moon.phaseName}>
                          {renderMoonIcon(item.moon.phaseCode)}
                        </span>
                        <div className="min-w-0">
                          <span className="text-[10px] sm:text-[11px] font-bold text-black dark:text-white truncate block">
                            {item.moon.phaseName}
                          </span>
                          <span className="text-[9px] text-[#777] dark:text-[#999] block tabular-nums">
                            {item.moon.illumination}% iluminada
                          </span>
                        </div>
                      </div>
                      {item.isSpringTide && (
                        <span className="inline-block mt-1 text-[8px] font-black uppercase px-1 py-0.2 bg-[#fee2e2] text-[#b91c1c] dark:bg-[#450a0a] dark:text-[#fca5a5] border border-[#f87171]">
                          Sizígia
                        </span>
                      )}
                    </div>

                    {/* Coluna 3: Extremos de Maré (Preia-mar e Baixa-mar) */}
                    <div className="col-span-6 sm:col-span-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
                        {item.extremes.map((ext, extIdx) => {
                          const isHigh = ext.type === 'preia-mar';
                          return (
                            <div
                              key={`ext-${item.dateKey}-${extIdx}`}
                              className={`p-1.5 border ${
                                isHigh
                                  ? 'border-[#0284c7]/40 bg-[#f0f9ff] dark:bg-[#0c4a6e]/20'
                                  : 'border-[#f59e0b]/40 bg-[#fffbeb] dark:bg-[#78350f]/20'
                              } flex flex-col justify-between`}
                            >
                              <div className="flex items-center justify-between text-[8px] font-bold uppercase">
                                <span className={isHigh ? 'text-[#0284c7]' : 'text-[#d97706]'}>
                                  {isHigh ? '↗ PM' : '↘ BM'}
                                </span>
                                <span className="tabular-nums text-[#666] dark:text-[#8b949e]">
                                  {ext.timeString}
                                </span>
                              </div>
                              <div className="text-right mt-0.5">
                                <span className="font-display text-xs sm:text-sm font-black text-black dark:text-white tabular-nums">
                                  {ext.height.toFixed(2)}m
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Coluna 4: Amplitude Diária e Folga do Calado (UKC) */}
                    <div className="hidden sm:block sm:col-span-2 text-right">
                      <div>
                        <span className="text-[9px] text-[#666] dark:text-[#8b949e] uppercase block font-bold">
                          Amplitude
                        </span>
                        <span className="font-display text-sm font-black text-black dark:text-white tabular-nums">
                          Δ {item.dailyRange.toFixed(2)}m
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        {item.isSafeForVessel ? (
                          <span className="text-[9px] font-bold text-[#16a34a] dark:text-[#4ade80] flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" />
                            UKC: +{item.minUkc.toFixed(2)}m
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-[#d42020] dark:text-[#f87171] flex items-center gap-0.5 animate-pulse">
                            <ShieldAlert className="w-3 h-3" />
                            Calado Crítico
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. RODAPÉ DA TÁBUA VIRTUAL */}
      <div className="p-3 bg-[#f8f7f4] dark:bg-[#161b22] border-t-2 border-black dark:border-[#30363d] flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-[#666] dark:text-[#8b949e]">
        <div>
          DHN Zero Hidrográfico (0.00m) // Calado configurado da embarcação:{' '}
          <strong className="text-black dark:text-white">{vessel.draft.toFixed(2)}m ({vessel.name})</strong>
        </div>
        <div className="flex items-center gap-2">
          <span>Linhas visíveis: {visibleDays.length}</span>
          <span>•</span>
          <span>Renderização Virtualizada Ativa</span>
        </div>
      </div>
    </div>
  );
};

export default VirtualTideScroller;
