import {
  BackupRecommendation,
  CandidateSite,
  ComparisonResult,
  HorizonBin,
  SimulationResult,
  SimulationSummary,
  TelemetryStep,
  TerrainData,
} from '../types/lunar';
import { CANDIDATE_SITES } from '../data/fallbackSites';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const R_MOON_KM = 1737.4;
const R_MOON_M = 1737400.0;
const MEAN_EARTH_DIST_KM = 384400.0;
const MOON_OBLIQUITY_DEG = 1.5427;
const SYNODIC_MONTH_DAYS = 29.530589;
const DRACONIC_YEAR_DAYS = 346.620075;
const NODAL_MONTH_DAYS = 27.212221;
const ANOMALISTIC_MONTH_DAYS = 27.55455;

// Reference epoch: 2026-10-15T00:00:00Z (southern lunar summer approaching peak grazing light)
const REF_EPOCH_MS = Date.UTC(2026, 9, 15, 0, 0, 0);

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap360(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

export function computeSelenocentricSunUnitVector(utcMs: number): [number, number, number] {
  const days = (utcMs - REF_EPOCH_MS) / 86400000;
  // Subsolar latitude oscillates +/- 1.54 deg (negative = South Pole summer illumination)
  const subLatRad =
    (-MOON_OBLIQUITY_DEG * Math.cos((2 * Math.PI * (days - 45)) / DRACONIC_YEAR_DAYS)) * DEG2RAD;
  // Subsolar longitude sweeps westward 360 deg per synodic month
  const subLonRad = (-((days / SYNODIC_MONTH_DAYS) * 360 + 25)) * DEG2RAD;

  const x = Math.cos(subLatRad) * Math.cos(subLonRad);
  const y = Math.cos(subLatRad) * Math.sin(subLonRad);
  const z = Math.sin(subLatRad);
  const norm = Math.hypot(x, y, z);
  return norm > 0 ? [x / norm, y / norm, z / norm] : [x, y, z];
}

export function computeSelenocentricEarthUnitVector(utcMs: number): [number, number, number] {
  const days = (utcMs - REF_EPOCH_MS) / 86400000;
  // Optical libration in latitude: +/- 6.68 deg with draconic/nodal period (27.212 d)
  const subLatRad = (6.68 * Math.sin((2 * Math.PI * days) / NODAL_MONTH_DAYS + 0.4)) * DEG2RAD;
  // Optical libration in longitude: +/- 7.85 deg with anomalistic period (27.555 d)
  const subLonRad = (7.85 * Math.sin((2 * Math.PI * days) / ANOMALISTIC_MONTH_DAYS + 1.15)) * DEG2RAD;

  const x = Math.cos(subLatRad) * Math.cos(subLonRad);
  const y = Math.cos(subLatRad) * Math.sin(subLonRad);
  const z = Math.sin(subLatRad);
  const norm = Math.hypot(x, y, z);
  return norm > 0 ? [x / norm, y / norm, z / norm] : [x, y, z];
}

export function computeTopocentricAzEl(
  obsLatDeg: number,
  obsLonDeg: number,
  unitVec: [number, number, number],
  distanceKm: number = 1.496e8
): { az_deg: number; el_deg: number } {
  const phi = obsLatDeg * DEG2RAD;
  const lam = obsLonDeg * DEG2RAD;

  // Local ENU orthonormal basis at observer (East, North, Up)
  const up = [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)];
  const north = [-Math.sin(phi) * Math.cos(lam), -Math.sin(phi) * Math.sin(lam), Math.cos(phi)];
  const east = [-Math.sin(lam), Math.cos(lam), 0];

  // Target position and observer topocentric offset (parallax)
  const tx = unitVec[0] * distanceKm - up[0] * R_MOON_KM;
  const ty = unitVec[1] * distanceKm - up[1] * R_MOON_KM;
  const tz = unitVec[2] * distanceKm - up[2] * R_MOON_KM;
  const dist = Math.hypot(tx, ty, tz);
  const ux = dist > 0 ? tx / dist : unitVec[0];
  const uy = dist > 0 ? ty / dist : unitVec[1];
  const uz = dist > 0 ? tz / dist : unitVec[2];

  const sinEl = Math.max(-1, Math.min(1, ux * up[0] + uy * up[1] + uz * up[2]));
  const elRad = Math.asin(sinEl);

  const nComp = ux * north[0] + uy * north[1] + uz * north[2];
  const eComp = ux * east[0] + uy * east[1] + uz * east[2];
  const azDeg = wrap360(Math.atan2(eComp, nComp) * RAD2DEG);

  return {
    az_deg: Number(azDeg.toFixed(2)),
    el_deg: Number((elRad * RAD2DEG).toFixed(2)),
  };
}

