import win32com.client
import pythoncom
import math
from pathlib import Path

# Setup paths
cad_dir = Path(r"C:\Users\Surya\.gemini\antigravity\scratch\lunar-landing-site-navigator\cad")
cad_dir.mkdir(parents=True, exist_ok=True)
template_path = r"C:\ProgramData\SOLIDWORKS\SOLIDWORKS 2026\templates\Part.PRTDOT"

# Connect to SolidWorks
sw = win32com.client.Dispatch("SldWorks.Application")
sw.Visible = True
sw.UserControl = True

null_dispatch = win32com.client.VARIANT(pythoncom.VT_DISPATCH, None)

print("[SolidWorks] Creating Artemis Lunar Lander Part Document...")
doc = sw.NewDocument(template_path, 0, 0, 0)
if not doc:
    raise RuntimeError("Failed to create SolidWorks part document")

title = doc.GetTitle
print(f"[SolidWorks] Active document: {title}")

# 1. Base Descent Stage: Octagonal Core (3.6m wide, 1.6m height)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)

# Draw 8-sided regular polygon (or octagonal circle approximation)
# CreatePolygon(CenterX, CenterY, CenterZ, RadiusX, RadiusY, RadiusZ, NumSides, Inscribed)
doc.SketchManager.CreatePolygon(0, 0, 0, 1.8, 0, 0, 8, True)

feat_descent = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 1.6, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 0, 0, False
)
print("Descent Stage Extruded:", feat_descent is not None)

# 2. Main Descent Rocket Engine Bell at bottom (Z = 0)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
c_engine = doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.55) # 1.1m diameter
feat_engine = doc.FeatureManager.FeatureExtrusion3(
    True, True, False, 0, 0, 1.1, 0.0, # Direction 1 = False/True for negative direction
    True, False, False, False, math.radians(16.0), 0.0, # Conical de Laval nozzle draft
    False, False, False, False, True, True, True, 0, 0, False
)
print("Descent Engine Bell Extruded:", feat_engine is not None)

# 3. Ascent Stage Pressurized Crew Cabin on top (Z = 1.6m to 3.4m)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
c_crew = doc.SketchManager.CreateCircleByRadius(0, 0, 0, 1.25) # 2.5m diameter
feat_crew = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 1.8, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 5, 1.6, False # Start offset at 1.6m
)
print("Ascent Crew Cabin Extruded:", feat_crew is not None)

# 4. Docking Port Tunnel on top (Z = 3.4m to 3.9m)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
c_dock = doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.65) # 1.3m diameter
feat_dock = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 0.5, 0.0,
    True, False, False, False, math.radians(15.0), 0.0, # Tapered docking cone
    False, False, False, False, True, True, True, 5, 3.4, False
)
print("Docking Collar Extruded:", feat_dock is not None)

# 5. External Spherical Propellant Tanks (4 Quadrants)
tank_offsets = [
    (1.45, 1.45),
    (1.45, -1.45),
    (-1.45, 1.45),
    (-1.45, -1.45)
]

for idx, (tx, tz) in enumerate(tank_offsets):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCircleByRadius(tx, tz, 0, 0.48) # 0.96m diameter tank
    feat_tank = doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 1.2, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 5, 0.2, False # offset 0.2m
    )
    print(f"Propellant Tank {idx+1} Extruded:", feat_tank is not None)

# 6. Landing Gear Outrigger Struts (4 corners extending outward and downward)
leg_angles = [math.radians(45), math.radians(135), math.radians(225), math.radians(315)]
for idx, ang in enumerate(leg_angles):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    # Footpad position: 2.8m radial distance, 380mm diameter dish
    fx = 2.8 * math.cos(ang)
    fz = 2.8 * math.sin(ang)
    doc.SketchManager.CreateCircleByRadius(fx, fz, 0, 0.19)
    # Extrude down to ground Z = -0.9m
    feat_leg = doc.FeatureManager.FeatureExtrusion3(
        True, True, False, 0, 0, 0.9, 0.0,
        True, False, False, False, math.radians(12.0), 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )
    print(f"Landing Gear Strut {idx+1} Extruded:", feat_leg is not None)

# Zoom to fit
doc.ViewZoomtofit2()

# Mass Properties
mp = doc.GetMassProperties
if mp:
    print(f"[Mass Properties] Volume: {mp[3]:.3f} m^3, Mass: {mp[5]:.2f} kg, Surface Area: {mp[4]:.2f} m^2")

# Save SLDPRT and Export STEP
sldprt_path = str(cad_dir / "artemis_lunar_lander.SLDPRT")
step_path = str(cad_dir / "artemis_lunar_lander.step")

save_res = doc.SaveAs3(sldprt_path, 0, 2)
step_res = doc.SaveAs3(step_path, 0, 2)

print(f"[Saved] SLDPRT: {sldprt_path} (res: {save_res})")
print(f"[Exported] STEP: {step_path} (res: {step_res})")
