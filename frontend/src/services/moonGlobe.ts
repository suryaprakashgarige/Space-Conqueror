import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

/**
 * Converts selenographic latitude and longitude into Cartesian coordinates
 * on a sphere of the given radius.
 * +Y is North, -Y is South.
 * Lat: [-90, +90], Lon: [-180, +180] East.
 */
export function selenographicToCartesian(
  latDeg: number,
  lonDeg: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - latDeg) * DEG2RAD; // 0 at North Pole, 180 at South Pole
  const theta = (lonDeg + 90) * DEG2RAD; // 0 at Prime Meridian facing Earth
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Computes an analytical unit vector pointing toward the Sun from the Moon's center
 * for a given UTC timestamp.
 * The Moon's orbital period around the Sun is 1 synodic month (29.530588 days).
 */
export function getMoonSubsolarVector(utcIso: string): THREE.Vector3 {
  const d = new Date(utcIso);
  const timeMs = d.getTime();
  // Reference epoch near 2026-10-10T15:50:00Z (J2000 aligned synodic and draconic cycles)
  const refMs = Date.UTC(2026, 9, 10, 15, 50, 0);
  const synodicPeriodMs = 29.530588 * 86400 * 1000;
  const draconicPeriodMs = 27.21222 * 86400 * 1000;
  const synodicPhaseRad = ((timeMs - refMs) / synodicPeriodMs) * Math.PI * 2;
  const draconicPhaseRad = ((timeMs - refMs) / draconicPeriodMs) * Math.PI * 2;

  // Subsolar latitude oscillates +/- 1.54 deg due to Moon obliquity to ecliptic
  const subsolarLatDeg = -1.54 * Math.sin(draconicPhaseRad);
  // Subsolar longitude sweeps westward 360 deg per synodic month
  const synodicPhaseDeg = (synodicPhaseRad * 180) / Math.PI;
  const subsolarLonDeg = ((180.0 - (synodicPhaseDeg % 360) + 540) % 360) - 180;

  return selenographicToCartesian(subsolarLatDeg, subsolarLonDeg, 1.0).normalize();
}

/**
 * Generates a photorealistic lunar albedo texture on an HTML5 canvas.
 * Includes major maria (basalt seas), crater ray systems (Tycho, Copernicus),
 * and the Artemis South Pole exploration basin.
 */
export function createMoonAlbedoTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base anorthosite highland regolith (light silver-gray)
  ctx.fillStyle = '#8e96a2';
  ctx.fillRect(0, 0, width, height);

  // High-frequency regolith procedural noise
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  let seed = 42;
  const pseudoRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < data.length; i += 4) {
    const n = (pseudoRand() - 0.5) * 28;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 0.98));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.95));
  }
  ctx.putImageData(imgData, 0, 0);

  // Draw Maria (basalt volcanic plains - dark gray/blue)
  ctx.fillStyle = 'rgba(40, 46, 56, 0.72)';
  const maria: [number, number, number, number, number][] = [
    // [cx, cy, rx, ry, rot]
    [480, 180, 120, 95, 0.15], // Oceanus Procellarum
    [580, 160, 85, 75, -0.1], // Mare Imbrium
    [680, 175, 60, 50, 0.05], // Mare Serenitatis
    [710, 230, 68, 55, 0.2], // Mare Tranquillitatis
    [800, 205, 45, 38, -0.05], // Mare Crisium
    [640, 280, 65, 45, 0.1], // Mare Nectaris
    [540, 285, 72, 50, -0.15], // Mare Nubium
    [500, 450, 160, 48, 0.0], // South Pole-Aitken Basin
  ];

  for (const [cx, cy, rx, ry, rot] of maria) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();

    // Soft feathered edges
    const grad = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.5, cx, cy, Math.max(rx, ry) * 1.2);
    grad.addColorStop(0, 'rgba(32, 38, 48, 0.45)');
    grad.addColorStop(1, 'rgba(142, 150, 162, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.25, ry * 1.25, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  // Major Prominent Craters & Ejecta Ray Systems
  const craters: [number, number, number, string, boolean][] = [
    [540, 365, 14, '#ffffff', true], // Tycho Crater with long bright rays
    [565, 195, 12, '#f1f5f9', true], // Copernicus Crater
    [515, 190, 9, '#e2e8f0', true], // Kepler Crater
    [512, 492, 7, '#38bdf8', false], // Shackleton Crater (South Pole)
    [485, 480, 9, '#dbeafe', false], // Haworth Crater
    [535, 475, 11, '#dbeafe', false], // Faustini Crater
    [512, 465, 13, '#94a3b8', false], // Malapert Mountain
    [420, 230, 8, '#f8fafc', false], // Grimaldi
    [780, 170, 7, '#f8fafc', false], // Proclus
  ];

  for (const [cx, cy, r, color, hasRays] of craters) {
    if (hasRays) {
      // Draw radial ejecta rays
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.2;
      for (let a = 0; a < 24; a++) {
        const angle = (a / 24) * Math.PI * 2 + ((a % 3) * 0.1);
        const rayLen = 55 + (a % 5) * 35;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * rayLen, cy + Math.sin(angle) * rayLen);
        ctx.stroke();
      }
    }

    // Crater rim shadow & bright highlight
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Central peak
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // South Pole Artemis Target Zone Glow
  const spGrad = ctx.createRadialGradient(512, 500, 2, 512, 500, 32);
  spGrad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
  spGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = spGrad;
  ctx.beginPath();
  ctx.arc(512, 500, 32, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Generates a bump/height map for the Moon sphere to create
 * razor-sharp grazing crater rim shadows along the solar terminator.
 */
export function createMoonBumpTexture(): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);

  // Basalt depressions
  ctx.fillStyle = '#404040';
  ctx.beginPath();
  ctx.ellipse(240, 90, 60, 48, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(290, 80, 42, 38, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(256, 230, 80, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mountain ridges and crater rims (bright high elevation)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  const craterRims: [number, number, number][] = [
    [270, 182, 7], // Tycho
    [282, 98, 6], // Copernicus
    [256, 246, 4], // Shackleton
    [242, 240, 5], // Haworth
    [268, 238, 6], // Faustini
    [256, 232, 7], // Malapert Mountain
  ];
  for (const [x, y, r] of craterRims) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