export function computeSunDirection(
  latDeg: number,
  lonDeg: number,
  utcMs: number
): { az_deg: number; el_deg: number } {
  const sunVec = computeSelenocentricSunUnitVector(utcMs);
  return computeTopocentricAzEl(latDeg, lonDeg, sunVec, 1.496e8);
}

export function computeEarthDirection(
  latDeg: number,
  lonDeg: number,
  utcMs: number
): { az_deg: number; el_deg: number } {
  const earthVec = computeSelenocentricEarthUnitVector(utcMs);
  return computeTopocentricAzEl(latDeg, lonDeg, earthVec, MEAN_EARTH_DIST_KM);
}

interface CraterDef {
  cx: number;
  cz: number;
  radius: number;
  depth: number;
  rimHeight: number;
}

export function generateSiteTerrain(site: CandidateSite): TerrainData {
  const gridSize = 65;
  const widthM = 4000;
  const heightM = 4000;
  const halfW = widthM / 2;
  const step = widthM / (gridSize - 1);

  const seed = hashSeed(`${site.id}_${site.lat_deg.toFixed(2)}_${site.lon_deg.toFixed(2)}`);
  const rng = mulberry32(seed);

  // Build deterministic micro-craters outside the immediate landing pad (r > 130m)
  const craters: CraterDef[] = [];
  for (let i = 0; i < 28; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 220 + rng() * 1750;
    const radius = 75 + rng() * 290;
    const depth = radius * (0.14 + rng() * 0.08);
    craters.push({
      cx: Math.cos(angle) * dist,
      cz: Math.sin(angle) * dist,
      radius,
      depth,
      rimHeight: depth * 0.24,
    });
  }

  // Site-specific macro morphology
  const elevations = new Array<number>(gridSize * gridSize);
  const padRadius = site.id === 'mons_mouton' ? 420 : 190;

  for (let row = 0; row < gridSize; row++) {
    // row 0 = North (-Z), row N-1 = South (+Z)
    const z = -halfW + row * step;
    for (let col = 0; col < gridSize; col++) {
      const x = -halfW + col * step;
      const r = Math.hypot(x, z);
      let h = 0;

      if (site.id === 'shackleton_rim') {
        // Elevated rim ridge along WNW-ESE, steep drop into Shackleton crater to the East/South
        const ridge = 140 * Math.exp(-Math.pow((x * 0.6 + z * 0.8) / 720, 2));
        const craterDist = Math.hypot(x - 1650, z - 1250);
        const shackletonWall =
          craterDist < 1900 ? -680 * Math.pow(1 - craterDist / 1900, 1.55) : 0;
        h = 1850 + ridge + shackletonWall;
      } else if (site.id === 'mons_mouton') {
        // Broad flat-topped plateau with gentle outer slopes
        const plateau = r < 1150 ? 0 : -260 * Math.pow((r - 1150) / 1100, 1.45);
        h = 4200 + plateau + 24 * Math.sin(x * 0.0022) * Math.cos(z * 0.0021);
      } else if (site.id === 'malapert_massif') {
        // Commanding ridge crest running E-W, dropping southward and northward
        const crest = 340 * Math.exp(-Math.pow(z / 850, 2));
        const saddle = -90 * Math.sin(x * 0.0018);
        h = 4600 + crest + saddle;
      } else if (site.id === 'connecting_ridge') {
        // Narrow ridge linking Shackleton (-X) and de Gerlache (+X) with deep basins N and S
        const bridge = 280 * Math.exp(-Math.pow(z / 540, 2));
        const basins = -380 * Math.pow(Math.min(1, Math.abs(z) / 1650), 1.6);
        h = 2350 + bridge + basins;
      } else if (site.id === 'haworth_rim') {
        const slopeDown = z < -250 ? -420 * Math.pow((-z - 250) / 1750, 1.4) : 0;
        const ridge = 175 * Math.exp(-Math.pow((z + 100) / 750, 2));
        h = 1600 + ridge + slopeDown;
      } else if (site.id === 'nobile_rim') {
        const rimArc = 210 * Math.exp(-Math.pow((x - 120) / 880, 2));
        const basin = x > 650 ? -360 * Math.pow((x - 650) / 1450, 1.35) : 0;
        h = 1950 + rimArc + basin;
      } else {
        // Deterministic custom site morphology
        const phase = (seed % 360) * DEG2RAD;
        const rx = x * Math.cos(phase) - z * Math.sin(phase);
        const rz = x * Math.sin(phase) + z * Math.cos(phase);
        const ridge = 220 * Math.exp(-Math.pow(rz / 820, 2));
        const basin = rx > 400 ? -320 * Math.pow((rx - 400) / 1600, 1.5) : 0;
        h = 1800 + ridge + basin;
      }

      // Multi-octave deterministic regolith undulation (damped near landing pad)
      const padBlend = Math.min(1, Math.pow(r / padRadius, 1.4));
      const undulation =
        (22 * Math.sin(x * 0.0041 + seed * 0.01) * Math.cos(z * 0.0037) +
          10 * Math.sin((x + z) * 0.009) +
          4.5 * Math.cos((x - z) * 0.018)) *
        (0.28 + 0.72 * padBlend);
      h += undulation;

      // Bowl + raised ejecta rim craters
      for (const c of craters) {
        const dc = Math.hypot(x - c.cx, z - c.cz);
        const norm = dc / c.radius;
        if (norm < 1.0) {
          const bowl = -c.depth * (1 - norm * norm);
          const rim = c.rimHeight * Math.exp(-Math.pow((norm - 0.96) / 0.14, 2));
          h += (bowl + rim) * padBlend;
        } else if (norm < 1.45) {
          const rim = c.rimHeight * Math.exp(-Math.pow((norm - 0.96) / 0.14, 2));
          h += rim * padBlend;
        }
      }

      elevations[row * gridSize + col] = Number(h.toFixed(2));
    }
  }

  const centerIdx = Math.floor(gridSize / 2) * gridSize + Math.floor(gridSize / 2);
  const centerElev = elevations[centerIdx];

  // Compute slope_deg via central differences
  const slopes = new Array<number>(gridSize * gridSize);
  let sumSlope = 0;
  let maxSlope = 0;
  for (let row = 0; row < gridSize; row++) {
    const rPrev = Math.max(0, row - 1);
    const rNext = Math.min(gridSize - 1, row + 1);
    for (let col = 0; col < gridSize; col++) {
      const cPrev = Math.max(0, col - 1);
      const cNext = Math.min(gridSize - 1, col + 1);
      const dzdx =
        (elevations[row * gridSize + cNext] - elevations[row * gridSize + cPrev]) /
        ((cNext - cPrev) * step);
      const dzdz =
        (elevations[rNext * gridSize + col] - elevations[rPrev * gridSize + col]) /
        ((rNext - rPrev) * step);
      const slopeDeg = Math.atan(Math.hypot(dzdx, dzdz)) * RAD2DEG;
      const idx = row * gridSize + col;
      slopes[idx] = Number(slopeDeg.toFixed(2));
      sumSlope += slopeDeg;
      if (slopeDeg > maxSlope) maxSlope = slopeDeg;
    }
  }

  return {
    site_id: site.id,
    lat_deg: site.lat_deg,
    lon_deg: site.lon_deg,
    grid_size: gridSize,
    width_m: widthM,
    height_m: heightM,
    center_elev_m: Number(centerElev.toFixed(2)),
    elevations,
    slope_deg: slopes,
    mean_slope_deg: Number((sumSlope / slopes.length).toFixed(2)),
    max_slope_deg: Number(maxSlope.toFixed(2)),
    center_slope_deg: slopes[centerIdx],
    glb_url: site.is_custom ? undefined : `/assets/terrains/${site.id}.glb`,
  };
}

