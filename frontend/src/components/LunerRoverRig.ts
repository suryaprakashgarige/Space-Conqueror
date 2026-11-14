import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoverState, RoverTelemetry, TerrainData } from '../types/lunar';

export interface LunarRoverRig {
  root: THREE.Group;
  chassis: THREE.Object3D;
  leftHeadlight: THREE.SpotLight;
  rightHeadlight: THREE.SpotLight;
  leftHeadlightTarget: THREE.Object3D;
  rightHeadlightTarget: THREE.Object3D;
  headlightLenses: THREE.Mesh[];
  proximityLight: THREE.PointLight;
  solarPanels: THREE.Mesh[];
  antennaTip: THREE.Object3D;
}

export type MarsRoverRig = LunarRoverRig;
export type LunerRoverRig = LunarRoverRig;

export function buildProceduralLunarRover(): LunarRoverRig {
  const root = new THREE.Group();
  root.name = 'LunarPolarScoutRoverRoot';

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.65,
    roughness: 0.35,
  });

  const darkWheelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.82,
    roughness: 0.28,
  });

  const goldThermalMat = new THREE.MeshStandardMaterial({
    color: 0xd99b26,
    metalness: 0.85,
    roughness: 0.28,
  });

  const lensOffMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.2,
  });

  const chassis = new THREE.Group();
  chassis.name = 'Chassis';

  // Fuselage body
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.95, 2.0), titaniumMat);
  body.position.y = 1.05;
  body.castShadow = true;
  body.receiveShadow = true;
  chassis.add(body);

  const avionics = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 1.7), goldThermalMat);
  avionics.position.set(-0.2, 1.6, 0);
  avionics.castShadow = true;
  chassis.add(avionics);

  // Solar panels are natively part of the user's CAD design (no extra procedural overlay)
  const solarPanels: THREE.Mesh[] = [];

  // Front Navigation Mast & Sensor Head (+X is forward)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.35, 10), titaniumMat);
  mast.position.set(1.4, 1.95, 0.45);
  mast.castShadow = true;
  chassis.add(mast);

  const sensorHead = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.4), darkWheelMat);
  sensorHead.position.set(1.4, 2.65, 0.45);
  sensorHead.castShadow = true;
  chassis.add(sensorHead);

  // Antenna Mast for Telemetry Relay (Rear +Z side)
  const antennaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 8), darkWheelMat);
  antennaMast.position.set(-1.2, 2.1, -0.75);
  chassis.add(antennaMast);

  const antennaTip = new THREE.Object3D();
  antennaTip.position.set(-1.2, 2.9, -0.75);
  chassis.add(antennaTip);

  // 6 Rocker-Bogie Heavy-Duty Lunar Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.44, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelPositions: [number, number, number][] = [
    [1.5, 0.48, -1.25],
    [1.5, 0.48, 1.25],
    [0.0, 0.48, -1.35],
    [0.0, 0.48, 1.35],
    [-1.5, 0.48, -1.25],
    [-1.5, 0.48, 1.25],
  ];

  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, darkWheelMat);
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    chassis.add(wheel);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.46, 12), titaniumMat);
    hub.position.set(wx, wy, wz);
    hub.rotation.x = Math.PI / 2;
    chassis.add(hub);
  }

  // Front Bumper Dual Headlights (+X forward)
  const headlightLenses: THREE.Mesh[] = [];
  const lensGeo = new THREE.SphereGeometry(0.12, 16, 16);

  const leftLens = new THREE.Mesh(lensGeo, lensOffMat.clone());
  leftLens.position.set(1.82, 1.05, -0.65);
  chassis.add(leftLens);
  headlightLenses.push(leftLens);

  const rightLens = new THREE.Mesh(lensGeo, lensOffMat.clone());
  rightLens.position.set(1.82, 1.05, 0.65);
  chassis.add(rightLens);
  headlightLenses.push(rightLens);

  const leftHeadlightTarget = new THREE.Object3D();
  leftHeadlightTarget.position.set(16, 0.2, -0.65);
  chassis.add(leftHeadlightTarget);

  const leftHeadlight = new THREE.SpotLight('#fef08a', 4.5, 60, Math.PI / 4, 0.45);
  leftHeadlight.position.set(1.85, 1.05, -0.65);
  leftHeadlight.target = leftHeadlightTarget;
  leftHeadlight.castShadow = true;
  chassis.add(leftHeadlight);

  const rightHeadlightTarget = new THREE.Object3D();
  rightHeadlightTarget.position.set(16, 0.2, 0.65);
  chassis.add(rightHeadlightTarget);

  const rightHeadlight = new THREE.SpotLight('#fef08a', 4.5, 60, Math.PI / 4, 0.45);
  rightHeadlight.position.set(1.85, 1.05, 0.65);
  rightHeadlight.target = rightHeadlightTarget;
  rightHeadlight.castShadow = true;
  chassis.add(rightHeadlight);

  const proximityLight = new THREE.PointLight('#fef08a', 2.0, 18, 1.2);
  proximityLight.position.set(0.5, 1.6, 0);
  chassis.add(proximityLight);

  root.add(chassis);

  return {
    root,
    chassis,
    leftHeadlight,
    rightHeadlight,
    leftHeadlightTarget,
    rightHeadlightTarget,
    headlightLenses,
    proximityLight,
    solarPanels,
    antennaTip,
  };
}

