"""Comprehensive unit, integration, and adversarial verification suite for Lunar Landing Site Navigator."""

from datetime import datetime, timezone
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.physics.dem import get_dem, R_MOON_M
from backend.physics.ephemeris import get_ephemeris, SUN_ANGULAR_RADIUS_DEG, EARTH_ANGULAR_RADIUS_DEG
from backend.physics.horizon import (
    compute_horizon_360,
    evaluate_site_mission,
    compute_solar_disk_fraction,
    compute_earth_disk_fraction,
    compute_thermal_equilibrium,
)


def test_lola_dem_known_landmarks() -> None:
    dem = get_dem()
    # Shackleton Crater interior must be deep negative; Mons Mouton & Malapert Massif must be elevated
    shackleton_floor = dem.sample_elevation_latlon(-89.67, 129.78)
    mons_mouton = dem.sample_elevation_latlon(-84.60, 31.20)
    malapert = dem.sample_elevation_latlon(-85.99, -0.23)
    assert shackleton_floor < -2000.0, f"Expected deep crater floor, got {shackleton_floor}"
    assert mons_mouton > 3500.0, f"Expected high peak on Mons Mouton, got {mons_mouton}"
    assert malapert > 3500.0, f"Expected high relief on Malapert Massif, got {malapert}"


def test_ephemeris_matches_jpl_horizons_reference() -> None:
    # Verified directly against NASA JPL Horizons API for 2026-11-12T12:00:00Z at (-88.90, 126.60E, 0.0m)
    eph = get_ephemeris()
    t = datetime(2026, 11, 12, 12, 0, 0, tzinfo=timezone.utc)
    res = eph.compute_single_instant(-88.90, 126.60, 0.0, t)
    assert abs(res["sun_az_deg"] - 18.3188) < 0.05, f"Sun Az mismatch: {res['sun_az_deg']}"
    assert abs(res["sun_el_deg"] - 2.5990) < 0.05, f"Sun El mismatch: {res['sun_el_deg']}"
    assert abs(res["earth_az_deg"] - 234.2615) < 0.05, f"Earth Az mismatch: {res['earth_az_deg']}"
    assert abs(res["earth_el_deg"] - (-6.5731)) < 0.05, f"Earth El mismatch: {res['earth_el_deg']}"


def test_eddington_solar_limb_darkening_monotonicity() -> None:
    # Test closed-form analytical Eddington solar limb-darkening
    margins = np.linspace(-SUN_ANGULAR_RADIUS_DEG * 1.5, SUN_ANGULAR_RADIUS_DEG * 1.5, 31)
    fracs = compute_solar_disk_fraction(margins)

    # 1. Must be bounded in [0, 1]
    assert np.all(fracs >= 0.0)
    assert np.all(fracs <= 1.0)

    # 2. Strict monotonicity across the transition
    diffs = np.diff(fracs)
    assert np.all(diffs >= -1e-12), "Illumination curve must be monotonically non-decreasing"

    # 3. Boundaries
    assert fracs[0] == 0.0
    assert fracs[-1] == 1.0

    # 4. Center bisection (margin = 0.0 -> exact 50% flux by disk symmetry)
    center_frac = float(compute_solar_disk_fraction(np.array([0.0]))[0])
    assert abs(center_frac - 0.50) < 1e-6, f"Center bisection must be 0.50, got {center_frac}"


def test_earth_disk_fraction_geometry() -> None:
    # Earth disk angular radius ~0.95 deg
    margins = np.array([-1.5, -0.95, 0.0, 0.95, 1.5])
    e_frac = compute_earth_disk_fraction(margins)

    assert e_frac[0] == 0.0
    assert abs(e_frac[1] - 0.0) < 1e-6
    assert abs(e_frac[2] - 0.5) < 1e-6
    assert abs(e_frac[3] - 1.0) < 1e-6
    assert e_frac[4] == 1.0