export function computeSolarDiskFraction(
  sunMarginDeg: number,
  radiusDeg: number = 0.266,
  u: number = 0.60
): number {
  if (sunMarginDeg >= radiusDeg) return 1.0;
  if (sunMarginDeg <= -radiusDeg) return 0.0;
  const y = Math.max(-1.0, Math.min(1.0, sunMarginDeg / radiusDeg));
  const term1 = (1.0 - u) * (y * Math.sqrt(Math.max(0.0, 1.0 - y * y)) + Math.asin(y));
  const term2 = u * (Math.PI / 2.0) * (y - (y * y * y) / 3.0);
  const fy = term1 + term2;
  const fMinus1 = -(1.0 - u) * (Math.PI / 2.0) - u * (Math.PI / 3.0);
  const totalFlux = Math.PI * (1.0 - u / 3.0);
  return Math.max(0.0, Math.min(1.0, (fy - fMinus1) / totalFlux));
}

export function computeEarthDiskFraction(
  earthMarginDeg: number,
  radiusDeg: number = 0.95
): number {
  if (earthMarginDeg >= radiusDeg) return 1.0;
  if (earthMarginDeg <= -radiusDeg) return 0.0;
  const x = Math.max(-1.0, Math.min(1.0, earthMarginDeg / radiusDeg));
  const theta = 2.0 * Math.acos(-x);
  const areaVis = 0.5 * (radiusDeg * radiusDeg) * (theta - Math.sin(theta));
  const totalArea = Math.PI * (radiusDeg * radiusDeg);
  return Math.max(0.0, Math.min(1.0, areaVis / totalArea));
}

