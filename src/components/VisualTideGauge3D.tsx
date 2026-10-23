import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CurrentTideStatus, TideExtreme, VesselProfile } from '../types/tide';
import { Eye, RotateCcw, Compass, ShieldAlert, ShieldCheck, Waves, Maximize2, HelpCircle } from 'lucide-react';

interface VisualTideGauge3DProps {
  currentHeight: number; // e.g. 1.85m
  maxTideRange: number; // e.g. 2.5m
  status: CurrentTideStatus;
  todayExtremes: TideExtreme[];
  vessel: VesselProfile;
  stationName: string;
}

// Detecção segura de WebGL por software (SwiftShader, llvmpipe, WARP)
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

// Cria textura procedural de alta nitidez para a Régua Maregráfica (DHN)
function createTidePoleTexture(maxMeters: number, minMeters: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    const totalRange = maxMeters - minMeters;
    const step = 0.5; // marcas a cada 0.5m

    for (let m = minMeters; m <= maxMeters; m += 0.1) {
      const normalizedY = (maxMeters - m) / totalRange;
      const y = normalizedY * canvas.height;
      const isMajor = Math.abs(m % 1.0) < 0.01;
      const isHalf = Math.abs(m % 0.5) < 0.01;
      const isDatum = Math.abs(m) < 0.01;

      if (isDatum) {
        // Zero Hidrográfico em destaque vermelho
        ctx.fillStyle = '#d42020';
        ctx.fillRect(4, y - 6, canvas.width - 8, 12);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px monospace';
        ctx.fillText('0.00m DATUM DHN', 18, y + 6);
      } else if (isMajor || isHalf) {
        ctx.strokeStyle = isMajor ? '#000000' : '#444444';
        ctx.lineWidth = isMajor ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(8, y);
        ctx.lineTo(isMajor ? 80 : 50, y);
        ctx.stroke();

        ctx.fillStyle = '#111111';
        ctx.font = isMajor ? 'bold 26px monospace' : 'bold 18px monospace';
        ctx.fillText(`${m > 0 ? '+' : ''}${m.toFixed(1)}m`, 95, y + 8);
      } else {
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(8, y);
        ctx.lineTo(25, y);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Textura procedural para o leito marinho com ondulações de areia
function createSeabedTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#c8b99d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ondas de sedimentação
    ctx.strokeStyle = '#a8987b';
    ctx.lineWidth = 4;
    for (let y = 0; y < canvas.height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < canvas.width; x += 32) {
        ctx.quadraticCurveTo(x + 16, y + (Math.sin(x * 0.1) * 8), x + 32, y);
      }
      ctx.stroke();
    }

    // Granulação
    ctx.fillStyle = '#7a6a4f';
    for (let i = 0; i < 2000; i++) {
      const rx = Math.random() * canvas.width;
      const ry = Math.random() * canvas.height;
      const rSize = Math.random() * 2 + 0.5;
      ctx.fillRect(rx, ry, rSize, rSize);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const VisualTideGauge3D: React.FC<VisualTideGauge3DProps> = ({
  currentHeight,
  maxTideRange,
  status,
  todayExtremes,
  vessel,
  stationName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);

  // Dynamic mesh refs
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const waterSurfaceRef = useRef<THREE.Mesh | null>(null);
  const vesselGroupRef = useRef<THREE.Group | null>(null);
  const ukcBeamRef = useRef<THREE.Mesh | null>(null);
  const ukcMarkerRef = useRef<THREE.Group | null>(null);
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);

  // Active camera view preset
  const [activePreset, setActivePreset] = useState<'profile' | 'isometric' | 'keel'>('profile');
  const [showControlsHint, setShowControlsHint] = useState<boolean>(true);

  // Fixed hydrographic reference: seabed is 2.5m below DHN datum
  const chartedDepth = 2.5; // meters below chart datum
  const totalWaterDepth = currentHeight + chartedDepth;
  const ukc = totalWaterDepth - vessel.draft;
  const isCritical = ukc < 0.4;
  const isWarning = ukc < vessel.safetyMargin;

  // Camera preset handler
  const setCameraPreset = useCallback((preset: 'profile' | 'isometric' | 'keel') => {
    setActivePreset(preset);
    if (!controlsRef.current || !cameraRef.current) return;

    if (preset === 'profile') {
      // Perfil técnico náutico (vista lateral pura perpendicular)
      targetCamPosRef.current = new THREE.Vector3(0, currentHeight * 0.4, 9.8);
      targetLookAtRef.current = new THREE.Vector3(0, currentHeight * 0.2, 0);
    } else if (preset === 'isometric') {
      // Vista isométrica 3D tática
      targetCamPosRef.current = new THREE.Vector3(7.2, 4.8, 7.8);
      targetLookAtRef.current = new THREE.Vector3(0, 0, 0);
    } else if (preset === 'keel') {
      // Foco na quilha & folga de fundo (UKC submerso)
      targetCamPosRef.current = new THREE.Vector3(2.4, -chartedDepth * 0.5, 3.8);
      targetLookAtRef.current = new THREE.Vector3(0, -chartedDepth * 0.7, 0);
    }
  }, [currentHeight, chartedDepth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = Math.min(Math.max(window.innerHeight * 0.42, 360), 460);

    const isSoftwareGl = checkIsSoftwareGl();

    // 1. Cena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1ece4);
    scene.fog = new THREE.FogExp2(0xf1ece4, 0.035);
    sceneRef.current = scene;

    // 2. Câmera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(0, 0.8, 9.8);
    cameraRef.current = camera;

    // 3. Renderer com PBR & ACES Filmic Tone Mapping
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

    // 5. Controles orbitais suaves
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 + 0.12; // não passar muito do solo
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.target.set(0, 0.2, 0);
    controlsRef.current = controls;

    // 6. Iluminação de Estúdio Náutico (Key, Fill, Rim & Hemisphere)
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0xb45309, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 2.0);
    dirLight.position.set(6, 12, 7);
    dirLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.bias = -0.0004;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 30;
      dirLight.shadow.camera.left = -8;
      dirLight.shadow.camera.right = 8;
      dirLight.shadow.camera.top = 8;
      dirLight.shadow.camera.bottom = -8;
    }
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(-8, 4, -4);
    scene.add(fillLight);

    // 7. Leito Marinho (Batimetria & Areia)
    const seabedY = -chartedDepth;
    const seabedGeo = new THREE.BoxGeometry(16, 1.2, 12);
    const seabedTex = createSeabedTexture();
    const seabedMat = new THREE.MeshStandardMaterial({
      color: 0xd4c3a3,
      roughness: 0.88,
      metalness: 0.05,
      map: seabedTex,
    });
    const seabedMesh = new THREE.Mesh(seabedGeo, seabedMat);
    seabedMesh.position.set(0, seabedY - 0.6, 0);
    seabedMesh.receiveShadow = !isSoftwareGl;
    scene.add(seabedMesh);

    // Borda tática do leito
    const seabedEdgeGeo = new THREE.BoxGeometry(16.05, 0.08, 12.05);
    const seabedEdgeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const seabedEdge = new THREE.Mesh(seabedEdgeGeo, seabedEdgeMat);
    seabedEdge.position.set(0, seabedY, 0);
    scene.add(seabedEdge);

    // Linha do Datum DHN (0.00m)
    const datumLineMat = new THREE.LineDashedMaterial({
      color: 0x475569,
      dashSize: 0.35,
      gapSize: 0.2,
      linewidth: 2,
    });
    const datumPoints = [new THREE.Vector3(-8, 0, 0), new THREE.Vector3(8, 0, 0)];
    const datumGeo = new THREE.BufferGeometry().setFromPoints(datumPoints);
    const datumLine = new THREE.Line(datumGeo, datumLineMat);
    datumLine.computeLineDistances();
    scene.add(datumLine);

    // 8. Régua Maregráfica 3D (Tide Measuring Pole)
    const poleHeight = 7.0;
    const poleGeo = new THREE.BoxGeometry(0.35, poleHeight, 0.35);
    const poleTex = createTidePoleTexture(4.0, -3.0);
    poleTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const poleMat = new THREE.MeshStandardMaterial({
      map: poleTex,
      roughness: 0.3,
      metalness: 0.1,
    });
    const poleMesh = new THREE.Mesh(poleGeo, poleMat);
    poleMesh.position.set(-4.5, 0.5, 0);
    poleMesh.castShadow = !isSoftwareGl;
    poleMesh.receiveShadow = !isSoftwareGl;
    scene.add(poleMesh);

    // Base de fixação de concreto da régua no fundo
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.65, 0.6, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(-4.5, seabedY + 0.3, 0);
    scene.add(baseMesh);

    // 9. Volume de Água Translúcido PBR
    const waterDepthInitial = currentHeight + chartedDepth;
    const waterGeo = new THREE.BoxGeometry(14, Math.max(0.1, waterDepthInitial), 9);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      transmission: isSoftwareGl ? 0 : 0.62,
      opacity: 0.78,
      transparent: true,
      roughness: 0.12,
      metalness: 0.05,
      ior: 1.333,
      reflectivity: 0.45,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(0, seabedY + waterDepthInitial / 2, 0);
    waterMesh.receiveShadow = !isSoftwareGl;
    scene.add(waterMesh);
    waterMeshRef.current = waterMesh;

    // Superfície da água com ondulação geométrica suave
    const surfaceGeo = new THREE.PlaneGeometry(14, 9, 28, 20);
    surfaceGeo.rotateX(-Math.PI / 2);
    const surfaceMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.5,
      opacity: 0.85,
      transparent: true,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.position.set(0, currentHeight, 0);
    scene.add(surfaceMesh);
    waterSurfaceRef.current = surfaceMesh;

    // 10. Embarcação Procedural Realista (Composta por 8+ partes em THREE.Group)
    const vesselGroup = new THREE.Group();
    
    // Parte 1: Casco Principal (Hull com proa e popa náutica)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-1.6, 0.4);
    hullShape.lineTo(1.4, 0.4);
    hullShape.lineTo(1.8, 0.55); // proa inclinada
    hullShape.lineTo(1.3, -0.4);
    hullShape.lineTo(-1.5, -0.35); // popa
    hullShape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: 1.1,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.1,
      bevelSegments: 3,
    };
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
    hullGeo.center();
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.1,
    });
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.castShadow = !isSoftwareGl;
    vesselGroup.add(hullMesh);

    // Parte 2: Faixa de Flutuação Vermelha Náutica (Boot-stripe antifouling)
    const stripeGeo = new THREE.BoxGeometry(3.2, 0.12, 1.34);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd42020, roughness: 0.4 });
    const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
    stripeMesh.position.set(0, -0.15, 0);
    vesselGroup.add(stripeMesh);

    // Parte 3: Convés de Teca (Deck)
    const deckGeo = new THREE.BoxGeometry(3.0, 0.08, 1.25);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.set(0, 0.42, 0);
    vesselGroup.add(deckMesh);

    // Parte 4: Cabine / Casario
    const cabinGeo = new THREE.BoxGeometry(1.4, 0.65, 0.9);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(-0.25, 0.75, 0);
    cabinMesh.castShadow = !isSoftwareGl;
    vesselGroup.add(cabinMesh);

    // Parte 5: Para-brisa / Janelas da Cabine
    const winGeo = new THREE.BoxGeometry(0.3, 0.32, 0.92);
    const winMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      roughness: 0.05,
      metalness: 0.3,
      transmission: 0.7,
      transparent: true,
      opacity: 0.9,
    });
    const winMesh = new THREE.Mesh(winGeo, winMat);
    winMesh.position.set(0.32, 0.78, 0);
    vesselGroup.add(winMesh);

    // Parte 6: Quilha Náutica com Calado Real (Keel extending to vessel.draft)
    const keelDepth = vessel.draft;
    const keelGeo = new THREE.BoxGeometry(0.8, keelDepth, 0.16);
    const keelMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });
    const keelMesh = new THREE.Mesh(keelGeo, keelMat);
    // Posicionada na parte inferior do casco
    keelMesh.position.set(-0.2, -keelDepth / 2 - 0.2, 0);
    vesselGroup.add(keelMesh);

    // Parte 7: Bulbo de Chumbo da Quilha (Ballast Bulb)
    const bulbGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.0, 16);
    bulbGeo.rotateZ(Math.PI / 2);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
    bulbMesh.position.set(-0.2, -keelDepth - 0.2, 0);
    vesselGroup.add(bulbMesh);

    // Parte 8: Mastro & Cruzeta
    const mastGeo = new THREE.CylinderGeometry(0.04, 0.06, 3.8, 12);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.2 });
    const mastMesh = new THREE.Mesh(mastGeo, mastMat);
    mastMesh.position.set(0.3, 2.3, 0);
    mastMesh.castShadow = !isSoftwareGl;
    vesselGroup.add(mastMesh);

    // Cruzeta
    const spreaderGeo = new THREE.BoxGeometry(0.04, 0.04, 0.9);
    const spreaderMesh = new THREE.Mesh(spreaderGeo, mastMat);
    spreaderMesh.position.set(0.3, 2.6, 0);
    vesselGroup.add(spreaderMesh);

    // Posiciona o barco flutuando na superfície da água
    vesselGroup.position.set(0.5, currentHeight + 0.18, 0);
    scene.add(vesselGroup);
    vesselGroupRef.current = vesselGroup;

    // 11. Feixe Laser / Sonar da Folga sob a Quilha (UKC Clearance Beam)
    const beamGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: isCritical ? 0xd42020 : isWarning ? 0xeab308 : 0x22c55e,
      wireframe: false,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.set(0.3, 0, 0);
    scene.add(beamMesh);
    ukcBeamRef.current = beamMesh;

    // Disco de projeção no fundo (sonar ping contact on seabed)
    const pingGeo = new THREE.RingGeometry(0.1, 0.45, 24);
    pingGeo.rotateX(-Math.PI / 2);
    const pingMat = new THREE.MeshBasicMaterial({
      color: isCritical ? 0xd42020 : 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const pingMesh = new THREE.Mesh(pingGeo, pingMat);
    pingMesh.position.set(0.3, seabedY + 0.02, 0);
    scene.add(pingMesh);

    // 12. Marcador Flutuante 3D de Preia-mar e Baixa-mar
    const extremeGroup = new THREE.Group();
    const highestPM = todayExtremes
      .filter((e) => e.type === 'preia-mar')
      .reduce((max, e) => (e.height > max ? e.height : max), 2.2);
    const lowestBM = todayExtremes
      .filter((e) => e.type === 'baixa-mar')
      .reduce((min, e) => (e.height < min ? e.height : min), 0.4);

    // Anel marcador de PM na régua
    const ringGeo = new THREE.TorusGeometry(0.32, 0.04, 12, 24);
    ringGeo.rotateX(Math.PI / 2);
    const pmMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const pmRing = new THREE.Mesh(ringGeo, pmMat);
    pmRing.position.set(-4.5, highestPM, 0);
    extremeGroup.add(pmRing);

    // Anel marcador de BM na régua
    const bmMat = new THREE.MeshBasicMaterial({ color: 0xd42020 });
    const bmRing = new THREE.Mesh(ringGeo, bmMat);
    bmRing.position.set(-4.5, lowestBM, 0);
    extremeGroup.add(bmRing);

    scene.add(extremeGroup);

    // Redimensionamento responsivo
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = containerRef.current.clientWidth;
      const newH = Math.min(Math.max(window.innerHeight * 0.42, 360), 460);
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // Loop de Animação com Física de Borneio e Ondulação Náutica
    let clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Suave movimentação de pitch/roll do barco no mar
      if (vesselGroupRef.current) {
        const rockAngle = Math.sin(elapsed * 1.8) * 0.035;
        const pitchAngle = Math.cos(elapsed * 1.2) * 0.02;
        vesselGroupRef.current.rotation.z = rockAngle;
        vesselGroupRef.current.rotation.x = pitchAngle;
      }

      // Leve ondulação na malha de superfície
      if (surfaceMesh) {
        const posAttr = surfaceMesh.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vz = posAttr.getZ(i);
          const vy = Math.sin(vx * 1.5 + elapsed * 2.2) * 0.04 + Math.cos(vz * 1.2 + elapsed * 1.8) * 0.03;
          posAttr.setY(i, vy);
        }
        posAttr.needsUpdate = true;
      }

      // Transição suave da câmera em direção ao preset selecionado
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

    // Limpeza rigorosa no unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      pmremGenerator.dispose();
      hullGeo.dispose();
      seabedGeo.dispose();
      waterGeo.dispose();
      surfaceGeo.dispose();
      poleGeo.dispose();
    };
  }, []);

  // Atualização em tempo real da cota da maré, altura da coluna d'água e UKC
  useEffect(() => {
    const seabedY = -chartedDepth;
    const waterDepth = currentHeight + chartedDepth;
    const currentUKC = waterDepth - vessel.draft;
    const keelBottomY = currentHeight - vessel.draft;

    // Atualiza bloco de água
    if (waterMeshRef.current) {
      waterMeshRef.current.scale.set(1, Math.max(0.01, waterDepth / chartedDepth), 1);
      waterMeshRef.current.position.y = seabedY + waterDepth / 2;
    }

    // Atualiza superfície da água
    if (waterSurfaceRef.current) {
      waterSurfaceRef.current.position.y = currentHeight;
    }

    // Atualiza barco flutuando
    if (vesselGroupRef.current) {
      vesselGroupRef.current.position.y = currentHeight + 0.18;
    }

    // Atualiza feixe do sonar UKC entre a quilha e o leito marinho
    if (ukcBeamRef.current) {
      const beamHeight = Math.max(0.05, keelBottomY - seabedY);
      ukcBeamRef.current.scale.set(1, beamHeight, 1);
      ukcBeamRef.current.position.set(0.3, seabedY + beamHeight / 2, 0);

      const isCrit = currentUKC < 0.4;
      const isWarn = currentUKC < vessel.safetyMargin;
      (ukcBeamRef.current.material as THREE.MeshBasicMaterial).color.setHex(
        isCrit ? 0xd42020 : isWarn ? 0xeab308 : 0x22c55e
      );
    }
  }, [currentHeight, chartedDepth, vessel.draft, vessel.safetyMargin]);

  return (
    <div className="relative w-full border-2 border-black dark:border-[#30363d] bg-[#f8f7f4] dark:bg-[#0d1117] overflow-hidden select-none">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-[360px] sm:h-[420px] cursor-grab active:cursor-grabbing block"
      />

      {/* Tactical HUD Header: Cota e Estado de Navegação */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none gap-2">
        <div className="bg-black/90 dark:bg-[#161b22]/95 text-white p-2 sm:p-2.5 border border-black shadow-[2px_2px_0px_#000] backdrop-blur-xs flex items-center gap-3">
          <div>
            <div className="text-[9px] text-[#38bdf8] font-bold uppercase tracking-wider flex items-center gap-1">
              <Waves className="w-3 h-3" />
              <span>COTA DA MARÉ 3D</span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-display text-white tabular-nums">
              {currentHeight.toFixed(2)}m
            </div>
          </div>

          <div className="border-l border-white/20 pl-3">
            <div className="text-[9px] text-[#aaa] font-bold uppercase">PROF. TOTAL</div>
            <div className="text-sm sm:text-base font-bold text-white tabular-nums">
              {totalWaterDepth.toFixed(2)}m
            </div>
          </div>

          <div className="border-l border-white/20 pl-3">
            <div className="text-[9px] text-[#aaa] font-bold uppercase">FOLGA QUILHA (UKC)</div>
            <div
              className={`text-sm sm:text-base font-black tabular-nums ${
                isCritical ? 'text-[#ef4444]' : isWarning ? 'text-[#facc15]' : 'text-[#4ade80]'
              }`}
            >
              {ukc >= 0 ? `+${ukc.toFixed(2)}m` : `${ukc.toFixed(2)}m`}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="pointer-events-auto">
          <div
            className={`px-3 py-1.5 border border-black text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#000] ${
              isCritical
                ? 'bg-[#d42020] text-white animate-pulse'
                : isWarning
                ? 'bg-[#fef08a] text-[#854d0e]'
                : 'bg-[#dcfce7] text-[#166534]'
            }`}
          >
            {isCritical ? (
              <>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>RISCO DE ENCALHE</span>
              </>
            ) : isWarning ? (
              <>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>ATENÇÃO / ÁGUA RASA</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>ÁGUA SEGURA</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bottom Tactical Dock (Controles de Câmera 3D sem obstrução) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-auto max-w-[95%] pointer-events-auto bg-black/90 dark:bg-[#161b22]/95 border-2 border-black text-white p-1.5 sm:p-2 shadow-[3px_3px_0px_#000] flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase text-[#888] px-1 hidden sm:inline">
          CÂMERA 3D:
        </span>

        <button
          onClick={() => setCameraPreset('profile')}
          className={`px-2.5 py-1 text-[11px] font-bold uppercase border cursor-pointer transition-colors flex items-center gap-1 ${
            activePreset === 'profile'
              ? 'bg-[#0284c7] text-white border-white'
              : 'bg-black text-[#ccc] border-transparent hover:border-[#666]'
          }`}
          title="Vista Lateral Técnica / Corte Transversal da Coluna d'Água"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>PERFIL</span>
        </button>

        <button
          onClick={() => setCameraPreset('isometric')}
          className={`px-2.5 py-1 text-[11px] font-bold uppercase border cursor-pointer transition-colors flex items-center gap-1 ${
            activePreset === 'isometric'
              ? 'bg-[#0284c7] text-white border-white'
              : 'bg-black text-[#ccc] border-transparent hover:border-[#666]'
          }`}
          title="Perspectiva 3D Isométrica do Barco e Mar"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>ISOMÉTRICA</span>
        </button>

        <button
          onClick={() => setCameraPreset('keel')}
          className={`px-2.5 py-1 text-[11px] font-bold uppercase border cursor-pointer transition-colors flex items-center gap-1 ${
            activePreset === 'keel'
              ? 'bg-[#d42020] text-white border-white'
              : 'bg-black text-[#ccc] border-transparent hover:border-[#666]'
          }`}
          title="Foco de Proximidade Subaquática na Quilha e Fundo (UKC)"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>QUILHA / UKC</span>
        </button>

        <button
          onClick={() => setCameraPreset(activePreset)}
          className="p-1 hover:bg-[#333] border border-transparent hover:border-white/20 text-[#aaa] hover:text-white cursor-pointer ml-1"
          title="Resetar Ângulo de Visão"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dica interativa inicial */}
      {showControlsHint && (
        <div className="absolute top-16 right-3 bg-black/80 text-white text-[10px] px-2.5 py-1 border border-white/20 flex items-center gap-1.5 pointer-events-auto">
          <span>Arraste para girar em 3D · Scroll para zoom</span>
          <button
            onClick={() => setShowControlsHint(false)}
            className="text-[#999] hover:text-white ml-1 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default VisualTideGauge3D;
