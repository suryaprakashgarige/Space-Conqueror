"""Precompute and export real NASA LOLA terrain and simulation JSON packs for zero-backend static deployment."""

from datetime import datetime, timezone
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.sites import CANDIDATE_SITES
from backend.physics.dem import get_dem
from backend.main import simulate, get_site_terrain

PUB_DATA = ROOT / "frontend" / "public" / "data"
PUB_DATA.mkdir(parents=True, exist_ok=True)


def main() -> None:
    dem = get_dem()

    print("1. Exporting sites.json ...")
    sites_list = [
        {
            "id": s.id,
            "name": s.name,
            "region": s.region,
            "lat_deg": s.lat_deg,
            "lon_deg": s.lon_deg,
            "mission_context": s.mission_context,
            "science_highlight": s.science_highlight,
        }
        for s in CANDIDATE_SITES
    ]
    (PUB_DATA / "sites.json").write_text(json.dumps(sites_list, indent=2), encoding="utf-8")

    print("2. Exporting 80S-90S south_pole_map.json ...")
    sp_map = dem.south_pole_overview(grid_size=160)
    (PUB_DATA / "south_pole_map.json").write_text(json.dumps(sp_map), encoding="utf-8")

    default_start = "2026-11-15T00:00:00Z"
    for s in CANDIDATE_SITES:
        print(f"3. Exporting real NASA terrain & sim for {s.id} ...")
        t_data = get_site_terrain(s.id, grid_size=128)
        (PUB_DATA / f"terrain_{s.id}.json").write_text(json.dumps(t_data), encoding="utf-8")

        sim_data = simulate(site_id=s.id, start_utc=default_start, duration_days=14.0, slip_days=0.0)
        sim_data["data_source"] = "static"
        (PUB_DATA / f"sim_{s.id}.json").write_text(json.dumps(sim_data), encoding="utf-8")

    print("\n[OK] All static JSON packs exported to frontend/public/data/")


if __name__ == "__main__":
    main()