export function computeKnifeEdgeDiffractionLoss(
  clearanceMarginDeg: number,
  fresnelDeg: number = 0.08
): number {
  const v = -clearanceMarginDeg / Math.max(1e-4, fresnelDeg);
  if (v <= -0.8) return 0.0;
  const u = v - 0.1;
  const term = Math.sqrt(u * u + 1.0) + u;
  return Math.max(0.0, 6.9 + 20.0 * Math.log10(Math.max(1e-6, term)));
}

export function computeEventCountdowns(
  flags: boolean[],
  _margins: number[],
  stepHours: number,
  trueEventName: string = 'sunset',
  falseEventName: string = 'sunrise'
): { countdowns: number[]; events: string[] } {
  const n = flags.length;
  const countdowns: number[] = [];
  const events: string[] = [];

  for (let i = 0; i < n; i++) {
    const curState = flags[i];
    const targetEvent = curState ? trueEventName : falseEventName;
    events.push(targetEvent);

    let stepDelta = -1;
    for (let j = i + 1; j < n; j++) {
      if (flags[j] !== curState) {
        stepDelta = j - i;
        break;
      }
    }
    if (stepDelta === -1) {
      for (let j = 0; j < i; j++) {
        if (flags[j] !== curState) {
          stepDelta = (n - 1 - i) + (j + 1);
          break;
        }
      }
    }

    if (stepDelta > 0) {
      countdowns.push(Number((stepDelta * stepHours).toFixed(1)));
    } else {
      countdowns.push(999.0);
    }
  }

  return { countdowns, events };
}

