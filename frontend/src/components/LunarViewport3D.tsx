import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  CameraPreset,
  CandidateSite,
  LandingState,
  MissionViewMode,
  RoverState,
  RoverTelemetry,
  TelemetryStep,
  TerrainData,
} from '../types/lunar';
import {
  createMoonAlbedoTexture,
  createMoonBumpTexture,
  getMoonSubsolarVector,
  selenographicToCartesian,
} from '../services/moonGlobe';
import { LunarRoverController, getTerrainElevationAt } from './LunerRoverRig';
import { missionAudio } from '../services/missionAudio';

interface LunarViewport3DProps {
  terrain: TerrainData;
  currentStep: TelemetryStep | null;
  cameraPreset: CameraPreset;
  cameraPresetTrigger: number;
  showSlopeHeatmap: boolean;
  showHazardOverlay: boolean;
  missionViewMode: MissionViewMode;
  landingState: LandingState;
  onLandingComplete?: () => void;
  roverState: RoverState;
  onUpdateRoverTelemetry?: (tel: RoverTelemetry) => void;
  sites: CandidateSite[];
  selectedSite: CandidateSite;
  onSelectSite: (site: CandidateSite) => void;
  onInitiateLanding?: () => void;
}

const DEG2RAD = Math.PI / 180;

function azElToVector(azDeg: number, elDeg: number): THREE.Vector3 {
  const az = azDeg * DEG2RAD;
  const el = elDeg * DEG2RAD;
  const cosEl = Math.cos(el);
  return new THREE.Vector3(
    cosEl * Math.sin(az),
    Math.sin(el),
    -cosEl * Math.cos(az)
  ).normalize();
}

function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#dbeafe');
  grad.addColorStop(0.14, '#1d4ed8');
  grad.addColorStop(0.5, '#0f3b8c');
  grad.addColorStop(0.86, '#1e40af');
  grad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = 'rgba(74, 152, 110, 0.72)';
  const blobs = [
    [130, 95, 52, 34],
    [175, 145, 34, 48],
    [290, 88, 66, 36],
    [310, 140, 44, 40],
    [400, 105, 58, 42],
    [435, 165, 32, 22],
  ];
  for (const [bx, by, rx, ry] of blobs) {
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
  for (let i = 0; i < 28; i++) {
    const cx = (i * 73) % 512;
    const cy = 28 + ((i * 41) % 200);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 34 + (i % 4) * 14, 7 + (i % 3) * 4, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSunGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 253, 240, 1)');
  grad.addColorStop(0.14, 'rgba(255, 232, 175, 0.95)');
  grad.addColorStop(0.36, 'rgba(245, 158, 11, 0.38)');
  grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface LanderRig {
  root: THREE.Group;
  solarWingPivot: THREE.Object3D | null;
  commsDishGimbal: THREE.Object3D | null;
  commsDishElevation: THREE.Object3D | null;
  dishTipLocal: THREE.Vector3;
  beaconMesh: THREE.Mesh | null;
  thrusterPlume: THREE.Group;
  thrusterLight: THREE.PointLight;
  dustRing: THREE.Mesh;
  footpadBottomOffset: number;
}

function buildProceduralLander(): LanderRig {
  const root = new THREE.Group();
  root.name = 'ArtemisProceduralLander';

  const goldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xd99b26,
    metalness: 0.85,
    roughness: 0.28,
  });
  const hullWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.25,
    roughness: 0.42,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.75,
    roughness: 0.38,
  });
  const solarCellMat = new THREE.MeshStandardMaterial({
    color: 0x0f294d,
    metalness: 0.6,
    roughness: 0.22,
    emissive: 0x081a33,
    emissiveIntensity: 0.4,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.85,
    roughness: 0.15,
  });

  // 4 Landing Legs + Footpads
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const legGroup = new THREE.Group();
    legGroup.rotation.y = angle;

    const footPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.72, 0.16, 16),
      darkMetalMat
    );
    footPad.position.set(3.4, 0.08, 0);
    footPad.castShadow = true;
    legGroup.add(footPad);

    const primaryStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 3.8, 12),
      goldFoilMat
    );
    primaryStrut.position.set(1.7, 1.45, 0);
    primaryStrut.rotation.z = -0.74;
    primaryStrut.castShadow = true;
    legGroup.add(primaryStrut);

    const secondaryStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 2.7, 8),
      darkMetalMat
    );
    secondaryStrut.position.set(2.4, 0.95, 0);
    secondaryStrut.rotation.z = -0.82;
    secondaryStrut.castShadow = true;
    legGroup.add(secondaryStrut);

    root.add(legGroup);
  }

  // Descent Stage (Gold MLI Octagon)
  const descentStage = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.45, 2.1, 8),
    goldFoilMat
  );
  descentStage.position.y = 2.65;
  descentStage.castShadow = true;
  descentStage.receiveShadow = true;
  root.add(descentStage);

  // Descent Engine Bell
  const engineBell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.72, 1.15, 20, 1, true),
    darkMetalMat
  );
  engineBell.position.y = 1.15;
  engineBell.castShadow = true;
  root.add(engineBell);

  // Ascent Crew Cabin
  const cabin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.72, 1.95, 2.9, 12),
    hullWhiteMat
  );
  cabin.position.y = 5.15;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  root.add(cabin);

  // Cockpit Windows
  for (const offset of [-0.52, 0.52]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.12), windowMat);
    win.position.set(offset, 5.55, 1.72);
    win.rotation.x = -0.15;
    root.add(win);
  }

  // Top Docking Ring
  const dockingRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.05, 0.45, 20),
    darkMetalMat
  );
  dockingRing.position.y = 6.8;
  dockingRing.castShadow = true;
  root.add(dockingRing);

  // Beacon
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), beaconMat);
  beaconMesh.position.set(0, 7.45, 0);
  root.add(beaconMesh);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 8), darkMetalMat);
  mast.position.set(0, 7.15, 0);
  root.add(mast);

  // Solar Wing Pivot
  const solarWingPivot = new THREE.Group();
  solarWingPivot.name = 'SolarWingPivot';
  solarWingPivot.position.set(0, 5.95, 0);

  const boom = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.1, 0.12), darkMetalMat);
  solarWingPivot.add(boom);

  for (const side of [-1, 1]) {
    const wingFrame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.25, 0.06), goldFoilMat);
    wingFrame.position.set(side * 3.15, 0, 0);
    wingFrame.castShadow = true;
    solarWingPivot.add(wingFrame);

    const wingPanel = new THREE.Mesh(new THREE.BoxGeometry(3.26, 1.12, 0.08), solarCellMat);
    wingPanel.position.set(side * 3.15, 0, 0.01);
    solarWingPivot.add(wingPanel);
  }
  root.add(solarWingPivot);

  // Comms Dish
  const commsDishGimbal = new THREE.Group();
  commsDishGimbal.name = 'CommsDishGimbal';
  commsDishGimbal.position.set(1.55, 6.45, 0);

  const gimbalBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.38, 12), darkMetalMat);
  commsDishGimbal.add(gimbalBase);

  const commsDishElevation = new THREE.Group();
  commsDishElevation.name = 'CommsDishElevation';
  commsDishElevation.position.set(0, 0.25, 0);

  const dishPoints: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const r = (i / 10) * 0.78;
    const z = r * r * 0.42;
    dishPoints.push(new THREE.Vector2(r, z));
  }
  const dishGeo = new THREE.LatheGeometry(dishPoints, 24);
  dishGeo.rotateX(Math.PI / 2);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.45,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const dishMesh = new THREE.Mesh(dishGeo, dishMat);
  dishMesh.castShadow = true;
  commsDishElevation.add(dishMesh);

  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.55, 10), goldFoilMat);
  feedHorn.rotation.x = Math.PI / 2;
  feedHorn.position.set(0, 0, 0.35);
  commsDishElevation.add(feedHorn);

  commsDishGimbal.add(commsDishElevation);
  root.add(commsDishGimbal);

  // Retro-Thruster Exhaust Plume for Powered Descent
  const thrusterPlume = new THREE.Group();
  thrusterPlume.position.set(0, 0.6, 0);

  // Inner Core Flame Cone (Inverted)
  const innerFlameGeo = new THREE.ConeGeometry(0.65, 4.2, 16);
  innerFlameGeo.rotateX(Math.PI);
  innerFlameGeo.translate(0, -2.1, 0);
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.95,
  });
  const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
  thrusterPlume.add(innerFlame);

  // Outer Expansion Gas Cone (Inverted Cyan / Purple)
  const outerFlameGeo = new THREE.ConeGeometry(1.65, 7.8, 16);
  outerFlameGeo.rotateX(Math.PI);
  outerFlameGeo.translate(0, -3.9, 0);
  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
  });
  const outerFlame = new THREE.Mesh(outerFlameGeo, outerFlameMat);
  thrusterPlume.add(outerFlame);

  const thrusterLight = new THREE.PointLight('#f97316', 7.5, 55, 1.2);
  thrusterLight.position.set(0, -1.5, 0);
  thrusterPlume.add(thrusterLight);
  thrusterPlume.visible = false;
  root.add(thrusterPlume);

  // Touchdown Regolith Dust Expansion Ring
  const dustRingGeo = new THREE.RingGeometry(0.8, 4.5, 32);
  dustRingGeo.rotateX(-Math.PI / 2);
  const dustRingMat = new THREE.MeshBasicMaterial({
    color: 0xcfd8dc,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
  });
  const dustRing = new THREE.Mesh(dustRingGeo, dustRingMat);
  dustRing.position.set(0, 0.15, 0);
  root.add(dustRing);

  root.updateMatrixWorld(true);
  const footpadBottomOffset = 0.0;

  return {
    root,
    solarWingPivot,
    commsDishGimbal,
    commsDishElevation,
    dishTipLocal: new THREE.Vector3(1.55, 6.7, 0),
    beaconMesh,
    thrusterPlume,
    thrusterLight,
    dustRing,
    footpadBottomOffset,
  };
}

