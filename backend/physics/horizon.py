"""360-degree lunar horizon raycaster, Sun/Earth visibility, and mission scoring."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, Any, List

import numpy as np

from backend.physics.dem import LolaSouthPoleDEM, R_MOON_M, get_dem
from backend.physics.ephemeris import (
    LunarEphemeris,
    SUN_ANGULAR_RADIUS_DEG,
    get_ephemeris,
)


def compute_horizon_360(
    dem: LolaSouthPoleDEM,
    lat_deg: float,
    lon_deg: float,
    max_dist_m: float = 90_000.0,
    radial_step_m: float = 240.0,
    n_az: int = 360,
    observer_height_m: float = 2.0,
) -> Dict[str, Any]:
    """Cast 360 azimuth rays across the LOLA DEM with spherical Moon curvature drop.

    Azimuth convention (matches Skyfield altaz):
      0 deg = North, 90 deg = East, 180 deg = South, 270 deg = West.
    """
    x0, y0 = dem.latlon_to_xy_m(lat_deg, lon_deg)
    z0 = dem.sample_elevation_latlon(lat_deg, lon_deg) + observer_height_m

    lam = np.radians(lon_deg)
    east_vec = np.array([np.cos(lam), -np.sin(lam)])
    north_vec = np.array([np.sin(lam), np.cos(lam)])

    az_deg = np.arange(n_az, dtype=np.float64)
    az_rad = np.radians(az_deg)
    # Unit direction vectors in stereographic plane for each azimuth (clockwise from North)
    dir_x = np.sin(az_rad) * east_vec[0] + np.cos(az_rad) * north_vec[0]
    dir_y = np.sin(az_rad) * east_vec[1] + np.cos(az_rad) * north_vec[1]

    dists = np.arange(radial_step_m, max_dist_m + 1.0, radial_step_m, dtype=np.float64)  # (N_r,)
    # Stereographic coordinates of all ray sample points: shape (n_az, N_r)
    px = x0 + dir_x[:, None] * dists[None, :]
    py = y0 + dir_y[:, None] * dists[None, :]

    rows, cols = dem.xy_m_to_rowcol(px, py)
    elevs = dem.sample_elevation_rc(rows, cols)

    # Spherical curvature drop correction: dz_curv = -d^2 / (2 * R_moon)
    curv_drop = (dists[None, :] ** 2) / (2.0 * R_MOON_M)
    angle_rad = np.arctan2((elevs - z0) - curv_drop, dists[None, :])
    horizon_deg = np.degrees(np.max(angle_rad, axis=1))

    return {
        "azimuth_deg": az_deg.tolist(),
        "horizon_el_deg": np.round(horizon_deg, 3).tolist(),
        "observer_elev_m": round(float(z0 - observer_height_m), 2),
    }


# Physics constants for solar irradiance & thermal equilibrium
SOLAR_CONSTANT_1AU_WM2 = 1361.0
LUNAR_ALBEDO_BOND = 0.12
LUNAR_EMISSIVITY_IR = 0.95
STEFAN_BOLTZMANN_SIGMA = 5.670374e-8
LUNAR_GEOTHERMAL_HEAT_WM2 = 0.018
CRYOGENIC_PSR_MIN_TEMP_K = 38.0
EARTH_ANGULAR_RADIUS_DEG = 0.95

# Operational link budget & rover power constants
X_BAND_UNOBSTRUCTED_MARGIN_DB = 14.5
FRESNEL_CLEARANCE_ANGLE_DEG = 0.08  # First Fresnel zone radius at 8.4 GHz over 10 km obstacle
ROVER_BATTERY_CAPACITY_WH = 1200.0
ROVER_ARRAY_AREA_M2 = 1.2
ROVER_CELL_EFFICIENCY = 0.28
ROVER_BASE_LOAD_W = 55.0
ROVER_DRIVE_LOAD_W = 85.0


def compute_knife_edge_diffraction_loss(
    clearance_margin_deg: np.ndarray,
    fresnel_deg: float = FRESNEL_CLEARANCE_ANGLE_DEG,
) -> np.ndarray:
    """ITU-R P.526 knife-edge terrain diffraction loss in dB.

    Parameters:
        clearance_margin_deg: theta_earth - theta_horiz (positive = line of sight clears ridge).
        fresnel_deg: Angular scale of first Fresnel zone (deg).
    """
    margins = np.asarray(clearance_margin_deg, dtype=np.float64)
    v = -margins / max(1e-4, fresnel_deg)
    loss = np.zeros_like(v)

    mask = v > -0.8
    if np.any(mask):
        vm = v[mask]
        u = vm - 0.1
        term = np.sqrt(u**2 + 1.0) + u
        loss[mask] = 6.9 + 20.0 * np.log10(np.maximum(1e-6, term))

    return np.maximum(0.0, loss)


def compute_event_countdowns(
    flags: np.ndarray,
    margins: np.ndarray,
    step_hours: float,
    true_event_name: str = "sunset",
    false_event_name: str = "sunrise",
) -> Tuple[List[float], List[str]]:
    """Compute hours remaining until next solar/earth visibility transition."""
    n = len(flags)
    countdowns: List[float] = []
    events: List[str] = []

    for i in range(n):
        curr_state = bool(flags[i])
        target_event = true_event_name if curr_state else false_event_name
        events.append(target_event)

        # Search forward for first transition
        found = False
        for j in range(i + 1, n):
            if bool(flags[j]) != curr_state:
                # Fractional interpolation using margins
                m1 = abs(float(margins[j - 1]))
                m2 = abs(float(margins[j]))
                frac = m1 / (m1 + m2) if (m1 + m2) > 0 else 0.5
                frac = max(0.0, min(1.0, frac))
                hrs = ((j - 1 - i) + frac) * step_hours
                countdowns.append(round(float(max(0.0, hrs)), 2))
                found = True
                break

        if not found:
            # Remains in current state through end of mission window
            rem_hrs = (n - 1 - i) * step_hours
            countdowns.append(round(float(rem_hrs), 2))

    return countdowns, events


def compute_rover_battery_timeline(
    flux_vertical_wm2: np.ndarray,
    step_hours: float,
    capacity_wh: float = ROVER_BATTERY_CAPACITY_WH,
    array_area_m2: float = ROVER_ARRAY_AREA_M2,
    cell_eff: float = ROVER_CELL_EFFICIENCY,
    base_load_w: float = ROVER_BASE_LOAD_W,
    drive_load_w: float = ROVER_DRIVE_LOAD_W,
) -> Tuple[np.ndarray, np.ndarray]:
    """Integrate rover energy state in Watt-hours over the 14-day mission timeline."""
    n = len(flux_vertical_wm2)
    battery_wh = np.zeros(n, dtype=np.float64)
    soc_pct = np.zeros(n, dtype=np.float64)

    cur_energy = float(capacity_wh)
    for i in range(n):
        flux = float(flux_vertical_wm2[i])
        p_gen = flux * array_area_m2 * cell_eff

        # Rover drives when sufficient battery (>25%) and solar power is active
        is_driving = (cur_energy > 0.25 * capacity_wh) and (flux > 50.0)
        p_load = (base_load_w + drive_load_w) if is_driving else base_load_w

        p_net = p_gen - p_load
        cur_energy = max(0.0, min(capacity_wh, cur_energy + p_net * step_hours))
        battery_wh[i] = cur_energy
        soc_pct[i] = (cur_energy / capacity_wh) * 100.0

    return battery_wh, soc_pct


def compute_solar_disk_fraction(
    sun_margin_deg: np.ndarray,
    radius_deg: float = SUN_ANGULAR_RADIUS_DEG,
    limb_darkening_u: float = 0.60,
) -> np.ndarray:
    """Analytical closed-form integration of Eddington limb-darkened solar disk occultation.

    When the Sun is occulted by a knife-edge lunar horizon at margin h = el_sun - el_horizon:
      - h <= -R: 0.0 (total occultation / eclipse)
      - h >= +R: 1.0 (fully unobscured disk)
      - -R < h < +R: Closed-form analytical integration of I(mu) = 1 - u(1 - mu).
    """
    h = np.asarray(sun_margin_deg, dtype=np.float64)
    frac = np.zeros_like(h)
    frac[h >= radius_deg] = 1.0

    mask = (h > -radius_deg) & (h < radius_deg)
    if np.any(mask):
        y = np.clip(h[mask] / radius_deg, -1.0, 1.0)
        u = float(limb_darkening_u)
        # Anti-derivative F(y) = int_{-x_max}^{x_max} [ (1-u) + u*sqrt(1 - x^2 - y^2) ] dx dy
        term1 = (1.0 - u) * (y * np.sqrt(np.maximum(0.0, 1.0 - y**2)) + np.arcsin(y))
        term2 = u * (np.pi / 2.0) * (y - (y**3) / 3.0)
        f_y = term1 + term2

        f_minus_1 = -(1.0 - u) * (np.pi / 2.0) - u * (np.pi / 3.0)
        total_flux = np.pi * (1.0 - u / 3.0)

        frac[mask] = (f_y - f_minus_1) / total_flux

    return np.clip(frac, 0.0, 1.0)


def compute_earth_disk_fraction(
    earth_margin_deg: np.ndarray,
    radius_deg: float = EARTH_ANGULAR_RADIUS_DEG,
) -> np.ndarray:
    """Exact circular segment geometric fraction of Earth disk above the lunar horizon."""
    h = np.asarray(earth_margin_deg, dtype=np.float64)
    frac = np.zeros_like(h)
    frac[h >= radius_deg] = 1.0

    mask = (h > -radius_deg) & (h < radius_deg)
    if np.any(mask):
        x = np.clip(h[mask] / radius_deg, -1.0, 1.0)
        theta = 2.0 * np.arccos(-x)
        area_vis = 0.5 * (radius_deg**2) * (theta - np.sin(theta))
        total_area = np.pi * (radius_deg**2)
        frac[mask] = area_vis / total_area

    return np.clip(frac, 0.0, 1.0)


def compute_thermal_equilibrium(
    sun_frac: np.ndarray,
    sun_el_deg: np.ndarray,
    sun_dist_au: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute incident solar flux (W/m^2) and surface equilibrium temperature (Kelvin)."""
    dist_sq = np.maximum(0.8, np.asarray(sun_dist_au, dtype=np.float64) ** 2)
    s_direct = (SOLAR_CONSTANT_1AU_WM2 / dist_sq) * np.asarray(sun_frac, dtype=np.float64)
    sin_elev = np.maximum(0.0, np.sin(np.radians(np.maximum(0.0, sun_el_deg))))
    flux_incident = s_direct * sin_elev

    # Stefan-Boltzmann equilibrium temperature on horizontal regolith
    rad_in = (1.0 - LUNAR_ALBEDO_BOND) * flux_incident + LUNAR_GEOTHERMAL_HEAT_WM2
    temp_k = (rad_in / (LUNAR_EMISSIVITY_IR * STEFAN_BOLTZMANN_SIGMA)) ** 0.25
    temp_k = np.maximum(CRYOGENIC_PSR_MIN_TEMP_K, temp_k)
    return flux_incident, temp_k