export function computeHorizonProfile(
  site: CandidateSite,
  terrain: TerrainData,
  observerHeightM: number = 2.0
): HorizonBin[] {
  const bins: HorizonBin[] = [];
  const N = terrain.grid_size;
  const halfW = terrain.width_m / 2;
  const step = terrain.width_m / (N - 1);
  const centerElev = terrain.center_elev_m + observerHeightM;
  const seed = hashSeed(site.id);

  // Site-specific distant regional horizon bias (km-scale lunar topography)
  const regionalBias = (azDeg: number): number => {
    const rad = azDeg * DEG2RAD;
    if (site.id === 'shackleton_rim') {
      // Clear toward Shackleton interior (SE), moderate ridge peaks N/W
      return 0.45 + 1.35 * Math.sin(rad + 0.9) + 0.7 * Math.cos(2 * rad - 0.5);
    }
    if (site.id === 'mons_mouton') {
      // Commanding elevated plateau: horizon drops below 0 in several directions!
      return -0.55 + 0.95 * Math.sin(rad * 2 + 0.4) + 0.45 * Math.cos(rad * 3);
    }
    if (site.id === 'malapert_massif') {
      // Very clear northern near-side view toward Earth (az ~ 0)
      return -0.65 - 1.1 * Math.cos(rad) + 0.85 * Math.sin(2 * rad + 0.2);
    }
    if (site.id === 'connecting_ridge') {
      return 0.25 + 1.15 * Math.cos(2 * rad) + 0.55 * Math.sin(3 * rad + 1.0);
    }
    if (site.id === 'haworth_rim') {
      return 1.1 + 1.55 * Math.sin(rad - 1.1) + 0.85 * Math.cos(2 * rad + 0.7);
    }
    if (site.id === 'nobile_rim') {
      return 0.65 + 1.25 * Math.cos(rad - 0.4) + 0.75 * Math.sin(3 * rad);
    }
    const ph = (seed % 360) * DEG2RAD;
    return 0.35 + 1.3 * Math.sin(rad + ph) + 0.7 * Math.cos(2 * rad - ph);
  };

  for (let az = 0; az < 360; az += 5) {
    const azRad = az * DEG2RAD;
    const dx = Math.sin(azRad); // +X = East
    const dz = -Math.cos(azRad); // -Z = North
    let maxAngleDeg = -8;

    // March along ray from 120m to 1950m in 60m steps with lunar spherical curvature drop-off
    for (let dist = 120; dist <= 1950; dist += 60) {
      const px = dx * dist;
      const pz = dz * dist;
      const col = Math.round((px + halfW) / step);
      const row = Math.round((pz + halfW) / step);
      if (col < 0 || col >= N || row < 0 || row >= N) break;
      const elev = terrain.elevations[row * N + col];
      // Lunar spherical curvature drop: delta_h = -(d^2) / (2 * R_moon), R_moon = 1,737,400m
      const curvDrop = -(dist * dist) / (2.0 * R_MOON_M);
      const apparentElev = elev + curvDrop;
      const angleDeg = Math.atan2(apparentElev - centerElev, dist) * RAD2DEG;
      if (angleDeg > maxAngleDeg) maxAngleDeg = angleDeg;
    }

    const combined = Math.max(maxAngleDeg, regionalBias(az));
    bins.push({
      az_deg: az,
      horizon_el_deg: Number(Math.max(-4.5, Math.min(18, combined)).toFixed(2)),
    });
  }

  return bins;
}

export function interpolateHorizon(horizon: HorizonBin[], azDeg: number): number {
  const n = horizon.length;
  if (n === 0) return 0;
  const norm = wrap360(azDeg);
  const step = 360 / n;
  const idx0 = Math.floor(norm / step) % n;
  const idx1 = (idx0 + 1) % n;
  const frac = (norm - idx0 * step) / step;
  return horizon[idx0].horizon_el_deg * (1 - frac) + horizon[idx1].horizon_el_deg * frac;
}

function longestContiguousFalseHours(flags: boolean[], stepHours: number): {
  longestHr: number;
  count: number;
} {
  let maxRun = 0;
  let curRun = 0;
  let episodes = 0;
  let inFalse = false;
  for (const ok of flags) {
    if (!ok) {
      curRun += 1;
      if (!inFalse) {
        episodes += 1;
        inFalse = true;
      }
      if (curRun > maxRun) maxRun = curRun;
    } else {
      curRun = 0;
      inFalse = false;
    }
  }
  return {
    longestHr: Number((maxRun * stepHours).toFixed(1)),
    count: episodes,
  };
}

