import React, { useState, useMemo } from 'react';
import {
  Compass,
  Gauge,
  Navigation,
  Wind,
  Ruler,
  Clock,
  ArrowRightLeft,
  Copy,
  Check,
  Info,
  Waves,
  Anchor,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  HelpCircle,
  Calculator,
  Layers,
  Zap,
} from 'lucide-react';
import { TideStation } from '../types/tide';
import { WindHistory24hPanel } from './WindHistory24hPanel';

// Fatores de conversão exatos e oficiais (Organização Hidrográfica Internacional & OMM)
const KNOT_TO_KMH = 1.852;
const KNOT_TO_MS = 0.51444444444;
const KNOT_TO_MPH = 1.150779448;

const NM_TO_KM = 1.852;
const NM_TO_METERS = 1852;
const NM_TO_STATUTE_MILES = 1.150779448;
const NM_TO_CABLES = 10; // 1 cabo náutico = 1/10 NM = 185.2 metros
const NM_TO_FATHOMS = 1012.6859; // 1 braça = 1.8288 metros (6 pés)

const HPA_TO_MB = 1; // 1 hPa = 1 mb exatamente
const HPA_TO_MMHG = 0.75006157584566;
const HPA_TO_INHG = 0.0295299830714;
const HPA_TO_ATM = 0.000986923266716;

// Escala de Beaufort Oficial Náutica (DHN Marinha do Brasil / OMM)
interface BeaufortLevel {
  force: number;
  name: string;
  minKnots: number;
  maxKnots: number;
  seaDescription: string;
  safetyAdvice: string;
  severity: 'calm' | 'safe' | 'caution' | 'warning' | 'danger';
}

const BEAUFORT_SCALE: BeaufortLevel[] = [
  { force: 0, name: 'Calmaria', minKnots: 0, maxKnots: 1, seaDescription: 'Mar espelhado, liso sem ondulações perceptíveis.', safetyAdvice: 'Ideal para qualquer manobra.', severity: 'calm' },
  { force: 1, name: 'Aragem', minKnots: 1, maxKnots: 3, seaDescription: 'Pequenas rugas na superfície que parecem escamas.', safetyAdvice: 'Navegação tranquila.', severity: 'safe' },
  { force: 2, name: 'Brisa Leve', minKnots: 4, maxKnots: 6, seaDescription: 'Pequenas vagas curtas mas pronunciadas, cristas não quebram.', safetyAdvice: 'Condições excelentes de navegação.', severity: 'safe' },
  { force: 3, name: 'Brisa Fraca', minKnots: 7, maxKnots: 10, seaDescription: 'Grandes rugas com algumas cristas quebrando (carneirinhos espalhados).', safetyAdvice: 'Ideal para velejadores iniciantes.', severity: 'safe' },
  { force: 4, name: 'Brisa Moderada', minKnots: 11, maxKnots: 16, seaDescription: 'Vagas pequenas tornando-se mais longas; numerosos carneirinhos brancos.', safetyAdvice: 'Boa navegabilidade; atenção com caiaques e botes pequenos.', severity: 'safe' },
  { force: 5, name: 'Brisa Forte', minKnots: 17, maxKnots: 21, seaDescription: 'Vagas moderadas com cristas pronunciadas; muitos carneirinhos e alguns respingos.', safetyAdvice: 'Atenção para embarcações miúdas; tripulação deve usar colete.', severity: 'caution' },
  { force: 6, name: 'Vento Fresco', minKnots: 22, maxKnots: 27, seaDescription: 'Grandes vagas começam a se formar; cristas brancas de espuma em toda parte.', safetyAdvice: 'Dificuldade para barcos menores; reduzir vela ou velocidade.', severity: 'caution' },
  { force: 7, name: 'Vento Muito Fresco', minKnots: 28, maxKnots: 33, seaDescription: 'Mar encapelado com espuma soprada em faixas na direção do vento.', safetyAdvice: 'Embarcações de recreio devem buscar porto abrigado.', severity: 'warning' },
  { force: 8, name: 'Vento Forte (Vendaval)', minKnots: 34, maxKnots: 40, seaDescription: 'Vagas moderadamente altas; bordas das cristas começam a quebrar em turbilhões.', safetyAdvice: 'Apenas embarcações de alto-mar preparadas devem navegar.', severity: 'warning' },
  { force: 9, name: 'Vendaval Forte', minKnots: 41, maxKnots: 47, seaDescription: 'Grandes vagas; mar revolto com grossas faixas de espuma e visibilidade reduzida.', safetyAdvice: 'Risco severo de emborcamento para navegação amadora.', severity: 'danger' },
  { force: 10, name: 'Tempestade', minKnots: 48, maxKnots: 55, seaDescription: 'Vagas muito altas com cristas suspensas; superfície do mar com aspecto todo branco.', safetyAdvice: 'Alerta vermelho absoluto da Capitania dos Portos.', severity: 'danger' },
  { force: 11, name: 'Tempestade Violenta', minKnots: 56, maxKnots: 63, seaDescription: 'Vagas excepcionalmente altas; mar totalmente coberto por espuma densa.', safetyAdvice: 'Emergência náutica extrema.', severity: 'danger' },
  { force: 12, name: 'Furacão', minKnots: 64, maxKnots: 999, seaDescription: 'Ar cheio de espuma e spray; mar completamente branco; visibilidade quase nula.', safetyAdvice: 'Condições de destruição máxima.', severity: 'danger' },
];

export interface NauticalUnitConverterProps {
  currentWindSpeedKnots?: number;
  currentPressureHpa?: number;
  onNavigateToTides?: () => void;
  station?: TideStation;
  userCoords?: { lat: number; lng: number };
}