def _longest_false_run_hours(flags: np.ndarray, step_hours: float) -> float:
    max_run = 0
    curr = 0
    for val in flags:
        if not val:
            curr += 1
            if curr > max_run:
                max_run = curr
        else:
            curr = 0
    return round(float(max_run * step_hours), 2)


def evaluate_site_mission(
    lat_deg: float,
    lon_deg: float,
    start_utc: datetime,
    duration_days: float = 14.0,
    step_minutes: int = 60,
    dem: LolaSouthPoleDEM | None = None,
    eph: LunarEphemeris | None = None,
    include_patch: bool = True,
) -> Dict[str, Any]:
    """Run full terrain + horizon + ephemeris mission evaluation for a lunar coordinate."""
    dem = dem or get_dem()
    eph = eph or get_ephemeris()

    terrain_info = dem.local_slope_and_normal(lat_deg, lon_deg)

    # Differentiate observer mast heights: 2.0m for solar array, 3.5m for DTE antenna
    horizon_solar = compute_horizon_360(dem, lat_deg, lon_deg, observer_height_m=2.0)
    horizon_dte = compute_horizon_360(dem, lat_deg, lon_deg, observer_height_m=3.5)
    horizon_solar_arr = np.asarray(horizon_solar["horizon_el_deg"], dtype=np.float64)
    horizon_dte_arr = np.asarray(horizon_dte["horizon_el_deg"], dtype=np.float64)

    traj = eph.compute_trajectory(
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        elev_m=terrain_info["elev_m"],
        start_utc=start_utc,
        duration_days=duration_days,
        step_minutes=step_minutes,
    )

    sun_az = np.asarray(traj["sun_az_deg"], dtype=np.float64)
    sun_el = np.asarray(traj["sun_el_deg"], dtype=np.float64)
    earth_az = np.asarray(traj["earth_az_deg"], dtype=np.float64)
    earth_el = np.asarray(traj["earth_el_deg"], dtype=np.float64)

    # Interpolate horizon masks along exact Sun and Earth azimuths (periodic 360 deg)
    az_grid = np.arange(360, dtype=np.float64)
    hs_ext = np.append(horizon_solar_arr, horizon_solar_arr[0])
    hd_ext = np.append(horizon_dte_arr, horizon_dte_arr[0])
    az_ext = np.append(az_grid, 360.0)

    sun_horiz = np.interp(sun_az % 360.0, az_ext, hs_ext)
    earth_horiz = np.interp(earth_az % 360.0, az_ext, hd_ext)

    # Exact Topographic Obstruction Margins required by NASA:
    # delta_sun = (theta_sun + 0.26 deg solar semi-diameter) - theta_horiz(alpha_sun)
    # delta_earth = theta_earth - theta_horiz(alpha_earth)
    delta_sun = (sun_el + SUN_ANGULAR_RADIUS_DEG) - sun_horiz
    delta_earth = earth_el - earth_horiz

    # Exact Eddington limb-darkened solar disk fraction
    sun_margin = sun_el - sun_horiz
    sun_frac = compute_solar_disk_fraction(sun_margin)
    sun_lit = delta_sun > 0.0

    # Exact Earth disk geometric line-of-sight fraction
    earth_margin = earth_el - earth_horiz
    earth_frac = compute_earth_disk_fraction(earth_margin)
    earth_vis = earth_frac > 0.05

    # Compute incident solar flux on horizontal regolith and surface temp
    sun_dist_au = np.asarray(traj.get("sun_dist_au", np.ones_like(sun_el)), dtype=np.float64)
    flux_wm2, temp_k = compute_thermal_equilibrium(sun_frac, sun_el, sun_dist_au)

    # Realistic Incident Solar Flux on vertical/tracking polar solar array:
    # I = 1361 * f_sun * max(0, cos(incidence_angle)) where normal faces sun azimuth, so incidence = sun_el
    cos_inc = np.maximum(0.0, np.cos(np.radians(np.maximum(0.0, sun_el))))
    flux_vertical_wm2 = (SOLAR_CONSTANT_1AU_WM2 / np.maximum(0.8, sun_dist_au**2)) * sun_frac * cos_inc

    step_hours = step_minutes / 60.0
    sun_lit_pct = round(float(np.mean(sun_lit) * 100.0), 1)
    dte_pct = round(float(np.mean(earth_vis) * 100.0), 1)
    max_eclipse_hr = _longest_false_run_hours(sun_lit, step_hours)
    max_blackout_hr = _longest_false_run_hours(earth_vis, step_hours)

    # Realistic Rover Battery State in Watt-hours over 14-day timeline
    battery_wh, soc_pct = compute_rover_battery_timeline(flux_vertical_wm2, step_hours)

    # Realistic X-band DTE Link Budget with Knife-Edge Terrain Diffraction Loss
    diff_loss = compute_knife_edge_diffraction_loss(delta_earth)
    dte_link_margin_db = np.clip(X_BAND_UNOBSTRUCTED_MARGIN_DB - diff_loss, -45.0, 28.0)

    # Exact Countdown Calculators (hours to next sunset/sunrise, earthset/earthrise)
    sun_countdowns, sun_events = compute_event_countdowns(sun_lit, delta_sun, step_hours, "sunset", "sunrise")
    earth_countdowns, earth_events = compute_event_countdowns(earth_vis, delta_earth, step_hours, "earthset", "earthrise")

    # PSR (Permanently Shadowed Region) detection: zero sun, peak temp < 110K (volatile cold trap)
    max_temp = round(float(np.max(temp_k)), 1)
    min_temp = round(float(np.min(temp_k)), 1)
    is_psr = bool(sun_lit_pct < 0.1 and max_temp <= 110.0)

    # Comparative mission-window score (0-100), not a landing certification:
    # - 45% Solar Power Persistence
    # - 30% Direct-to-Earth Comms Uptime
    # - 15% Local-slope indicator (not a landing-pad safety assessment)
    # - 10% Thermal Night-Survival Penalty (penalize >100h continuous eclipse)
    slope = terrain_info["slope_deg"]
    slope_score = max(0.0, min(100.0, 100.0 * (1.0 - max(0.0, slope - 2.0) / 18.0)))
    eclipse_penalty = max(0.0, min(100.0, 100.0 * (1.0 - max_eclipse_hr / (duration_days * 24.0))))
    suitability = round(
        0.45 * sun_lit_pct + 0.30 * dte_pct + 0.15 * slope_score + 0.10 * eclipse_penalty,
        1,
    )

    result: Dict[str, Any] = {
        "lat_deg": round(float(lat_deg), 4),
        "lon_deg": round(float(lon_deg), 4),
        "terrain": terrain_info,
        "horizon_360_deg": horizon_solar["horizon_el_deg"],
        "horizon_solar_360_deg": horizon_solar["horizon_el_deg"],
        "horizon_dte_360_deg": horizon_dte["horizon_el_deg"],
        "trajectory": {
            **traj,
            "sun_horizon_deg": np.round(sun_horiz, 3).tolist(),
            "earth_horizon_deg": np.round(earth_horiz, 3).tolist(),
            "delta_sun_deg": np.round(delta_sun, 3).tolist(),
            "delta_earth_deg": np.round(delta_earth, 3).tolist(),
            "sun_visible": sun_lit.astype(bool).tolist(),
            "sun_visible_frac": np.round(sun_frac, 3).tolist(),
            "earth_visible": earth_vis.astype(bool).tolist(),
            "earth_visible_frac": np.round(earth_frac, 3).tolist(),
            "solar_flux_wm2": np.round(flux_wm2, 2).tolist(),
            "solar_flux_vertical_wm2": np.round(flux_vertical_wm2, 2).tolist(),
            "rover_battery_wh": np.round(battery_wh, 1).tolist(),
            "rover_battery_pct": np.round(soc_pct, 1).tolist(),
            "dte_link_margin_db": np.round(dte_link_margin_db, 2).tolist(),
            "surface_temp_k": np.round(temp_k, 1).tolist(),
            "countdown_sun_hours": sun_countdowns,
            "sun_event": sun_events,
            "countdown_earth_hours": earth_countdowns,
            "earth_event": earth_events,
        },
        "summary": {
            "sun_lit_pct": sun_lit_pct,
            "max_eclipse_hours": max_eclipse_hr,
            "dte_pct": dte_pct,
            "max_blackout_hours": max_blackout_hr,
            "slope_deg": terrain_info["slope_deg"],
            "elev_m": terrain_info["elev_m"],
            "suitability_score": suitability,
            "slope_safe": bool(slope <= 15.0),
            "max_temp_k": max_temp,
            "min_temp_k": min_temp,
            "is_psr": is_psr,
            "next_solar_event_hours": sun_countdowns[0] if sun_countdowns else 0.0,
            "next_solar_event_type": sun_events[0] if sun_events else "sunset",
            "next_earth_event_hours": earth_countdowns[0] if earth_countdowns else 0.0,
            "next_earth_event_type": earth_events[0] if earth_events else "earthset",
            "min_battery_wh": round(float(np.min(battery_wh)), 1),
            "min_battery_pct": round(float(np.min(soc_pct)), 1),
            "min_dte_margin_db": round(float(np.min(dte_link_margin_db)), 1),
        },
    }

    if include_patch:
        result["patch"] = dem.extract_patch(lat_deg, lon_deg, half_width_m=12_000.0, grid_size=128)

    return result
