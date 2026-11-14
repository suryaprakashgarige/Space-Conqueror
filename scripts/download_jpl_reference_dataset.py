"""Downloads official NASA JPL Horizons ground-truth alt-azimuth ephemeris vectors
for Sun and Earth across Artemis South Pole landing sites and benchmark mission windows.
"""

import json
import re
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "raw" / "jpl_horizons_ground_truth.json"

SITES = [
    {"name": "Peak Near Shackleton", "lat": -88.90, "lon": 126.60, "elev_m": 0.0},
    {"name": "Connecting Ridge", "lat": -89.45, "lon": -137.30, "elev_m": 0.0},
    {"name": "Mons Mouton", "lat": -84.60, "lon": 31.20, "elev_m": 0.0},
    {"name": "Malapert Massif", "lat": -85.99, "lon": -0.23, "elev_m": 0.0},
    {"name": "Shackleton Crater Rim", "lat": -89.67, "lon": 129.78, "elev_m": 0.0},
    {"name": "Haworth Crater", "lat": -87.40, "lon": -5.10, "elev_m": 0.0},
]

DATES = [
    "2026-11-12 12:00",
    "2026-11-20 00:00",
    "2026-12-05 06:00",
    "2027-01-15 18:00",
]


def fetch_horizons_vector(target_id: str, lat: float, lon: float, date_str: str) -> Dict[str, float]:
    """Fetch apparent Azimuth and Elevation for target ('10' for Sun, '399' for Earth) from Moon site."""
    # Format coordinate string: lon,lat,elev_km
    # In Horizons: coord@301 (301 is Moon body-fixed frame)
    # SITE_COORD='lon,lat,alt' (lon positive East)
    # QUANTITIES='4' -> Apparent Azimuth & Elevation
    params = {
        "format": "json",
        "COMMAND": f"'{target_id}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon:.4f},{lat:.4f},0'",
        "START_TIME": f"'{date_str}'",
        "STOP_TIME": f"'{date_str[:-2]}59'",
        "STEP_SIZE": "'1d'",
        "QUANTITIES": "'4'",
    }
    qs_parts = []
    for k, v in params.items():
        v_escaped = urllib.parse.quote(str(v), safe="'")
        qs_parts.append(f"{k}={v_escaped}")
    qs = "&".join(qs_parts)
    url = f"https://ssd.jpl.nasa.gov/api/horizons.api?{qs}"

    req = urllib.request.Request(url, headers={"User-Agent": "LunarLandingNavigator/2026 (NASA Space Apps)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    text = data.get("result", "")
    # Parse $$SOE ... $$EOE
    match = re.search(r"\$\$SOE\s*\n(.*?)\n\s*\$\$EOE", text, re.DOTALL)
    if not match:
        raise ValueError(f"Could not parse SOE block from Horizons result for {target_id} at {date_str}")

    line = match.group(1).strip()
    parts = line.split()
    # Format: Date, Time, Flags(*), Azimuth, Elevation
    # e.g.: 2026-Nov-12 12:00 * 18.318826 2.599051
    az_deg = float(parts[-2])
    el_deg = float(parts[-1])
    return {"az_deg": az_deg, "el_deg": el_deg}


def build_dataset() -> None:
    print(f"[AstroDataAgent] Querying NASA JPL Horizons API for ground truth vectors...")
    records = []

    for site in SITES:
        print(f"  Fetching for site: {site['name']} ({site['lat']}, {site['lon']})...")
        for dt_str in DATES:
            try:
                sun_vec = fetch_horizons_vector("10", site["lat"], site["lon"], dt_str)
                time.sleep(0.3)
                earth_vec = fetch_horizons_vector("399", site["lat"], site["lon"], dt_str)
                time.sleep(0.3)

                rec = {
                    "site_name": site["name"],
                    "lat_deg": site["lat"],
                    "lon_deg": site["lon"],
                    "utc_time": dt_str,
                    "sun": sun_vec,
                    "earth": earth_vec,
                }
                records.append(rec)
                print(f"    {dt_str}: Sun Az={sun_vec['az_deg']:.2f}° El={sun_vec['el_deg']:.2f}°, Earth Az={earth_vec['az_deg']:.2f}° El={earth_vec['el_deg']:.2f}°")
            except Exception as e:
                print(f"    Error on {site['name']} at {dt_str}: {e}")

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"dataset_version": "2026.1", "source": "NASA JPL Horizons REST API", "records": records}, f, indent=2)

    print(f"[AstroDataAgent] Saved {len(records)} verified ground-truth vectors to: {OUT_FILE}")


if __name__ == "__main__":
    import urllib.parse
    build_dataset()
