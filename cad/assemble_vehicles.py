from build123d import import_step, export_step, export_stl, Compound, Location, Rotation
import win32com.client
import pythoncom
import math
from pathlib import Path

modular_dir = Path(r"C:\Users\Surya\.gemini\antigravity\scratch\lunar-landing-site-navigator\cad\modular")
cad_dir = modular_dir.parent

def load_solid(filename):
    p = modular_dir / filename
    shape = import_step(str(p))
    if hasattr(shape, "solids") and len(shape.solids()) > 0:
        return Compound(shape.solids())
    return shape

print("[Assembly Engineering] Loading modular STEP components...")
descent_stage = load_solid("lander_descent_stage.step")
ascent_cabin = load_solid("lander_ascent_cabin.step")
engine_bell = load_solid("lander_engine_bell.step")
prop_tank = load_solid("lander_propellant_tank.step")
landing_strut = load_solid("lander_landing_strut.step")
solar_wing = load_solid("lander_solar_wing.step")

# 1. ASSEMBLE ARTEMIS LUNAR LANDER
lander_components = []

# Core descent stage at origin
lander_components.append(descent_stage.locate(Location((0, 0, 0))))

# Ascent crew cabin on top of descent stage (Z = 1.6m)
lander_components.append(ascent_cabin.locate(Location((0, 0, 1.6))))

# Main descent engine bell at bottom (Z = -0.05m pointing down)
lander_components.append(engine_bell.locate(Location((0, 0, -0.05))))

# 4 Propellant Tanks in quadrants
tank_positions = [
    (1.45, 1.45, 0.35),
    (1.45, -1.45, 0.35),
    (-1.45, 1.45, 0.35),
    (-1.45, -1.45, 0.35)
]
for pos in tank_positions:
    lander_components.append(prop_tank.locate(Location(pos)))

# 4 Telescoping Landing Gear Struts at 45 degree corners
strut_positions = [
    (1.98, 1.98, -0.9),
    (1.98, -1.98, -0.9),
    (-1.98, 1.98, -0.9),
    (-1.98, -1.98, -0.9)
]
for pos in strut_positions:
    lander_components.append(landing_strut.locate(Location(pos)))

# 2 Solar Wings (Deployed +/- X)
lander_components.append(solar_wing.locate(Location((1.25, 0, 2.2))))
lander_components.append(solar_wing.locate(Location((-1.25, 0, 2.2), (0, 0, 180))))

# Build full Lander Assembly Compound
lander_assembly = Compound(lander_components)
lander_step_path = str(cad_dir / "artemis_lander_assembly.step")
lander_stl_path = str(cad_dir / "artemis_lander_assembly.stl")
export_step(lander_assembly, lander_step_path)
export_stl(lander_assembly, lander_stl_path)
print(f"[Lander Assembly Complete] Exported STEP: {lander_step_path}")
print(f"[Lander Assembly Complete] Exported STL: {lander_stl_path}")

# 2. ASSEMBLE ARTEMIS LUNAR TERRAIN VEHICLE (LTV ROVER)
rover_chassis = load_solid("rover_chassis_frame.step")
rover_wheel = load_solid("rover_compliant_wheel.step")
rover_mast = load_solid("rover_sensor_mast.step")

rover_components = []
# Chassis at 0.55m ground clearance
rover_components.append(rover_chassis.locate(Location((0, 0, 0.55))))

# 4 Wheels
wheel_positions = [
    (1.05, 0.95, 0.41),
    (1.05, -0.95, 0.41),
    (-1.05, 0.95, 0.41),
    (-1.05, -0.95, 0.41)
]
for pos in wheel_positions:
    rover_components.append(rover_wheel.locate(Location(pos)))

# Forward NavCam mast
rover_components.append(rover_mast.locate(Location((1.15, 0, 0.77))))

rover_assembly = Compound(rover_components)
rover_step_path = str(cad_dir / "artemis_rover_assembly.step")
rover_stl_path = str(cad_dir / "artemis_rover_assembly.stl")
export_step(rover_assembly, rover_step_path)
export_stl(rover_assembly, rover_stl_path)
print(f"[Rover Assembly Complete] Exported STEP: {rover_step_path}")
print(f"[Rover Assembly Complete] Exported STL: {rover_stl_path}")

# 3. IMPORT INTO SOLIDWORKS AND SAVE AS NATIVE .SLDASM / .SLDPRT
print("\n[SolidWorks] Opening assemblies and converting to native SolidWorks files...")
try:
    sw = win32com.client.Dispatch("SldWorks.Application")
    sw.Visible = True
    sw.UserControl = True
    
    errors = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
    warnings = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
    
    # Lander Assembly in SolidWorks (Type 1 = Part with multi-body assembly tree)
    doc_lander = sw.OpenDoc6(lander_step_path, 1, 0, "", errors, warnings)
    if doc_lander:
        lander_sld_path = str(cad_dir / "artemis_lander_assembly.SLDPRT")
        doc_lander.SaveAs3(lander_sld_path, 0, 2)
        print(f"[SolidWorks] Saved Native Lander System: {lander_sld_path}")
        sw.CloseDoc(doc_lander.GetTitle)
        
    # Rover Assembly in SolidWorks
    doc_rover = sw.OpenDoc6(rover_step_path, 1, 0, "", errors, warnings)
    if doc_rover:
        rover_sld_path = str(cad_dir / "artemis_rover_assembly.SLDPRT")
        doc_rover.SaveAs3(rover_sld_path, 0, 2)
        print(f"[SolidWorks] Saved Native Rover System: {rover_sld_path}")
        sw.CloseDoc(doc_rover.GetTitle)

except Exception as e:
    print(f"[SolidWorks COM Notice] {e}")

print("\n[Engineering System Verification Complete]")
