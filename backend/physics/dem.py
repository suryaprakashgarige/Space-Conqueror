"""NASA PDS LRO LOLA South Polar Stereographic DEM reader and terrain analyzer."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Dict, Tuple, Any

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_IMG = ROOT / "data" / "raw" / "ldem_75s_240m.img"
DEFAULT_LBL = ROOT / "data" / "raw" / "ldem_75s_240m.lbl"

# Constants verified from ldem_75s_240m.lbl
R_MOON_M = 1_737_400.0
LINES = 3812
LINE_SAMPLES = 3812
MAP_SCALE_M = 240.0
SCALING_FACTOR = 0.5
CENTER_LINE_0 = 1905.5  # 1-indexed 1905.5 -> wait: PDS offset check below
CENTER_SAMPLE_0 = 1905.5


class LolaSouthPoleDEM:
    """Memory-mapped reader for NASA LOLA South Polar Stereographic DEM."""

    def __init__(self, img_path: Path = DEFAULT_IMG) -> None:
        self.img_path = Path(img_path)
        if not self.img_path.exists():
            raise FileNotFoundError(f"LOLA DEM not found: {self.img_path}")
        expected_bytes = LINES * LINE_SAMPLES * 2
        actual_bytes = self.img_path.stat().st_size
        if actual_bytes != expected_bytes:
            raise ValueError(
                f"DEM size mismatch for {self.img_path}: got {actual_bytes}, expected {expected_bytes}"
            )
        # Little-endian signed 16-bit integer (SAMPLE_TYPE = LSB_INTEGER, SAMPLE_BITS = 16)
        self._raw = np.memmap(self.img_path, dtype="<i2", mode="r", shape=(LINES, LINE_SAMPLES))
        # Center of projection in 0-based indices (PDS offset 1905.5 with 1-based -> 1904.5, symmetric grid 3812 -> 1905.5)
        self.cx = (LINE_SAMPLES - 1) / 2.0
        self.cy = (LINES - 1) / 2.0
        self.scale_m = MAP_SCALE_M

    def latlon_to_xy_m(self, lat_deg: float, lon_deg: float) -> Tuple[float, float]:
        """Convert selenographic (lat_deg, East lon_deg) to South Polar Stereographic (x, y) meters.

        Standard NASA LOLA South Polar Stereographic projection:
          Center lat = -90 deg, Center lon = 0 deg, +Y toward 0 deg E (Prime Meridian / Earthward),
          +X toward 90 deg E.
          r = 2 * R_moon * tan((90 + lat) / 2)
          x = r * sin(lon), y = r * cos(lon)
        Let's verify image orientation: in PDS South Polar Stereographic (center lon=0):
          0 deg lon is top of image (decreasing row, i.e., +y_map -> decreasing row index),
          90 deg E is right of image (+x_map -> increasing col index).
        """
        phi = np.radians(lat_deg)
        lam = np.radians(lon_deg)
        rho = 2.0 * R_MOON_M * np.tan(np.pi / 4.0 + phi / 2.0)  # zero at -90, positive northwards
        x_m = rho * np.sin(lam)
        y_m = rho * np.cos(lam)
        return float(x_m), float(y_m)

    def xy_m_to_rowcol(self, x_m: np.ndarray | float, y_m: np.ndarray | float) -> Tuple[np.ndarray, np.ndarray]:
        """Map stereographic (x_m, y_m) in meters to 0-based (row, col)."""
        col = self.cx + np.asarray(x_m, dtype=np.float64) / self.scale_m
        row = self.cy - np.asarray(y_m, dtype=np.float64) / self.scale_m
        return row, col

    def latlon_to_rowcol(self, lat_deg: float, lon_deg: float) -> Tuple[float, float]:
        x_m, y_m = self.latlon_to_xy_m(lat_deg, lon_deg)
        r, c = self.xy_m_to_rowcol(x_m, y_m)
        return float(r), float(c)

    def sample_elevation_rc(self, rows: np.ndarray, cols: np.ndarray) -> np.ndarray:
        """Bilinearly interpolate elevation in meters at floating-point (rows, cols)."""
        r = np.clip(np.asarray(rows, dtype=np.float64), 0.0, LINES - 1.0001)
        c = np.clip(np.asarray(cols, dtype=np.float64), 0.0, LINE_SAMPLES - 1.0001)
        r0 = np.floor(r).astype(np.int32)
        c0 = np.floor(c).astype(np.int32)
        dr = r - r0
        dc = c - c0
        z00 = self._raw[r0, c0].astype(np.float64)
        z01 = self._raw[r0, c0 + 1].astype(np.float64)
        z10 = self._raw[r0 + 1, c0].astype(np.float64)
        z11 = self._raw[r0 + 1, c0 + 1].astype(np.float64)
        dn = (
            z00 * (1.0 - dr) * (1.0 - dc)
            + z01 * (1.0 - dr) * dc
            + z10 * dr * (1.0 - dc)
            + z11 * dr * dc
        )
        return dn * SCALING_FACTOR

    def sample_elevation_latlon(self, lat_deg: float, lon_deg: float) -> float:
        r, c = self.latlon_to_rowcol(lat_deg, lon_deg)
        return float(self.sample_elevation_rc(np.array([r]), np.array([c]))[0])

    def local_slope_and_normal(self, lat_deg: float, lon_deg: float) -> Dict[str, float]:
        """Compute local elevation (m), terrain slope (deg), and aspect (deg clockwise from North)."""
        r, c = self.latlon_to_rowcol(lat_deg, lon_deg)
        ri = int(np.clip(round(r), 1, LINES - 2))
        ci = int(np.clip(round(c), 1, LINE_SAMPLES - 2))
        elev_m = float(self._raw[ri, ci]) * SCALING_FACTOR

        # Central differences over 2 * scale_m
        dz_dx = (float(self._raw[ri, ci + 1]) - float(self._raw[ri, ci - 1])) * SCALING_FACTOR / (2.0 * self.scale_m)
        dz_dy = (float(self._raw[ri - 1, ci]) - float(self._raw[ri + 1, ci])) * SCALING_FACTOR / (2.0 * self.scale_m)
        grad = np.hypot(dz_dx, dz_dy)
        slope_deg = float(np.degrees(np.arctan(grad)))
        aspect_deg = float((np.degrees(np.arctan2(-dz_dx, -dz_dy))) % 360.0)
        return {
            "elev_m": round(elev_m, 2),
            "slope_deg": round(slope_deg, 2),
            "aspect_deg": round(aspect_deg, 2),
            "dz_dx": round(float(dz_dx), 5),
            "dz_dy": round(float(dz_dy), 5),
        }

    def extract_patch(
        self,
        lat_deg: float,
        lon_deg: float,
        half_width_m: float = 2_000.0,
        grid_size: int = 128,
    ) -> Dict[str, Any]:
        """Extract an ENU-aligned (East/North centered at site) terrain height patch."""
        x0, y0 = self.latlon_to_xy_m(lat_deg, lon_deg)

        # Build local East-North basis at (lat_deg, lon_deg) in polar stereographic plane
        # At South Pole stereographic: North unit vector points radially inward (-x0, -y0)/|r|
        # Wait: at lat < 0, moving North (toward equator) moves radially OUTWARD (+rho)!
        # Let's verify: rho = 2*R*tan(pi/4 + lat/2); as lat increases (-89 -> -88), rho INCREASES!
        # Wait: -89 + 1 = -88 is NORTHWARD! So North unit vector points radially OUTWARD (+x0, +y0)!
        # Wait: let's double check! At pole (rho=0), every direction is North, specifically along meridian lon:
        # d(x,y)/d(lat) = (d_rho/d_lat) * (sin(lon), cos(lon)). Since d_rho/d_lat > 0, North = (+sin(lon), +cos(lon)).
        # And East = d(x,y)/d(lon) normalized = (+cos(lon), -sin(lon)).
        # Check cross product: East x North = (cos, -sin) x (sin, cos) = cos^2 + sin^2 = +1 (right-handed ENU!).
        lam = np.radians(lon_deg)
        east_vec = np.array([np.cos(lam), -np.sin(lam)])
        north_vec = np.array([np.sin(lam), np.cos(lam)])

        coords = np.linspace(-half_width_m, half_width_m, grid_size)
        ee, nn = np.meshgrid(coords, coords)  # row = north (-half..+half), col = east (-half..+half)
        # Flip north so row 0 is +North (top), row -1 is -North (bottom), matching standard DEM images
        nn_top = np.flipud(nn)

        px = x0 + ee * east_vec[0] + nn_top * north_vec[0]
        py = y0 + ee * east_vec[1] + nn_top * north_vec[1]
        rows, cols = self.xy_m_to_rowcol(px, py)
        elevs = self.sample_elevation_rc(rows, cols)

        return {
            "width_m": float(2.0 * half_width_m),
            "height_m": float(2.0 * half_width_m),
            "grid_size": int(grid_size),
            "min_elev_m": round(float(np.min(elevs)), 2),
            "max_elev_m": round(float(np.max(elevs)), 2),
            "center_elev_m": round(float(elevs[grid_size // 2, grid_size // 2]), 2),
            "elevations": np.round(elevs, 2).ravel().tolist(),
        }

    def south_pole_overview(self, grid_size: int = 160) -> Dict[str, Any]:
        """Return a downsampled full 80S-90S overview grid for the 2D South Pole minimap."""
        # 80S corresponds to rho = 2 * R * tan(5 deg) ~= 303.99 km ~= 1266 px radius
        half_px = 1320
        r0 = int(self.cy) - half_px
        r1 = int(self.cy) + half_px
        c0 = int(self.cx) - half_px
        c1 = int(self.cx) + half_px
        step = max(1, (r1 - r0) // grid_size)
        sub = self._raw[r0:r1:step, c0:c1:step].astype(np.float64) * SCALING_FACTOR
        return {
            "grid_size": int(sub.shape[0]),
            "extent_m": float(half_px * self.scale_m),
            "min_elev_m": round(float(np.min(sub)), 1),
            "max_elev_m": round(float(np.max(sub)), 1),
            "elevations": np.round(sub, 1).ravel().tolist(),
        }

    def compute_horizon_elevation_mask(
        self,
        lat_deg: float,
        lon_deg: float,
        max_dist_m: float = 90_000.0,
        radial_step_m: float = 240.0,
        az_step_deg: float = 5.0,
        observer_height_m: float = 2.0,
    ) -> Dict[str, Any]:
        """Compute 360-deg topographic horizon mask across LOLA DEM with spherical Moon curvature.

        Parameters:
            lat_deg, lon_deg: Observer selenographic position.
            max_dist_m: Maximum horizon raycast distance (meters).
            radial_step_m: Raymarch radial sampling step (meters).
            az_step_deg: Azimuth bin spacing (e.g. 5.0 deg -> 72 bins, 1.0 deg -> 360 bins).
            observer_height_m: Mast height above terrain (2.0m for solar array, 3.5m for DTE antenna).

        Curvature drop formula:
            delta_h(d) = -(d^2) / (2 * R_moon), R_moon = 1,737,400 m
        """
        x0, y0 = self.latlon_to_xy_m(lat_deg, lon_deg)
        z_surf = self.sample_elevation_latlon(lat_deg, lon_deg)
        z0 = z_surf + observer_height_m

        lam = np.radians(lon_deg)
        east_vec = np.array([np.cos(lam), -np.sin(lam)])
        north_vec = np.array([np.sin(lam), np.cos(lam)])

        az_deg = np.arange(0.0, 360.0, az_step_deg, dtype=np.float64)
        az_rad = np.radians(az_deg)

        # Direction vectors clockwise from North
        dir_x = np.sin(az_rad) * east_vec[0] + np.cos(az_rad) * north_vec[0]
        dir_y = np.sin(az_rad) * east_vec[1] + np.cos(az_rad) * north_vec[1]

        dists = np.arange(radial_step_m, max_dist_m + 1.0, radial_step_m, dtype=np.float64)
        px = x0 + dir_x[:, None] * dists[None, :]
        py = y0 + dir_y[:, None] * dists[None, :]

        rows, cols = self.xy_m_to_rowcol(px, py)
        elevs = self.sample_elevation_rc(rows, cols)

        # Lunar spherical curvature drop: delta_h = -(d^2) / (2 * R_moon)
        curv_drop = -(dists[None, :] ** 2) / (2.0 * R_MOON_M)
        apparent_elev = elevs + curv_drop

        angles_rad = np.arctan2(apparent_elev - z0, dists[None, :])
        horizon_deg = np.degrees(np.max(angles_rad, axis=1))

        return {
            "azimuth_deg": az_deg.tolist(),
            "horizon_el_deg": np.round(horizon_deg, 3).tolist(),
            "observer_elev_m": round(float(z_surf), 2),
            "observer_height_m": round(float(observer_height_m), 2),
            "az_step_deg": round(float(az_step_deg), 2),
        }


    def compute_traverse_profile(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float,
        n_points: int = 100,
    ) -> Dict[str, Any]:
        """Compute surface elevation profile, slope gradients, and traversal hazard along a rover path."""
        x1, y1 = self.latlon_to_xy_m(lat1, lon1)
        x2, y2 = self.latlon_to_xy_m(lat2, lon2)

        xs = np.linspace(x1, x2, n_points)
        ys = np.linspace(y1, y2, n_points)
        rows, cols = self.xy_m_to_rowcol(xs, ys)
        elevs = self.sample_elevation_rc(rows, cols)

        dx = np.diff(xs)
        dy = np.diff(ys)
        dist_steps = np.hypot(dx, dy)
        cum_dist_m = np.concatenate(([0.0], np.cumsum(dist_steps)))
        total_dist_km = round(float(cum_dist_m[-1] / 1000.0), 3)

        # Segment slope angles in degrees
        dz = np.diff(elevs)
        slopes_deg = np.degrees(np.arctan2(np.abs(dz), np.maximum(1.0, dist_steps)))
        max_slope = round(float(np.max(slopes_deg)), 2)
        mean_slope = round(float(np.mean(slopes_deg)), 2)

        ascent_m = round(float(np.sum(dz[dz > 0])), 1)
        descent_m = round(float(np.sum(-dz[dz < 0])), 1)

        # Traverse hazard classification: Safe <= 15°, Moderate <= 20°, Severe > 20°
        is_traversable = bool(max_slope <= 20.0)

        return {
            "total_distance_km": total_dist_km,
            "max_slope_deg": max_slope,
            "mean_slope_deg": mean_slope,
            "total_ascent_m": ascent_m,
            "total_descent_m": descent_m,
            "is_traversable": is_traversable,
            "cum_dist_km": np.round(cum_dist_m / 1000.0, 3).tolist(),
            "elevations_m": np.round(elevs, 2).tolist(),
            "segment_slopes_deg": np.round(slopes_deg, 2).tolist(),
        }


@lru_cache(maxsize=1)
def get_dem() -> LolaSouthPoleDEM:
    return LolaSouthPoleDEM()
