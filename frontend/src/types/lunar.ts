export interface CandidateSite {
  id: string;
  name: string;
  region: string;
  lat_deg: number; // Selenographic latitude (negative = South)
  lon_deg: number; // Selenographic East longitude [-180, 180]
  mission_context: string;
  science_highlight: string;
  is_custom?: boolean;
}

export interface TerrainData {
  site_id: string;
  lat_deg: number;
  lon_deg: number;
  grid_size: number;
  width_m: number;
  height_m: number;
  center_elev_m: number;
  elevations: number[]; // row-major (row = North->South, col = West->East)
  slope_deg?: number[];
  mean_slope_deg: number;
  max_slope_deg: number;
  center_slope_deg: number;
  glb_url?: string;
}

export interface HorizonBin {
  az_deg: number;
  horizon_el_deg: number;
}

export interface TelemetryStep {
  timestamp_utc: string;
  hour_offset: number;
  sun_az_deg: number;
  sun_el_deg: number;
  sun_horizon_deg: number;
  sun_visible: boolean;
  earth_az_deg: number;
  earth_el_deg: number;
  earth_horizon_deg: number;
  earth_visible: boolean;
  solar_power_pct: number;
  dte_link_db: number;
  // NASA Operational Metrics
  delta_sun_deg?: number;
  delta_earth_deg?: number;
  solar_flux_wm2?: number;
  battery_wh?: number;
  battery_pct?: number;
  countdown_sun_hr?: number;
  sun_event?: string;
  countdown_earth_hr?: number;
  earth_event?: string;
  terrain_elev_m?: number;
}

export interface SimulationSummary {
  solar_illumination_pct: number;
  longest_eclipse_hr: number;
  dte_comms_pct: number;
  longest_blackout_hr: number;
  terrain_slope_deg: number;
  suitability_score: number;
  eclipse_count: number;
  blackout_count: number;
  // NASA Operational Summary Metrics
  next_solar_event_hours?: number;
  next_solar_event_type?: string;
  next_earth_event_hours?: number;
  next_earth_event_type?: string;
  min_battery_wh?: number;
  min_battery_pct?: number;
  min_dte_margin_db?: number;
}

export type DataSourceMode = 'api' | 'static' | 'analytical';

export interface SimulationResult {
  site: CandidateSite;
  start_utc: string;
  effective_start_utc: string;
  duration_days: number;
  slip_days: number;
  horizon: HorizonBin[];
  timeline: TelemetryStep[];
  summary: SimulationSummary;
  data_source: DataSourceMode;
}

export interface MultiSiteComparisonEntry {
  site: CandidateSite;
  summary: SimulationSummary;
  rank: number;
}

export interface ComparisonResult {
  site_a: CandidateSite;
  site_b: CandidateSite;
  sim_a: SimulationResult;
  sim_b: SimulationResult;
  winner_id: string;
  rationale: string;
  multi_entries?: MultiSiteComparisonEntry[];
}

export interface BackupRecommendation {
  site: CandidateSite;
  recommended_slip_days: number;
  effective_start_utc: string;
  summary: SimulationSummary;
  score_delta: number;
  solar_delta_pct: number;
  dte_delta_pct: number;
  reason: string;
}

export type CameraPreset = 'orbital' | 'lander' | 'horizon' | 'rover';
export type AppMode = 'planner' | 'explorer';
export type DrawerTab = 'overview' | 'compare' | 'backup';
export type MissionViewMode = 'cockpit' | 'moon_globe';
export type LandingState = 'landed' | 'descending' | 'in_orbit';
export type RoverState = 'stowed' | 'deploying' | 'traversing' | 'stopped';

export interface RoverTelemetry {
  state: RoverState;
  x: number;
  z: number;
  distance_m: number;
  speed_mps: number;
  headlightsOn: boolean;
  solarPanelExposurePct: number;
  batteryPct: number;
  isCharging: boolean;
  hop1MarginDb: number;
  hop2MarginDb: number;
  dualHopOnline: boolean;
}
