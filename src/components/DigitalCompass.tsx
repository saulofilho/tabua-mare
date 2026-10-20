import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Compass,
  Navigation,
  RotateCw,
  Sliders,
  CheckCircle,
  AlertCircle,
  Maximize2,
  Minimize2,
  Anchor,
  Crosshair,
  Shield,
} from 'lucide-react';

interface DigitalCompassProps {
  currentHeading: number;
  onHeadingChange: (heading: number) => void;
  targetHeading?: number | null;
  onSetTargetHeading?: (heading: number | null) => void;
  className?: string;
  isCompact?: boolean;
}

// Converte graus (0-360) para ponto cardeal em português
function degreesToCardinalPt(deg: number): { short: string; full: string } {
  const normalized = ((deg % 360) + 360) % 360;
  const points = [
    { short: 'N', full: 'Norte' },
    { short: 'NNE', full: 'Norte-Nordeste' },
    { short: 'NE', full: 'Nordeste' },
    { short: 'ENE', full: 'Leste-Nordeste' },
    { short: 'L', full: 'Leste' },
    { short: 'ESE', full: 'Leste-Sudeste' },
    { short: 'SE', full: 'Sudeste' },
    { short: 'SSE', full: 'Sul-Sudeste' },
    { short: 'S', full: 'Sul' },
    { short: 'SSO', full: 'Sul-Sudoeste' },
    { short: 'SO', full: 'Sudoeste' },
    { short: 'OSO', full: 'Oeste-Sudoeste' },
    { short: 'O', full: 'Oeste' },
    { short: 'ONO', full: 'Oeste-Noroeste' },
    { short: 'NO', full: 'Noroeste' },
    { short: 'NNO', full: 'Norte-Noroeste' },
  ];
  const idx = Math.round(normalized / 22.5) % 16;
  return points[idx];
}

