import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wind,
  Zap,
  TrendingUp,
  AlertTriangle,
  RotateCw,
  Compass,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Activity,
  Gauge,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  fetch24HourPastWindHistory,
  Past24hWindHistory,
  HourlyPastWindReport,
} from '../services/realMarineApi';
import { TideStation } from '../types/tide';

export type WindDisplayUnit = 'knots' | 'kmh' | 'ms' | 'mph';

export interface WindHistory24hPanelProps {
  station?: TideStation;
  userCoords?: { lat: number; lng: number };
  onApplyToConverter?: (knots: number) => void;
  className?: string;
}

export const WindHistory24hPanel: React.FC<WindHistory24hPanelProps> = ({
  station,
  userCoords,
  onApplyToConverter,
  className = '',
}) => {
  const [data, setData] = useState<Past24hWindHistory | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUnit, setSelectedUnit] = useState<WindDisplayUnit>('knots');
  const [showTableLog, setShowTableLog] = useState<boolean>(false);
  const [copiedPeak, setCopiedPeak] = useState<boolean>(false);

  // Coordenadas da estação ou usuário
  const lat = station?.lat ?? userCoords?.lat ?? -13.0031;
  const lng = station?.lng ?? userCoords?.lng ?? -38.5322;
  const locationName = station?.name ?? 'Costa Brasileira';

  const loadWindHistory = useCallback(async () => {
    setLoading(true);
    try {
      const history = await fetch24HourPastWindHistory(lat, lng);
      setData(history);
    } catch (err) {
      console.warn('Erro ao carregar histórico de ventos 24h:', err);
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    loadWindHistory();
  }, [loadWindHistory]);

  // Função utilitária para obter valor convertido de acordo com a unidade selecionada
  const formatSpeed = useCallback(
    (report: { windSpeedKnots: number; windSpeedKmH: number; windSpeedMs: number; windSpeedMph: number }, isGust: boolean = false) => {
      if (isGust) {
        const gustReport = report as unknown as { windGustsKnots: number; windGustsKmH: number; windGustsMs: number; windGustsMph: number };
        switch (selectedUnit) {
          case 'knots':
            return { value: gustReport.windGustsKnots, unit: 'kn' };
          case 'kmh':
            return { value: gustReport.windGustsKmH, unit: 'km/h' };
          case 'ms':
            return { value: gustReport.windGustsMs, unit: 'm/s' };
          case 'mph':
            return { value: gustReport.windGustsMph, unit: 'mph' };
        }
      }
      switch (selectedUnit) {
        case 'knots':
          return { value: report.windSpeedKnots, unit: 'kn' };
        case 'kmh':
          return { value: report.windSpeedKmH, unit: 'km/h' };
        case 'ms':
          return { value: report.windSpeedMs, unit: 'm/s' };
        case 'mph':
          return { value: report.windSpeedMph, unit: 'mph' };
      }
    },
    [selectedUnit]
  );

  const unitLabel = useMemo(() => {
    switch (selectedUnit) {
      case 'knots':
        return 'Nós (kn)';
      case 'kmh':
        return 'km/h';
      case 'ms':
        return 'm/s';
      case 'mph':
        return 'mph';
    }
  }, [selectedUnit]);

  // Dados formatados para Recharts
  const chartData = useMemo(() => {
    if (!data?.reports) return [];
    return data.reports.map((r) => {
      let speedVal = r.windSpeedKnots;
      let gustVal = r.windGustsKnots;

      if (selectedUnit === 'kmh') {
        speedVal = r.windSpeedKmH;
        gustVal = r.windGustsKmH;
      } else if (selectedUnit === 'ms') {
        speedVal = r.windSpeedMs;
        gustVal = r.windGustsMs;
      } else if (selectedUnit === 'mph') {
        speedVal = r.windSpeedMph;
        gustVal = r.windGustsMph;
      }

      return {
        time: r.timeStr,
        fullLabel: r.fullLabel,
        speed: speedVal,
        gust: gustVal,
        cardinal: r.windDirectionCardinal,
        deg: r.windDirectionDeg,
        beaufort: r.beaufortName,
        isPeak: r.isPeakGust,
        severity: r.severity,
        rawKnots: r.windGustsKnots,
      };
    });
  }, [data, selectedUnit]);

  // Pico convertido
  const peakConverted = useMemo(() => {
    if (!data) return { value: 0, unit: 'kn' };
    switch (selectedUnit) {
      case 'knots':
        return { value: data.peakGustKnots, unit: 'kn' };
      case 'kmh':
        return { value: data.peakGustKmH, unit: 'km/h' };
      case 'ms':
        return { value: data.peakGustMs, unit: 'm/s' };
      case 'mph':
        return { value: data.peakGustMph, unit: 'mph' };
    }
  }, [data, selectedUnit]);

  const handleApplyPeak = () => {
    if (data && onApplyToConverter) {
      onApplyToConverter(data.peakGustKnots);
      setCopiedPeak(true);
      setTimeout(() => setCopiedPeak(false), 2500);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] overflow-hidden ${className}`}
      id="wind-history-24h-panel"
    >
      {/* Top Header Tático */}
      <div className="p-4 sm:p-5 border-b-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#d42020]">
            <Wind className="w-4 h-4" />
            <span>RELATÓRIO METEOROLÓGICO RETROSPECTIVO (ÚLTIMAS 24 HORAS)</span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-tight text-black dark:text-white mt-0.5 flex items-center gap-2">
            <span>Histórico de Ventos & Rajadas Máximas</span>
            <span className="hidden sm:inline-block text-xs font-mono font-bold px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black">
              24H REGISTRADAS
            </span>
          </h3>
          <p className="text-xs text-[#555] dark:text-[#8b949e] mt-1">
            Local de referência: <strong className="text-black dark:text-white">{locationName}</strong> ({lat.toFixed(3)}°, {lng.toFixed(3)}°) • 
            Fonte: {data?.source || 'Open-Meteo Weather API'}
          </p>
        </div>

        {/* Controles de Unidade & Recarregamento */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#161b22] p-0.5 text-xs font-bold font-mono">
            <span className="px-2 text-[10px] text-[#777] dark:text-[#8b949e] uppercase hidden sm:inline">
              UNIDADE:
            </span>
            {(['knots', 'kmh', 'ms', 'mph'] as WindDisplayUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => setSelectedUnit(u)}
                className={`px-2 py-1 text-xs cursor-pointer transition-colors ${
                  selectedUnit === u
                    ? 'bg-black text-white dark:bg-white dark:text-black font-black'
                    : 'text-black dark:text-white hover:bg-[#eee] dark:hover:bg-[#21262d]'
                }`}
              >
                {u === 'knots' ? 'NÓS (kn)' : u === 'kmh' ? 'km/h' : u === 'ms' ? 'm/s' : 'mph'}
              </button>
            ))}
          </div>

          <button
            onClick={loadWindHistory}
            disabled={loading}
            className="p-2 border-2 border-black dark:border-white bg-white dark:bg-[#21262d] hover:bg-[#eee] dark:hover:bg-[#30363d] text-black dark:text-white cursor-pointer transition-colors"
            title="Atualizar relatórios meteorológicos de vento"
            aria-label="Atualizar histórico de ventos de 24h"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#d42020]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* CARDS TÁTICOS DE DESTAQUE: PICO MÁXIMO DE RAJADA E MÉTRICAS */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Card Principal: PICO MÁXIMO DE RAJADA REGISTRADA (Alerta Tático) */}
            <div className="md:col-span-2 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] p-4 relative shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-black/20 dark:border-white/20">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#d42020]">
                    <Zap className="w-4 h-4 animate-pulse" />
                    <span>Pico Máximo de Rajada Registrada</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-[#d42020] text-white">
                    RECORD DAS 24H
                  </span>
                </div>

                <div className="my-3 flex items-baseline gap-2">
                  <span className="font-display text-4xl sm:text-5xl font-black tabular-nums text-black dark:text-white">
                    {peakConverted.value.toFixed(1)}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-[#d42020]">
                    {peakConverted.unit}
                  </span>
                  <span className="text-xs text-[#666] dark:text-[#8b949e] font-mono ml-2">
                    ({data.peakGustKnots.toFixed(1)} kn / {data.peakGustKmH.toFixed(1)} km/h)
                  </span>
                </div>

                {/* Detalhes do Registro do Pico */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#444] dark:text-[#c9d1d9] bg-white dark:bg-[#161b22] p-2.5 border border-black/30 dark:border-white/30">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#d42020]" />
                    <span>Horário: <strong>{data.peakGustTime}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#d42020]" />
                    <span>Rumo: <strong>{data.peakGustDirectionDeg}° ({data.peakGustDirectionCardinal})</strong></span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-[#666] dark:text-[#8b949e]">Escala Beaufort:</span>
                    <strong className="text-black dark:text-white font-bold text-[11px]">
                      Força {data.peakGustBeaufortScale} — {data.peakGustBeaufortName}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Botão de Ação: Injetar no Conversor */}
              {onApplyToConverter && (
                <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
                  <button
                    onClick={handleApplyPeak}
                    className="w-full py-2 px-3 border-2 border-black dark:border-white bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold font-mono uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-[2px_2px_0px_#000]"
                    title="Carregar o valor desta rajada máxima no conversor de velocidade da aba"
                  >
                    {copiedPeak ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>VALOR APLICADO NO CONVERSOR!</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        <span>CONVERTER ESTA RAJADA ({data.peakGustKnots.toFixed(1)} KN)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Card 2: Vento Médio Sustentado */}
            <div className="border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#161b22] p-4 flex flex-col justify-between shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-blue-600" />
                  Média Sustentada (24h)
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold font-display tabular-nums text-black dark:text-white">
                    {selectedUnit === 'knots'
                      ? data.avgWindKnots.toFixed(1)
                      : selectedUnit === 'kmh'
                      ? data.avgWindKmH.toFixed(1)
                      : selectedUnit === 'ms'
                      ? (data.avgWindKmH / 3.6).toFixed(1)
                      : (data.avgWindKmH * 0.621371).toFixed(1)}
                  </span>
                  <span className="text-sm font-bold font-mono text-[#666] dark:text-[#8b949e]">
                    {unitLabel}
                  </span>
                </div>
                <div className="text-xs text-[#555] dark:text-[#8b949e] mt-1">
                  Média de rajadas: <strong>{selectedUnit === 'knots' ? data.avgGustKnots.toFixed(1) + ' kn' : data.avgGustKmH.toFixed(1) + ' km/h'}</strong>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-black/10 dark:border-white/10 text-[11px] text-[#666] dark:text-[#8b949e]">
                Fator de rajada médio: <strong className="text-black dark:text-white">1.6x</strong> acima do vento de fundo.
              </div>
            </div>

            {/* Card 3: Rumo Predominante & Dinâmica */}
            <div className="border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#161b22] p-4 flex flex-col justify-between shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#666] dark:text-[#8b949e] flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-emerald-600" />
                  Rumo Predominante
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold font-display text-black dark:text-white">
                    {data.prevailingQuadrant}
                  </span>
                  <span className="text-xs font-mono text-[#666] dark:text-[#8b949e]">
                    ({data.peakGustDirectionDeg}°)
                  </span>
                </div>
                <div className="text-xs text-[#555] dark:text-[#8b949e] mt-1">
                  Vento mínimo: <strong>{data.minWindKnots.toFixed(1)} kn</strong> ({data.minWindKmH.toFixed(1)} km/h)
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-black/10 dark:border-white/10 text-[11px] text-[#666] dark:text-[#8b949e]">
                {data.peakGustKnots >= 25 ? (
                  <span className="text-[#d42020] font-bold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Condição de Vento Forte
                  </span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Navegabilidade Segura
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GRÁFICO RECHARTS: VENTOS SUSTENTADOS VS RAJADAS MÁXIMAS REGISTRADAS */}
        <div className="border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/20 dark:border-white/20 mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#d42020]" />
                Curva Horária das 24 Horas: Vento Sustentado vs Rajada Máxima
              </span>
              <span className="text-[11px] text-[#666] dark:text-[#8b949e]">
                A área colorida representa o envelope de rajadas registradas a cada hora; a linha escura é o vento médio sustentado.
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#d42020] inline-block"></span>
                <span className="font-bold text-black dark:text-white">Rajadas Máximas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#111] dark:bg-white inline-block"></span>
                <span className="text-[#555] dark:text-[#aaa]">Vento Médio</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-2 text-xs font-mono">
              <RotateCw className="w-6 h-6 animate-spin text-[#d42020]" />
              <span>Consultando relatórios meteorológicos da costa...</span>
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gustGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d42020" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#d42020" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" opacity={0.3} />
                  <XAxis
                    dataKey="time"
                    stroke="#888"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#888"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    unit={` ${unitLabel}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-black text-white p-3 border-2 border-white text-xs font-mono space-y-1 shadow-[3px_3px_0px_#d42020]">
                            <div className="font-bold text-[#f59e0b] border-b border-[#333] pb-1">
                              {item.fullLabel}
                            </div>
                            <div className="text-[#ef4444] font-bold">
                              Rajada Máxima: {item.gust.toFixed(1)} {unitLabel}
                            </div>
                            <div className="text-white">
                              Vento Sustentado: {item.speed.toFixed(1)} {unitLabel}
                            </div>
                            <div className="text-[#aaa] text-[11px] pt-1">
                              Rumo: {item.deg}° ({item.cardinal}) • {item.beaufort}
                            </div>
                            {item.isPeak && (
                              <div className="bg-[#d42020] text-white px-1.5 py-0.5 text-[10px] font-black uppercase text-center mt-1">
                                PICO MÁXIMO DAS 24H
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Linha de Referência da Rajada Máxima */}
                  {data && (
                    <ReferenceLine
                      y={peakConverted.value}
                      stroke="#d42020"
                      strokeDasharray="4 4"
                      label={{
                        value: `PICO: ${peakConverted.value.toFixed(1)} ${unitLabel}`,
                        position: 'insideTopRight',
                        fill: '#d42020',
                        fontSize: 10,
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                      }}
                    />
                  )}
                  {/* Área de Rajadas */}
                  <Area
                    type="monotone"
                    dataKey="gust"
                    name="Rajada Máxima"
                    stroke="#d42020"
                    strokeWidth={2.5}
                    fill="url(#gustGradient)"
                  />
                  {/* Linha de Vento Sustentado */}
                  <Line
                    type="monotone"
                    dataKey="speed"
                    name="Vento Sustentado"
                    stroke="#111111"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#111111' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Dica Náutica de Interpretação */}
          <div className="mt-3 pt-2 border-t border-black/10 dark:border-white/10 flex items-start gap-1.5 text-[11px] text-[#666] dark:text-[#8b949e]">
            <HelpCircle className="w-3.5 h-3.5 shrink-0 text-black dark:text-white mt-0.5" />
            <span>
              <strong>Doutrina Náutica da DHN:</strong> Em cálculos de estabilidade, fundeio e manobra costeira, planeje sempre considerando a 
              <strong> rajada máxima registrada</strong> e não apenas o vento médio sustentado, pois as forças aerodinâmicas sobre o velame e superestrutura aumentam com o quadrado da velocidade da rajada ($F \propto V^2$).
            </span>
          </div>
        </div>

        {/* LOG RETROSPECTIVO HORÁRIO EM TABELA (EXPANSÍVEL) */}
        <div className="border-2 border-black dark:border-[#30363d] bg-white dark:bg-[#161b22]">
          <button
            onClick={() => setShowTableLog(!showTableLog)}
            className="w-full p-3.5 bg-[#eeebe6] dark:bg-[#21262d] hover:bg-[#ddd] dark:hover:bg-[#30363d] flex items-center justify-between text-xs font-bold font-mono uppercase cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2 text-black dark:text-white">
              <Layers className="w-4 h-4 text-[#d42020]" />
              <span>Ver Tabela Detalhada das 24 Horas de Registros ({data?.reports.length || 0} relatórios)</span>
            </span>
            {showTableLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showTableLog && data && (
            <div className="p-3 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black dark:border-white bg-[#f8f7f4] dark:bg-[#0d1117] text-[11px] uppercase">
                    <th className="p-2">Horário</th>
                    <th className="p-2">Vento Médio</th>
                    <th className="p-2">Rajada Máxima</th>
                    <th className="p-2">Fator Rajada</th>
                    <th className="p-2">Direção</th>
                    <th className="p-2">Beaufort</th>
                    <th className="p-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 dark:divide-white/10">
                  {data.reports.map((r, i) => {
                    const speed = formatSpeed(r, false);
                    const gust = formatSpeed(r, true);
                    return (
                      <tr
                        key={i}
                        className={`hover:bg-[#f8f7f4] dark:hover:bg-[#21262d] transition-colors ${
                          r.isPeakGust
                            ? 'bg-red-50 dark:bg-red-950/30 font-bold border-l-4 border-l-[#d42020]'
                            : ''
                        }`}
                      >
                        <td className="p-2 whitespace-nowrap">
                          <span>{r.fullLabel}</span>
                          {r.isPeakGust && (
                            <span className="ml-2 px-1 py-0.2 bg-[#d42020] text-white text-[9px] font-black uppercase">
                              PICO
                            </span>
                          )}
                        </td>
                        <td className="p-2 tabular-nums">
                          {speed.value.toFixed(1)} {speed.unit}
                        </td>
                        <td className={`p-2 tabular-nums font-bold ${r.isPeakGust ? 'text-[#d42020]' : ''}`}>
                          {gust.value.toFixed(1)} {gust.unit}
                        </td>
                        <td className="p-2 tabular-nums text-[#666] dark:text-[#8b949e]">
                          {r.gustFactor}x
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="inline-block"
                              style={{ transform: `rotate(${r.windDirectionDeg}deg)` }}
                              title={`${r.windDirectionDeg}°`}
                            >
                              ↑
                            </span>
                            <span>{r.windDirectionDeg}° ({r.windDirectionCardinal})</span>
                          </span>
                        </td>
                        <td className="p-2 text-[11px] text-[#555] dark:text-[#aaa]">
                          F{r.beaufortScale} ({r.beaufortName})
                        </td>
                        <td className="p-2 text-right">
                          {onApplyToConverter && (
                            <button
                              onClick={() => {
                                onApplyToConverter(r.windGustsKnots);
                                setCopiedPeak(true);
                                setTimeout(() => setCopiedPeak(false), 2000);
                              }}
                              className="px-2 py-1 bg-black hover:bg-[#333] text-white dark:bg-white dark:text-black dark:hover:bg-[#eee] text-[10px] font-bold uppercase transition-colors cursor-pointer"
                              title={`Injetar rajada de ${r.windGustsKnots.toFixed(1)} kn no conversor`}
                            >
                              Converter
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WindHistory24hPanel;
