import win32com.client
import pythoncom
import math
from pathlib import Path

modular_dir = Path(r"C:\Users\Surya\.gemini\antigravity\scratch\lunar-landing-site-navigator\cad\modular")
modular_dir.mkdir(parents=True, exist_ok=True)
template_path = r"C:\ProgramData\SOLIDWORKS\SOLIDWORKS 2026\templates\Part.PRTDOT"

sw = win32com.client.Dispatch("SldWorks.Application")
sw.Visible = True
sw.UserControl = True
null_dispatch = win32com.client.VARIANT(pythoncom.VT_DISPATCH, None)

def create_part(name, builder_func):
    print(f"\n[SolidWorks Modular CAD] Building: {name}...")
    doc = sw.NewDocument(template_path, 0, 0, 0)
    if not doc:
        print(f"Failed to create document for {name}")
        return None
    builder_func(doc)
    doc.ViewZoomtofit2()
    
    # Save SLDPRT & STEP
    sldprt_path = str(modular_dir / f"{name}.SLDPRT")
    step_path = str(modular_dir / f"{name}.step")
    doc.SaveAs3(sldprt_path, 0, 2)
    doc.SaveAs3(step_path, 0, 2)
    print(f"  -> Saved: {sldprt_path}")
    print(f"  -> Exported STEP: {step_path}")
    sw.CloseDoc(doc.GetTitle)

# 1. Lander Descent Stage
def build_descent_stage(doc):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreatePolygon(0, 0, 0, 1.8, 0, 0, 8, True)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 1.6, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )

# 2. Lander Propellant Tank
def build_propellant_tank(doc):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    # Sphere approximate as high-dome cylinder with draft or circle
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.48)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.96, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )
    # Equatorial weld ring
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.52)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.06, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 5, 0.45, False
    )

# 3. Lander Engine Bell
def build_engine_bell(doc):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.55)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 1.15, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )

# 4. Lander Landing Gear Strut
def build_landing_strut(doc):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    # Footpad base: 380mm diameter dish
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.19)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.015, 0.0,
        True, False, False, False, math.radians(15.0), 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )
    # Telescoping piston shaft
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.035)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.95, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )

# 5. Lander Ascent Crew Cabin
def build_ascent_cabin(doc):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 1.25)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 1.80, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )
    # Docking Tunnel on top (Z = 1.80m to 2.30m)
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.65)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 2.30, 0.0,
        True, False, False, False, math.radians(8.0), 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )

# 6. Lander Solar Array Wing
def build_solar_wing(doc):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCenterRectangle(1.1, 0, 0, 2.2, 0.45, 0)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.03, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )

# 7. Rover Chassis Frame
def build_rover_chassis(doc):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCenterRectangle(0, 0, 0, 1.3, 0.7, 0)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.22, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )

# 8. Rover Compliant Mesh Wheel
def build_rover_wheel(doc):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    # Outer tire
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.41)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.30, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )
    # Central hub
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.16)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.36, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )

# 9. Rover Sensor Mast
def build_sensor_mast(doc):
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCircleByRadius(0, 0, 0, 0.05)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 1.25, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 0, 0, False
    )
    # NavCam bar
    doc.ClearSelection2(True)
    doc.Extension.SelectByID2("Top Plane", "PLANE", 0, 0, 0, False, 0, null_dispatch, 0)
    doc.SketchManager.InsertSketch(True)
    doc.SketchManager.CreateCenterRectangle(0, 0, 0, 0.08, 0.22, 0)
    doc.FeatureManager.FeatureExtrusion3(
        True, False, False, 0, 0, 0.10, 0.0,
        False, False, False, False, 0.0, 0.0,
        False, False, False, False, True, True, True, 5, 1.25, False
    )

# Run creation batch
create_part("lander_descent_stage", build_descent_stage)
create_part("lander_propellant_tank", build_propellant_tank)
create_part("lander_engine_bell", build_engine_bell)
create_part("lander_landing_strut", build_landing_strut)
create_part("lander_ascent_cabin", build_ascent_cabin)
create_part("lander_solar_wing", build_solar_wing)
create_part("rover_chassis_frame", build_rover_chassis)
create_part("rover_compliant_wheel", build_rover_wheel)
create_part("rover_sensor_mast", build_sensor_mast)

print("\n[Complete] All modular SolidWorks aerospace components built and saved!")