export function simulateMissionAnalytical(
  site: CandidateSite,
  terrain: TerrainData,
  startUtc: string,
  durationDays: number,
  slipDays: number
): SimulationResult {
  // Differentiate observer mast heights: 2.0m for solar array, 3.5m for DTE antenna
  const solarHorizon = computeHorizonProfile(site, terrain, 2.0);
  const dteHorizon = computeHorizonProfile(site, terrain, 3.5);

  const baseMs = Date.parse(startUtc) || Date.UTC(2026, 10, 15, 0, 0, 0);
  const effectiveMs = baseMs + slipDays * 86400000;
  const effectiveUtc = new Date(effectiveMs).toISOString();

  // Sample hourly for 7d/14d, 2-hourly for 28d to keep UI ultra-snappy
  const stepHours = durationDays <= 14 ? 1 : 2;
  const totalSteps = Math.max(24, Math.round((durationDays * 24) / stepHours));

  interface StepData {
    tMs: number;
    hourOffset: number;
    sun: { az_deg: number; el_deg: number };
    earth: { az_deg: number; el_deg: number };
    sunHoriz: number;
    earthHoriz: number;
    deltaSun: number;
    deltaEarth: number;
    sunFrac: number;
    sunVisible: boolean;
    earthVisible: boolean;
    solarFluxVerticalWm2: number;
    solarPowerPct: number;
    dteLinkDb: number;
  }

  const steps: StepData[] = [];

  for (let i = 0; i <= totalSteps; i++) {
    const hourOffset = i * stepHours;
    const tMs = effectiveMs + hourOffset * 3600000;
    const sun = computeSunDirection(site.lat_deg, site.lon_deg, tMs);
    const earth = computeEarthDirection(site.lat_deg, site.lon_deg, tMs);

    const sunHoriz = Number(interpolateHorizon(solarHorizon, sun.az_deg).toFixed(2));
    const earthHoriz = Number(interpolateHorizon(dteHorizon, earth.az_deg).toFixed(2));

    // Topographic Obstruction Margins required by NASA:
    // delta_sun = (theta_sun + 0.26 deg solar semi-diameter) - theta_horiz(alpha_sun)
    // delta_earth = theta_earth - theta_horiz(alpha_earth)
    const deltaSun = Number((sun.el_deg + 0.26 - sunHoriz).toFixed(2));
    const deltaEarth = Number((earth.el_deg - earthHoriz).toFixed(2));

    const sunFrac = computeSolarDiskFraction(deltaSun - 0.26);
    const sunVisible = deltaSun > 0.0;

    // Realistic X-band link margin with knife-edge diffraction loss
    const diffLoss = computeKnifeEdgeDiffractionLoss(deltaEarth);
    const dteLinkDb = Number(Math.max(-45.0, Math.min(28.0, 14.5 - diffLoss)).toFixed(1));
    const earthVisible = deltaEarth > -0.05 && dteLinkDb > 0.0;

    // Realistic Incident Solar Flux on vertical/tracking polar solar array:
    // I = 1361 * f_sun * max(0, cos(theta_sun)) W/m^2
    const cosInc = Math.max(0.0, Math.cos(Math.max(0.0, sun.el_deg) * DEG2RAD));
    const solarFluxVerticalWm2 = Number((1361.0 * sunFrac * cosInc).toFixed(1));
    const solarPowerPct = Number(
      Math.min(100.0, (solarFluxVerticalWm2 / 1361.0) * 100.0).toFixed(1)
    );

    steps.push({
      tMs,
      hourOffset,
      sun,
      earth,
      sunHoriz,
      earthHoriz,
      deltaSun,
      deltaEarth,
      sunFrac,
      sunVisible,
      earthVisible,
      solarFluxVerticalWm2,
      solarPowerPct,
      dteLinkDb,
    });
  }

  // Realistic Rover Battery Integration in Watt-hours over 14-day timeline (1200 Wh capacity)
  const batteryCapacityWh = 1200.0;
  let curBatteryWh = batteryCapacityWh;
  const batteryWhList: number[] = [];
  const batteryPctList: number[] = [];

  for (let i = 0; i <= totalSteps; i++) {
    const flux = steps[i].solarFluxVerticalWm2;
    const pGen = flux * 1.2 * 0.28; // 1.2 m^2 array, 28% triple-junction cell efficiency
    const isDriving = curBatteryWh > 300.0 && flux > 50.0;
    const pLoad = isDriving ? 140.0 : 55.0; // 55W base survival/avionics, 140W roving
    const pNet = pGen - pLoad;
    curBatteryWh = Math.max(0.0, Math.min(batteryCapacityWh, curBatteryWh + pNet * stepHours));
    batteryWhList.push(Number(curBatteryWh.toFixed(1)));
    batteryPctList.push(Number(((curBatteryWh / batteryCapacityWh) * 100.0).toFixed(1)));
  }

  // Exact Countdown Calculators (hours remaining until next sunset/sunrise, earthset/earthrise)
  const sunFlags = steps.map((s) => s.sunVisible);
  const earthFlags = steps.map((s) => s.earthVisible);
  const sunMargins = steps.map((s) => s.deltaSun);
  const earthMargins = steps.map((s) => s.deltaEarth);

  const sunCountdowns = computeEventCountdowns(
    sunFlags,
    sunMargins,
    stepHours,
    'sunset',
    'sunrise'
  );
  const earthCountdowns = computeEventCountdowns(
    earthFlags,
    earthMargins,
    stepHours,
    'earthset',
    'earthrise'
  );

  const timeline: TelemetryStep[] = [];
  for (let i = 0; i <= totalSteps; i++) {
    const s = steps[i];
    timeline.push({
      timestamp_utc: new Date(s.tMs).toISOString(),
      hour_offset: s.hourOffset,
      sun_az_deg: s.sun.az_deg,
      sun_el_deg: s.sun.el_deg,
      sun_horizon_deg: s.sunHoriz,
      sun_visible: s.sunVisible,
      earth_az_deg: s.earth.az_deg,
      earth_el_deg: s.earth.el_deg,
      earth_horizon_deg: s.earthHoriz,
      earth_visible: s.earthVisible,
      solar_power_pct: s.solarPowerPct,
      dte_link_db: s.dteLinkDb,
      delta_sun_deg: s.deltaSun,
      delta_earth_deg: s.deltaEarth,
      solar_flux_wm2: s.solarFluxVerticalWm2,
      battery_wh: batteryWhList[i],
      battery_pct: batteryPctList[i],
      countdown_sun_hr: sunCountdowns.countdowns[i],
      sun_event: sunCountdowns.events[i],
      countdown_earth_hr: earthCountdowns.countdowns[i],
      earth_event: earthCountdowns.events[i],
    } as TelemetryStep);
  }

  const solarPct = Number(
    ((sunFlags.filter(Boolean).length / timeline.length) * 100).toFixed(1)
  );
  const dtePct = Number(
    ((earthFlags.filter(Boolean).length / timeline.length) * 100).toFixed(1)
  );
  const eclipseInfo = longestContiguousFalseHours(sunFlags, stepHours);
  const blackoutInfo = longestContiguousFalseHours(earthFlags, stepHours);

  const terrainSlope = terrain.center_slope_deg;
  // Weighted suitability score (0 - 100)
  const slopePenalty = Math.max(0, (terrainSlope - 5) * 2.4);
  const eclipsePenalty = Math.min(20, eclipseInfo.longestHr * 0.14);
  const rawScore =
    solarPct * 0.48 + dtePct * 0.34 + Math.max(0, 18 - slopePenalty) - eclipsePenalty * 0.25;
  const suitabilityScore = Number(Math.max(0, Math.min(100, rawScore)).toFixed(1));

  const summary: SimulationSummary = {
    solar_illumination_pct: solarPct,
    longest_eclipse_hr: eclipseInfo.longestHr,
    dte_comms_pct: dtePct,
    longest_blackout_hr: blackoutInfo.longestHr,
    terrain_slope_deg: terrainSlope,
    suitability_score: suitabilityScore,
    eclipse_count: eclipseInfo.count,
    blackout_count: blackoutInfo.count,
    next_solar_event_hours: sunCountdowns.countdowns[0] ?? 0,
    next_solar_event_type: sunCountdowns.events[0] ?? 'sunset',
    next_earth_event_hours: earthCountdowns.countdowns[0] ?? 0,
    next_earth_event_type: earthCountdowns.events[0] ?? 'earthset',
    min_battery_wh: Math.min(...batteryWhList),
    min_battery_pct: Math.min(...batteryPctList),
    min_dte_margin_db: Math.min(...timeline.map((t) => t.dte_link_db)),
  } as SimulationSummary;

  return {
    site,
    start_utc: startUtc,
    effective_start_utc: effectiveUtc,
    duration_days: durationDays,
    slip_days: slipDays,
    horizon: solarHorizon,
    timeline,
    summary,
    data_source: 'analytical',
  };
}