def test_thermal_radiative_equilibrium_physics() -> None:
    # Full sun at zenith (1 AU) vs grazing sun vs complete shadow
    sun_frac = np.array([0.0, 0.5, 1.0, 1.0])
    sun_el = np.array([0.0, 1.5, 1.5, 45.0])
    sun_dist = np.array([1.0, 1.0, 1.0, 1.0])

    flux, temp_k = compute_thermal_equilibrium(sun_frac, sun_el, sun_dist)

    # In zero sun: flux must be 0 and temp should be at cryogenic baseline (~38K - 45K)
    assert flux[0] == 0.0
    assert 38.0 <= temp_k[0] <= 50.0

    # At grazing angle in full sun: moderate polar surface temp (~150K)
    assert flux[2] > 0.0
    assert 130.0 <= temp_k[2] <= 200.0

    # At higher elevation: hotter surface (~300K - 370K)
    assert temp_k[3] > temp_k[2]
    assert temp_k[3] < 390.0


def test_horizon_360_shape_and_range() -> None:
    dem = get_dem()
    hz = compute_horizon_360(dem, -89.45, -137.30)
    assert len(hz["horizon_el_deg"]) == 360
    assert min(hz["horizon_el_deg"]) > -10.0
    assert max(hz["horizon_el_deg"]) < 30.0


def test_evaluate_mission_bounds_and_psr() -> None:
    start = datetime(2026, 11, 15, 0, 0, tzinfo=timezone.utc)
    # High plateau: Mons Mouton
    res_mouton = evaluate_site_mission(-84.60, 31.20, start, duration_days=7.0, step_minutes=60, include_patch=True)
    summary_m = res_mouton["summary"]
    assert 0.0 <= summary_m["sun_lit_pct"] <= 100.0
    assert 0.0 <= summary_m["dte_pct"] <= 100.0
    assert 0.0 <= summary_m["suitability_score"] <= 100.0
    assert not summary_m["is_psr"]
    assert len(res_mouton["patch"]["elevations"]) == 128 * 128
    assert "solar_flux_wm2" in res_mouton["trajectory"]
    assert "surface_temp_k" in res_mouton["trajectory"]


def test_rover_traverse_profile() -> None:
    dem = get_dem()
    # Path from Peak Near Shackleton (-88.90, 126.60) to Shackleton Rim (-89.67, 129.78)
    trav = dem.compute_traverse_profile(-88.90, 126.60, -89.67, 129.78, n_points=50)

    assert trav["total_distance_km"] > 10.0
    assert trav["max_slope_deg"] > 0.0
    assert trav["mean_slope_deg"] > 0.0
    assert len(trav["elevations_m"]) == 50
    assert len(trav["cum_dist_km"]) == 50
    assert "is_traversable" in trav


def test_fastapi_endpoints_comprehensive() -> None:
    client = TestClient(app)

    # 1. Sites list
    r_sites = client.get("/api/sites")
    assert r_sites.status_code == 200
    assert len(r_sites.json()) == 6

    # 2. Simulation with physics properties
    r_sim = client.get("/api/simulate", params={"site_id": "connecting_ridge", "duration_days": 7, "slip_days": 3})
    assert r_sim.status_code == 200
    data = r_sim.json()
    assert data["summary"]["suitability_score"] > 0.0
    assert "max_temp_k" in data["summary"]
    assert "min_temp_k" in data["summary"]
    assert "is_psr" in data["summary"]
    assert len(data["horizon"]) == 72
    assert len(data["timeline"]) > 0
    t0 = data["timeline"][0]
    assert "solar_flux_wm2" in t0
    assert "surface_temp_k" in t0
    assert "earth_visible_frac" in t0

    # 3. Rover Traverse Endpoint
    r_trav = client.get("/api/traverse", params={"lat_start": -88.90, "lon_start": 126.60, "lat_target": -89.67, "lon_target": 129.78, "n_points": 30})
    assert r_trav.status_code == 200
    trav_data = r_trav.json()
    assert trav_data["total_distance_km"] > 0
    assert len(trav_data["elevations_m"]) == 30

    # 4. Comparison Endpoint
    r_comp = client.get("/api/compare", params={"site_a": "shackleton_rim", "site_b": "mons_mouton"})
    assert r_comp.status_code == 200
    comp_data = r_comp.json()
    assert "winner_id" in comp_data
    assert "rationale" in comp_data