export const NauticalUnitConverter: React.FC<NauticalUnitConverterProps> = ({
  currentWindSpeedKnots,
  currentPressureHpa,
  onNavigateToTides,
  station,
  userCoords,
}) => {
  // Estado de Conversão de Velocidade
  const [knotsInput, setKnotsInput] = useState<string>(
    currentWindSpeedKnots ? currentWindSpeedKnots.toFixed(1) : '12'
  );
  const [kmhInput, setKmhInput] = useState<string>(
    currentWindSpeedKnots ? (currentWindSpeedKnots * KNOT_TO_KMH).toFixed(1) : '22.2'
  );
  const [speedSource, setSpeedSource] = useState<'knots' | 'kmh'>('knots');

  // Estado de Conversão de Distância
  const [nmInput, setNmInput] = useState<string>('15');
  const [kmDistInput, setKmDistInput] = useState<string>('27.8');
  const [distSource, setDistSource] = useState<'nm' | 'km'>('nm');

  // Estado de Conversão de Pressão
  const [hpaInput, setHpaInput] = useState<string>(
    currentPressureHpa ? currentPressureHpa.toFixed(1) : '1013.25'
  );
  const [mbInput, setMbInput] = useState<string>(
    currentPressureHpa ? currentPressureHpa.toFixed(1) : '1013.25'
  );
  const [pressSource, setPressSource] = useState<'hpa' | 'mb'>('hpa');

  // Estado de Conversão de Profundidade (Metros / Pés / Braças)
  const [depthMeters, setDepthMeters] = useState<string>('5.0');

  // Calculadora de Navegação (D = V x T)
  const [calcSpeedKnots, setCalcSpeedKnots] = useState<string>('12');
  const [calcDistanceNm, setCalcDistanceNm] = useState<string>('24');

  // Tendência Barométrica (Variação em 3 horas)
  const [pressureDelta3h, setPressureDelta3h] = useState<string>('-1.5');

  // Aba ativa interna de foco
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'speed' | 'wind24h' | 'distance' | 'pressure' | 'depth' | 'calculator'>('all');

  // Estado de cópia para feedback visual
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // --- Handlers de Velocidade ---
  const handleKnotsChange = (val: string) => {
    setKnotsInput(val);
    setSpeedSource('knots');
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setKmhInput((num * KNOT_TO_KMH).toFixed(2));
    } else {
      setKmhInput('');
    }
  };

  const handleKmhChange = (val: string) => {
    setKmhInput(val);
    setSpeedSource('kmh');
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setKnotsInput((num / KNOT_TO_KMH).toFixed(2));
    } else {
      setKnotsInput('');
    }
  };

  const currentKnotsNum = useMemo(() => {
    const num = parseFloat(knotsInput);
    return isNaN(num) ? 0 : Math.max(0, num);
  }, [knotsInput]);

  const currentBeaufort = useMemo(() => {
    return (
      BEAUFORT_SCALE.find(
        (b) => currentKnotsNum >= b.minKnots && currentKnotsNum <= b.maxKnots
      ) || BEAUFORT_SCALE[BEAUFORT_SCALE.length - 1]
    );
  }, [currentKnotsNum]);

  // --- Handlers de Distância ---
  const handleNmChange = (val: string) => {
    setNmInput(val);
    setDistSource('nm');
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setKmDistInput((num * NM_TO_KM).toFixed(2));
    } else {
      setKmDistInput('');
    }
  };

  const handleKmDistChange = (val: string) => {
    setKmDistInput(val);
    setDistSource('km');
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setNmInput((num / NM_TO_KM).toFixed(2));
    } else {
      setNmInput('');
    }
  };

  const currentNmNum = useMemo(() => {
    const num = parseFloat(nmInput);
    return isNaN(num) ? 0 : Math.max(0, num);
  }, [nmInput]);

  // --- Handlers de Pressão ---
  const handleHpaChange = (val: string) => {
    setHpaInput(val);
    setPressSource('hpa');
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setMbInput(num.toFixed(2));
    } else {
      setMbInput('');
    }
  };

  const handleMbChange = (val: string) => {
    setMbInput(val);
    setPressSource('mb');
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setHpaInput(num.toFixed(2));
    } else {
      setHpaInput('');
    }
  };

  const currentHpaNum = useMemo(() => {
    const num = parseFloat(hpaInput);
    return isNaN(num) ? 1013.25 : num;
  }, [hpaInput]);

  // Interpretação Meteorológica da Pressão
  const pressureAssessment = useMemo(() => {
    const p = currentHpaNum;
    if (p >= 1022) {
      return {
        label: 'ALTA PRESSÃO FORTE (ANTICICLONE)',
        description: 'Tempo estável, céu limpo, brisas regulares e pouca chance de tempestades.',
        color: 'text-emerald-700 dark:text-emerald-400',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-500',
      };
    }
    if (p >= 1013) {
      return {
        label: 'PRESSÃO NORMAL A ELEVADA',
        description: 'Condição padrão ISA ao nível do mar (1013.25 hPa). Boas condições na costa.',
        color: 'text-sky-700 dark:text-sky-400',
        badgeBg: 'bg-sky-100 dark:bg-sky-950/40 border-sky-500',
      };
    }
    if (p >= 1005) {
      return {
        label: 'BAIXA PRESSÃO MODERADA',
        description: 'Instabilidade provável; nebulosidade variável e possibilidade de ventos arrastados.',
        color: 'text-amber-700 dark:text-amber-400',
        badgeBg: 'bg-amber-100 dark:bg-amber-950/40 border-amber-500',
      };
    }
    if (p >= 995) {
      return {
        label: 'DEPRESSÃO BAROMÉTRICA ATIVA',
        description: 'Alerta náutico! Frente fria vigorosa ou área de convergência; mar encapelado.',
        color: 'text-orange-700 dark:text-orange-400',
        badgeBg: 'bg-orange-100 dark:bg-orange-950/40 border-orange-500',
      };
    }
    return {
      label: 'CICLONE OU TEMPESTADE SEVERA',
      description: 'Aviso de mau tempo severo! Pressão perigosamente baixa com risco iminente de ventania.',
      color: 'text-red-700 dark:text-red-400',
      badgeBg: 'bg-red-100 dark:bg-red-950/40 border-red-500',
    };
  }, [currentHpaNum]);

  // Interpretação da Tendência Barométrica (3 horas)
  const barometricTrendInfo = useMemo(() => {
    const delta = parseFloat(pressureDelta3h);
    if (isNaN(delta)) return null;

    if (delta <= -4.0) {
      return {
        status: 'QUEDA MUITO BRUSCA (PERIGO EXTREMO)',
        text: 'Queda superior a 4 hPa em 3 horas indica chegada de frente fria violenta, vendaval ou ciclone nas próximas 6h a 12h. Procure abrigo imediatamente.',
        icon: TrendingDown,
        color: 'text-red-600 dark:text-red-400',
        borderColor: 'border-red-600',
      };
    }
    if (delta <= -2.0) {
      return {
        status: 'QUEDA RÁPIDA (ALERTA DE MAU TEMPO)',
        text: 'Queda de 2 a 4 hPa em 3 horas. Deterioração acelerada das condições meteorológicas; ondas e ventos fortes iminentes.',
        icon: TrendingDown,
        color: 'text-amber-600 dark:text-amber-400',
        borderColor: 'border-amber-600',
      };
    }
    if (delta <= -0.6) {
      return {
        status: 'QUEDA MODERADA (INSTABILIDADE)',
        text: 'Pressão em declínio contínuo. Possibilidade de chuvas e aumento da intensidade do vento.',
        icon: TrendingDown,
        color: 'text-yellow-600 dark:text-yellow-400',
        borderColor: 'border-yellow-600',
      };
    }
    if (delta <= 0.6) {
      return {
        status: 'PRESSÃO ESTÁVEL',
        text: 'Variação normal dentro das oscilações da maré barométrica diurna (maré atmosférica). Condições consistentes.',
        icon: Check,
        color: 'text-emerald-600 dark:text-emerald-400',
        borderColor: 'border-emerald-600',
      };
    }
    return {
      status: 'PRESSÃO EM ELEVAÇÃO (MELHORIA)',
      text: 'Aumento barométrico após passagem de frente fria. Vento deve rondar para o quadrante Sul/Sudeste com tempo secando.',
      icon: TrendingUp,
      color: 'text-sky-600 dark:text-sky-400',
      borderColor: 'border-sky-600',
    };
  }, [pressureDelta3h]);

  // Calculadora de ETA / Tempo de Navegação
  const navCalcResults = useMemo(() => {
    const spd = parseFloat(calcSpeedKnots);
    const dist = parseFloat(calcDistanceNm);
    if (isNaN(spd) || spd <= 0 || isNaN(dist) || dist <= 0) {
      return null;
    }
    const hoursTotal = dist / spd;
    const wholeHours = Math.floor(hoursTotal);
    const minutes = Math.round((hoursTotal - wholeHours) * 60);

    const distKm = dist * NM_TO_KM;
    const speedKmh = spd * KNOT_TO_KMH;

    return {
      timeFormatted: `${wholeHours}h ${minutes.toString().padStart(2, '0')}min`,
      hoursDecimal: hoursTotal.toFixed(2),
      distKm: distKm.toFixed(1),
      speedKmh: speedKmh.toFixed(1),
    };
  }, [calcSpeedKnots, calcDistanceNm]);

  // Profundidade convertida
  const depthMetersNum = useMemo(() => {
    const n = parseFloat(depthMeters);
    return isNaN(n) ? 0 : Math.max(0, n);
  }, [depthMeters]);
  const depthFeet = (depthMetersNum * 3.28084).toFixed(1);
  const depthFathoms = (depthMetersNum / 1.8288).toFixed(1);

  return (
    <div className="bg-[#f8f7f4] dark:bg-[#0d1117] text-[#111] dark:text-[#f0f6fc] font-mono border-b-2 border-black dark:border-[#30363d] transition-colors">
      {/* Cabeçalho Tático Náutico */}
      <div className="p-4 sm:p-6 bg-white dark:bg-[#161b22] border-b-2 border-black dark:border-[#30363d] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#d42020]">
            <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '12s' }} />
            <span>INSTRUMENTO TÁTICO DE NAVEGAÇÃO & METEOROLOGIA MARÍTIMA</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-black dark:text-white mt-1">
            Conversor de Unidades Náuticas
          </h2>
          <p className="text-xs sm:text-sm text-[#666] dark:text-[#8b949e] max-w-2xl mt-1">
            Ferramenta de conversão bidirecional instantânea para velocidade (<span className="text-black dark:text-white font-bold">nós ↔ km/h</span>), 
            distância (<span className="text-black dark:text-white font-bold">milhas náuticas ↔ km</span>), 
            pressão (<span className="text-black dark:text-white font-bold">hPa ↔ mb</span>) e batimetria marítima.
          </p>
        </div>

        {/* Mnemônico Rápido do Comandante */}
        <div className="bg-[#f8f7f4] dark:bg-[#21262d] border-2 border-black dark:border-[#30363d] p-3 text-xs space-y-1 shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_#30363d] shrink-0">
          <div className="font-bold text-[11px] uppercase tracking-wider text-[#d42020] flex items-center gap-1.5">
            <Anchor className="w-3.5 h-3.5" />
            <span>Regras de Bolso da DHN</span>
          </div>
          <div className="text-[11px] text-[#444] dark:text-[#c9d1d9]">
            • <strong>1 Nó</strong> = 1,852 km/h (1 NM por hora)
          </div>
          <div className="text-[11px] text-[#444] dark:text-[#c9d1d9]">
            • <strong>1 NM</strong> = 1,852 km (1' arco de latitude)
          </div>
          <div className="text-[11px] text-[#444] dark:text-[#c9d1d9]">
            • <strong>1 hPa</strong> = 1 mbar (relação 1:1 exata)
          </div>
        </div>
      </div>

      {/* Barra de Filtro de Módulo (Subtabs) */}
      <div className="bg-[#eeebe6] dark:bg-[#161b22] px-4 sm:px-6 py-2.5 border-b-2 border-black dark:border-[#30363d] flex items-center gap-1.5 sm:gap-2 overflow-x-auto text-xs font-bold uppercase">
        <span className="text-[10px] text-[#888] dark:text-[#8b949e] uppercase mr-1 hidden sm:inline">
          MÓDULO:
        </span>
        <button
          onClick={() => setActiveSubTab('all')}
          className={`px-3 py-1.5 border-2 border-black dark:border-white transition-all cursor-pointer ${
            activeSubTab === 'all'
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_#d42020]'
              : 'bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#ddd] dark:hover:bg-[#30363d]'
          }`}
        >
          Todos os Conversores
        </button>
        <button
          onClick={() => setActiveSubTab('speed')}
          className={`px-3 py-1.5 border-2 border-black dark:border-white transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'speed'
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_#d42020]'
              : 'bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#ddd] dark:hover:bg-[#30363d]'
          }`}
        >
          <Wind className="w-3.5 h-3.5 text-[#d42020]" />
          <span>Velocidade (Nós / km/h)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('wind24h')}
          className={`px-3 py-1.5 border-2 border-black dark:border-white transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'wind24h'
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_#d42020]'
              : 'bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#ddd] dark:hover:bg-[#30363d]'
          }`}
          title="Histórico de ventos das últimas 24h e monitoramento de rajadas máximas registradas"
        >
          <Zap className="w-3.5 h-3.5 text-[#d42020] animate-pulse" />
          <span>Histórico 24h & Rajadas</span>
        </button>
        <button
          onClick={() => setActiveSubTab('distance')}
          className={`px-3 py-1.5 border-2 border-black dark:border-white transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'distance'
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_#d42020]'
              : 'bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#ddd] dark:hover:bg-[#30363d]'
          }`}
        >
          <Ruler className="w-3.5 h-3.5 text-blue-600" />
          <span>Distância (NM / km)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('pressure')}
          className={`px-3 py-1.5 border-2 border-black dark:border-white transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'pressure'
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_#d42020]'
              : 'bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#ddd] dark:hover:bg-[#30363d]'
          }`}
        >
          <Gauge className="w-3.5 h-3.5 text-amber-600" />
          <span>Pressão (hPa / mb)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('depth')}
          className={`px-3 py-1.5 border-2 border-black dark:border-white transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'depth'
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_#d42020]'
              : 'bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#ddd] dark:hover:bg-[#30363d]'
          }`}
        >
          <Waves className="w-3.5 h-3.5 text-cyan-600" />
          <span>Profundidade & Calado</span>
        </button>
        <button
          onClick={() => setActiveSubTab('calculator')}
          className={`px-3 py-1.5 border-2 border-black dark:border-white transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'calculator'
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_#d42020]'
              : 'bg-white dark:bg-[#21262d] text-black dark:text-white hover:bg-[#ddd] dark:hover:bg-[#30363d]'
          }`}
        >
          <Calculator className="w-3.5 h-3.5 text-emerald-600" />
          <span>Calculadora ETA</span>
        </button>
      </div>

      {/* Grade Principal dos Conversores */}
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* SEÇÃO 1: VELOCIDADE (NÓS <-> KM/H) */}
        {(activeSubTab === 'all' || activeSubTab === 'speed') && (
          <div className="bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] p-4 sm:p-6 shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-black dark:border-[#30363d]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-black text-white dark:bg-white dark:text-black">
                  <Wind className="w-5 h-5 text-[#d42020]" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-black dark:text-white">
                    Conversor de Velocidade Náutica
                  </h3>
                  <span className="text-[11px] text-[#666] dark:text-[#8b949e]">
                    Nós (knots / kn) ⇄ Quilômetros por Hora (km/h) ⇄ m/s ⇄ mph
                  </span>
                </div>
              </div>

              {/* Botões de Cópia Rápida */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(`${knotsInput} kn = ${kmhInput} km/h`, 'speed')}
                  className="px-3 py-1.5 bg-[#f8f7f4] dark:bg-[#21262d] border border-black dark:border-white text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-[#eee] dark:hover:bg-[#30363d] cursor-pointer"
                  title="Copiar resultado da conversão"
                >
                  {copiedKey === 'speed' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 dark:text-emerald-400">COPIADO!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPIAR</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inputs Bidirecionais de Velocidade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Nós */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-knots" className="text-xs font-bold uppercase text-black dark:text-white flex items-center gap-1.5">
                    <Wind className="w-4 h-4 text-[#d42020]" />
                    <span>NÓS (KNOTS / KN)</span>
                  </label>
                  <span className="text-[10px] text-[#777] dark:text-[#8b949e]">MILHAS NÁUTICAS / HORA</span>
                </div>
                <div className="relative">
                  <input
                    id="input-knots"
                    type="number"
                    step="0.1"
                    min="0"
                    max="150"
                    value={knotsInput}
                    onChange={(e) => handleKnotsChange(e.target.value)}
                    className="w-full text-2xl sm:text-3xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d42020]"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#888]">
                    kn
                  </span>
                </div>

                {/* Slider tático de velocidade */}
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="0.5"
                  value={currentKnotsNum}
                  onChange={(e) => handleKnotsChange(e.target.value)}
                  className="w-full accent-[#d42020] cursor-pointer"
                  aria-label="Controle deslizante de velocidade em nós"
                />
              </div>

              {/* KM/H */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-kmh" className="text-xs font-bold uppercase text-black dark:text-white flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                    <span>QUILÔMETROS POR HORA (KM/H)</span>
                  </label>
                  <span className="text-[10px] text-[#777] dark:text-[#8b949e]">SISTEMA MÉTRICO INTERNACIONAL</span>
                </div>
                <div className="relative">
                  <input
                    id="input-kmh"
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    value={kmhInput}
                    onChange={(e) => handleKmhChange(e.target.value)}
                    className="w-full text-2xl sm:text-3xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#888]">
                    km/h
                  </span>
                </div>

                {/* Unidades derivadas imediatas */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="bg-white dark:bg-[#161b22] p-1.5 border border-black/20 dark:border-white/20">
                    <span className="text-[#888] block text-[9px]">METROS / SEGUNDO:</span>
                    <strong>{(currentKnotsNum * KNOT_TO_MS).toFixed(2)} m/s</strong>
                  </div>
                  <div className="bg-white dark:bg-[#161b22] p-1.5 border border-black/20 dark:border-white/20">
                    <span className="text-[#888] block text-[9px]">MILHAS TERRESTRES (MPH):</span>
                    <strong>{(currentKnotsNum * KNOT_TO_MPH).toFixed(2)} mph</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Presets Rápidos de Velocidade Náutica */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#777] dark:text-[#8b949e] block">
                PRESETS NÁUTICOS EM UM CLIQUE:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '0 kn (Calmo)', val: '0' },
                  { label: '5 kn (Manobra)', val: '5' },
                  { label: '7 kn (Veleiro)', val: '7' },
                  { label: '12 kn (Moderado)', val: '12' },
                  { label: '18 kn (Planeio)', val: '18' },
                  { label: '25 kn (Vento Forte)', val: '25' },
                  { label: '35 kn (Vendaval)', val: '35' },
                  { label: '50 kn (Tempestade)', val: '50' },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    onClick={() => handleKnotsChange(preset.val)}
                    className="px-2.5 py-1 text-xs border border-black dark:border-white bg-[#f8f7f4] dark:bg-[#21262d] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-bold cursor-pointer transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Acesso Rápido ao Painel de Rajadas das 24 Horas */}
            <div className="p-3 bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#d42020] animate-pulse" />
                <span>
                  <strong>Monitor de Rajadas:</strong> Consulte o histórico retrospectivo das últimas 24h e as rajadas máximas registradas.
                </span>
              </div>
              <button
                onClick={() => {
                  const el = document.getElementById('wind-history-24h-panel');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    setActiveSubTab('wind24h');
                  }
                }}
                className="px-3 py-1 bg-[#d42020] hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap"
              >
                IR PARA HISTÓRICO 24H ↓
              </button>
            </div>

            {/* Escala Beaufort Conectada ao Valor de Velocidade */}
            <div className="p-3 bg-[#f8f7f4] dark:bg-[#0d1117] border-2 border-black dark:border-[#30363d] space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black text-xs font-bold">
                    BEAUFORT F{currentBeaufort.force}
                  </span>
                  <span className="font-bold text-sm uppercase text-[#d42020]">
                    {currentBeaufort.name}
                  </span>
                  <span className="text-xs text-[#777] dark:text-[#8b949e]">
                    ({currentBeaufort.minKnots} a {currentBeaufort.maxKnots === 999 ? '64+' : currentBeaufort.maxKnots} nós)
                  </span>
                </div>
                <div className="text-xs font-bold text-[#555] dark:text-[#8b949e]">
                  Marinha do Brasil / DHN
                </div>
              </div>
              <div className="text-xs text-[#333] dark:text-[#c9d1d9] grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-black/10 dark:border-white/10">
                <div>
                  <strong className="text-black dark:text-white block text-[10px] uppercase">Estado da Superfície do Mar:</strong>
                  <span>{currentBeaufort.seaDescription}</span>
                </div>
                <div>
                  <strong className="text-black dark:text-white block text-[10px] uppercase">Recomendação de Segurança Náutica:</strong>
                  <span className="text-[#d42020] font-bold">{currentBeaufort.safetyAdvice}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO DE HISTÓRICO DE VENTOS DE 24H & RAJADAS MÁXIMAS REGISTRADAS */}
        {(activeSubTab === 'all' || activeSubTab === 'wind24h' || activeSubTab === 'speed') && (
          <WindHistory24hPanel
            station={station}
            userCoords={userCoords}
            onApplyToConverter={(knots) => {
              handleKnotsChange(knots.toFixed(1));
              const el = document.getElementById('input-knots');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
              }
            }}
          />
        )}

        {/* SEÇÃO 2: DISTÂNCIA NÁUTICA (MILHAS NÁUTICAS <-> QUILÔMETROS) */}
        {(activeSubTab === 'all' || activeSubTab === 'distance') && (
          <div className="bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] p-4 sm:p-6 shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-black dark:border-[#30363d]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-black text-white dark:bg-white dark:text-black">
                  <Ruler className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-black dark:text-white">
                    Conversor de Distância Marítima
                  </h3>
                  <span className="text-[11px] text-[#666] dark:text-[#8b949e]">
                    Milhas Náuticas (NM) ⇄ Quilômetros (km) ⇄ Metros ⇄ Braças ⇄ Cabos
                  </span>
                </div>
              </div>

              {/* Botão Copiar */}
              <button
                onClick={() => handleCopy(`${nmInput} NM = ${kmDistInput} km`, 'distance')}
                className="px-3 py-1.5 bg-[#f8f7f4] dark:bg-[#21262d] border border-black dark:border-white text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-[#eee] dark:hover:bg-[#30363d] cursor-pointer"
              >
                {copiedKey === 'distance' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">COPIADO!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPIAR</span>
                  </>
                )}
              </button>
            </div>

            {/* Inputs Bidirecionais de Distância */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Milhas Náuticas */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-nm" className="text-xs font-bold uppercase text-black dark:text-white flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    <span>MILHAS NÁUTICAS (NM / M)</span>
                  </label>
                  <span className="text-[10px] text-[#777] dark:text-[#8b949e]">1 NM = 1' LATITUDE (1852m)</span>
                </div>
                <div className="relative">
                  <input
                    id="input-nm"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10000"
                    value={nmInput}
                    onChange={(e) => handleNmChange(e.target.value)}
                    className="w-full text-2xl sm:text-3xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#888]">
                    NM
                  </span>
                </div>
                <div className="text-[11px] text-[#666] dark:text-[#8b949e]">
                  Exatamente <strong>{(currentNmNum * NM_TO_METERS).toLocaleString('pt-BR')} metros</strong> náuticos
                </div>
              </div>

              {/* Quilômetros */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-kmdist" className="text-xs font-bold uppercase text-black dark:text-white flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                    <span>QUILÔMETROS (KM)</span>
                  </label>
                  <span className="text-[10px] text-[#777] dark:text-[#8b949e]">DISTÂNCIA TERRESTRE EQUIVALENTE</span>
                </div>
                <div className="relative">
                  <input
                    id="input-kmdist"
                    type="number"
                    step="0.1"
                    min="0"
                    max="18000"
                    value={kmDistInput}
                    onChange={(e) => handleKmDistChange(e.target.value)}
                    className="w-full text-2xl sm:text-3xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#888]">
                    km
                  </span>
                </div>

                {/* Unidades derivadas adicionais */}
                <div className="grid grid-cols-3 gap-2 text-[10px] pt-1">
                  <div className="bg-white dark:bg-[#161b22] p-1.5 border border-black/20 dark:border-white/20">
                    <span className="text-[#888] block text-[8px]">CABOS NÁUTICOS:</span>
                    <strong>{(currentNmNum * NM_TO_CABLES).toFixed(1)} cb</strong>
                  </div>
                  <div className="bg-white dark:bg-[#161b22] p-1.5 border border-black/20 dark:border-white/20">
                    <span className="text-[#888] block text-[8px]">BRAÇAS (FATHOMS):</span>
                    <strong>{(currentNmNum * NM_TO_FATHOMS).toFixed(0)} fa</strong>
                  </div>
                  <div className="bg-white dark:bg-[#161b22] p-1.5 border border-black/20 dark:border-white/20">
                    <span className="text-[#888] block text-[8px]">MILHAS TERRESTRES:</span>
                    <strong>{(currentNmNum * NM_TO_STATUTE_MILES).toFixed(2)} mi</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Presets Notáveis da Geografia Marítima Brasileira */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#777] dark:text-[#8b949e] block">
                MARCOS JURÍDICOS & DISTÂNCIAS DA MARINHA DO BRASIL:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '1 NM (1 min de latitude)', val: '1' },
                  { label: '3 NM (Horizonte visual)', val: '3' },
                  { label: '12 NM (Mar Territorial - Soberania)', val: '12' },
                  { label: '24 NM (Zona Contígua)', val: '24' },
                  { label: '200 NM (ZEE / Amazônia Azul)', val: '200' },
                  { label: '350 NM (Plataforma Continental Estendida)', val: '350' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => handleNmChange(item.val)}
                    className="px-2.5 py-1 text-xs border border-black dark:border-white bg-[#f8f7f4] dark:bg-[#21262d] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-bold cursor-pointer transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO 3: PRESSÃO ATMOSFÉRICA & BAROMETRIA (HPA <-> MB) */}
        {(activeSubTab === 'all' || activeSubTab === 'pressure') && (
          <div className="bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] p-4 sm:p-6 shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-black dark:border-[#30363d]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-black text-white dark:bg-white dark:text-black">
                  <Gauge className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-black dark:text-white">
                    Conversor Barométrico & Pressão Marítima
                  </h3>
                  <span className="text-[11px] text-[#666] dark:text-[#8b949e]">
                    Hectopascais (hPa) ⇄ Milibares (mb) ⇄ mmHg (Torr) ⇄ inHg (Polegadas de Mercúrio)
                  </span>
                </div>
              </div>

              {/* Botão Copiar */}
              <button
                onClick={() => handleCopy(`${hpaInput} hPa = ${mbInput} mb`, 'pressure')}
                className="px-3 py-1.5 bg-[#f8f7f4] dark:bg-[#21262d] border border-black dark:border-white text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-[#eee] dark:hover:bg-[#30363d] cursor-pointer"
              >
                {copiedKey === 'pressure' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">COPIADO!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPIAR</span>
                  </>
                )}
              </button>
            </div>

            {/* Explicação da Relação 1:1 hPa e mb */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500/50 flex items-start gap-2.5 text-xs">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-900 dark:text-amber-300 uppercase block font-bold">
                  Relação Exata 1:1 na Meteorologia Marítima:
                </strong>
                <p className="text-amber-800 dark:text-amber-200 mt-0.5">
                  <strong>1 hPa (hectopascal) é exatamente igual a 1 mb (milibar)</strong> (1 hPa = 100 Pa = 1 mb = 1 mbar). 
                  A Organização Meteorológica Mundial (OMM) e o Serviço Meteorológico Marinho da Marinha do Brasil adotaram a nomenclatura hPa 
                  para integrar o barômetro ao Sistema Internacional de Unidades (SI), mantendo o mesmo valor numérico lido nos barômetros de bordo.
                </p>
              </div>
            </div>

            {/* Inputs Bidirecionais de Pressão */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* hPa */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-hpa" className="text-xs font-bold uppercase text-black dark:text-white flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-amber-600" />
                    <span>HECTOPASCAL (HPA)</span>
                  </label>
                  <span className="text-[10px] text-[#777] dark:text-[#8b949e]">PADRÃO SI / OMM</span>
                </div>
                <div className="relative">
                  <input
                    id="input-hpa"
                    type="number"
                    step="0.1"
                    min="850"
                    max="1080"
                    value={hpaInput}
                    onChange={(e) => handleHpaChange(e.target.value)}
                    className="w-full text-2xl sm:text-3xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                    placeholder="1013.25"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#888]">
                    hPa
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#666] dark:text-[#8b949e] pt-1">
                  <span>Equivalente: <strong>{(currentHpaNum * HPA_TO_MMHG).toFixed(1)} mmHg</strong> (Torr)</span>
                  <span><strong>{(currentHpaNum * HPA_TO_INHG).toFixed(2)} inHg</strong></span>
                </div>
              </div>

              {/* mb (milibar) */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-mb" className="text-xs font-bold uppercase text-black dark:text-white flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                    <span>MILIBAR (MB / MBAR)</span>
                  </label>
                  <span className="text-[10px] text-[#777] dark:text-[#8b949e]">TRADICIONAL EM BARÔMETROS</span>
                </div>
                <div className="relative">
                  <input
                    id="input-mb"
                    type="number"
                    step="0.1"
                    min="850"
                    max="1080"
                    value={mbInput}
                    onChange={(e) => handleMbChange(e.target.value)}
                    className="w-full text-2xl sm:text-3xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="1013.25"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#888]">
                    mb
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#666] dark:text-[#8b949e] pt-1">
                  <span>Atmosferas: <strong>{(currentHpaNum * HPA_TO_ATM).toFixed(4)} atm</strong></span>
                  <span className="text-emerald-600 font-bold">1:1 com hPa</span>
                </div>
              </div>
            </div>

            {/* Presets Barométricos Notáveis */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#777] dark:text-[#8b949e] block">
                SITUAÇÕES BAROMÉTRICAS PADRÃO:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '1030 hPa (Alta Continental Forte)', val: '1030' },
                  { label: '1020 hPa (Tempo Bom)', val: '1020' },
                  { label: '1013.25 hPa (Padrão ISA Nível do Mar)', val: '1013.25' },
                  { label: '1005 hPa (Aproximação de Frente)', val: '1005' },
                  { label: '995 hPa (Depressão / Mar Agitado)', val: '995' },
                  { label: '980 hPa (Ciclone Extratropical)', val: '980' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => handleHpaChange(item.val)}
                    className="px-2.5 py-1 text-xs border border-black dark:border-white bg-[#f8f7f4] dark:bg-[#21262d] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-bold cursor-pointer transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Diagnóstico Barométrico Instantâneo */}
            <div className={`p-4 border-2 border-black dark:border-[#30363d] ${pressureAssessment.badgeBg} space-y-1`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#d42020]" />
                <span className={`font-bold text-xs uppercase tracking-wider ${pressureAssessment.color}`}>
                  DIAGNÓSTICO BAROMÉTRICO: {pressureAssessment.label}
                </span>
              </div>
              <p className="text-xs text-[#222] dark:text-[#e6edf3]">
                {pressureAssessment.description}
              </p>
            </div>

            {/* Teste de Tendência Barométrica em 3 Horas (ΔP / 3h) */}
            <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[#d42020]" />
                  <span className="font-bold text-xs uppercase text-black dark:text-white">
                    Tendência Barométrica em 3 Horas (ΔP nas últimas 3h)
                  </span>
                </div>
                <span className="text-[10px] text-[#777] dark:text-[#8b949e]">
                  REGRA DE OURO DA MARINHA MERCANTE
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="input-delta" className="text-xs font-bold text-[#555] dark:text-[#8b949e] uppercase">
                    Variação (hPa / 3h):
                  </label>
                  <input
                    id="input-delta"
                    type="number"
                    step="0.5"
                    value={pressureDelta3h}
                    onChange={(e) => setPressureDelta3h(e.target.value)}
                    className="w-24 px-2 py-1 border-2 border-black dark:border-white bg-white dark:bg-[#161b22] text-sm font-bold font-mono text-black dark:text-white text-center"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  {['-5.0', '-3.0', '-1.5', '0.0', '+2.0'].map((dVal) => (
                    <button
                      key={dVal}
                      onClick={() => setPressureDelta3h(dVal)}
                      className="px-2 py-0.5 text-[10px] border border-black/50 dark:border-white/50 bg-white dark:bg-[#21262d] font-bold cursor-pointer hover:bg-black hover:text-white"
                    >
                      {dVal > '0' ? `+${dVal}` : dVal} hPa
                    </button>
                  ))}
                </div>
              </div>

              {barometricTrendInfo && (
                <div className={`p-3 border-2 ${barometricTrendInfo.borderColor} bg-white dark:bg-[#161b22] text-xs space-y-1`}>
                  <div className={`font-bold flex items-center gap-1.5 uppercase ${barometricTrendInfo.color}`}>
                    <barometricTrendInfo.icon className="w-4 h-4" />
                    <span>{barometricTrendInfo.status}</span>
                  </div>
                  <p className="text-[#333] dark:text-[#c9d1d9]">
                    {barometricTrendInfo.text}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SEÇÃO 4: PROFUNDIDADE, CALADO & SONDAGEM */}
        {(activeSubTab === 'all' || activeSubTab === 'depth') && (
          <div className="bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] p-4 sm:p-6 shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-black dark:border-[#30363d]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-black text-white dark:bg-white dark:text-black">
                  <Waves className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-black dark:text-white">
                    Conversor de Profundidade & Sondagem Marítima
                  </h3>
                  <span className="text-[11px] text-[#666] dark:text-[#8b949e]">
                    Metros (m - DHN Brasil) ⇄ Pés (ft - Ecobatímetros EUA) ⇄ Braças (fathoms - Cartas Admiralty)
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleCopy(`${depthMeters} m = ${depthFeet} ft = ${depthFathoms} braças`, 'depth')}
                className="px-3 py-1.5 bg-[#f8f7f4] dark:bg-[#21262d] border border-black dark:border-white text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-[#eee] dark:hover:bg-[#30363d] cursor-pointer"
              >
                {copiedKey === 'depth' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">COPIADO!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPIAR</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Metros */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <span className="text-xs font-bold uppercase text-black dark:text-white block">
                  METROS (M) - PADRÃO BRASIL
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={depthMeters}
                  onChange={(e) => setDepthMeters(e.target.value)}
                  className="w-full text-2xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-black dark:text-white"
                />
                <span className="text-[10px] text-[#777] dark:text-[#8b949e] block">
                  Unidade oficial das cartas náuticas da DHN
                </span>
              </div>

              {/* Pés */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <span className="text-xs font-bold uppercase text-black dark:text-white block">
                  PÉS (FEET / FT)
                </span>
                <div className="text-2xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-cyan-700 dark:text-cyan-400">
                  {depthFeet} ft
                </div>
                <span className="text-[10px] text-[#777] dark:text-[#8b949e] block">
                  Comum em sonares Garmin / Raymarine (1m ≈ 3.28 ft)
                </span>
              </div>

              {/* Braças */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <span className="text-xs font-bold uppercase text-black dark:text-white block">
                  BRAÇAS (FATHOMS)
                </span>
                <div className="text-2xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-blue-700 dark:text-blue-400">
                  {depthFathoms} fa
                </div>
                <span className="text-[10px] text-[#777] dark:text-[#8b949e] block">
                  1 braça náutica = exatamente 1,8288 m (6 pés)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO 5: CALCULADORA NÁUTICA (D = V x T / ETA) */}
        {(activeSubTab === 'all' || activeSubTab === 'calculator') && (
          <div className="bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] p-4 sm:p-6 shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_#30363d] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-black dark:border-[#30363d]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-black text-white dark:bg-white dark:text-black">
                  <Calculator className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-black dark:text-white">
                    Calculadora de Travessia Náutica & ETA
                  </h3>
                  <span className="text-[11px] text-[#666] dark:text-[#8b949e]">
                    Relação fundamental: Distância (NM) = Velocidade (Nós) × Tempo (Horas)
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Velocidade Estimada */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <label htmlFor="calc-speed" className="text-xs font-bold uppercase text-black dark:text-white block">
                  VELOCIDADE MÉDIA (NÓS)
                </label>
                <div className="relative">
                  <input
                    id="calc-speed"
                    type="number"
                    step="0.5"
                    min="1"
                    value={calcSpeedKnots}
                    onChange={(e) => setCalcSpeedKnots(e.target.value)}
                    className="w-full text-xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-black dark:text-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#888]">kn</span>
                </div>
              </div>

              {/* Distância da Rota */}
              <div className="p-4 border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] space-y-2">
                <label htmlFor="calc-dist" className="text-xs font-bold uppercase text-black dark:text-white block">
                  DISTÂNCIA DA ROTA (MILHAS NÁUTICAS)
                </label>
                <div className="relative">
                  <input
                    id="calc-dist"
                    type="number"
                    step="1"
                    min="1"
                    value={calcDistanceNm}
                    onChange={(e) => setCalcDistanceNm(e.target.value)}
                    className="w-full text-xl font-bold font-mono bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] px-3 py-2 text-black dark:text-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#888]">NM</span>
                </div>
              </div>

              {/* Resultado ETA */}
              {navCalcResults && (
                <div className="p-4 border-2 border-black dark:border-[#30363d] bg-black text-white dark:bg-white dark:text-black space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#d42020] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>TEMPO ESTIMADO DE VIAGEM:</span>
                  </div>
                  <div className="text-3xl font-bold font-mono">
                    {navCalcResults.timeFormatted}
                  </div>
                  <div className="text-[11px] text-[#ccc] dark:text-[#444] pt-1">
                    Equivalente a {navCalcResults.distKm} km a {navCalcResults.speedKmh} km/h
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GUIA DE BOLSO & CURIOSIDADES HISTÓRICAS DA NAVEGAÇÃO */}
        <div className="p-4 sm:p-6 bg-white dark:bg-[#161b22] border-2 border-black dark:border-[#30363d] space-y-3">
          <div className="flex items-center gap-2 border-b-2 border-black dark:border-[#30363d] pb-2">
            <HelpCircle className="w-4 h-4 text-[#d42020]" />
            <h4 className="font-display text-base font-bold uppercase text-black dark:text-white">
              Guia Prático da Tradição Náutica & Cartográfica
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#444] dark:text-[#c9d1d9]">
            <div className="p-3 bg-[#f8f7f4] dark:bg-[#0d1117] border border-black/20 dark:border-white/20 space-y-1">
              <strong className="text-black dark:text-white block font-bold uppercase text-[11px]">
                Por que se chama "Nó" (Knot)?
              </strong>
              <p>
                No século XVI, os marinheiros jogavam na popa uma peça de madeira presa a uma linha com nós atados a cada 47 pés e 3 polegadas. 
                Contavam quantos nós passavam pela mão enquanto uma ampulheta de 28 segundos esvaziava. O número de nós indicava a velocidade exata!
              </p>
            </div>

            <div className="p-3 bg-[#f8f7f4] dark:bg-[#0d1117] border border-black/20 dark:border-white/20 space-y-1">
              <strong className="text-black dark:text-white block font-bold uppercase text-[11px]">
                Por que a Milha Náutica tem 1.852m?
              </strong>
              <p>
                Diferente da milha terrestre arbitrária (1.609m), a Milha Náutica é uma grandeza astronômica: equivale exatamente ao comprimento de 
                <strong> 1 minuto de arco de latitude</strong> na superfície da Terra (1 grau dividido por 60). Navegar 60 milhas náuticas ao norte muda sua latitude em 1 grau exato.
              </p>
            </div>

            <div className="p-3 bg-[#f8f7f4] dark:bg-[#0d1117] border border-black/20 dark:border-white/20 space-y-1">
              <strong className="text-black dark:text-white block font-bold uppercase text-[11px]">
                Regra Mental Rápida no Timão
              </strong>
              <p>
                Para converter nós em km/h de cabeça: <strong>dobre os nós e subtraia 10%</strong>. 
                Exemplo para 20 nós: 20 × 2 = 40. 40 - 4 = 36 km/h (valor real exato: 37,04 km/h, margem de erro desprezível para segurança no mar).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NauticalUnitConverter;