export function compareSitesAnalytical(
  siteA: CandidateSite,
  siteB: CandidateSite,
  startUtc: string,
  durationDays: number,
  slipDays: number
): ComparisonResult {
  const simA = simulateMissionAnalytical(
    siteA,
    generateSiteTerrain(siteA),
    startUtc,
    durationDays,
    slipDays
  );
  const simB = simulateMissionAnalytical(
    siteB,
    generateSiteTerrain(siteB),
    startUtc,
    durationDays,
    slipDays
  );
  const winner =
    simA.summary.suitability_score >= simB.summary.suitability_score ? siteA : siteB;
  const loser = winner.id === siteA.id ? siteB : siteA;
  const winSim = winner.id === siteA.id ? simA : simB;
  const loseSim = winner.id === siteA.id ? simB : simA;

  const deltaScore = (winSim.summary.suitability_score - loseSim.summary.suitability_score).toFixed(
    1
  );
  const rationale = `${winner.name} leads by +${deltaScore} pts for this window (${winSim.summary.solar_illumination_pct}% solar, ${winSim.summary.dte_comms_pct}% DTE vs ${loseSim.summary.solar_illumination_pct}% solar, ${loseSim.summary.dte_comms_pct}% DTE at ${loser.name}).`;

  return {
    site_a: siteA,
    site_b: siteB,
    sim_a: simA,
    sim_b: simB,
    winner_id: winner.id,
    rationale,
  };
}