/**
 * Predefined science exploration route with distinct geological survey stations.
 * The rover traverses sequentially through these points rather than in a simple circle.
 */
export const EXPLORATION_WAYPOINTS: { x: number; z: number; label: string }[] = [
  { x: 5.2, z: 0.0, label: 'Lander Ramp Egress' },
  { x: 18.0, z: 9.0, label: 'Station 1: Regolith Core Drilling' },
  { x: 36.0, z: 22.0, label: 'Station 2: Ejecta Blanket Survey' },
  { x: 54.0, z: 12.0, label: 'Station 3: East Crater Rim Crest' },
  { x: 62.0, z: -16.0, label: 'Station 4: Shadow Boundary Transect' },
  { x: 44.0, z: -38.0, label: 'Station 5: PSR Volatile Cold Trap' },
  { x: 22.0, z: -30.0, label: 'Station 6: Basalt Boulder Field' },
  { x: 8.0, z: -14.0, label: 'Station 7: Intermediate Uplink Outpost' },
  { x: -14.0, z: -18.0, label: 'Station 8: West Ridge Stratigraphy' },
  { x: -38.0, z: -8.0, label: 'Station 9: Anorthosite Outcrop' },
  { x: -48.0, z: 18.0, label: 'Station 10: Pyroclastic Deposit Recon' },
  { x: -28.0, z: 32.0, label: 'Station 11: North Escarpment View' },
  { x: -8.0, z: 16.0, label: 'Station 12: Lander Rendezvous Leg' },
  { x: 5.2, z: 0.0, label: 'Return to Artemis Lander' },
];

/**
 * Computes exact ground surface elevation at (x, z) using bilinear interpolation
 * of the digital elevation model grid.
 * Guarantees rover wheels never sink below the terrain surface.
 */
export function getTerrainElevationAt(terrain: TerrainData | null, x: number, z: number): number {
  if (!terrain || !terrain.elevations || terrain.elevations.length === 0) return 0;
  const N = terrain.grid_size;
  const halfW = terrain.width_m / 2;
  const halfH = terrain.height_m / 2;

  const u = Math.max(0, Math.min(N - 1, ((x + halfW) / terrain.width_m) * (N - 1)));
  const v = Math.max(0, Math.min(N - 1, ((z + halfH) / terrain.height_m) * (N - 1)));

  const c0 = Math.floor(u);
  const c1 = Math.min(N - 1, c0 + 1);
  const r0 = Math.floor(v);
  const r1 = Math.min(N - 1, r0 + 1);

  const du = u - c0;
  const dv = v - r0;

  const e00 = terrain.elevations[r0 * N + c0] ?? terrain.center_elev_m;
  const e10 = terrain.elevations[r0 * N + c1] ?? terrain.center_elev_m;
  const e01 = terrain.elevations[r1 * N + c0] ?? terrain.center_elev_m;
  const e11 = terrain.elevations[r1 * N + c1] ?? terrain.center_elev_m;

  const top = e00 * (1 - du) + e10 * du;
  const bot = e01 * (1 - du) + e11 * du;
  const rawElev = top * (1 - dv) + bot * dv;

  // Ground surface Y relative to center datum (zero floating, zero underground clipping)
  return rawElev - terrain.center_elev_m;
}

export class LunarRoverController {
  public rig: LunarRoverRig;
  public rampMesh: THREE.Mesh;
  public isGlbLoaded: boolean = false;

  private deployProgress: number = 0;
  private currentWaypointIdx: number = 0;
  private waypointProgress: number = 0;
  private waypointPauseSec: number = 0;

  // Realistic Battery Model (0 - 100%)
  private batteryPct: number = 88.0;
  private isBatteryDepleted: boolean = false;

