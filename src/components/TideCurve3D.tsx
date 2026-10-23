import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TidePoint, TideExtreme, VesselProfile } from '../types/tide';
import { Compass, Maximize2, RotateCcw, Waves, ShieldAlert, Clock, Anchor } from 'lucide-react';

interface TideCurve3DProps {
  points: TidePoint[];
  extremes: TideExtreme[];
  currentTime: number;
  lowTideAlertThreshold: number;
  timeRange: 24 | 168;
  vessel: VesselProfile;
  onHoverPoint?: (pt: TidePoint | null) => void;
  hoveredPoint?: TidePoint | null;
}

// Detecção segura de WebGL por software
function checkIsSoftwareGl(): boolean {
  if (typeof document === 'undefined') return true;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

// Gera textura procedural de grade temporal náutica para a base
function createGridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#f8f7f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#e2dfd9';
    ctx.lineWidth = 2;
    for (let x = 0; x <= canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Cria pin procedural com texto para picos de Preia-mar e Baixa-mar
function createPeakBadgeTexture(title: string, value: string, isPM: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = isPM ? '#0284c7' : '#d42020';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isPM ? '#0284c7' : '#d42020';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 42);

    ctx.fillStyle = '#111111';
    ctx.font = '900 36px monospace';
    ctx.fillText(value, canvas.width / 2, 90);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const TideCurve3D: React.FC<TideCurve3DProps> = ({
  points,
  extremes,
  currentTime,
  lowTideAlertThreshold,
  timeRange,
  vessel,
  onHoverPoint,
  hoveredPoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);

  // Mesh refs
  const waveMeshRef = useRef<THREE.Mesh | null>(null);
  const cursorLineRef = useRef<THREE.Line | null>(null);
  const boatRef = useRef<THREE.Group | null>(null);
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);

  const [activePreset, setActivePreset] = useState<'isometric' | 'profile' | 'top'>('isometric');

  // Dimensões do espaço 3D para o gráfico
  const spanX = 14.0; // comprimento do eixo temporal
  const depthZ = 3.6; // largura transversal do ribbon de água
  const minTime = points.length > 0 ? points[0].timestamp : currentTime;
  const maxTime = points.length > 0 ? points[points.length - 1].timestamp : currentTime + timeRange * 3600 * 1000;
  const timeSpan = Math.max(1, maxTime - minTime);

  const maxHeightMeters = points.reduce((m, p) => (p.height > m ? p.height : m), 2.5);
  const scaleY = 3.2 / Math.max(2.5, maxHeightMeters); // escala vertical ajustada

  // Função para mapear timestamp para coordenada X (-spanX/2 até +spanX/2)
  const timeToX = useCallback((t: number) => {
    const ratio = (t - minTime) / timeSpan;
    return (ratio - 0.5) * spanX;
  }, [minTime, timeSpan, spanX]);

  // Função para interpolar altura da maré a partir de X
  const xToTideHeight = useCallback((x: number) => {
    const ratio = Math.max(0, Math.min(1, (x / spanX) + 0.5));
    const targetT = minTime + ratio * timeSpan;
    if (points.length === 0) return 0;

    let closest = points[0];
    let minD = Infinity;
    for (const p of points) {
      const d = Math.abs(p.timestamp - targetT);
      if (d < minD) {
        minD = d;
        closest = p;
      }
    }
    return closest.height;
  }, [points, minTime, timeSpan, spanX]);

  // Manipulador de preset de câmera
  const setCameraPreset = useCallback((preset: 'isometric' | 'profile' | 'top') => {
    setActivePreset(preset);
    if (!controlsRef.current || !cameraRef.current) return;

    if (preset === 'isometric') {
      targetCamPosRef.current = new THREE.Vector3(7.5, 6.2, 8.5);
      targetLookAtRef.current = new THREE.Vector3(0, 1.2, 0);
    } else if (preset === 'profile') {
      targetCamPosRef.current = new THREE.Vector3(0, 1.5, 11.5);
      targetLookAtRef.current = new THREE.Vector3(0, 1.2, 0);
    } else if (preset === 'top') {
      targetCamPosRef.current = new THREE.Vector3(0, 10.5, 2.5);
      targetLookAtRef.current = new THREE.Vector3(0, 0.5, 0);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = Math.min(Math.max(window.innerHeight * 0.44, 340), 440);

    const isSoftwareGl = checkIsSoftwareGl();

    // 1. Cena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6f5f1);
    scene.fog = new THREE.FogExp2(0xf6f5f1, 0.03);
    sceneRef.current = scene;

    // 2. Câmera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 80);
    camera.position.set(7.5, 6.2, 8.5);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Studio Environment Reflection via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 5. Controles orbitais
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // impede de olhar por baixo da base
    controls.minDistance = 4;
    controls.maxDistance = 22;
    controls.target.set(0, 1.2, 0);
    controlsRef.current = controls;

    // 6. Iluminação
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0xd4c3a3, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    dirLight.position.set(8, 14, 8);
    dirLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.bias = -0.0004;
      dirLight.shadow.camera.left = -9;
      dirLight.shadow.camera.right = 9;
      dirLight.shadow.camera.top = 9;
      dirLight.shadow.camera.bottom = -9;
    }
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-8, 5, -6);
    scene.add(rimLight);

    // 7. Base / Grid do Leito (Datum DHN 0.00m)
    const baseGeo = new THREE.BoxGeometry(spanX + 1.2, 0.3, depthZ + 1.2);
    const baseTex = createGridTexture();
    const baseMat = new THREE.MeshStandardMaterial({
      map: baseTex,
      roughness: 0.7,
      metalness: 0.1,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -0.15, 0);
    baseMesh.receiveShadow = !isSoftwareGl;
    scene.add(baseMesh);

    // Borda preta tática da base
    const baseEdgeGeo = new THREE.BoxGeometry(spanX + 1.24, 0.04, depthZ + 1.24);
    const baseEdgeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const baseEdge = new THREE.Mesh(baseEdgeGeo, baseEdgeMat);
    baseEdge.position.set(0, 0, 0);
    scene.add(baseEdge);

    // 8. Construção da Superfície 3D da Onda de Maré (Ribbon de Água)
    const xSegments = Math.min(180, Math.max(60, points.length));
    const zSegments = 24;
    const waveGeo = new THREE.PlaneGeometry(spanX, depthZ, xSegments, zSegments);
    waveGeo.rotateX(-Math.PI / 2);

    const waveMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      roughness: 0.12,
      metalness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.65,
      opacity: 0.88,
      transparent: true,
      ior: 1.333,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    });

    // Atualiza a elevação Y de cada vértice de acordo com a curva de maré calculada
    const posAttr = waveGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const h = xToTideHeight(vx);
      // Vértice central tem altura total; bordas caem levemente para formar o volume
      const edgeFactor = 1.0 - Math.pow(vz / (depthZ * 0.5), 6) * 0.06;
      posAttr.setY(i, h * scaleY * edgeFactor);
    }
    waveGeo.computeVertexNormals();

    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.castShadow = !isSoftwareGl;
    waveMesh.receiveShadow = !isSoftwareGl;
    scene.add(waveMesh);
    waveMeshRef.current = waveMesh;

    // 9. Cortina Frontal Transversal (Corte batimétrico visível de frente)
    const frontShape = new THREE.Shape();
    frontShape.moveTo(-spanX / 2, 0);
    for (let i = 0; i <= xSegments; i++) {
      const x = -spanX / 2 + (i / xSegments) * spanX;
      const h = xToTideHeight(x) * scaleY;
      frontShape.lineTo(x, h);
    }
    frontShape.lineTo(spanX / 2, 0);
    frontShape.closePath();

    const frontGeo = new THREE.ShapeGeometry(frontShape);
    const frontMat = new THREE.MeshPhysicalMaterial({
      color: 0x0369a1,
      roughness: 0.2,
      metalness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.5,
      opacity: 0.75,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const frontMesh = new THREE.Mesh(frontGeo, frontMat);
    frontMesh.position.set(0, 0, depthZ / 2);
    scene.add(frontMesh);

    // Linha de crista brilhante náutica ao longo da frente
    const crestPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= xSegments; i++) {
      const x = -spanX / 2 + (i / xSegments) * spanX;
      const h = xToTideHeight(x) * scaleY;
      crestPoints.push(new THREE.Vector3(x, h, depthZ / 2 + 0.01));
    }
    const crestGeo = new THREE.BufferGeometry().setFromPoints(crestPoints);
    const crestMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
    const crestLine = new THREE.Line(crestGeo, crestMat);
    scene.add(crestLine);

    // 10. Plano de Alerta de Maré Baixa (Danger Threshold)
    if (lowTideAlertThreshold > 0) {
      const alertY = lowTideAlertThreshold * scaleY;
      const alertGeo = new THREE.PlaneGeometry(spanX, depthZ);
      alertGeo.rotateX(-Math.PI / 2);
      const alertMat = new THREE.MeshBasicMaterial({
        color: 0xd42020,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      });
      const alertPlane = new THREE.Mesh(alertGeo, alertMat);
      alertPlane.position.set(0, alertY, 0);
      scene.add(alertPlane);

      // Borda vermelha tracejada no plano de perigo
      const alertEdgeMat = new THREE.LineDashedMaterial({
        color: 0xd42020,
        dashSize: 0.3,
        gapSize: 0.15,
      });
      const alertPoints = [
        new THREE.Vector3(-spanX / 2, alertY, depthZ / 2),
        new THREE.Vector3(spanX / 2, alertY, depthZ / 2),
      ];
      const alertEdgeGeo = new THREE.BufferGeometry().setFromPoints(alertPoints);
      const alertEdgeLine = new THREE.Line(alertEdgeGeo, alertEdgeMat);
      alertEdgeLine.computeLineDistances();
      scene.add(alertEdgeLine);
    }

    // 11. Pinos / Banners 3D nos Picos de Preia-mar e Baixa-mar
    const peakGroup = new THREE.Group();
    extremes.forEach((ext, idx) => {
      const x = timeToX(ext.timestamp);
      if (x < -spanX / 2 || x > spanX / 2) return;
      const h = ext.height * scaleY;
      const isPM = ext.type === 'preia-mar';

      // Haste vertical
      const rodGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8);
      const rodMat = new THREE.MeshBasicMaterial({ color: isPM ? 0x0284c7 : 0xd42020 });
      const rodMesh = new THREE.Mesh(rodGeo, rodMat);
      rodMesh.position.set(x, h + 0.4, 0);
      peakGroup.add(rodMesh);

      // Plaqueta com textura Canvas procedural
      const title = isPM ? 'PREIA-MAR' : 'BAIXA-MAR';
      const val = `${ext.height.toFixed(2)}m`;
      const badgeTex = createPeakBadgeTexture(title, val, isPM);
      const badgeGeo = new THREE.PlaneGeometry(0.85, 0.45);
      const badgeMat = new THREE.MeshBasicMaterial({
        map: badgeTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
      badgeMesh.position.set(x, h + 0.95, 0);
      peakGroup.add(badgeMesh);
    });
    scene.add(peakGroup);

    // 12. Marcador do Horário Atual (Tempo Real) + Miniatura de Barco Flutuante
    const currentX = timeToX(currentTime);
    const currentH = xToTideHeight(currentX) * scaleY;

    // Linha de laser vertical no momento presente
    const nowPoints = [
      new THREE.Vector3(currentX, 0, 0),
      new THREE.Vector3(currentX, currentH + 1.2, 0),
    ];
    const nowGeo = new THREE.BufferGeometry().setFromPoints(nowPoints);
    const nowMat = new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 });
    const nowLine = new THREE.Line(nowGeo, nowMat);
    scene.add(nowLine);

    // Barquinho procedural flutuando sobre a curva no tempo atual
    const boatGroup = new THREE.Group();
    const bHullGeo = new THREE.ConeGeometry(0.24, 0.8, 4);
    bHullGeo.rotateZ(Math.PI / 2);
    bHullGeo.rotateY(Math.PI / 4);
    const bHullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const bHull = new THREE.Mesh(bHullGeo, bHullMat);
    boatGroup.add(bHull);

    const bSailShape = new THREE.Shape();
    bSailShape.moveTo(0, 0);
    bSailShape.lineTo(-0.35, 0.6);
    bSailShape.lineTo(0, 0.6);
    bSailShape.closePath();
    const bSailGeo = new THREE.ShapeGeometry(bSailShape);
    const bSailMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, side: THREE.DoubleSide });
    const bSail = new THREE.Mesh(bSailGeo, bSailMat);
    bSail.position.set(0, 0.05, 0);
    boatGroup.add(bSail);

    boatGroup.position.set(currentX, currentH + 0.12, 0);
    scene.add(boatGroup);
    boatRef.current = boatGroup;

    // 13. Linha e cursor interativo de inspeção (Raycasting)
    const cursorGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 4, 0),
    ]);
    const cursorMat = new THREE.LineDashedMaterial({
      color: 0x0284c7,
      dashSize: 0.2,
      gapSize: 0.1,
      linewidth: 2,
    });
    const cursorLine = new THREE.Line(cursorGeo, cursorMat);
    cursorLine.visible = false;
    scene.add(cursorLine);
    cursorLineRef.current = cursorLine;

    // Raycaster para interatividade com o ponteiro
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(waveMesh);

      if (intersects.length > 0) {
        const hitX = intersects[0].point.x;
        const ratio = Math.max(0, Math.min(1, (hitX / spanX) + 0.5));
        const targetTime = minTime + ratio * timeSpan;

        let closest = points[0];
        let minD = Infinity;
        for (const p of points) {
          const d = Math.abs(p.timestamp - targetTime);
          if (d < minD) {
            minD = d;
            closest = p;
          }
        }

        if (closest) {
          onHoverPoint?.(closest);
          if (cursorLineRef.current) {
            cursorLineRef.current.visible = true;
            cursorLineRef.current.position.set(hitX, 0, intersects[0].point.z);
            cursorLineRef.current.computeLineDistances();
          }
        }
      } else {
        if (cursorLineRef.current) cursorLineRef.current.visible = false;
        onHoverPoint?.(null);
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousemove', onPointerMove);
    domElem.addEventListener('mouseleave', () => {
      if (cursorLineRef.current) cursorLineRef.current.visible = false;
      onHoverPoint?.(null);
    });

    // Responsividade
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = containerRef.current.clientWidth;
      const newH = Math.min(Math.max(window.innerHeight * 0.44, 340), 440);
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // Loop de Animação com Ondulação Suave
    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Suave balanço do barquinho no tempo atual
      if (boatRef.current) {
        boatRef.current.rotation.z = Math.sin(elapsed * 2.5) * 0.08;
        boatRef.current.rotation.x = Math.cos(elapsed * 1.8) * 0.05;
      }

      // Leve ondulação micro-superficial na malha
      if (waveMeshRef.current) {
        const pAttr = waveMeshRef.current.geometry.attributes.position;
        for (let i = 0; i < pAttr.count; i++) {
          const vx = pAttr.getX(i);
          const vz = pAttr.getZ(i);
          const baseH = xToTideHeight(vx) * scaleY;
          // Ondinhas suaves
          const ripple = Math.sin(vx * 3.0 + elapsed * 2.0) * 0.02 + Math.cos(vz * 4.0 + elapsed * 1.5) * 0.015;
          pAttr.setY(i, baseH + ripple);
        }
        pAttr.needsUpdate = true;
      }

      // Transição suave de câmera para os presets selecionados
      if (targetCamPosRef.current && cameraRef.current && controlsRef.current) {
        cameraRef.current.position.lerp(targetCamPosRef.current, delta * 3.5);
        if (targetLookAtRef.current) {
          controlsRef.current.target.lerp(targetLookAtRef.current, delta * 3.5);
        }
        if (cameraRef.current.position.distanceTo(targetCamPosRef.current) < 0.05) {
          targetCamPosRef.current = null;
          targetLookAtRef.current = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // Limpeza rigorosa
    return () => {
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('mousemove', onPointerMove);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      pmremGenerator.dispose();
      waveGeo.dispose();
      baseGeo.dispose();
      frontGeo.dispose();
    };
  }, [points, extremes, currentTime, lowTideAlertThreshold, timeRange, spanX, depthZ, scaleY, timeToX, xToTideHeight, onHoverPoint]);

  return (
    <div className="relative w-full border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] overflow-hidden select-none">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-[340px] sm:h-[420px] cursor-crosshair block"
      />

      {/* Floating Tactical Overlay: Resumo Imediato do Ponto Inspecionado */}
      {hoveredPoint && (
        <div className="absolute top-3 left-3 bg-black/90 dark:bg-[#161b22]/95 text-white p-2 sm:p-2.5 border border-black shadow-[2px_2px_0px_#000] backdrop-blur-xs flex items-center gap-3 pointer-events-none">
          <div>
            <div className="text-[9px] text-[#38bdf8] font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>HORÁRIO 3D</span>
            </div>
            <div className="text-base sm:text-lg font-black font-display text-white">
              {new Date(hoveredPoint.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="border-l border-white/20 pl-3">
            <div className="text-[9px] text-[#aaa] font-bold uppercase">ALTURA ESTIMADA</div>
            <div className="text-base sm:text-lg font-black text-[#38bdf8] tabular-nums">
              {hoveredPoint.height.toFixed(2)}m
            </div>
          </div>

          <div className="border-l border-white/20 pl-3">
            <div className="text-[9px] text-[#aaa] font-bold uppercase">TENDÊNCIA</div>
            <div className="text-xs font-bold text-white uppercase">
              {hoveredPoint.rateOfChange > 2 ? '↑ Enchendo' : hoveredPoint.rateOfChange < -2 ? '↓ Vazando' : '↔ Estofo'}
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Tactical Dock (Controles de Câmera 3D sem obstrução) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-auto max-w-[95%] pointer-events-auto bg-black/90 dark:bg-[#161b22]/95 border-2 border-black text-white p-1.5 sm:p-2 shadow-[3px_3px_0px_#000] flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase text-[#888] px-1 hidden sm:inline">
          CÂMERA 3D:
        </span>

        <button
          onClick={() => setCameraPreset('isometric')}
          className={`px-2.5 py-1 text-[11px] font-bold uppercase border cursor-pointer transition-colors flex items-center gap-1 ${
            activePreset === 'isometric'
              ? 'bg-[#0284c7] text-white border-white'
              : 'bg-black text-[#ccc] border-transparent hover:border-[#666]'
          }`}
          title="Perspectiva Tridimensional Isométrica da Onda de Maré"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>ISOMÉTRICA</span>
        </button>

        <button
          onClick={() => setCameraPreset('profile')}
          className={`px-2.5 py-1 text-[11px] font-bold uppercase border cursor-pointer transition-colors flex items-center gap-1 ${
            activePreset === 'profile'
              ? 'bg-[#0284c7] text-white border-white'
              : 'bg-black text-[#ccc] border-transparent hover:border-[#666]'
          }`}
          title="Vista Lateral / Perfil da Curva de Maré"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>PERFIL</span>
        </button>

        <button
          onClick={() => setCameraPreset('top')}
          className={`px-2.5 py-1 text-[11px] font-bold uppercase border cursor-pointer transition-colors flex items-center gap-1 ${
            activePreset === 'top'
              ? 'bg-[#0284c7] text-white border-white'
              : 'bg-black text-[#ccc] border-transparent hover:border-[#666]'
          }`}
          title="Linha do Tempo / Vista Superior"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>LINHA DO TEMPO</span>
        </button>

        <button
          onClick={() => setCameraPreset(activePreset)}
          className="p-1 hover:bg-[#333] border border-transparent hover:border-white/20 text-[#aaa] hover:text-white cursor-pointer ml-1"
          title="Resetar Ângulo de Visão"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TideCurve3D;