export function findBackupRecommendationsAnalytical(
  currentSite: CandidateSite,
  startUtc: string,
  durationDays: number,
  slipDays: number
): BackupRecommendation[] {
  const baseline = simulateMissionAnalytical(
    currentSite,
    generateSiteTerrain(currentSite),
    startUtc,
    durationDays,
    slipDays
  );

  const candidates: BackupRecommendation[] = [];
  const shiftOffsets = [0, -7, 7, 14];

  for (const site of CANDIDATE_SITES) {
    const terrain = generateSiteTerrain(site);
    let bestSim: SimulationResult | null = null;
    let bestShift = 0;

    for (const shift of shiftOffsets) {
      if (site.id === currentSite.id && shift === 0) continue;
      const sim = simulateMissionAnalytical(
        site,
        terrain,
        startUtc,
        durationDays,
        slipDays + shift
      );
      if (!bestSim || sim.summary.suitability_score > bestSim.summary.suitability_score) {
        bestSim = sim;
        bestShift = shift;
      }
    }

    if (bestSim) {
      const scoreDelta = Number(
        (bestSim.summary.suitability_score - baseline.summary.suitability_score).toFixed(1)
      );
      const solarDelta = Number(
        (
          bestSim.summary.solar_illumination_pct - baseline.summary.solar_illumination_pct
        ).toFixed(1)
      );
      const dteDelta = Number(
        (bestSim.summary.dte_comms_pct - baseline.summary.dte_comms_pct).toFixed(1)
      );

      let reason = '';
      if (site.id === currentSite.id) {
        reason = `Adjusting launch by ${bestShift > 0 ? `+${bestShift}` : bestShift}d aligns ${site.name} with peak solar grazing phase.`;
      } else if (dteDelta > 15) {
        reason = `Superior Direct-to-Earth visibility (+${dteDelta}% DTE) reduces blackout risk during launch slip.`;
      } else if (solarDelta > 8) {
        reason = `Higher rim illumination (+${solarDelta}% solar) minimizes battery depletion across crater shadows.`;
      } else {
        reason = `Balanced terrain safety (${bestSim.summary.terrain_slope_deg}° slope) and robust comms margin.`;
      }

      candidates.push({
        site,
        recommended_slip_days: slipDays + bestShift,
        effective_start_utc: bestSim.effective_start_utc,
        summary: bestSim.summary,
        score_delta: scoreDelta,
        solar_delta_pct: solarDelta,
        dte_delta_pct: dteDelta,
        reason,
      });
    }
  }

  return candidates.sort((a, b) => b.summary.suitability_score - a.summary.suitability_score).slice(0, 5);
}