const groundRaycaster = new THREE.Raycaster();
const groundDownDir = new THREE.Vector3(0, -1, 0);

function sampleVisibleGroundY(
  refs: { blenderOverlay: THREE.Object3D | null; terrainMesh: THREE.Mesh | null } | null,
  terrain: TerrainData | null,
  x: number,
  z: number
): { y: number; normal: THREE.Vector3 } {
  if (refs) {
    const targets: THREE.Object3D[] = [];
    if (refs.blenderOverlay && refs.blenderOverlay.visible) {
      targets.push(refs.blenderOverlay);
    } else if (refs.terrainMesh && refs.terrainMesh.visible) {
      targets.push(refs.terrainMesh);
    }
    if (targets.length > 0) {
      groundRaycaster.set(new THREE.Vector3(x, 600, z), groundDownDir);
      const hits = groundRaycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const hit = hits[0];
        let normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
        if (hit.object) {
          normal.transformDirection(hit.object.matrixWorld);
        }
        if (normal.y < 0) normal.negate();
        normal.normalize();
        return { y: hit.point.y, normal };
      }
    }
  }
  const fallbackY = getTerrainElevationAt(terrain, x, z);
  return { y: fallbackY, normal: new THREE.Vector3(0, 1, 0) };
}

function buildTerrainGeometry(terrain: TerrainData): {
  geometry: THREE.PlaneGeometry;
  centerNormal: THREE.Vector3;
} {
  const N = terrain.grid_size;
  const geometry = new THREE.PlaneGeometry(terrain.width_m, terrain.height_m, N - 1, N - 1);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const count = posAttr.count;
  for (let i = 0; i < count; i++) {
    const elev = terrain.elevations[i] ?? terrain.center_elev_m;
    posAttr.setY(i, elev - terrain.center_elev_m);
  }
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  const mid = Math.floor(N / 2);
  const centerIdx = mid * N + mid;
  const normAttr = geometry.attributes.normal as THREE.BufferAttribute;
  const centerNormal = new THREE.Vector3(
    normAttr.getX(centerIdx),
    normAttr.getY(centerIdx),
    normAttr.getZ(centerIdx)
  ).normalize();

  return { geometry, centerNormal };
}

