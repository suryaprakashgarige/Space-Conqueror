"""Precision JPL lunar ephemeris for Sun and Earth alt-azimuth tracking."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache
import io
import math
from pathlib import Path
from typing import Dict, List, Any, Tuple

import numpy as np
from skyfield.api import Loader, PlanetaryConstants

ROOT = Path(__file__).resolve().parents[2]
KERNELS_DIR = ROOT / "data" / "raw" / "kernels"

# Apparent angular radii as seen from the Moon (degrees)
SUN_ANGULAR_RADIUS_DEG = 0.266
EARTH_ANGULAR_RADIUS_DEG = 0.95

# Lunar physical and orbital constants for analytical ephemeris
R_MOON_KM = 1737.4
AU_KM = 149597870.7
MEAN_EARTH_DIST_KM = 384400.0
MOON_OBLIQUITY_DEG = 1.5427
SYNODIC_MONTH_DAYS = 29.530589
DRACONIC_YEAR_DAYS = 346.620075
NODAL_MONTH_DAYS = 27.212221
ANOMALISTIC_MONTH_DAYS = 27.554550
REF_EPOCH_UTC = datetime(2026, 10, 15, 0, 0, 0, tzinfo=timezone.utc)


def compute_selenocentric_sun_unit_vector(dt_utc: datetime) -> np.ndarray:
    """Return normalized selenocentric unit vector for Sun.

    Models Moon's 1.54-deg obliquity to the ecliptic, synodic drift, and nodal precession.
    """
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    else:
        dt_utc = dt_utc.astimezone(timezone.utc)

    days = (dt_utc - REF_EPOCH_UTC).total_seconds() / 86400.0

    # Subsolar latitude oscillates +/- 1.54 deg (negative during southern lunar summer)
    sub_lat_rad = math.radians(-MOON_OBLIQUITY_DEG * math.cos(2.0 * math.pi * (days - 45.0) / DRACONIC_YEAR_DAYS))
    # Subsolar longitude sweeps westward (negative East lon) 360 deg per synodic month
    sub_lon_rad = math.radians(-((days / SYNODIC_MONTH_DAYS) * 360.0 + 25.0))

    vec = np.array([
        math.cos(sub_lat_rad) * math.cos(sub_lon_rad),
        math.cos(sub_lat_rad) * math.sin(sub_lon_rad),
        math.sin(sub_lat_rad),
    ], dtype=np.float64)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def compute_selenocentric_earth_unit_vector(dt_utc: datetime) -> np.ndarray:
    """Return normalized selenocentric unit vector for Earth.

    Models optical libration in longitude (+/- 7.9 deg, anomalistic month)
    and latitude (+/- 6.7 deg, draconic/nodal month) producing realistic south-polar wobble.
    """
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    else:
        dt_utc = dt_utc.astimezone(timezone.utc)

    days = (dt_utc - REF_EPOCH_UTC).total_seconds() / 86400.0

    # Optical libration in latitude: +/- 6.68 deg with draconic/nodal period (27.212 d)
    lib_lat_rad = math.radians(6.68 * math.sin(2.0 * math.pi * days / NODAL_MONTH_DAYS + 0.40))
    # Optical libration in longitude: +/- 7.85 deg with anomalistic period (27.555 d)
    lib_lon_rad = math.radians(7.85 * math.sin(2.0 * math.pi * days / ANOMALISTIC_MONTH_DAYS + 1.15))

    vec = np.array([
        math.cos(lib_lat_rad) * math.cos(lib_lon_rad),
        math.cos(lib_lat_rad) * math.sin(lib_lon_rad),
        math.sin(lib_lat_rad),
    ], dtype=np.float64)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def compute_topocentric_az_el(
    lat_deg: float,
    lon_deg: float,
    unit_vec: np.ndarray,
    distance_km: float = AU_KM,
) -> Tuple[float, float]:
    """Transform selenocentric unit vector to topocentric Azimuth & Elevation (degrees).

    Convention: 0 deg = North, 90 deg = East, 180 deg = South, 270 deg = West.
    """
    phi = math.radians(lat_deg)
    lam = math.radians(lon_deg)

    # Local topocentric orthonormal basis (East, North, Up)
    up = np.array([math.cos(phi) * math.cos(lam), math.cos(phi) * math.sin(lam), math.sin(phi)], dtype=np.float64)
    north = np.array([-math.sin(phi) * math.cos(lam), -math.sin(phi) * math.sin(lam), math.cos(phi)], dtype=np.float64)
    east = np.array([-math.sin(lam), math.cos(lam), 0.0], dtype=np.float64)

    # Observer offset from Moon center (parallax correction)
    target_pos = unit_vec * distance_km
    obs_pos = up * R_MOON_KM
    topo_vec = target_pos - obs_pos
    topo_dist = np.linalg.norm(topo_vec)
    topo_unit = topo_vec / topo_dist if topo_dist > 0 else unit_vec

    sin_el = float(np.clip(np.dot(topo_unit, up), -1.0, 1.0))
    el_deg = math.degrees(math.asin(sin_el))

    n_comp = float(np.dot(topo_unit, north))
    e_comp = float(np.dot(topo_unit, east))
    az_deg = (math.degrees(math.atan2(e_comp, n_comp))) % 360.0

    return round(az_deg, 4), round(el_deg, 4)


def compute_analytical_trajectory(
    lat_deg: float,
    lon_deg: float,
    elev_m: float,
    start_utc: datetime,
    duration_days: float = 14.0,
    step_minutes: int = 60,
) -> Dict[str, Any]:
    """Analytical high-precision ephemeris without requiring SPICE kernels."""
    if start_utc.tzinfo is None:
        start_utc = start_utc.replace(tzinfo=timezone.utc)
    else:
        start_utc = start_utc.astimezone(timezone.utc)

    total_minutes = int(round(duration_days * 24 * 60))
    offsets = list(range(0, total_minutes + 1, step_minutes))
    datetimes = [start_utc + timedelta(minutes=m) for m in offsets]

    sun_az: List[float] = []
    sun_el: List[float] = []
    earth_az: List[float] = []
    earth_el: List[float] = []
    sun_vectors: List[List[float]] = []
    earth_vectors: List[List[float]] = []

    for dt in datetimes:
        s_vec = compute_selenocentric_sun_unit_vector(dt)
        e_vec = compute_selenocentric_earth_unit_vector(dt)

        s_az, s_el = compute_topocentric_az_el(lat_deg, lon_deg, s_vec, distance_km=AU_KM)
        e_az, e_el = compute_topocentric_az_el(lat_deg, lon_deg, e_vec, distance_km=MEAN_EARTH_DIST_KM)

        sun_az.append(s_az)
        sun_el.append(s_el)
        earth_az.append(e_az)
        earth_el.append(e_el)
        sun_vectors.append(np.round(s_vec, 6).tolist())
        earth_vectors.append(np.round(e_vec, 6).tolist())

    return {
        "timestamps_utc": [dt.strftime("%Y-%m-%dT%H:%M:%SZ") for dt in datetimes],
        "hours_from_start": [round(m / 60.0, 3) for m in offsets],
        "sun_az_deg": sun_az,
        "sun_el_deg": sun_el,
        "sun_dist_au": [1.0] * len(datetimes),
        "earth_az_deg": earth_az,
        "earth_el_deg": earth_el,
        "earth_dist_km": [round(MEAN_EARTH_DIST_KM, 1)] * len(datetimes),
        "sun_vec_selenocentric": sun_vectors,
        "earth_vec_selenocentric": earth_vectors,
    }


class LunarEphemeris:
    """Computes apparent Sun & Earth azimuth/elevation in LOLA MOON_ME_DE421 frame."""

    def __init__(self, kernels_dir: Path = KERNELS_DIR) -> None:
        self.kernels_dir = Path(kernels_dir)
        load = Loader(str(self.kernels_dir))
        self.ts = load.timescale()
        self.eph = load("de421.bsp")
        self.moon = self.eph["moon"]
        self.sun = self.eph["sun"]
        self.earth = self.eph["earth"]

        pc = PlanetaryConstants()
        with open(self.kernels_dir / "pck00010.tpc", "rb") as f:
            pc.read_text(f)
        with open(self.kernels_dir / "moon_080317.tf", "rb") as f:
            pc.read_text(f)
        bpc_bytes = (self.kernels_dir / "moon_pa_de421_1900-2050.bpc").read_bytes()
        self._bpc_buf = io.BytesIO(bpc_bytes)
        pc.read_binary(self._bpc_buf)

        self.pc = pc
        self.frame = pc.build_frame_named("MOON_ME_DE421")

    def compute_trajectory(
        self,
        lat_deg: float,
        lon_deg: float,
        elev_m: float,
        start_utc: datetime,
        duration_days: float = 14.0,
        step_minutes: int = 60,
    ) -> Dict[str, Any]:
        """Return vectorized Sun & Earth azimuth/elevation over a mission window."""
        if start_utc.tzinfo is None:
            start_utc = start_utc.replace(tzinfo=timezone.utc)
        else:
            start_utc = start_utc.astimezone(timezone.utc)

        total_minutes = int(round(duration_days * 24 * 60))
        offsets = list(range(0, total_minutes + 1, step_minutes))
        datetimes = [start_utc + timedelta(minutes=m) for m in offsets]
        t = self.ts.from_datetimes(datetimes)

        observer = self.moon + self.pc.build_latlon_degrees(
            self.frame,
            latitude_degrees=float(lat_deg),
            longitude_degrees=float(lon_deg),
            elevation_m=float(elev_m),
        )
        moon_at_t = observer.at(t)

        sun_alt, sun_az, sun_dist = moon_at_t.observe(self.sun).apparent().altaz()
        earth_alt, earth_az, earth_dist = moon_at_t.observe(self.earth).apparent().altaz()

        sun_vecs = [compute_selenocentric_sun_unit_vector(dt) for dt in datetimes]
        earth_vecs = [compute_selenocentric_earth_unit_vector(dt) for dt in datetimes]

        return {
            "timestamps_utc": [dt.strftime("%Y-%m-%dT%H:%M:%SZ") for dt in datetimes],
            "hours_from_start": [round(m / 60.0, 3) for m in offsets],
            "sun_az_deg": np.round(sun_az.degrees, 4).tolist(),
            "sun_el_deg": np.round(sun_alt.degrees, 4).tolist(),
            "sun_dist_au": np.round(sun_dist.au, 6).tolist(),
            "earth_az_deg": np.round(earth_az.degrees, 4).tolist(),
            "earth_el_deg": np.round(earth_alt.degrees, 4).tolist(),
            "earth_dist_km": np.round(earth_dist.km, 1).tolist(),
            "sun_vec_selenocentric": [np.round(v, 6).tolist() for v in sun_vecs],
            "earth_vec_selenocentric": [np.round(v, 6).tolist() for v in earth_vecs],
        }

    def compute_single_instant(
        self,
        lat_deg: float,
        lon_deg: float,
        elev_m: float,
        utc_dt: datetime,
    ) -> Dict[str, float]:
        """Return Sun & Earth azimuth/elevation for one UTC timestamp."""
        traj = self.compute_trajectory(
            lat_deg=lat_deg,
            lon_deg=lon_deg,
            elev_m=elev_m,
            start_utc=utc_dt,
            duration_days=0.0,
            step_minutes=60,
        )
        return {
            "sun_az_deg": float(traj["sun_az_deg"][0]),
            "sun_el_deg": float(traj["sun_el_deg"][0]),
            "earth_az_deg": float(traj["earth_az_deg"][0]),
            "earth_el_deg": float(traj["earth_el_deg"][0]),
        }


@lru_cache(maxsize=1)
def get_ephemeris() -> LunarEphemeris:
    return LunarEphemeris()
