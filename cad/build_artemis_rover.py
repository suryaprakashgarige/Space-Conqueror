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

print("[SolidWorks] Creating Artemis Lunar Terrain Vehicle (LTV) Part Document...")
doc = sw.NewDocument(template_path, 0, 0, 0)
if not doc:
    raise RuntimeError("Failed to create SolidWorks part document")

# 1. Main Spaceframe Chassis Flatbed (Length 2.6m, Width 1.4m, Thickness 0.22m, elevated 0.55m off ground)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)

# Centered rectangle: CreateCenterRectangle(CenterX, CenterY, CenterZ, CornerX, CornerY, CornerZ)
doc.SketchManager.CreateCenterRectangle(0, 0, 0, 1.3, 0.7, 0)
feat_chassis = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 0.22, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 5, 0.55, False # Start offset at 0.55m
)
print("Rover Chassis Extruded:", feat_chassis is not None)

# 2. Four Compliant Mesh Wheels (Diameter 0.80m -> Radius 0.40m, Width 0.30m)
wheel_coords = [
    (1.05, 0.95),   # Front-Right
    (1.05, -0.95),  # Front-Left
    (-1.05, 0.95),  # Rear-Right
    (-1.05, -0.95)  # Rear-Left
]

for idx, (wx, wz) in enumerate(wheel_coords):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCircleByRadius(wx, wz, 0, 0.40)
    feat_wheel = doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.30, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 5, 0.10, False
    )
    print(f"Mesh Wheel {idx+1} Extruded:", feat_wheel is not None)

# 3. Dual Astronaut Crew Bucket Seats (Front Deck)
seat_coords = [(0.25, 0.35), (0.25, -0.35)]
for idx, (sx, sz) in enumerate(seat_coords):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCenterRectangle(sx, sz, 0, sx + 0.28, sz + 0.24, 0)
    feat_seat = doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.55, 0.0,
        True, False, False, False, math.radians(10.0), 0.0,
        False, False, False, False, True, True, True, 5, 0.77, False
    )
    print(f"Crew Seat {idx+1} Extruded:", feat_seat is not None)

# 4. Forward Sensor / Navigation Camera Mast (Height 1.35m at front: X = 1.15m, Z = 0)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
doc.SketchManager.CreateCircleByRadius(1.15, 0, 0, 0.06)
feat_mast = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 1.15, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 5, 0.77, False
)
print("Forward Sensor Mast Extruded:", feat_mast is not None)

# Stereo NavCam Crossbar on Mast Top (X = 1.15m, Height Z = 1.92m)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
doc.SketchManager.CreateCenterRectangle(1.15, 0, 0, 1.25, 0.32, 0)
feat_cam = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 0.12, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 5, 1.92, False
)
print("Stereo NavCam Crossbar Extruded:", feat_cam is not None)

# 5. Rear Scientific Sample Bay & Avionics Power Deck (X = -0.75m, Z = 0)
doc.ClearSelection2(True)
doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
doc.SketchManager.InsertSketch(True)
doc.SketchManager.CreateCenterRectangle(-0.75, 0, 0, -0.35, 0.55, 0)
feat_bay = doc.FeatureManager.FeatureExtrusion3(
    True, False, False, 0, 0, 0.42, 0.0,
    False, False, False, False, 0.0, 0.0,
    False, False, False, False, True, True, True, 5, 0.77, False
)
print("Rear Science Sample Bay Extruded:", feat_bay is not None)

# Zoom to fit
doc.ViewZoomtofit2()

# Mass Properties
mp = doc.GetMassProperties
if mp:
    print(f"[Rover Mass Properties] Volume: {mp[3]:.3f} m^3, Mass: {mp[5]:.2f} kg, Surface Area: {mp[4]:.2f} m^2")

# Save SLDPRT and Export STEP
sldprt_path = str(cad_dir / "artemis_lunar_rover.SLDPRT")
step_path = str(cad_dir / "artemis_lunar_rover.step")

save_res = doc.SaveAs3(sldprt_path, 0, 2)
step_res = doc.SaveAs3(step_path, 0, 2)

print(f"[Saved] SLDPRT: {sldprt_path} (res: {save_res})")
print(f"[Exported] STEP: {step_path} (res: {step_res})")
