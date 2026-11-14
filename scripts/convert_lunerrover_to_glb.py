"""Convert lunerrover_new.stl to high-performance Three.js GLB asset with PBR materials."""

import bpy
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STL_PATH = ROOT / "cad" / "lunerrover_new.stl"
OUT_GLB = ROOT / "frontend" / "public" / "assets" / "lunerrover.glb"

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import STL
print(f"[Blender] Importing {STL_PATH}...")
bpy.ops.wm.stl_import(filepath=str(STL_PATH))
rover = bpy.context.selected_objects[0]
rover.name = "Mars_Rover"

# Dimensions in mm -> convert to meters
# Extents: X=4692mm, Y=2580mm, Z=2610mm
rover.scale = (0.001, 0.001, 0.001)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# Center origin
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
rover.location = (0.0, 0.0, rover.dimensions.z / 2.0)
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

# Smooth shading
for p in rover.data.polygons:
    p.use_smooth = True

# Add auto-smooth / edge split for crisp mechanical edges
mod = rover.modifiers.new("WeightedNormal", 'WEIGHTED_NORMAL')
mod.keep_sharp = True

# Materials
mat_chassis = bpy.data.materials.new(name="RoverChassis")
mat_chassis.use_nodes = True
nodes_c = mat_chassis.node_tree.nodes
bsdf_c = next(n for n in nodes_c if n.type == "BSDF_PRINCIPLED")
bsdf_c.inputs['Base Color'].default_value = (0.82, 0.84, 0.87, 1.0)
bsdf_c.inputs['Metallic'].default_value = 0.65
bsdf_c.inputs['Roughness'].default_value = 0.32

# Rear solar panel material
mat_solar = bpy.data.materials.new(name="RearSolarPanels")
mat_solar.use_nodes = True
nodes_s = mat_solar.node_tree.nodes
bsdf_s = next(n for n in nodes_s if n.type == "BSDF_PRINCIPLED")
bsdf_s.inputs['Base Color'].default_value = (0.04, 0.09, 0.28, 1.0)
bsdf_s.inputs['Metallic'].default_value = 0.92
bsdf_s.inputs['Roughness'].default_value = 0.15

rover.data.materials.clear()
rover.data.materials.append(mat_chassis)
rover.data.materials.append(mat_solar)

# Export GLB
OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
print(f"[Blender] Exporting GLB to {OUT_GLB}...")
bpy.ops.export_scene.gltf(
    filepath=str(OUT_GLB),
    export_format='GLB',
    use_selection=True,
    export_apply=True,
)

print(f"[Blender] Exported Mars Rover GLB ({OUT_GLB.stat().st_size:,} bytes) successfully!")
