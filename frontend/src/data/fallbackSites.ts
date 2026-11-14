import { CandidateSite } from '../types/lunar';

export const CANDIDATE_SITES: CandidateSite[] = [
  {
    id: 'shackleton_rim',
    name: 'Peak Near Shackleton',
    region: 'Shackleton Crater Rim',
    lat_deg: -88.9,
    lon_deg: 126.6,
    mission_context:
      'High-elevation ridge adjacent to Shackleton Crater; prime Artemis illumination target.',
    science_highlight:
      'Direct access to permanently shadowed crater walls rich in potential water ice.',
  },
  {
    id: 'mons_mouton',
    name: 'Mons Mouton Plateau',
    region: 'Mons Mouton (Leibnitz Beta)',
    lat_deg: -84.6,
    lon_deg: 31.2,
    mission_context:
      'Broad elevated flat-topped plateau selected for Artemis III & CLPS IM-2 precursor.',
    science_highlight:
      'Ancient impact-basin massif ideal for safe lander touchdown and long-range traverse.',
  },
  {
    id: 'malapert_massif',
    name: 'Malapert Massif',
    region: 'Malapert Mountain Ridge',
    lat_deg: -85.99,
    lon_deg: -0.23,
    mission_context:
      'Prime near-side ridge renowned for strong Direct-to-Earth (DTE) line-of-sight.',
    science_highlight:
      'Commanding 5 km relief overlooking South Pole-Aitken basin ejecta.',
  },
  {
    id: 'connecting_ridge',
    name: 'Connecting Ridge',
    region: 'Shackleton–de Gerlache Ridge',
    lat_deg: -89.45,
    lon_deg: -137.3,
    mission_context:
      'Narrow elevated bridge linking Shackleton and de Gerlache craters with high solar persistence.',
    science_highlight:
      'Straddles two deep permanently shadowed cold traps within rover traverse reach.',
  },
  {
    id: 'haworth_rim',
    name: 'Haworth Rim',
    region: 'Haworth Crater Margin',
    lat_deg: -86.75,
    lon_deg: -23.2,
    mission_context:
      'High-latitude rim near one of the coldest shadowed basins at the South Pole.',
    science_highlight:
      'Ancient highland crust next to multi-billion-year cryogenic volatile traps.',
  },
  {
    id: 'nobile_rim',
    name: 'Nobile Rim 1',
    region: 'Nobile Crater Rim',
    lat_deg: -85.4,
    lon_deg: 37.4,
    mission_context:
      'Elevated rim segment along Nobile Crater evaluated for NASA VIPER & Artemis traverses.',
    science_highlight:
      'Diverse slope gradients and nearby micro-cold traps for volatile sampling.',
  },
];

export interface SouthPoleFeature {
  name: string;
  lat_deg: number;
  lon_deg: number;
  radius_km: number;
  kind: 'crater' | 'massif';
}

export const SOUTH_POLE_LANDMARKS: SouthPoleFeature[] = [
  { name: 'Shackleton', lat_deg: -89.67, lon_deg: 129.78, radius_km: 10.5, kind: 'crater' },
  { name: 'de Gerlache', lat_deg: -88.48, lon_deg: -88.3, radius_km: 16.2, kind: 'crater' },
  { name: 'Sverdrup', lat_deg: -88.3, lon_deg: -152.0, radius_km: 16.5, kind: 'crater' },
  { name: 'Haworth', lat_deg: -87.45, lon_deg: -5.17, radius_km: 25.5, kind: 'crater' },
  { name: 'Shoemaker', lat_deg: -88.1, lon_deg: 44.9, radius_km: 25.5, kind: 'crater' },
  { name: 'Faustini', lat_deg: -87.3, lon_deg: 77.0, radius_km: 19.5, kind: 'crater' },
  { name: 'Nobile', lat_deg: -85.2, lon_deg: 53.5, radius_km: 36.5, kind: 'crater' },
  { name: 'Cabeus', lat_deg: -84.9, lon_deg: -35.5, radius_km: 49.0, kind: 'crater' },
  { name: 'Mons Mouton', lat_deg: -84.6, lon_deg: 31.2, radius_km: 22.0, kind: 'massif' },
  { name: 'Malapert', lat_deg: -85.99, lon_deg: -0.23, radius_km: 14.0, kind: 'massif' },
];
