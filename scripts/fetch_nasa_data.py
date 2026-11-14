"""Download official NASA PDS LRO LOLA South Pole DEMs and JPL lunar kernels."""

from pathlib import Path
import requests
from skyfield.api import Loader

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
KERNELS_DIR = RAW_DIR / "kernels"

BASE_PDS = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img"

DOWNLOADS = {
    RAW_DIR / "ldem_75s_240m.lbl": f"{BASE_PDS}/ldem_75s_240m.lbl",
    RAW_DIR / "ldem_75s_240m.img": f"{BASE_PDS}/ldem_75s_240m.img",
    RAW_DIR / "ldem_80s_80m.lbl": f"{BASE_PDS}/ldem_80s_80m.lbl",
    RAW_DIR / "ldem_80s_80m.img": f"{BASE_PDS}/ldem_80s_80m.img",
    KERNELS_DIR / "moon_pa_de421_1900-2050.bpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc",
    KERNELS_DIR / "moon_080317.tf": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf",
    KERNELS_DIR / "pck00010.tpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
}


def download_file(dest: Path, url: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"[skip] {dest.name} already exists ({dest.stat().st_size / 1e6:.2f} MB)", flush=True)
        return
    print(f"[get]  {dest.name} ...", flush=True)
    with requests.get(url, stream=True, timeout=(15, 60)) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        downloaded = 0
        tmp = dest.with_suffix(dest.suffix + ".part")
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
        tmp.replace(dest)
        print(f"[done] {dest.name} ({downloaded / 1e6:.2f} MB / {total / 1e6:.2f} MB)", flush=True)


def main() -> None:
    # Remove any old stalled .part files from PGDA
    for p in RAW_DIR.glob("*.TIF.part"):
        p.unlink(missing_ok=True)

    for dest, url in DOWNLOADS.items():
        download_file(dest, url)

    load = Loader(str(KERNELS_DIR))
    eph = load("de421.bsp")
    print(f"[ok]   de421.bsp ready ({len(eph.names())} bodies)", flush=True)

    for lbl_name in ("ldem_75s_240m.lbl", "ldem_80s_80m.lbl"):
        print(f"\n=== {lbl_name} ===", flush=True)
        print((RAW_DIR / lbl_name).read_text(encoding="utf-8", errors="ignore"), flush=True)


if __name__ == "__main__":
    main()
