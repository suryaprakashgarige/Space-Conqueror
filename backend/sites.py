"""Curated NASA Artemis III / CLPS South Pole candidate landing sites."""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any


@dataclass(frozen=True)
class CandidateSite:
    id: str
    name: str
    region: str
    lat_deg: float  # Selenographic latitude (negative = South)
    lon_deg: float  # Selenographic East longitude [-180, 180]
    mission_context: str
    science_highlight: str


CANDIDATE_SITES: List[CandidateSite] = [
    CandidateSite(
        id="shackleton_rim",
        name="Peak Near Shackleton",
        region="Shackleton Crater Rim",
        lat_deg=-88.90,
        lon_deg=126.60,
        mission_context="High-elevation ridge adjacent to Shackleton Crater; prime Artemis illumination target.",
        science_highlight="Direct access to permanently shadowed crater walls rich in potential water ice.",
    ),
    CandidateSite(
        id="mons_mouton",
        name="Mons Mouton Plateau",
        region="Mons Mouton (Leibnitz Beta)",
        lat_deg=-84.60,
        lon_deg=31.20,
        mission_context="Broad elevated flat-topped plateau selected for Artemis III & CLPS IM-2 precursor.",
        science_highlight="Ancient impact-basin massif ideal for safe lander touchdown and long-range traverse.",
    ),
    CandidateSite(
        id="malapert_massif",
        name="Malapert Massif",
        region="Malapert Mountain Ridge",
        lat_deg=-85.99,
        lon_deg=-0.23,
        mission_context="Prime near-side ridge renowned for strong Direct-to-Earth (DTE) line-of-sight.",
        science_highlight="Commanding 5 km relief overlooking South Pole-Aitken basin ejecta.",
    ),
    CandidateSite(
        id="connecting_ridge",
        name="Connecting Ridge",
        region="Shackleton–de Gerlache Ridge",
        lat_deg=-89.45,
        lon_deg=-137.30,
        mission_context="Narrow elevated bridge linking Shackleton and de Gerlache craters with high solar persistence.",
        science_highlight="Straddles two deep permanently shadowed cold traps within rover traverse reach.",
    ),
    CandidateSite(
        id="haworth_rim",
        name="Haworth Rim",
        region="Haworth Crater Margin",
        lat_deg=-86.75,
        lon_deg=-23.20,
        mission_context="High-latitude rim near one of the coldest shadowed basins at the South Pole.",
        science_highlight="Ancient highland crust next to multi-billion-year cryogenic volatile traps.",
    ),
    CandidateSite(
        id="nobile_rim",
        name="Nobile Rim 1",
        region="Nobile Crater Rim",
        lat_deg=-85.40,
        lon_deg=37.40,
        mission_context="Elevated rim segment along Nobile Crater evaluated for NASA VIPER & Artemis traverses.",
        science_highlight="Diverse slope gradients and nearby micro-cold traps for volatile sampling.",
    ),
]


def get_sites_as_dicts() -> List[Dict[str, Any]]:
    return [asdict(s) for s in CANDIDATE_SITES]


def get_site_by_id(site_id: str) -> CandidateSite | None:
    for site in CANDIDATE_SITES:
        if site.id == site_id:
            return site
    return None
