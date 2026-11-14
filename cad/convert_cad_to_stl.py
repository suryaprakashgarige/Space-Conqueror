from build123d import import_step, export_stl, Compound
from pathlib import Path

cad_dir = Path(r"C:\Users\Surya\.gemini\antigravity\scratch\lunar-landing-site-navigator\cad")

step_files = [
    "artemis_lunar_lander.step",
    "artemis_lunar_rover.step",
    "lunar_relay_satellite.step",
    "artemis_landing_gear_strut.step"
]

for name in step_files:
    step_p = cad_dir / name
    stl_p = cad_dir / name.replace(".step", ".stl")
    if step_p.exists():
        print(f"Converting {name} to STL...")
        try:
            shape = import_step(str(step_p))
            export_stl(shape, str(stl_p))
            print(f"  -> Generated {stl_p.name} ({stl_p.stat().st_size:,} bytes)")
        except Exception as e:
            print(f"  Standard export failed ({e}), attempting compound solid extraction...")
            try:
                comp = Compound.make_compound(shape.solids())
                export_stl(comp, str(stl_p))
                print(f"  -> Generated {stl_p.name} via Compound ({stl_p.stat().st_size:,} bytes)")
            except Exception as e2:
                print(f"  Compound failed: {e2}")

print("[Conversion Check Complete]")
