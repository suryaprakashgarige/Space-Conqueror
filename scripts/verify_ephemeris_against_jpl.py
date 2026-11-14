"""Verification script comparing local SPICE LunarEphemeris against downloaded JPL Horizons truth."""

import json
from datetime import datetime, timezone
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.physics.ephemeris import get_ephemeris
GT_PATH = ROOT / "data" / "raw" / "jpl_horizons_ground_truth.json"


def run_verification():
    with open(GT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    eph = get_ephemeris()
    records = data["records"]
    print(f"[AstroDataAgent] Verifying {len(records)} ground-truth vectors against local SPICE ephemeris...")

    max_sun_az = 0.0
    max_sun_el = 0.0
    max_earth_az = 0.0
    max_earth_el = 0.0

    for r in records:
        t = datetime.strptime(r["utc_time"], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        res = eph.compute_single_instant(r["lat_deg"], r["lon_deg"], 0.0, t)

        d_sun_az = abs((res["sun_az_deg"] - r["sun"]["az_deg"] + 180.0) % 360.0 - 180.0)
        d_sun_el = abs(res["sun_el_deg"] - r["sun"]["el_deg"])
        d_earth_az = abs((res["earth_az_deg"] - r["earth"]["az_deg"] + 180.0) % 360.0 - 180.0)
        d_earth_el = abs(res["earth_el_deg"] - r["earth"]["el_deg"])

        max_sun_az = max(max_sun_az, d_sun_az)
        max_sun_el = max(max_sun_el, d_sun_el)
        max_earth_az = max(max_earth_az, d_earth_az)
        max_earth_el = max(max_earth_el, d_earth_el)

    print(f"  Max Sun Azimuth Residual:   {max_sun_az:.5f}° (Limit: <0.05°)")
    print(f"  Max Sun Elevation Residual: {max_sun_el:.5f}° (Limit: <0.05°)")
    print(f"  Max Earth Azimuth Residual:   {max_earth_az:.5f}° (Limit: <0.05°)")
    print(f"  Max Earth Elevation Residual: {max_earth_el:.5f}° (Limit: <0.05°)")

    assert max_sun_az < 0.05, f"Sun Az residual too large: {max_sun_az}"
    assert max_sun_el < 0.05, f"Sun El residual too large: {max_sun_el}"
    assert max_earth_az < 0.05, f"Earth Az residual too large: {max_earth_az}"
    assert max_earth_el < 0.05, f"Earth El residual too large: {max_earth_el}"

    print("[SUCCESS] All 24 JPL Horizons vectors match local physics core to <0.05° precision!")


if __name__ == "__main__":
    run_verification()