export const DigitalCompass: React.FC<DigitalCompassProps> = ({
  currentHeading,
  onHeadingChange,
  targetHeading = null,
  onSetTargetHeading,
  className = '',
  isCompact = false,
}) => {
  const [sensorStatus, setSensorStatus] = useState<
    'active' | 'unsupported' | 'permission_needed' | 'manual'
  >('manual');
  const [sensorAccuracy, setSensorAccuracy] = useState<number | null>(null);
  const [manualHeading, setManualHeading] = useState<number>(currentHeading);
  const [targetCourse, setTargetCourse] = useState<number | null>(targetHeading);
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  // Ref para amortecimento e interpolação circular
  const smoothedHeadingRef = useRef<number>(currentHeading);
  const lastRawHeadingRef = useRef<number>(currentHeading);

  // Inicialização e escuta da DeviceOrientation API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Checa se a API existe
    const hasDeviceOrientation = 'DeviceOrientationEvent' in window;
    if (!hasDeviceOrientation) {
      setSensorStatus('unsupported');
      return;
    }

    // Checa se o iOS requer permissão explícita
    const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof DeviceOrientation?.requestPermission === 'function') {
      setSensorStatus('permission_needed');
    }

    let hasReceivedRealEvent = false;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // 1. Suporte iOS: webkitCompassHeading (0-360 graus em relação ao Norte magnético)
      if ('webkitCompassHeading' in event && typeof (event as any).webkitCompassHeading === 'number') {
        const compassHeading = (event as any).webkitCompassHeading;
        if (!isNaN(compassHeading) && compassHeading >= 0) {
          heading = compassHeading;
          if ('webkitCompassAccuracy' in event) {
            setSensorAccuracy((event as any).webkitCompassAccuracy);
          }
        }
      }
      // 2. Suporte Android / Padrão W3C: event.alpha (360 - alpha para rotação horária)
      else if (event.alpha !== null && typeof event.alpha === 'number') {
        // Se disponível orientação absoluta
        heading = (360 - event.alpha) % 360;
      }

      if (heading !== null && !isNaN(heading)) {
        hasReceivedRealEvent = true;
        setSensorStatus('active');

        // Suavização circular de transição (evita giro de 360 graus ao passar por 0°)
        const raw = Math.round(heading);
        lastRawHeadingRef.current = raw;

        // Amortecimento
        let prev = smoothedHeadingRef.current;
        let diff = raw - (prev % 360);
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        const smoothed = (prev + diff * 0.35 + 360) % 360;
        smoothedHeadingRef.current = smoothed;

        onHeadingChange(Math.round(smoothed));
        setManualHeading(Math.round(smoothed));
      }
    };

    // Tenta escutar o evento padrão e o absoluto
    window.addEventListener('deviceorientation', handleOrientation, true);
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    }

    // Se após 3 segundos não receber nenhum evento com valores válidos, define como manual/simulado
    const checkTimer = setTimeout(() => {
      if (!hasReceivedRealEvent && sensorStatus !== 'permission_needed') {
        setSensorStatus('manual');
      }
    }, 2800);

    return () => {
      clearTimeout(checkTimer);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      }
    };
  }, [onHeadingChange]);

  // Solicitar permissão no iOS
  const handleRequestPermission = async () => {
    try {
      const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };

      if (typeof DeviceOrientation?.requestPermission === 'function') {
        const res = await DeviceOrientation.requestPermission();
        if (res === 'granted') {
          setSensorStatus('active');
        } else {
          setSensorStatus('manual');
        }
      } else {
        setSensorStatus('active');
      }
    } catch (e) {
      console.warn('Erro ao solicitar permissão de orientação:', e);
      setSensorStatus('manual');
    }
  };

  const handleManualChange = (val: number) => {
    const normalized = ((val % 360) + 360) % 360;
    setManualHeading(normalized);
    onHeadingChange(normalized);
  };

  const handleToggleTargetCourse = (target: number | null) => {
    setTargetCourse(target);
    if (onSetTargetHeading) onSetTargetHeading(target);
  };

  // Cálculo de desvio do rumo alvo
  let courseDeviation: number | null = null;
  let deviationDirection: 'boreste' | 'bombordo' | 'alinhado' = 'alinhado';
  if (targetCourse !== null) {
    let diff = (currentHeading - targetCourse + 360) % 360;
    if (diff > 180) diff -= 360;
    courseDeviation = Math.abs(Math.round(diff));
    if (Math.abs(diff) <= 2) {
      deviationDirection = 'alinhado';
    } else if (diff > 0) {
      deviationDirection = 'boreste'; // Desviado para a direita (estibordo/boreste)
    } else {
      deviationDirection = 'bombordo'; // Desviado para a esquerda (bombordo)
    }
  }

  const cardinalInfo = degreesToCardinalPt(currentHeading);

  return (
    <div
      className={`font-mono border-2 border-black bg-white shadow-[3px_3px_0px_#000] select-none ${
        isCompact ? 'p-2.5' : 'p-4'
      } ${className}`}
    >
      {/* Header com Status do Sensor e Rumo Atual */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-black">
        <div className="flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-[#d42020]" />
          <span className="font-display font-bold text-xs uppercase tracking-tight text-black">
            Bússola Náutica Digital
          </span>
        </div>

        {/* Badge do Sensor de Orientação */}
        <div>
          {sensorStatus === 'active' && (
            <span
              className="inline-flex items-center gap-1 bg-[#dcfce7] text-[#15803d] border border-[#15803d] px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide"
              title="Sensor giroscópio e magnetômetro do aparelho ativo em tempo real"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] animate-ping" />
              Giroscópio Ativo
            </span>
          )}

          {sensorStatus === 'permission_needed' && (
            <button
              onClick={handleRequestPermission}
              className="bg-[#d42020] text-white hover:bg-black px-2 py-0.5 text-[9px] font-bold uppercase border border-black cursor-pointer shadow-xs"
            >
              Ativar Bússola
            </button>
          )}

          {(sensorStatus === 'manual' || sensorStatus === 'unsupported') && (
            <span
              className="bg-[#f3f4f6] text-[#4b5563] border border-black/40 px-1.5 py-0.2 text-[9px] font-bold uppercase"
              title="Em desktops ou dispositivos sem bússola nativa, use o controle manual de proa"
            >
              Simulação / Manual
            </span>
          )}
        </div>
      </div>

      {/* Visor Numérico Central e Rosa dos Ventos Giratória */}
      <div className="flex flex-col items-center justify-center py-1">
        {/* Grande Mostrador Digital */}
        <div className="text-center mb-2.5">
          <div className="font-display text-3xl font-black text-black tracking-tight tabular-nums flex items-baseline justify-center gap-1">
            <span>{String(currentHeading).padStart(3, '0')}°</span>
            <span className="text-lg font-bold text-[#d42020]">{cardinalInfo.short}</span>
          </div>
          <div className="text-[10px] font-bold uppercase text-[#555] tracking-widest mt-0.5">
            {cardinalInfo.full}
          </div>
        </div>

        {/* Rosa dos Ventos Náutica com Rotação Tática SVG */}
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 my-1 flex items-center justify-center">
          {/* Marcador Fixo de Proa (Lubber Line / Indicador Superior) */}
          <div className="absolute top-0 z-20 flex flex-col items-center -translate-y-1">
            <div className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[10px] border-t-[#d42020]" />
            <div className="w-0.5 h-3 bg-[#d42020]" />
          </div>

          {/* Marcador de Rumo Alvo / Course Bug (se definido) */}
          {targetCourse !== null && (
            <div
              className="absolute inset-0 z-10 pointer-events-none transition-transform duration-300"
              style={{
                transform: `rotate(${targetCourse - currentHeading}deg)`,
              }}
            >
              <div className="absolute top-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className="w-2.5 h-2.5 bg-amber-400 border border-black rotate-45 shadow-xs" />
                <span className="text-[8px] font-bold bg-amber-400 text-black px-0.5 border border-black mt-0.5">
                  ALVO
                </span>
              </div>
            </div>
          )}

          {/* Rosa Giratória que roda com o ângulo do navio */}
          <div
            className="w-full h-full rounded-full border-4 border-black bg-[#faf8f5] shadow-[inset_0px_0px_8px_rgba(0,0,0,0.15)] flex items-center justify-center transition-transform duration-150 ease-out"
            style={{
              transform: `rotate(${-currentHeading}deg)`,
            }}
          >
            {/* SVG com as graduações e pontos cardeais */}
            <svg viewBox="0 0 160 160" className="w-full h-full">
              {/* Círculo Interno */}
              <circle cx="80" cy="80" r="74" fill="none" stroke="#222" strokeWidth="1.5" />
              <circle cx="80" cy="80" r="56" fill="none" stroke="#ccc" strokeWidth="1" strokeDasharray="2,2" />

              {/* Traços de 10 em 10 graus */}
              {Array.from({ length: 36 }).map((_, i) => {
                const angle = i * 10;
                const isMajor = angle % 30 === 0;
                const isCardinal = angle % 90 === 0;
                const r1 = 74;
                const r2 = isCardinal ? 60 : isMajor ? 64 : 68;
                const rad = (angle * Math.PI) / 180;
                const x1 = 80 + r1 * Math.sin(rad);
                const y1 = 80 - r1 * Math.cos(rad);
                const x2 = 80 + r2 * Math.sin(rad);
                const y2 = 80 - r2 * Math.cos(rad);

                return (
                  <line
                    key={angle}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isCardinal ? '#d42020' : isMajor ? '#111' : '#888'}
                    strokeWidth={isCardinal ? 2.5 : isMajor ? 1.5 : 1}
                  />
                );
              })}

              {/* Agulha Norte (Vermelha) */}
              <polygon points="80,14 74,80 80,72" fill="#d42020" stroke="#991b1b" strokeWidth="0.5" />
              <polygon points="80,14 86,80 80,72" fill="#ef4444" stroke="#991b1b" strokeWidth="0.5" />

              {/* Agulha Sul (Preta/Cinza) */}
              <polygon points="80,146 74,80 80,88" fill="#1f2937" stroke="#000" strokeWidth="0.5" />
              <polygon points="80,146 86,80 80,88" fill="#4b5563" stroke="#000" strokeWidth="0.5" />

              {/* Centro de Pivô da Agulha Náutica */}
              <circle cx="80" cy="80" r="5" fill="#d42020" stroke="#000" strokeWidth="2" />
              <circle cx="80" cy="80" r="2" fill="#fff" />

              {/* Pontos Cardeais Textuais na Rosa */}
              <text x="80" y="32" textAnchor="middle" fill="#d42020" fontSize="13" fontWeight="900" fontFamily="monospace">
                N
              </text>
              <text x="135" y="85" textAnchor="middle" fill="#111" fontSize="12" fontWeight="800" fontFamily="monospace">
                L
              </text>
              <text x="80" y="137" textAnchor="middle" fill="#111" fontSize="12" fontWeight="800" fontFamily="monospace">
                S
              </text>
              <text x="25" y="85" textAnchor="middle" fill="#111" fontSize="12" fontWeight="800" fontFamily="monospace">
                O
              </text>

              {/* Intercardinais */}
              <text x="120" y="44" textAnchor="middle" fill="#777" fontSize="8" fontWeight="bold" fontFamily="monospace">
                NE
              </text>
              <text x="122" y="125" textAnchor="middle" fill="#777" fontSize="8" fontWeight="bold" fontFamily="monospace">
                SE
              </text>
              <text x="38" y="125" textAnchor="middle" fill="#777" fontSize="8" fontWeight="bold" fontFamily="monospace">
                SO
              </text>
              <text x="38" y="44" textAnchor="middle" fill="#777" fontSize="8" fontWeight="bold" fontFamily="monospace">
                NO
              </text>
            </svg>
          </div>
        </div>
      </div>

      {/* Alerta de Desvio de Rumo Alvo */}
      {targetCourse !== null && courseDeviation !== null && (
        <div
          className={`mt-2 p-2 border border-black font-mono text-[11px] flex items-center justify-between ${
            deviationDirection === 'alinhado'
              ? 'bg-[#dcfce7] text-[#15803d]'
              : 'bg-[#fef3c7] text-[#854d0e]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            <span>
              Rumo Alvo: <strong>{String(targetCourse).padStart(3, '0')}°</strong>
            </span>
          </div>

          <div className="font-bold">
            {deviationDirection === 'alinhado' ? (
              <span>✓ No Rumo</span>
            ) : (
              <span>
                Desvio {courseDeviation}° a {deviationDirection.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Controles Táticos: Definir Rumo Alvo e Presets */}
      <div className="mt-3 pt-2.5 border-t border-black/20 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[#666]">
          <span>Pontos Cardeais Rápidos:</span>
          {targetCourse !== null ? (
            <button
              onClick={() => handleToggleTargetCourse(null)}
              className="text-[#d42020] hover:underline cursor-pointer"
            >
              Limpar Rumo Alvo
            </button>
          ) : (
            <button
              onClick={() => handleToggleTargetCourse(currentHeading)}
              className="text-black hover:underline cursor-pointer"
            >
              Fixar Proa Atual ({String(currentHeading).padStart(3, '0')}°)
            </button>
          )}
        </div>

        {/* Botoes de Presets Rápidos */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 font-mono text-[10px] font-bold">
          {[
            { label: 'N', deg: 0 },
            { label: 'NE', deg: 45 },
            { label: 'L', deg: 90 },
            { label: 'SE', deg: 135 },
            { label: 'S', deg: 180 },
            { label: 'SO', deg: 225 },
            { label: 'O', deg: 270 },
            { label: 'NO', deg: 315 },
          ].map((pt) => (
            <button
              key={pt.label}
              onClick={() => handleManualChange(pt.deg)}
              className={`py-1 border border-black cursor-pointer transition-colors ${
                Math.abs(currentHeading - pt.deg) <= 10
                  ? 'bg-black text-white'
                  : 'bg-white hover:bg-[#eee] text-black'
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>

        {/* Slider Manual de Proa (para Desktop ou quando sem sensor) */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-[10px] text-[#777] mb-0.5">
            <span>Ajuste Fino de Rumo (0° - 360°):</span>
            <span className="font-bold text-black tabular-nums">{manualHeading}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="359"
            step="1"
            value={manualHeading}
            onChange={(e) => handleManualChange(Number(e.target.value))}
            className="w-full accent-black cursor-pointer"
            aria-label="Ajustar rumo da embarcação manualmente"
          />
        </div>
      </div>
    </div>
  );
};

export default DigitalCompass;
