import win32com.client
import pythoncom
import math
from pathlib import Path

cad_dir = Path(r"C:\Users\Surya\.gemini\antigravity\scratch\lunar-landing-site-navigator\cad")
cad_dir.mkdir(parents=True, exist_ok=True)
template_path = r"C:\ProgramData\SOLIDWORKS\SOLIDWORKS 2026\templates\Part.PRTDOT"

sw = win32com.client.Dispatch("SldWorks.Application")
sw.Visible = True
sw.UserControl = True

null_dispatch = win32com.client.VARIANT(pythoncom.VT_DISPATCH, None)

print("[SolidWorks] Creating Lunar Relay Communication Satellite Part Document...")
doc = sw.NewDocument(template_path, 0, 0, 0)
if not doc:
    raise RuntimeError("Failed to create SolidWorks part document")

# 1. Central Avionics Bus (1.2m x 1.2m, height 1.6m)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)

doc.SketchManager.CreateCenterRectangle(0, 0, 0, 0.6, 0.6, 0)
feat_bus = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 1.6, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 0, 0, False
)
print("Satellite Main Bus Extruded:", feat_bus is not None)

# 2. High-Gain Parabolic Reflector Dish Antenna on Top (Diameter 1.5m, Dish Depth 0.35m)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.75) # 1.5m diameter
feat_dish = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 0.35, 0.0,
    True, False, False, False, math.radians(24.0), 0.0, # Conical parabolic dish profile
    False, False, False, False, True, True, True, 5, 1.6, False # Offset at top of bus
)
print("High-Gain Antenna Dish Extruded:", feat_dish is not None)

# Central Antenna Feed Horn Mast (Z = 1.95m to 2.45m)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.045)
feat_feed = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 0.50, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 5, 1.95, False
)
print("Antenna Feed Horn Mast Extruded:", feat_feed is not None)

# 3. Dual Deployable Solar Array Wings (Spanning +/- X)
# +X Solar Wing (Length 2.4m, Width 0.85m, Thickness 0.03m at Z = 0.8m)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
doc.SketchManager.CreateCenterRectangle(1.85, 0, 0, 1.85 + 1.20, 0.42, 0)
feat_solar_r = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 0.03, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 5, 0.80, False
)
print("Right Solar Wing Extruded:", feat_solar_r is not None)

# -X Solar Wing (Length 2.4m, Width 0.85m at Z = 0.8m)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
doc.SketchManager.CreateCenterRectangle(-1.85, 0, 0, -1.85 - 1.20, 0.42, 0)
feat_solar_l = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 0.03, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 5, 0.80, False
)
print("Left Solar Wing Extruded:", feat_solar_l is not None)

# 4. Ion Propulsion / Main Thruster Cluster at Bottom (Z = 0)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.28)
feat_ion = doc.FeatureManager.FeatureExtrusion3(
    True, True, False, 0, 0, 0.35, 0.0,
    True, False, False, False, math.radians(10.0), 0.0,
    False, False, False, False, True, True, True, 0, 0, False
)
print("Ion Thruster Nozzle Extruded:", feat_ion is not None)

# Zoom to fit
doc.ViewZoomtofit2()

# Mass Properties
mp = doc.GetMassProperties
if mp:
    print(f"[Satellite Mass Properties] Volume: {mp[3]:.3f} m^3, Mass: {mp[5]:.2f} kg, Surface Area: {mp[4]:.2f} m^2")

# Save SLDPRT and Export STEP
sldprt_path = str(cad_dir / "lunar_relay_satellite.SLDPRT")
step_path = str(cad_dir / "lunar_relay_satellite.step")

save_res = doc.SaveAs3(sldprt_path, 0, 2)
step_res = doc.SaveAs3(step_path, 0, 2)

print(f"[Saved] SLDPRT: {sldprt_path} (res: {save_res})")
print(f"[Exported] STEP: {step_path} (res: {step_res})")