function applyTerrainColors(
  geometry: THREE.PlaneGeometry,
  terrain: TerrainData,
  showSlopeHeatmap: boolean
): void {
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const normAttr = geometry.attributes.normal as THREE.BufferAttribute;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  const skirtColor = new THREE.Color(0x16191f);

  const halfW = terrain.width_m / 2;
  const halfH = terrain.height_m / 2;
  const rBoundary = Math.min(halfW, halfH);
  const rInnerFade = rBoundary * 0.85; // Outer 15% radial fade zone

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const ny = Math.max(0.01, Math.min(1, normAttr.getY(i)));
    const slopeDeg =
      terrain.slope_deg && terrain.slope_deg[i] !== undefined
        ? terrain.slope_deg[i]
        : (Math.acos(ny) * 180) / Math.PI;

    const elevFactor = Math.max(-1, Math.min(1, y / 450));
    const baseShade = 0.44 + elevFactor * 0.14 - Math.min(0.18, slopeDeg * 0.005);
    color.setRGB(baseShade * 0.97, baseShade * 0.99, baseShade * 1.03);

    if (showSlopeHeatmap) {
      if (slopeDeg > 15) {
        color.lerp(new THREE.Color('#ef4444'), 0.72);
      } else if (slopeDeg > 10) {
        color.lerp(new THREE.Color('#f59e0b'), 0.58);
      } else {
        color.lerp(new THREE.Color('#22c55e'), 0.32);
      }
    }

    // Radial vertex-color fade on outer 15% of terrain patch into dark lunar skirt
    const dist = Math.hypot(x, z);
    if (dist > rInnerFade) {
      const t = Math.min(1.0, (dist - rInnerFade) / (rBoundary - rInnerFade));
      const smoothT = t * t * (3 - 2 * t);
      color.lerp(skirtColor, smoothT);
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export const LunarViewport3D: React.FC<LunarViewport3DProps> = ({
  terrain,
  currentStep,
  cameraPreset,
  cameraPresetTrigger,
  showSlopeHeatmap,
  showHazardOverlay,
  missionViewMode,
  landingState,
  onLandingComplete,
  roverState,
  onUpdateRoverTelemetry,
  sites,
  selectedSite,
  onSelectSite,
  onInitiateLanding,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [, setLanderAssetStatus] = useState<'glb' | 'procedural'>('procedural');
  const [selectedGlobeSite, setSelectedGlobeSite] = useState<CandidateSite>(selectedSite);

  const stepRef = useRef<TelemetryStep | null>(currentStep);
  stepRef.current = currentStep;
  const terrainRef = useRef<TerrainData>(terrain);
  terrainRef.current = terrain;
  const showSlopeHeatmapRef = useRef<boolean>(showSlopeHeatmap);
  showSlopeHeatmapRef.current = showSlopeHeatmap;
  const landingStateRef = useRef<LandingState>(landingState);
  landingStateRef.current = landingState;
  const roverStateRef = useRef<RoverState>(roverState);
  roverStateRef.current = roverState;
  const missionViewModeRef = useRef<MissionViewMode>(missionViewMode);
  missionViewModeRef.current = missionViewMode;

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    terrainMesh: THREE.Mesh | null;
    terrainGeo: THREE.PlaneGeometry | null;
    terrainSkirtMesh: THREE.Mesh | null;
    boulderMesh: THREE.InstancedMesh | null;
    blenderOverlay: THREE.Object3D | null;
    landerRig: LanderRig | null;
    roverController: LunarRoverController | null;
    roverHop1Line: THREE.Line;
    roverHop1Pulse: THREE.Mesh;
    moonGlobeGroup: THREE.Group;
    moonSphereMesh: THREE.Mesh;
    moonSunLight: THREE.DirectionalLight;
    globeSiteMarkers: { site: CandidateSite; group: THREE.Group }[];
    sunLight: THREE.DirectionalLight;
    earthLight: THREE.DirectionalLight;
    sunSprite: THREE.Sprite;
    sunMarkerGroup: THREE.Group;
    sunLineSolid: THREE.Line;
    sunLineDashed: THREE.Line;
    sunPulseMesh: THREE.Mesh;
    earthMesh: THREE.Mesh;
    earthMarkerGroup: THREE.Group;
    dteLineSolid: THREE.Line;
    dteLineDashed: THREE.Line;
    dtePulseMesh: THREE.Mesh;
    reticleGroup: THREE.Group;
    camAnim: {
      active: boolean;
      targetPos: THREE.Vector3;
      targetLook: THREE.Vector3;
    };
    landingAnim: {
      active: boolean;
      timeSec: number;
    };
  } | null>(null);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030509');
    scene.fog = new THREE.FogExp2('#030509', 0.000045);

    const isInitialMoonGlobe = missionViewModeRef.current === 'moon_globe';
    const camera = new THREE.PerspectiveCamera(45, width / height, 1.5, 52000);
    if (isInitialMoonGlobe) {
      camera.position.set(0, -180, 290);
    } else {
      camera.position.set(42, 22, 52);
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = isInitialMoonGlobe ? 145 : 6;
    controls.maxDistance = isInitialMoonGlobe ? 1500 : 420;
    controls.maxPolarAngle = isInitialMoonGlobe ? Math.PI : Math.PI / 2 - 0.04;
    controls.target.set(0, isInitialMoonGlobe ? -90 : 4.5, 0);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.38,
      0.35,
      0.82
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // Procedural 3D Starfield
    const starCount = 2800;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 24000;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.92 + 150;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const brightness = 0.45 + Math.random() * 0.55;
      starCol[i * 3] = brightness;
      starCol[i * 3 + 1] = brightness * 0.96;
      starCol[i * 3 + 2] = brightness * 1.05;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 26,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      fog: false,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Space Lighting & High-Resolution Grazing Polar Shadow Generator
    const sunLight = new THREE.DirectionalLight('#fff7e6', 4.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(4096, 4096);
    sunLight.shadow.camera.near = 50;
    sunLight.shadow.camera.far = 16000;
    const dFrustum = 350;
    sunLight.shadow.camera.left = -dFrustum;
    sunLight.shadow.camera.right = dFrustum;
    sunLight.shadow.camera.top = dFrustum;
    sunLight.shadow.camera.bottom = -dFrustum;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const earthLight = new THREE.DirectionalLight('#60a5fa', 0.85);
    scene.add(earthLight);

    const ambientLight = new THREE.AmbientLight('#94a3b8', 0.75);
    scene.add(ambientLight);

    const lunarBounce = new THREE.HemisphereLight('#cbd5e1', '#334155', 0.65);
    scene.add(lunarBounce);

    const landerFloodlight1 = new THREE.PointLight('#fef08a', 3.2, 180, 1.0);
    landerFloodlight1.position.set(0, 8.5, 0);
    scene.add(landerFloodlight1);

    // 3D Sun Visual Disk + Corona Sprite
    const sunTex = createSunGlowTexture();
    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTex,
        color: 0xfff5d6,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        fog: false,
      })
    );
    sunSprite.scale.set(1600, 1600, 1);
    scene.add(sunSprite);

    // 3D Sun Indicator Marker (Targeting Halo)
    const sunMarkerGroup = new THREE.Group();
    const sunRingPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      sunRingPts.push(new THREE.Vector3(Math.cos(a) * 48, Math.sin(a) * 48, 0));
    }
    const sunRing = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(sunRingPts),
      new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 })
    );
    sunMarkerGroup.add(sunRing);
    scene.add(sunMarkerGroup);

    // Sun Sightline Vectors (Lander Solar Mast -> Sun)
    const sunSolidGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 6, 0),
      new THREE.Vector3(0, 100, 500),
    ]);
    const sunLineSolid = new THREE.Line(
      sunSolidGeo,
      new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.9 })
    );
    scene.add(sunLineSolid);

    const sunDashedGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 6, 0),
      new THREE.Vector3(0, 40, 200),
    ]);
    const sunLineDashed = new THREE.Line(
      sunDashedGeo,
      new THREE.LineDashedMaterial({
        color: 0xef4444,
        dashSize: 15,
        gapSize: 10,
        transparent: true,
        opacity: 0.85,
      })
    );
    sunLineDashed.computeLineDistances();
    scene.add(sunLineDashed);

    const sunPulseMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    scene.add(sunPulseMesh);

    // 3D Earth Globe Visual Orb
    const earthTex = createEarthTexture();
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(36, 32, 32),
      new THREE.MeshStandardMaterial({
        map: earthTex,
        emissive: 0x1d4ed8,
        emissiveMap: earthTex,
        emissiveIntensity: 0.85,
        roughness: 0.65,
        fog: false,
      })
    );
    scene.add(earthMesh);

    // 3D Earth Indicator Marker (Targeting Halo)
    const earthMarkerGroup = new THREE.Group();
    const earthRingPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      earthRingPts.push(new THREE.Vector3(Math.cos(a) * 38, Math.sin(a) * 38, 0));
    }
    const earthRing = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(earthRingPts),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    earthMarkerGroup.add(earthRing);
    scene.add(earthMarkerGroup);

    // DTE Signal Beams (Artemis Lander -> Earth Direct-to-Earth)
    const dteSolidGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 7, 0),
      new THREE.Vector3(0, 500, -1000),
    ]);
    const dteLineSolid = new THREE.Line(
      dteSolidGeo,
      new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.9 })
    );
    scene.add(dteLineSolid);

    const dteDashedGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 7, 0),
      new THREE.Vector3(0, 50, -350),
    ]);
    const dteLineDashed = new THREE.Line(
      dteDashedGeo,
      new THREE.LineDashedMaterial({
        color: 0xef4444,
        dashSize: 15,
        gapSize: 10,
        transparent: true,
        opacity: 0.85,
      })
    );
    dteLineDashed.computeLineDistances();
    scene.add(dteLineDashed);

    const dtePulseMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    scene.add(dtePulseMesh);

    // Landing Zone Reticle
    const reticleGroup = new THREE.Group();
    const makeRing = (radius: number, colorHex: number, opacity: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0.8, Math.sin(a) * radius));
      }
      return new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity })
      );
    };
    reticleGroup.add(makeRing(35, 0x38bdf8, 0.72));
    reticleGroup.add(makeRing(120, 0x38bdf8, 0.34));
    scene.add(reticleGroup);

    // Build Artemis Procedural Lander
    const procRig = buildProceduralLander();
    scene.add(procRig.root);
    const initialGroundY = getTerrainElevationAt(terrainRef.current, 0, 0);
    procRig.root.position.set(0, initialGroundY - procRig.footpadBottomOffset - 0.06, 0);
    procRig.root.updateMatrixWorld(true);

    // Build lunar rover controller (CAD asset + headlights + rocker-bogie)
    const roverController = new LunarRoverController();
    scene.add(roverController.rig.root);
    scene.add(roverController.rampMesh);

    // Hop 1 telemetry line (lunar rover → Artemis lander)
    const hop1Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(6, 2, 0),
      new THREE.Vector3(0, 6.5, 0),
    ]);
    const hop1Line = new THREE.Line(
      hop1Geo,
      new THREE.LineBasicMaterial({
        color: 0x06b6d4, // glowing cyan
        transparent: true,
        opacity: 0.9,
      })
    );
    scene.add(hop1Line);

    const hop1Pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    scene.add(hop1Pulse);

    // Build 3D Moon Globe System (Interactive Pre-Launch Site Selector)
    const moonGlobeGroup = new THREE.Group();
    moonGlobeGroup.name = 'MoonGlobeGroup';
    moonGlobeGroup.visible = false;

    const moonAlbedoTex = createMoonAlbedoTexture();
    const moonBumpTex = createMoonBumpTexture();
    const moonSphereMat = new THREE.MeshStandardMaterial({
      map: moonAlbedoTex,
      bumpMap: moonBumpTex,
      bumpScale: 3.2,
      roughness: 0.92,
      metalness: 0.05,
    });
    const moonSphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(140, 64, 64),
      moonSphereMat
    );
    moonSphereMesh.receiveShadow = true;
    moonSphereMesh.castShadow = true;
    moonGlobeGroup.add(moonSphereMesh);

    // Earthshine ambient light for night hemisphere (so dark craters are visible, not pitch black)
    const moonEarthshine = new THREE.AmbientLight('#2a3b50', 1.25);
    moonGlobeGroup.add(moonEarthshine);

    // Subsolar Directional Light for 3D Moon Globe
    const moonSunLight = new THREE.DirectionalLight('#fff7e6', 5.5);
    moonSunLight.castShadow = true;
    moonGlobeGroup.add(moonSunLight);
    moonGlobeGroup.add(moonSunLight.target);

    // Populate Artemis candidate site markers on the 3D Moon Globe
    const globeSiteMarkers: { site: CandidateSite; group: THREE.Group }[] = [];
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const markerHeadMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const markerRingMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });

    sites.forEach((site) => {
      const siteGroup = new THREE.Group();
      const pos = selenographicToCartesian(site.lat_deg, site.lon_deg, 140.5);
      siteGroup.position.copy(pos);
      siteGroup.lookAt(0, 0, 0); // Local -Z points to Moon center, local +Z points OUTWARD into space

      // Ground beacon base ring
      const ringPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0.3));
      }
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), markerRingMat);
      siteGroup.add(ring);

      // Beacon pillar (pointing outward along +Z)
      const pillarGeo = new THREE.CylinderGeometry(0.5, 0.9, 7.5, 12);
      pillarGeo.rotateX(Math.PI / 2);
      const pillar = new THREE.Mesh(pillarGeo, markerMat);
      pillar.position.z = 3.75;
      siteGroup.add(pillar);

      // Luminous beacon head orb at tip
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 16), markerHeadMat.clone());
      head.position.z = 8.2;
      siteGroup.add(head);

      siteGroup.userData = { site, pillar, head, ring };
      moonGlobeGroup.add(siteGroup);
      globeSiteMarkers.push({ site, group: siteGroup });
    });

    scene.add(moonGlobeGroup);

    sceneRefs.current = {
      scene,
      camera,
      controls,
      renderer,
      composer,
      terrainMesh: null,
      terrainGeo: null,
      terrainSkirtMesh: null,
      boulderMesh: null,
      blenderOverlay: null,
      landerRig: procRig,
      roverController,
      roverHop1Line: hop1Line,
      roverHop1Pulse: hop1Pulse,
      moonGlobeGroup,
      moonSphereMesh,
      moonSunLight,
      globeSiteMarkers,
      sunLight,
      earthLight,
      sunSprite,
      sunMarkerGroup,
      sunLineSolid,
      sunLineDashed,
      sunPulseMesh,
      earthMesh,
      earthMarkerGroup,
      dteLineSolid,
      dteLineDashed,
      dtePulseMesh,
      reticleGroup,
      camAnim: {
        active: false,
        targetPos: new THREE.Vector3(),
        targetLook: new THREE.Vector3(),
      },
      landingAnim: {
        active: false,
        timeSec: 0,
      },
    };

    // Attempt GLB upgrade for Artemis lander
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/assets/artemis_lander.glb', { method: 'GET' });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || ct.includes('text/html') || cancelled) return;
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const loader = new GLTFLoader();
        loader.parse(
          buf,
          '/assets/',
          (gltf) => {
            if (cancelled || !sceneRefs.current) return;
            const model = gltf.scene;
            model.traverse((obj) => {
              if ((obj as THREE.Mesh).isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
              }
            });
            model.quaternion.copy(procRig.root.quaternion);
            scene.remove(procRig.root);
            scene.add(model);

            // Exact local bottom contact surface of artemis_lander.glb footpads is at y = 0
            model.updateMatrixWorld(true);
            const footpadBottomOffset = 0.0;

            const initialGlbGround = sampleVisibleGroundY(sceneRefs.current, terrainRef.current, 0, 0);
            model.position.set(0, initialGlbGround.y - 0.04, 0);
            model.updateMatrixWorld(true);

            // Re-attach retro thruster plume to GLB model base
            model.add(procRig.thrusterPlume);
            model.add(procRig.dustRing);

            sceneRefs.current.landerRig = {
              root: model,
              solarWingPivot: model.getObjectByName('SolarWingPivot') ?? null,
              commsDishGimbal: model.getObjectByName('CommsDishGimbal') ?? null,
              commsDishElevation: model.getObjectByName('CommsDishElevation') ?? null,
              dishTipLocal: new THREE.Vector3(0, 6.5, 0),
              beaconMesh: null,
              thrusterPlume: procRig.thrusterPlume,
              thrusterLight: procRig.thrusterLight,
              dustRing: procRig.dustRing,
              footpadBottomOffset,
            };
            setLanderAssetStatus('glb');
          },
          () => {}
        );
      } catch {}
    })();

    const onUserInteract = () => {
      if (sceneRefs.current) {
        sceneRefs.current.camAnim.active = false;
      }
    };
    controls.addEventListener('start', onUserInteract);

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !sceneRefs.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Raycasting for Moon Globe site clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (evt: MouseEvent) => {
      if (missionViewModeRef.current !== 'moon_globe' || !sceneRefs.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const targets = sceneRefs.current.globeSiteMarkers.map((m) => m.group);
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.site) {
          obj = obj.parent;
        }
        if (obj && obj.userData.site) {
          setSelectedGlobeSite(obj.userData.site);
          onSelectSite(obj.userData.site);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Main 60fps Animation Loop
    let rafId = 0;
    const clock = new THREE.Clock();
    const tmpDishWorld = new THREE.Vector3();
    const tmpTargetPos = new THREE.Vector3();
    const tmpLocalSun = new THREE.Vector3();
    const tmpLocalEarth = new THREE.Vector3();
    const roverMastWorld = new THREE.Vector3();
    const landerMastWorld = new THREE.Vector3();
    const invQuat = new THREE.Quaternion();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const delta = Math.min(0.1, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const refs = sceneRefs.current;
      if (!refs) return;

      const isMoonGlobe = missionViewModeRef.current === 'moon_globe';
      refs.moonGlobeGroup.visible = isMoonGlobe;
      if (refs.terrainMesh) refs.terrainMesh.visible = !isMoonGlobe && !refs.blenderOverlay;
      if (refs.terrainSkirtMesh) refs.terrainSkirtMesh.visible = !isMoonGlobe;
      if (refs.blenderOverlay) refs.blenderOverlay.visible = !isMoonGlobe;
      if (refs.boulderMesh) refs.boulderMesh.visible = !isMoonGlobe;
      refs.reticleGroup.visible = !isMoonGlobe && showHazardOverlay;
      const isLanded = landingStateRef.current === 'landed';
      if (refs.landerRig) refs.landerRig.root.visible = !isMoonGlobe;

      // Lunar Polar Scout Rover is visible when landed and deployed
      const showRover = !isMoonGlobe && isLanded;
      if (refs.roverController) {
        refs.roverController.rig.root.visible = showRover;
        refs.roverController.rampMesh.visible = showRover;
      }
      refs.roverHop1Line.visible = showRover;
      refs.roverHop1Pulse.visible = showRover;

      refs.sunSprite.visible = !isMoonGlobe;
      refs.sunMarkerGroup.visible = !isMoonGlobe;
      refs.sunLineSolid.visible = !isMoonGlobe && (stepRef.current?.sun_visible ?? true);
      refs.sunLineDashed.visible = !isMoonGlobe && !(stepRef.current?.sun_visible ?? true);
      refs.sunPulseMesh.visible = !isMoonGlobe && (stepRef.current?.sun_visible ?? true);
      refs.earthMesh.visible = !isMoonGlobe;
      refs.earthMarkerGroup.visible = !isMoonGlobe;
      refs.dteLineSolid.visible = !isMoonGlobe && (stepRef.current?.earth_visible ?? true);
      refs.dteLineDashed.visible = !isMoonGlobe && !(stepRef.current?.earth_visible ?? true);
      refs.dtePulseMesh.visible = !isMoonGlobe && (stepRef.current?.earth_visible ?? true);

      if (isMoonGlobe) {
        // Moon Globe Sun Positioning based on current UTC ephemeris
        const step = stepRef.current;
        const subsolarDir = getMoonSubsolarVector(step?.timestamp_utc ?? '2026-11-15T00:00:00Z');
        refs.moonSunLight.position.copy(subsolarDir).multiplyScalar(850);
        refs.moonSunLight.target.position.set(0, 0, 0);

        // Pulse selected site marker ring and update marker color
        refs.globeSiteMarkers.forEach(({ site, group }) => {
          const isSel = site.id === selectedSite.id;
          const scale = isSel ? 1.0 + 0.28 * Math.sin(elapsed * 5.5) : 0.92;
          group.scale.setScalar(scale);

          const head = group.userData.head as THREE.Mesh | undefined;
          if (head && head.material) {
            const mat = head.material as THREE.MeshStandardMaterial;
            if (isSel) {
              mat.color.setHex(0xfbbf24);
              mat.emissive.setHex(0xd97706);
            } else {
              mat.color.setHex(0x38bdf8);
              mat.emissive.setHex(0x0284c7);
            }
          }
        });

        // Run camera transition in Moon Globe mode!
        if (refs.camAnim.active) {
          camera.position.lerp(refs.camAnim.targetPos, 0.08);
          controls.target.lerp(refs.camAnim.targetLook, 0.08);
          if (
            camera.position.distanceTo(refs.camAnim.targetPos) < 1.0 &&
            controls.target.distanceTo(refs.camAnim.targetLook) < 0.5
          ) {
            refs.camAnim.active = false;
          }
        }

        controls.update();
        composer.render();
        return;
      }

      // Smooth camera presets
      if (refs.camAnim.active) {
        camera.position.lerp(refs.camAnim.targetPos, 0.08);
        controls.target.lerp(refs.camAnim.targetLook, 0.08);
        if (
          camera.position.distanceTo(refs.camAnim.targetPos) < 0.8 &&
          controls.target.distanceTo(refs.camAnim.targetLook) < 0.4
        ) {
          refs.camAnim.active = false;
        }
      }

      controls.update();

      // Powered Descent & Landing Dynamics
      const lander = refs.landerRig;
      const currentLandingState = landingStateRef.current;

      if (lander) {
        const centerGround = sampleVisibleGroundY(refs, terrainRef.current, 0, 0);
        const terrainNorm = centerGround.normal;
        const normalQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), terrainNorm);

        // 4 Footpad contact points in local lander space
        const padOffsets = [
          new THREE.Vector3(1.92, 0, 0),
          new THREE.Vector3(-1.92, 0, 0),
          new THREE.Vector3(0, 0, 1.92),
          new THREE.Vector3(0, 0, -1.92),
        ];

        let minContactLandedY = centerGround.y;
        for (let i = 0; i < 4; i++) {
          const worldPad = padOffsets[i].clone().applyQuaternion(normalQuat);
          const padGround = sampleVisibleGroundY(refs, terrainRef.current, worldPad.x, worldPad.z);
          const padLandedY = padGround.y - worldPad.y;
          if (padLandedY < minContactLandedY) {
            minContactLandedY = padLandedY;
          }
        }
        // Sink 4cm into lunar regolith dust so every footpad is firmly planted with zero hovering gap
        const landedY = minContactLandedY - 0.04;

        if (currentLandingState === 'descending') {
          if (!refs.landingAnim.active) {
            missionAudio.startThruster();
          }
          refs.landingAnim.active = true;
          refs.landingAnim.timeSec += delta;
          const totalDuration = 5.5; // seconds
          const t = Math.min(1.0, refs.landingAnim.timeSec / totalDuration);

          // Altitude Deceleration Curve: drops smoothly from landedY + 110m to landedY
          const altitude = 110 * Math.pow(1.0 - t, 2.2);
          // Braking Burn Pitch Tilt: 14 deg retro-pitch righting to 0 deg upright
          const pitch = 0.24 * (1.0 - Math.min(1.0, t * 1.3));

          lander.root.position.set(0, landedY + altitude, 0);
          const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
          lander.root.quaternion.copy(normalQuat).multiply(pitchQuat);

          // Thruster Flame Plume Active & Flickering
          lander.thrusterPlume.visible = true;
          const flicker = 1.0 + 0.25 * Math.sin(elapsed * 45) + 0.15 * Math.cos(elapsed * 28);
          lander.thrusterPlume.scale.set(1.0, flicker, 1.0);
          lander.thrusterLight.intensity = 6.5 * flicker;

          // Altimeter radar beep during final descent
          if (altitude < 35 && Math.floor(elapsed * 2.5) !== Math.floor((elapsed - delta) * 2.5)) {
            missionAudio.playAltimeterBeep(altitude);
          }

          // Surface Dust Ring expands as lander descends below 25m
          if (altitude < 25) {
            const dustProgress = (25 - altitude) / 25;
            lander.dustRing.scale.setScalar(1.0 + dustProgress * 3.8);
            (lander.dustRing.material as THREE.MeshBasicMaterial).opacity =
              0.65 * (1.0 - dustProgress);
          }

          if (t >= 1.0) {
            // Touchdown Confirmed: Kill thrusters & apply shock strut damping
            lander.thrusterPlume.visible = false;
            lander.root.quaternion.copy(normalQuat);
            refs.landingAnim.active = false;
            refs.landingAnim.timeSec = 0;
            lander.root.position.set(0, landedY, 0);
            lander.root.updateMatrixWorld(true);
            missionAudio.stopThruster();
            missionAudio.playTouchdownChime();
            if (onLandingComplete) onLandingComplete();
          }
        } else if (currentLandingState === 'landed') {
          // Ground the Artemis Lander every frame conforming to terrain slope (zero floating gap)
          lander.thrusterPlume.visible = false;
          (lander.dustRing.material as THREE.MeshBasicMaterial).opacity = 0;
          lander.root.quaternion.copy(normalQuat);
          lander.root.position.set(0, landedY, 0);
          lander.root.updateMatrixWorld(true);
        } else {
          // 'in_orbit': hover high above
          lander.thrusterPlume.visible = false;
          lander.root.quaternion.set(0, 0, 0, 1);
          lander.root.position.set(0, centerGround.y + 120, 0);
        }
      }

      // Lunar Polar Scout Rover controller update (autonomous traverse and dynamic headlights)
      const step = stepRef.current;
      const isDarkness = !step?.sun_visible;

      if (refs.roverController) {
        const landerPosY = lander ? lander.root.position.y : undefined;
        const groundSampler = (x: number, z: number) =>
          sampleVisibleGroundY(refs, terrainRef.current, x, z).y;
        const tel = refs.roverController.update(
          delta,
          elapsed,
          roverStateRef.current,
          isDarkness,
          terrainRef.current,
          step?.earth_visible ?? true,
          landerPosY,
          groundSampler
        );
        if (onUpdateRoverTelemetry) onUpdateRoverTelemetry(tel);

        // Bounding-box bottom-clamp for rover so zero parts ever float in mid-air
        const roverRoot = refs.roverController.rig.root;
        roverRoot.updateMatrixWorld(true);
        const roverBBox = new THREE.Box3().setFromObject(roverRoot);
        if (roverBBox.min.y !== Infinity && !isNaN(roverBBox.min.y)) {
          const rGroundY = sampleVisibleGroundY(refs, terrainRef.current, roverRoot.position.x, roverRoot.position.z).y;
          if (roverStateRef.current !== 'deploying') {
            roverRoot.position.y += (rGroundY - 0.04) - roverBBox.min.y;
            roverRoot.updateMatrixWorld(true);
          }
        }

        if (tel.state === 'traversing') {
          missionAudio.startRoverHum();
        } else {
          missionAudio.stopRoverHum();
        }

        // Hop 1 telemetry link (Lunar Polar Scout Rover antenna mast → Artemis lander mast)
        refs.roverController.rig.antennaTip.getWorldPosition(roverMastWorld);
        const landerMastY = lander ? lander.root.position.y + 6.8 : getTerrainElevationAt(terrainRef.current, 0, 0) + 6.8;
        landerMastWorld.set(0, landerMastY, 0);

        const hop1Pos = refs.roverHop1Line.geometry.attributes.position as THREE.BufferAttribute;
        hop1Pos.setXYZ(0, roverMastWorld.x, roverMastWorld.y, roverMastWorld.z);
        hop1Pos.setXYZ(1, landerMastWorld.x, landerMastWorld.y, landerMastWorld.z);
        hop1Pos.needsUpdate = true;

        const pulseT = (elapsed * 2.5) % 1.0;
        refs.roverHop1Pulse.position.lerpVectors(roverMastWorld, landerMastWorld, pulseT);
      }

      // Sun, Earth, Sightlines & Lander Gimbal Tracking
      if (step) {
        const sunDir = azElToVector(step.sun_az_deg, step.sun_el_deg);
        const earthDir = azElToVector(step.earth_az_deg, step.earth_el_deg);

        // Drive DirectionalLight directly from true selenocentric subsolar azimuth & grazing elevation
        refs.sunLight.position.copy(sunDir).multiplyScalar(6500);
        refs.sunLight.target.position.set(0, 0, 0);
        refs.sunSprite.position.copy(sunDir).multiplyScalar(14500);

        const targetSunIntensity = step.sun_visible ? 4.2 : 0.65;
        refs.sunLight.intensity += (targetSunIntensity - refs.sunLight.intensity) * 0.15;
        refs.sunSprite.material.opacity = step.sun_visible ? 0.96 : 0.35;

        // Position 3D Sun sky marker
        refs.sunMarkerGroup.position.copy(sunDir).multiplyScalar(3800);
        refs.sunMarkerGroup.lookAt(camera.position);

        // Position 3D Earth globe along true Earth azimuth/elevation vector within visible sky dome
        const earthDist = 1400; // Within sky dome, prominently visible in central viewport
        refs.earthMesh.position.copy(earthDir).multiplyScalar(earthDist);
        refs.earthMesh.lookAt(0, 0, 0);
        refs.earthLight.position.copy(earthDir).multiplyScalar(800);
        refs.earthLight.intensity = step.earth_visible ? 1.1 : 0.45;

        refs.earthMarkerGroup.position.copy(earthDir).multiplyScalar(earthDist * 0.96);
        refs.earthMarkerGroup.scale.setScalar(0.95);
        refs.earthMarkerGroup.lookAt(camera.position);

        const landerBaseY = lander ? lander.root.position.y : getTerrainElevationAt(terrainRef.current, 0, 0);
        const solarMastWorld = new THREE.Vector3(0, landerBaseY + 6.0, 0);

        // 1. Sun Sightline Vector (Lander Solar Mast -> Sun)
        const isSunClear = step.sun_visible;
        if (isSunClear) {
          refs.sunLineSolid.visible = true;
          refs.sunLineDashed.visible = false;
          refs.sunPulseMesh.visible = true;

          const sunTarget = solarMastWorld.clone().addScaledVector(sunDir, 4200);
          const posArr = refs.sunLineSolid.geometry.attributes.position as THREE.BufferAttribute;
          posArr.setXYZ(0, solarMastWorld.x, solarMastWorld.y, solarMastWorld.z);
          posArr.setXYZ(1, sunTarget.x, sunTarget.y, sunTarget.z);
          posArr.needsUpdate = true;

          const tPulse = (elapsed * 0.6) % 1;
          refs.sunPulseMesh.position.lerpVectors(
            solarMastWorld,
            solarMastWorld.clone().addScaledVector(sunDir, 1200),
            tPulse
          );
        } else {
          refs.sunLineSolid.visible = false;
          refs.sunLineDashed.visible = true;
          refs.sunPulseMesh.visible = false;

          // Blocked by crater ridge: dashed line terminates near horizon obstruction distance
          const blockedDist = 380;
          const sunTarget = solarMastWorld.clone().addScaledVector(sunDir, blockedDist);
          const posArr = refs.sunLineDashed.geometry.attributes.position as THREE.BufferAttribute;
          posArr.setXYZ(0, solarMastWorld.x, solarMastWorld.y, solarMastWorld.z);
          posArr.setXYZ(1, sunTarget.x, sunTarget.y, sunTarget.z);
          posArr.needsUpdate = true;
          refs.sunLineDashed.computeLineDistances();
        }

        // 2. Earth DTE Sightline Vector (Lander High-Gain Antenna -> Earth)
        if (lander) {
          invQuat.copy(lander.root.quaternion).invert();

          if (lander.solarWingPivot) {
            tmpLocalSun.copy(sunDir).applyQuaternion(invQuat).normalize();
            const targetYaw = Math.atan2(tmpLocalSun.x, tmpLocalSun.z);
            lander.solarWingPivot.rotation.y += (targetYaw - lander.solarWingPivot.rotation.y) * 0.12;
          }

          if (lander.commsDishGimbal) {
            tmpLocalEarth.copy(earthDir).applyQuaternion(invQuat).normalize();
            const yaw = Math.atan2(tmpLocalEarth.x, tmpLocalEarth.z);
            lander.commsDishGimbal.rotation.y += (yaw - lander.commsDishGimbal.rotation.y) * 0.14;

            if (lander.commsDishElevation) {
              const horizLen = Math.hypot(tmpLocalEarth.x, tmpLocalEarth.z);
              const pitch = -Math.atan2(tmpLocalEarth.y, Math.max(0.001, horizLen));
              lander.commsDishElevation.rotation.x +=
                (pitch - lander.commsDishElevation.rotation.x) * 0.14;
            }
          }

          if (lander.beaconMesh) {
            const pulse = 0.55 + 0.45 * Math.sin(elapsed * 3.8);
            lander.beaconMesh.scale.setScalar(0.85 + pulse * 0.4);
          }

          if (lander.commsDishElevation) {
            lander.commsDishElevation.getWorldPosition(tmpDishWorld);
          } else {
            tmpDishWorld.set(1.55, landerBaseY + 6.7, 0);
          }

          // Hop 2 Telemetry (Artemis Lander -> Earth Direct-to-Earth)
          if (step.earth_visible) {
            refs.dteLineSolid.visible = true;
            refs.dteLineDashed.visible = false;
            refs.dtePulseMesh.visible = true;

            tmpTargetPos.copy(tmpDishWorld).addScaledVector(earthDir, earthDist);
            const posArr = refs.dteLineSolid.geometry.attributes.position as THREE.BufferAttribute;
            posArr.setXYZ(0, tmpDishWorld.x, tmpDishWorld.y, tmpDishWorld.z);
            posArr.setXYZ(1, tmpTargetPos.x, tmpTargetPos.y, tmpTargetPos.z);
            posArr.needsUpdate = true;

            const tPulse = (elapsed * 0.55) % 1;
            refs.dtePulseMesh.position.lerpVectors(
              tmpDishWorld,
              tmpDishWorld.clone().addScaledVector(earthDir, 900),
              tPulse
            );
          } else {
            refs.dteLineSolid.visible = false;
            refs.dteLineDashed.visible = true;
            refs.dtePulseMesh.visible = false;

            tmpTargetPos.copy(tmpDishWorld).addScaledVector(earthDir, 350);
            const posArr = refs.dteLineDashed.geometry.attributes.position as THREE.BufferAttribute;
            posArr.setXYZ(0, tmpDishWorld.x, tmpDishWorld.y, tmpDishWorld.z);
            posArr.setXYZ(1, tmpTargetPos.x, tmpTargetPos.y, tmpTargetPos.z);
            posArr.needsUpdate = true;
            refs.dteLineDashed.computeLineDistances();
          }
        }
      }

      composer.render();
    };

    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onUserInteract);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      starGeo.dispose();
      starMat.dispose();
      earthTex.dispose();
      sunTex.dispose();
      moonAlbedoTex.dispose();
      moonBumpTex.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [sites]);

  // Update Terrain Mesh when terrain data changes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    if (refs.terrainMesh) {
      refs.scene.remove(refs.terrainMesh);
      refs.terrainGeo?.dispose();
      (refs.terrainMesh.material as THREE.Material).dispose();
      refs.terrainMesh = null;
      refs.terrainGeo = null;
    }

    if (refs.terrainSkirtMesh) {
      refs.scene.remove(refs.terrainSkirtMesh);
      refs.terrainSkirtMesh.geometry.dispose();
      (refs.terrainSkirtMesh.material as THREE.Material).dispose();
      refs.terrainSkirtMesh = null;
    }

    if (refs.boulderMesh) {
      refs.scene.remove(refs.boulderMesh);
      refs.boulderMesh.geometry.dispose();
      (refs.boulderMesh.material as THREE.Material).dispose();
      refs.boulderMesh = null;
    }

    if (refs.blenderOverlay) {
      refs.scene.remove(refs.blenderOverlay);
      refs.blenderOverlay = null;
    }

    const { geometry, centerNormal } = buildTerrainGeometry(terrain);
    applyTerrainColors(geometry, terrain, showSlopeHeatmap);

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    refs.scene.add(mesh);
    refs.terrainMesh = mesh;
    refs.terrainGeo = geometry;

    // 1. Large Circular Lunar Horizon Skirt (radius 25000m) to eliminate the floating square look
    let edgeElevSum = 0;
    let edgeCount = 0;
    const N = terrain.grid_size;
    for (let c = 0; c < N; c++) {
      edgeElevSum += (terrain.elevations[c] ?? terrain.center_elev_m) - terrain.center_elev_m;
      edgeElevSum += (terrain.elevations[(N - 1) * N + c] ?? terrain.center_elev_m) - terrain.center_elev_m;
      edgeCount += 2;
    }
    for (let r = 1; r < N - 1; r++) {
      edgeElevSum += (terrain.elevations[r * N] ?? terrain.center_elev_m) - terrain.center_elev_m;
      edgeElevSum += (terrain.elevations[r * N + (N - 1)] ?? terrain.center_elev_m) - terrain.center_elev_m;
      edgeCount += 2;
    }
    const avgEdgeElev = edgeCount > 0 ? edgeElevSum / edgeCount : 0;

    const innerRadius = Math.min(terrain.width_m, terrain.height_m) * 0.44;
    const outerRadius = 25000; // 25 km lunar horizon skirt
    const skirtGeo = new THREE.RingGeometry(innerRadius, outerRadius, 96, 16);
    skirtGeo.rotateX(-Math.PI / 2);

    const skirtPos = skirtGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < skirtPos.count; i++) {
      const sx = skirtPos.getX(i);
      const sz = skirtPos.getZ(i);
      const r = Math.hypot(sx, sz);
      const d = Math.max(0, r - innerRadius);
      // Realistic lunar curvature drop: delta_h = -(d^2) / (2 * R_moon)
      const curvDrop = -(d * d) / (2 * 1737400);
      skirtPos.setY(i, avgEdgeElev + curvDrop - 0.5);
    }
    skirtPos.needsUpdate = true;
    skirtGeo.computeVertexNormals();

    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x16191f, // Dark lunar regolith matching radial fade
      roughness: 0.96,
      metalness: 0.04,
      flatShading: false,
    });
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.receiveShadow = true;
    skirtMesh.castShadow = false;
    skirtMesh.visible = missionViewModeRef.current !== 'moon_globe';
    refs.scene.add(skirtMesh);
    refs.terrainSkirtMesh = skirtMesh;

    // 2. Realistic Angular Lunar Boulder Field (low-poly Dodecahedron, clustered & sunk 35-45% into regolith)
    const rockCount = 60; // 50% rock count reduction
    const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x47505d,
      roughness: 0.94,
      metalness: 0.06,
      flatShading: true,
    });
    const boulderMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    boulderMesh.castShadow = true;
    boulderMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const rockSeed = terrain.lat_deg * 1000 + terrain.lon_deg;
    const pseudoRng = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    let placed = 0;
    let clusterIdx = 0;
    while (placed < rockCount && clusterIdx < 35) {
      clusterIdx++;
      const cAngle = pseudoRng(rockSeed + clusterIdx * 1.7) * Math.PI * 2;
      const cDist = 18 + pseudoRng(rockSeed + clusterIdx * 3.3) * 135; // 18m to 153m away
      const cx = Math.cos(cAngle) * cDist;
      const cz = Math.sin(cAngle) * cDist;

      // 1. Primary large boulder in this cluster
      const largeRadius = 0.9 + pseudoRng(rockSeed + clusterIdx * 5.1) * 1.5;
      const largeGroundY = getTerrainElevationAt(terrain, cx, cz);
      const largeSinkRatio = 0.35 + pseudoRng(rockSeed + clusterIdx * 6.2) * 0.10; // 35% to 45% sunk
      const largeY = largeGroundY - largeRadius * largeSinkRatio;

      dummy.position.set(cx, largeY, cz);
      dummy.rotation.set(
        pseudoRng(rockSeed + clusterIdx * 7.1) * Math.PI,
        pseudoRng(rockSeed + clusterIdx * 8.3) * Math.PI,
        pseudoRng(rockSeed + clusterIdx * 9.5) * Math.PI
      );
      // Randomized non-uniform scaling (approx 1.3, 0.55, 0.9)
      dummy.scale.set(
        largeRadius * (1.15 + pseudoRng(rockSeed + clusterIdx * 10.1) * 0.35),
        largeRadius * (0.48 + pseudoRng(rockSeed + clusterIdx * 11.2) * 0.15),
        largeRadius * (0.80 + pseudoRng(rockSeed + clusterIdx * 12.3) * 0.25)
      );
      dummy.updateMatrix();
      boulderMesh.setMatrixAt(placed, dummy.matrix);
      placed++;

      // 2. Satellite cluster rocks (3 to 5 small rocks clustered near the large boulder)
      const satelliteCount = Math.min(
        rockCount - placed,
        3 + Math.floor(pseudoRng(rockSeed + clusterIdx * 13.7) * 3)
      );

      for (let s = 0; s < satelliteCount; s++) {
        const sSubSeed = clusterIdx * 40 + s;
        const sOffsetAngle = pseudoRng(rockSeed + sSubSeed * 2.1) * Math.PI * 2;
        const sOffsetDist = 2.0 + pseudoRng(rockSeed + sSubSeed * 3.5) * 5.0;
        const sxPos = cx + Math.cos(sOffsetAngle) * sOffsetDist;
        const szPos = cz + Math.sin(sOffsetAngle) * sOffsetDist;

        if (Math.hypot(sxPos, szPos) < 15.0) continue; // Keep 15m clear landing pad radius

        const sRadius = 0.25 + pseudoRng(rockSeed + sSubSeed * 4.7) * 0.50;
        const sGroundY = getTerrainElevationAt(terrain, sxPos, szPos);
        const sSinkRatio = 0.35 + pseudoRng(rockSeed + sSubSeed * 5.9) * 0.10;
        const sY = sGroundY - sRadius * sSinkRatio;

        dummy.position.set(sxPos, sY, szPos);
        dummy.rotation.set(
          pseudoRng(rockSeed + sSubSeed * 6.3) * Math.PI,
          pseudoRng(rockSeed + sSubSeed * 7.7) * Math.PI,
          pseudoRng(rockSeed + sSubSeed * 8.9) * Math.PI
        );
        dummy.scale.set(
          sRadius * (1.15 + pseudoRng(rockSeed + sSubSeed * 9.1) * 0.35),
          sRadius * (0.48 + pseudoRng(rockSeed + sSubSeed * 10.3) * 0.15),
          sRadius * (0.80 + pseudoRng(rockSeed + sSubSeed * 11.5) * 0.25)
        );
        dummy.updateMatrix();
        boulderMesh.setMatrixAt(placed, dummy.matrix);
        placed++;
        if (placed >= rockCount) break;
      }
    }
    boulderMesh.instanceMatrix.needsUpdate = true;
    boulderMesh.visible = missionViewModeRef.current !== 'moon_globe';
    refs.scene.add(boulderMesh);
    refs.boulderMesh = boulderMesh;

    if (refs.landerRig) {
      const up = new THREE.Vector3(0, 1, 0);
      refs.landerRig.root.quaternion.setFromUnitVectors(up, centerNormal);
      const ground = sampleVisibleGroundY(refs, terrain, 0, 0);
      refs.landerRig.root.position.set(0, ground.y - 0.04, 0);
      refs.landerRig.root.updateMatrixWorld(true);
    }

    let cancelled = false;
    if (terrain.glb_url) {
      (async () => {
        try {
          const res = await fetch(terrain.glb_url!);
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || ct.includes('text/html') || cancelled) return;
          const buf = await res.arrayBuffer();
          if (cancelled || !sceneRefs.current) return;
          new GLTFLoader().parse(buf, '/', (gltf) => {
            if (cancelled || !sceneRefs.current) return;
            const obj = gltf.scene;
            obj.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
              }
            });
            obj.updateMatrixWorld(true);
            sceneRefs.current.scene.add(obj);
            sceneRefs.current.blenderOverlay = obj;
            const heatmapActive = showSlopeHeatmapRef.current;
            obj.visible = !heatmapActive;
            if (sceneRefs.current.terrainMesh) {
              sceneRefs.current.terrainMesh.visible = heatmapActive;
            }
          });
        } catch {}
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [terrain]);

  // Update vertex colors when slope heatmap toggles
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.terrainGeo) return;
    applyTerrainColors(refs.terrainGeo, terrain, showSlopeHeatmap);
    const colAttr = refs.terrainGeo.attributes.color as THREE.BufferAttribute | undefined;
    if (colAttr) colAttr.needsUpdate = true;
    if (refs.blenderOverlay) {
      refs.blenderOverlay.visible = !showSlopeHeatmap;
      if (refs.terrainMesh) {
        refs.terrainMesh.visible = showSlopeHeatmap;
      }
    } else if (refs.terrainMesh) {
      refs.terrainMesh.visible = true;
    }
  }, [showSlopeHeatmap, terrain]);

  // Camera preset transitions
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    if (missionViewMode === 'moon_globe') {
      refs.controls.maxPolarAngle = Math.PI; // Full spherical exploration
      refs.controls.minDistance = 145;
      refs.controls.maxDistance = 1500;
      // Focus directly on the chosen site on the Moon sphere
      const sitePos = selenographicToCartesian(selectedSite.lat_deg, selectedSite.lon_deg, 140);
      const camNorm = sitePos.clone().normalize();
      const camPos = camNorm.clone().multiplyScalar(300);
      refs.camAnim.targetPos.copy(camPos);
      refs.camAnim.targetLook.copy(sitePos.clone().multiplyScalar(0.75));
      refs.camAnim.active = true;
      return;
    }

    refs.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Keep camera strictly above terrain
    refs.controls.minDistance = 6;
    refs.controls.maxDistance = 420; // Never zoom out past terrain

    const dFrustum = 350;
    refs.sunLight.shadow.camera.left = -dFrustum;
    refs.sunLight.shadow.camera.right = dFrustum;
    refs.sunLight.shadow.camera.top = dFrustum;
    refs.sunLight.shadow.camera.bottom = -dFrustum;
    refs.sunLight.shadow.bias = -0.0004;
    refs.sunLight.shadow.normalBias = 0.025;
    refs.sunLight.shadow.camera.updateProjectionMatrix();

    const groundY = sampleVisibleGroundY(refs, terrainRef.current, 0, 0).y;

    // Camera Framing for LANDER & ROVER OPS vs SURFACE HORIZON PLANNER
    if (roverState === 'traversing' || roverState === 'deploying' || cameraPreset === 'lander') {
      // LANDER & ROVER OPS: Close operational angle filling the center of the viewport
      refs.camAnim.targetPos.set(18, groundY + 9, 18);
      refs.camAnim.targetLook.set(3, groundY + 1.2, 0);
    } else if (cameraPreset === 'rover') {
      // Lunar rover close chase camera
      if (refs.roverController) {
        const roverPos = refs.roverController.rig.root.position;
        refs.camAnim.targetPos.set(roverPos.x - 8, roverPos.y + 4.5, roverPos.z + 8);
        refs.camAnim.targetLook.set(roverPos.x, roverPos.y + 1.2, roverPos.z);
      }
    } else if (cameraPreset === 'orbital') {
      refs.camAnim.targetPos.set(-280, groundY + 160, 320);
      refs.camAnim.targetLook.set(0, groundY, 0);
    } else {
      // SURFACE HORIZON PLANNER: Wide horizon-level overview
      refs.camAnim.targetPos.set(0, groundY + 28, 85);
      refs.camAnim.targetLook.set(0, groundY + 2, 0);
    }
    refs.camAnim.active = true;
  }, [cameraPreset, cameraPresetTrigger, missionViewMode, roverState, selectedSite]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 3D Moon Globe Pre-Launch Selector Overlay Card */}
      {missionViewMode === 'moon_globe' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-auto bg-[#0B111C]/90 border border-sky-400/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl max-w-md w-full text-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-sky-400/20 pb-2">
            <div>
              <div className="text-[10px] font-mono-tech uppercase text-sky-400 tracking-wider">
                PRE-LAUNCH 3D MOON SITE SELECTOR
              </div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                {selectedGlobeSite.name}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs px-2 py-0.5 rounded font-mono-tech bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {selectedGlobeSite.lat_deg.toFixed(2)}°S, {selectedGlobeSite.lon_deg.toFixed(2)}°E
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {selectedGlobeSite.mission_context}
          </p>

          <div className="flex items-center justify-between text-xs font-mono-tech bg-slate-900/80 rounded-lg p-2 border border-slate-700/60">
            <span className="text-slate-400">SCIENCE TARGET:</span>
            <span className="text-sky-300">{selectedGlobeSite.science_highlight}</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onSelectSite(selectedGlobeSite);
                if (onInitiateLanding) onInitiateLanding();
              }}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-bold text-xs font-mono-tech uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)] cursor-pointer"
            >
              🚀 INITIATE POWERED DESCENT AT THIS SITE
            </button>
          </div>
        </div>
      )}

      {/* Powered Descent Landing HUD Badge */}
      {missionViewMode === 'cockpit' && landingState === 'descending' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-amber-950/90 border border-amber-500/60 text-amber-200 text-xs font-mono-tech shadow-2xl backdrop-blur-xl animate-pulse">
          <span className="font-bold tracking-widest text-sm text-amber-300">
            🔥 POWERED DESCENT BRAKING BURN ACTIVE
          </span>
          <span className="text-[11px] text-amber-100/90">
            RETRO-THRUSTER EXHAUST FIRING · ALTITUDE DECELERATION TO TOUCHDOWN
          </span>
        </div>
      )}


    </div>
  );
};