  constructor() {
    this.rig = buildProceduralLunarRover();

    // Deployment ramp connects lander egress hatch to lunar regolith
    const rampGeo = new THREE.BoxGeometry(3.6, 0.08, 1.8);
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.7,
      roughness: 0.35,
    });
    this.rampMesh = new THREE.Mesh(rampGeo, rampMat);
    this.rampMesh.position.set(3.5, 0.55, 0);
    this.rampMesh.rotation.z = -0.308;
    this.rampMesh.castShadow = true;
    this.rampMesh.receiveShadow = true;

    this.loadGlbAsset();
  }

  private async loadGlbAsset() {
    const urls = ['/assets/lunerrover.glb', '/assets/lunar_rover.glb', '/assets/mars_rover.glb'];
    for (const url of urls) {
      try {
        const res = await fetch(url, { method: 'GET' });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || ct.includes('text/html')) continue;
        const buf = await res.arrayBuffer();

        const loader = new GLTFLoader();
        loader.parse(
          buf,
          '/assets/',
          (gltf) => {
            const model = gltf.scene;
            model.name = 'LunarPolarScoutRoverGLB';
            model.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            // Hide all procedural geometry when authentic CAD model loads
            this.rig.chassis.children.forEach((c) => {
              if (
                c !== model &&
                c !== this.rig.leftHeadlight &&
                c !== this.rig.rightHeadlight &&
                c !== this.rig.leftHeadlightTarget &&
                c !== this.rig.rightHeadlightTarget &&
                c !== this.rig.proximityLight
              ) {
                c.visible = false;
              }
            });
            model.position.set(0, 0, 0);
            this.rig.chassis.add(model);
            this.isGlbLoaded = true;
          }
        );
        break;
      } catch {}
    }
  }

  public update(
    deltaSec: number,
    _elapsedSec: number,
    roverState: RoverState,
    isDarkness: boolean,
    terrain: TerrainData | null,
    earthVisible: boolean,
    landerPosY?: number,
    sampleGroundY?: (x: number, z: number) => number
  ): RoverTelemetry {
    let speed = 0;
    let effectiveState = roverState;

    const getGround = (x: number, z: number) => {
      if (sampleGroundY) return sampleGroundY(x, z);
      return getTerrainElevationAt(terrain, x, z);
    };

    // Dynamically anchor deployment ramp between lander hatch and visible regolith
    const hatchBaseY = landerPosY !== undefined ? landerPosY : getGround(0, 0);
    const hatchX = 1.85;
    const hatchY = hatchBaseY + 1.15;
    const rampEndX = 5.2;
    const rampEndGroundY = getGround(rampEndX, 0) - 0.02; // sink 2cm into regolith dust
    const dx = rampEndX - hatchX;
    const dy = rampEndGroundY - hatchY;
    const rampDist = Math.hypot(dx, dy);
    const rampPitch = Math.atan2(dy, dx);
    this.rampMesh.position.set((hatchX + rampEndX) / 2, (hatchY + rampEndGroundY) / 2, 0);
    this.rampMesh.rotation.z = rampPitch;
    this.rampMesh.scale.set(rampDist / 3.6, 1, 1);

    // -- Battery Charge & Discharge Simulation --
    if (isDarkness) {
      // In darkness/shadow: No solar charging. Drains from driving & headlights.
      const drainRate = effectiveState === 'traversing' ? 2.4 : 0.45;
      this.batteryPct = Math.max(0, this.batteryPct - drainRate * deltaSec);
      if (this.batteryPct <= 0.5) {
        this.isBatteryDepleted = true;
      }
    } else {
      // In sunlight: Solar panels generate power and charge the battery.
      const chargeRate = 4.8;
      this.batteryPct = Math.min(100, this.batteryPct + chargeRate * deltaSec);
      if (this.batteryPct >= 12.0) {
        this.isBatteryDepleted = false;
      }
    }

    // If battery is depleted and in darkness, stop the rover!
    if (this.isBatteryDepleted && effectiveState === 'traversing') {
      effectiveState = 'stopped';
    }

    if (effectiveState === 'stowed') {
      this.deployProgress = 0;
      this.currentWaypointIdx = 0;
      this.waypointProgress = 0;
      // Stowed flush on the ground at egress ramp landing point (zero floating)
      const parkX = 5.4;
      const parkZ = 0.0;
      const parkY = getGround(parkX, parkZ) - 0.04;
      this.rig.root.position.set(parkX, parkY, parkZ);
      this.rig.root.rotation.set(0, 0, 0);
      speed = 0;
    } else if (effectiveState === 'deploying') {
      this.rampMesh.visible = true;
      this.deployProgress = Math.min(1.0, this.deployProgress + deltaSec * 0.45);
      const curX = hatchX + (rampEndX - hatchX) * this.deployProgress;
      const rampY = hatchY + (rampEndGroundY - hatchY) * this.deployProgress;
      const groundY = getGround(curX, 0) - 0.04;
      const curY = Math.max(groundY, rampY);
      const tilt = rampPitch * (1.0 - this.deployProgress);
      this.rig.root.position.set(curX, curY, 0);
      this.rig.root.rotation.set(0, 0, tilt);
      speed = 0.8;
      if (this.deployProgress >= 1.0) {
        effectiveState = 'traversing';
      }
    } else if (effectiveState === 'traversing') {
      this.rampMesh.visible = true;

      // Science station pause countdown
      if (this.waypointPauseSec > 0) {
        this.waypointPauseSec -= deltaSec;
        speed = 0;
      } else {
        speed = 1.35; // m/s cruise speed

        const wpA = EXPLORATION_WAYPOINTS[this.currentWaypointIdx];
        const wpB =
          EXPLORATION_WAYPOINTS[(this.currentWaypointIdx + 1) % EXPLORATION_WAYPOINTS.length];

        const dx = wpB.x - wpA.x;
        const dz = wpB.z - wpA.z;
        const segLen = Math.hypot(dx, dz);

        this.waypointProgress += (speed * deltaSec) / Math.max(0.1, segLen);

        if (this.waypointProgress >= 1.0) {
          this.currentWaypointIdx =
            (this.currentWaypointIdx + 1) % EXPLORATION_WAYPOINTS.length;
          this.waypointProgress = 0;
          this.waypointPauseSec = 2.0; // 2s pause to perform analysis
        }

        const t = Math.min(1.0, this.waypointProgress);
        const curX = wpA.x + dx * t;
        const curZ = wpA.z + dz * t;

        // Exact terrain elevation from ground sampler (zero clipping, zero floating)
        const curY = getGround(curX, curZ) - 0.04;

        // Forward sample for slope pitch
        const fwdDist = 2.5;
        const heading = Math.atan2(dz, dx);
        const fwdX = curX + Math.cos(heading) * fwdDist;
        const fwdZ = curZ + Math.sin(heading) * fwdDist;
        const fwdY = getGround(fwdX, fwdZ) - 0.04;
        const pitch = Math.atan2(fwdY - curY, fwdDist);

        this.rig.root.position.set(curX, curY, curZ);
        this.rig.root.rotation.set(pitch * 0.7, -heading, 0);
      }
    } else {
      // 'stopped': holds position exactly on terrain surface
      speed = 0;
      const curPos = this.rig.root.position;
      curPos.y = getGround(curPos.x, curPos.z) - 0.04;
    }

    // Auto Headlights: snap ON in darkness/shadow, standby in sunlight
    const targetHeadlightIntensity = isDarkness ? 4.8 : 0.15;
    const targetProximityIntensity = isDarkness ? 2.2 : 0.2;

    this.rig.leftHeadlight.intensity +=
      (targetHeadlightIntensity - this.rig.leftHeadlight.intensity) * 0.15;
    this.rig.rightHeadlight.intensity +=
      (targetHeadlightIntensity - this.rig.rightHeadlight.intensity) * 0.15;
    this.rig.proximityLight.intensity +=
      (targetProximityIntensity - this.rig.proximityLight.intensity) * 0.15;

    const lensGlowColor = isDarkness ? 0xfffae6 : 0x334155;
    for (const lens of this.rig.headlightLenses) {
      const mat = lens.material as THREE.MeshStandardMaterial;
      mat.color.setHex(lensGlowColor);
      mat.emissive.setHex(isDarkness ? 0xfef08a : 0x000000);
      mat.emissiveIntensity = isDarkness ? 0.95 : 0.0;
    }

    const pos = this.rig.root.position;
    const distToLander = Math.hypot(pos.x, pos.z);

    const hop1MarginDb = Math.max(6.0, 22.0 - (distToLander / 50) * 8.0);
    const hop2MarginDb = earthVisible ? 14.8 : -12.0;
    const isCharging = !isDarkness && this.batteryPct < 100;

    return {
      state: effectiveState,
      x: Number(pos.x.toFixed(2)),
      z: Number(pos.z.toFixed(2)),
      distance_m: Number(distToLander.toFixed(1)),
      speed_mps: Number(speed.toFixed(2)),
      headlightsOn: isDarkness,
      solarPanelExposurePct: isDarkness ? 0 : 94,
      batteryPct: Number(this.batteryPct.toFixed(1)),
      isCharging,
      hop1MarginDb: Number(hop1MarginDb.toFixed(1)),
      hop2MarginDb: Number(hop2MarginDb.toFixed(1)),
      dualHopOnline: hop1MarginDb > 0 && hop2MarginDb > 0,
    };
  }
}

// Backward-compatible aliases for mission planner
export {
  LunarRoverController as MarsRoverController,
  LunarRoverController as LunerRoverController,
  buildProceduralLunarRover as buildProceduralMarsRover,
  buildProceduralLunarRover as buildProceduralLunerRover,
};
