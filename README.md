# 🌕 Space Conqueror — Artemis Lunar South Pole Navigator

> **An interactive 3D mission cockpit designed to evaluate Artemis landing zones, solar illumination corridors, and rover traversability at the Moon’s South Pole using real NASA altimetry.**

[![Live Web App](https://img.shields.io/badge/Live_Cockpit-space--conqueror--sigma.vercel.app-00E5FF?style=for-the-badge&logo=vercel)](https://space-conqueror-sigma.vercel.app)
[![NASA Space Apps](https://img.shields.io/badge/NASA_Space_Apps-Challenge_Project-blue?style=for-the-badge&logo=nasa)](https://www.spaceappschallenge.org)
[![Slides Deck](https://img.shields.io/badge/7--Slide_Demo-Google_Slides-EA4335?style=for-the-badge&logo=google-slides)](https://docs.google.com/presentation/d/1RxLsukKEoIR-TVh88ZZNipXd8-lDk7Hl/edit?usp=drivesdk&ouid=111869408517493209993&rtpof=true&sd=true)

---

## 🚀 The Vision

When NASA returns humanity to the Moon with the **Artemis campaign**, astronauts will not land in the equatorial flatlands of Apollo. They are heading to the **Lunar South Pole** — a world of stark contrast, ancient ice deposits, and extreme physical hazards.

At the South Pole, the Sun never climbs more than a couple of degrees above the jagged horizon. Mountain ridges and crater rims cast shadows tens of kilometers long, while sunken crater floors remain trapped in billions of years of permanent darkness (*Permanently Shadowed Regions*, or PSRs). 

Finding a landing spot is not just about finding a flat patch of regolith. It is a four-dimensional survival puzzle:
* **Power**: You must touch down where your solar arrays receive sunlight.
* **Communications**: You must maintain direct line-of-sight with Earth.
* **Safety**: You cannot land on slopes steeper than 15 degrees without risking lander tipping or rover rollovers.

**Space Conqueror** was born to bridge raw planetary science and visual, intuitive mission planning. It takes authentic lunar datasets and brings them into a real-time, interactive 3D cockpit that anyone can explore directly in their browser.

---

## 🎯 What Space Conqueror Does

Space Conqueror transforms dry elevation data into an immersive flight deck for Artemis mission evaluation:

### 1. Authentic Lunar Topography from Orbit
Using digital elevation models collected by the **Lunar Orbiter Laser Altimeter (LOLA)** aboard NASA’s Lunar Reconnaissance Orbiter (LRO), the cockpit reconstructs 240-meter-per-pixel terrain across six prime Artemis candidate landing zones:
* **Shackleton Rim**: High-altitude crater crest featuring peaks of near-eternal sunlight right above deep frozen reserves.
* **Malapert Massif**: A towering lunar mountain offering long solar visibility and clear communication horizons.
* **Connecting Ridge**: A narrow topographic bridge connecting candidate landing spots.
* **Mons Mouton**: A vast plateau near the South Pole with sweeping exploration corridors.
* **Nobile Rim**: The primary landing destination for the VIPER volatile-hunting mission.
* **Haworth Crater Rim**: Steep perimeter slopes bordering massive cold-trap craters.

### 2. Dynamic Solar Illumination & Shadow Casting
Because lunar shadows at the South Pole are pitch black (no atmosphere to scatter light), a landing zone that is bathed in sunlight at 08:00 UTC might be completely plunged into darkness a few hours later. Space Conqueror computes real-time solar vectors, projecting accurate long-cast shadows across the craters so planners can visually identify stable solar power zones.

### 3. Slope Hazard Detection Heatmaps
Landing on a 20-degree incline can trigger fatal lander tip-over or strand an exploration rover. Space Conqueror calculates analytical surface gradients across every square meter of the terrain and overlays a dynamic, color-coded safety heatmap:
* 🟢 **Safe Zone (< 10°)**: Optimal terrain for lander touchdown and autonomous rover travel.
* 🟡 **Caution Zone (10° – 15°)**: Drivable by heavy rovers, requiring cautious approach paths.
* 🔴 **Hazard Zone (> 15°)**: Prohibitive slopes with high rollover and slippage risk.

### 4. Interactive Surface Exploration & Ground Physics
Beyond viewing terrain from orbit, users can inspect touchdown operations at ground level:
* **Artemis Lunar Lander**: Full descent stage, ascent module, and quad landing struts positioned with true terrain contact.
* **Lunar Rover (LunerRover)**: Third-person drivable surface rover equipped with compliant mesh wheels, suspension tracking, and elevation raycasting across the LOLA landscape.
* **Deployable Cargo Ramp**: Inspect the egress pathway used to transition the rover from the landing deck to the lunar dirt.

---

## 🛠️ The Creative & Engineering Process

Space Conqueror was built as an end-to-end integration of aerospace engineering, 3D computer graphics, and modern web architecture:

* **Google Antigravity**: Served as my autonomous engineering partner throughout the challenge — helping architect the full-stack system, synthesize 3D visualization logic, and continuously verify mathematical accuracy.
* **CATIA V5 & SolidWorks**: Used to engineer precision mechanical CAD models of the Artemis Lunar Lander and Lunar Rover from technical specifications, complete with compliant wheels, sensor masts, and landing struts.
* **Blender**: Processed physically based rendering (PBR) materials, modeled micro-displacement lunar regolith textures, and baked optimized GLTF/GLB models for zero-lag in-browser streaming.
* **NASA Planetary Data System (PDS)**: Provided the real-world altimetry rasters (`ldem_75s_240m`) that form the physical bedrock of the simulation.
* **Three.js & WebGL**: Powers the live in-browser graphics engine, handling real-time lighting calculations, shadow maps, and ground elevation raycasting at 60 FPS.
* **Vercel**: Hosts the production web platform with instant edge distribution.

---

## 🌌 Why This Matters

Returning to the Moon is not just a scientific mission — it is the proving ground for human life on Mars. 

Tools like Space Conqueror prove that with modern web technologies, complex planetary science data no longer has to be locked behind specialized GIS desktop software. By making lunar topography, lighting, and hazards accessible and interactive in real-time, we empower future explorers, students, and engineers to visualize the next giant leap before humanity sets foot on the South Pole.

---

### 🔗 Project Links

* **Live Mission Cockpit**: [https://space-conqueror-sigma.vercel.app](https://space-conqueror-sigma.vercel.app)
* **7-Slide Project Presentation**: [https://docs.google.com/presentation/d/1RxLsukKEoIR-TVh88ZZNipXd8-lDk7Hl/edit?usp=drivesdk&ouid=111869408517493209993&rtpof=true&sd=true](https://docs.google.com/presentation/d/1RxLsukKEoIR-TVh88ZZNipXd8-lDk7Hl/edit?usp=drivesdk&ouid=111869408517493209993&rtpof=true&sd=true)
* **GitHub Repository**: [https://github.com/suryaprakashgarige/Space-Conqueror](https://github.com/suryaprakashgarige/Space-Conqueror)
* **Challenge**: NASA Space Apps Challenge
* **Developer**: Surya Prakash Garige
