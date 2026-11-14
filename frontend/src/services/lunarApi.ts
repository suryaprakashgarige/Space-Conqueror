import { CANDIDATE_SITES } from '../data/fallbackSites';
import {
  BackupRecommendation,
  CandidateSite,
  ComparisonResult,
  DataSourceMode,
  SimulationResult,
  TerrainData,
} from '../types/lunar';
import {
  compareSitesAnalytical,
  findBackupRecommendationsAnalytical,
  generateSiteTerrain,
  simulateMissionAnalytical,
} from './analyticalPhysics';

const API_BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ||
  'http://127.0.0.1:8000';

async function fetchWithTimeout<T>(url: string, timeoutMs = 4000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export function createCustomSite(latDeg: number, lonDeg: number): CandidateSite {
  const latStr = `${Math.abs(latDeg).toFixed(2)}°S`;
  const lonStr = `${Math.abs(lonDeg).toFixed(2)}°${lonDeg >= 0 ? 'E' : 'W'}`;
  return {
    id: `custom_${latDeg.toFixed(3)}_${lonDeg.toFixed(3)}`,
    name: `Custom Pin (${latStr}, ${lonStr})`,
    region: 'South Pole Custom Target',
    lat_deg: Number(latDeg.toFixed(4)),
    lon_deg: Number(lonDeg.toFixed(4)),
    mission_context:
      'User-selected custom South Pole landing coordinates evaluated in real time.',
    science_highlight:
      'Exploratory terrain patch synthesized for polar illumination and DTE line-of-sight.',
    is_custom: true,
  };
}

export async function fetchSites(): Promise<{
  sites: CandidateSite[];
  source: DataSourceMode;
}> {
  try {
    const data = await fetchWithTimeout<{ sites?: CandidateSite[] } | CandidateSite[]>(
      `${API_BASE}/api/sites`
    );
    const list = Array.isArray(data) ? data : data.sites;
    if (list && list.length > 0) {
      return { sites: list, source: 'api' };
    }
  } catch {
    // Fall through to static pack
  }

  try {
    const staticSites = await fetchWithTimeout<CandidateSite[]>('/data/sites.json', 800);
    if (Array.isArray(staticSites) && staticSites.length > 0) {
      return { sites: staticSites, source: 'static' };
    }
  } catch {
    // Fall through to bundled dataset
  }

  return { sites: CANDIDATE_SITES, source: 'analytical' };
}

export async function fetchTerrain(site: CandidateSite): Promise<{
  terrain: TerrainData;
  source: DataSourceMode;
}> {
  if (!site.is_custom) {
    try {
      const apiTerrain = await fetchWithTimeout<TerrainData>(
        `${API_BASE}/api/terrain/${encodeURIComponent(site.id)}`
      );
      if (apiTerrain && Array.isArray(apiTerrain.elevations) && apiTerrain.elevations.length > 0) {
        return { terrain: apiTerrain, source: 'api' };
      }
    } catch {
      // Fall through
    }

    try {
      const staticTerrain = await fetchWithTimeout<TerrainData>(
        `/data/terrain_${encodeURIComponent(site.id)}.json`,
        900
      );
      if (
        staticTerrain &&
        Array.isArray(staticTerrain.elevations) &&
        staticTerrain.elevations.length > 0
      ) {
        return { terrain: staticTerrain, source: 'static' };
      }
    } catch {
      // Fall through
    }
  } else {
    try {
      const apiCustom = await fetchWithTimeout<TerrainData>(
        `${API_BASE}/api/terrain/custom?lat=${site.lat_deg}&lon=${site.lon_deg}`
      );
      if (apiCustom && Array.isArray(apiCustom.elevations) && apiCustom.elevations.length > 0) {
        return { terrain: apiCustom, source: 'api' };
      }
    } catch {
      // Fall through
    }
  }

  return { terrain: generateSiteTerrain(site), source: 'analytical' };
}

export async function fetchSimulation(
  site: CandidateSite,
  terrain: TerrainData,
  startUtc: string,
  durationDays: number,
  slipDays: number
): Promise<SimulationResult> {
  const params = new URLSearchParams({
    site_id: site.id,
    lat: String(site.lat_deg),
    lon: String(site.lon_deg),
    start_utc: startUtc,
    duration_days: String(durationDays),
    slip_days: String(slipDays),
  });

  try {
    const apiSim = await fetchWithTimeout<SimulationResult>(
      `${API_BASE}/api/simulate?${params.toString()}`,
      12000
    );
    if (apiSim && Array.isArray(apiSim.timeline) && apiSim.timeline.length > 0) {
      return { ...apiSim, data_source: 'api' };
    }
  } catch {
    // Fall through
  }

  if (!site.is_custom && slipDays === 0) {
    try {
      const staticSim = await fetchWithTimeout<SimulationResult>(
        `/data/sim_${encodeURIComponent(site.id)}.json`,
        900
      );
      if (staticSim && Array.isArray(staticSim.timeline) && staticSim.timeline.length > 0) {
        return { ...staticSim, data_source: 'static' };
      }
    } catch {
      // Fall through
    }
  }

  return simulateMissionAnalytical(site, terrain, startUtc, durationDays, slipDays);
}

export async function fetchComparison(
  siteA: CandidateSite,
  siteB: CandidateSite,
  startUtc: string,
  durationDays: number,
  slipDays: number
): Promise<ComparisonResult> {
  const params = new URLSearchParams({
    site_a: siteA.id,
    site_b: siteB.id,
    start_utc: startUtc,
    duration_days: String(durationDays),
    slip_days: String(slipDays),
  });

  try {
    const apiComp = await fetchWithTimeout<ComparisonResult>(
      `${API_BASE}/api/compare?${params.toString()}`,
      20000
    );
    if (apiComp && apiComp.sim_a && apiComp.sim_b) {
      return apiComp;
    }
  } catch {
    // Fall through
  }

  return compareSitesAnalytical(siteA, siteB, startUtc, durationDays, slipDays);
}

export async function fetchBackupRecommendations(
  currentSite: CandidateSite,
  startUtc: string,
  durationDays: number,
  slipDays: number
): Promise<BackupRecommendation[]> {
  const params = new URLSearchParams({
    site_id: currentSite.id,
    lat: String(currentSite.lat_deg),
    lon: String(currentSite.lon_deg),
    start_utc: startUtc,
    duration_days: String(durationDays),
    slip_days: String(slipDays),
  });

  try {
    const apiBackup = await fetchWithTimeout<
      { recommendations?: BackupRecommendation[] } | BackupRecommendation[]
    >(`${API_BASE}/api/backup?${params.toString()}`, 45000);
    const list = Array.isArray(apiBackup) ? apiBackup : apiBackup.recommendations;
    if (list && list.length > 0) {
      return list;
    }
  } catch {
    // Fall through
  }

  return findBackupRecommendationsAnalytical(currentSite, startUtc, durationDays, slipDays);
}
