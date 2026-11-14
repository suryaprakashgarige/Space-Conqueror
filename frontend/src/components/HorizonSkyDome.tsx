import React, { useMemo, useState } from 'react';
import { Compass, Sun, Radio, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AppMode, HorizonBin, TelemetryStep } from '../types/lunar';

interface HorizonSkyDomeProps {
  horizon: HorizonBin[];
  timeline: TelemetryStep[];
  currentStep: TelemetryStep | null;
  mode: AppMode;
}

const DEG2RAD = Math.PI / 180;

export const HorizonSkyDome: React.FC<HorizonSkyDomeProps> = ({
  horizon,
  timeline,
  currentStep,
  mode,
}) => {
  const [viewType, setViewType] = useState<'polar' | 'panorama'>('polar');

  // Polar projection maps elevation [-5, +20] deg to radius [R_OUT, R_IN]
  // Outer edge = -5 deg, horizon 0 deg = ~80% radius, +20 deg = inner 15% radius
  const polarData = useMemo(() => {
    const cx = 130;
    const cy = 125;
    const maxR = 98;
    const minR = 14;
    const minEl = -5;
    const maxEl = 20;

    const elToR = (el: number) => {
      const clamped = Math.max(minEl, Math.min(maxEl, el));
      const t = (clamped - minEl) / (maxEl - minEl);
      return maxR - t * (maxR - minR);
    };

    const azElToXY = (azDeg: number, elDeg: number) => {
      const r = elToR(elDeg);
      // 0 deg = North (up = -Y), 90 deg = East (right = +X)
      const rad = (azDeg - 90) * DEG2RAD;
      return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
      };
    };

    // Crater rim polygon (outer ring to horizon line)
    const sortedHorizon = [...horizon].sort((a, b) => a.az_deg - b.az_deg);
    const rimPoints = sortedHorizon.map((h) => azElToXY(h.az_deg, h.horizon_el_deg));
    const rimPath =
      rimPoints.length > 0
        ? `M ${rimPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')} Z`
        : '';

    // Outer boundary circle path for even-odd shading of blocked terrain below horizon
    const outerCirclePath = `M ${cx - maxR},${cy} A ${maxR},${maxR} 0 1,0 ${cx + maxR},${cy} A ${maxR},${maxR} 0 1,0 ${cx - maxR},${cy} Z`;

    // Build contiguous segments for Sun and Earth paths (avoid wraparound jumps)
    const sunSegments: { x1: number; y1: number; x2: number; y2: number; visible: boolean; isNearCurrent: boolean }[] = [];
    const earthSegments: { x1: number; y1: number; x2: number; y2: number; visible: boolean }[] = [];

    const curHour = currentStep ? currentStep.hour_offset : 0;

    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      const sp1 = azElToXY(prev.sun_az_deg, prev.sun_el_deg);
      const sp2 = azElToXY(curr.sun_az_deg, curr.sun_el_deg);

      if (Math.hypot(sp2.x - sp1.x, sp2.y - sp1.y) < 48) {
        const isNear = Math.abs(curr.hour_offset - curHour) <= 24;
        sunSegments.push({
          x1: sp1.x,
          y1: sp1.y,
          x2: sp2.x,
          y2: sp2.y,
          visible: curr.sun_visible,
          isNearCurrent: isNear,
        });
      }

      const ep1 = azElToXY(prev.earth_az_deg, prev.earth_el_deg);
      const ep2 = azElToXY(curr.earth_az_deg, curr.earth_el_deg);
      if (Math.hypot(ep2.x - ep1.x, ep2.y - ep1.y) < 48) {
        earthSegments.push({
          x1: ep1.x,
          y1: ep1.y,
          x2: ep2.x,
          y2: ep2.y,
          visible: curr.earth_visible,
        });
      }
    }

    const curSun = currentStep
      ? azElToXY(currentStep.sun_az_deg, currentStep.sun_el_deg)
      : null;
    const curEarth = currentStep
      ? azElToXY(currentStep.earth_az_deg, currentStep.earth_el_deg)
      : null;

    return {
      cx,
      cy,
      maxR,
      rMinus5: elToR(-5),
      r0: elToR(0),
      r5: elToR(5),
      r10: elToR(10),
      r15: elToR(15),
      rimPath,
      terrainMaskPath: `${outerCirclePath} ${rimPath}`,
      sunSegments,
      earthSegments,
      curSun,
      curEarth,
    };
  }, [horizon, timeline, currentStep]);

  // 360° Panorama projection
  const panoData = useMemo(() => {
    const w = 270;
    const h = 160;
    const padL = 26;
    const padR = 8;
    const padT = 16;
    const padB = 24;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const minEl = -6;
    const maxEl = 18;

    const azToX = (az: number) => padL + (az / 360) * plotW;
    const elToY = (el: number) => {
      const clamped = Math.max(minEl, Math.min(maxEl, el));
      return padT + plotH - ((clamped - minEl) / (maxEl - minEl)) * plotH;
    };

    const sorted = [...horizon].sort((a, b) => a.az_deg - b.az_deg);
    const polyPts: string[] = [];
    polyPts.push(`${azToX(0).toFixed(1)},${elToY(minEl).toFixed(1)}`);
    for (const h of sorted) {
      polyPts.push(`${azToX(h.az_deg).toFixed(1)},${elToY(h.horizon_el_deg).toFixed(1)}`);
    }
    polyPts.push(`${azToX(360).toFixed(1)},${elToY(minEl).toFixed(1)}`);
    const terrainPoly = `M ${polyPts.join(' L ')} Z`;

    const sunPts = timeline.map((s) => ({
      x: azToX(s.sun_az_deg),
      y: elToY(s.sun_el_deg),
      az: s.sun_az_deg,
      visible: s.sun_visible,
    }));

    const earthPts = timeline.map((s) => ({
      x: azToX(s.earth_az_deg),
      y: elToY(s.earth_el_deg),
      az: s.earth_az_deg,
      visible: s.earth_visible,
    }));

    return {
      w,
      h,
      padL,
      padR,
      padT,
      padB,
      plotW,
      plotH,
      yMinus5: elToY(-5),
      y0: elToY(0),
      y5: elToY(5),
      y10: elToY(10),
      terrainPoly,
      sunPts,
      earthPts,
      curSun: currentStep
        ? { x: azToX(currentStep.sun_az_deg), y: elToY(currentStep.sun_el_deg) }
        : null,
      curEarth: currentStep
        ? { x: azToX(currentStep.earth_az_deg), y: elToY(currentStep.earth_el_deg) }
        : null,
    };
  }, [horizon, timeline, currentStep]);

  // Operational clearance status
  const deltaSun = currentStep?.delta_sun_deg ?? (currentStep ? currentStep.sun_el_deg + 0.26 - currentStep.sun_horizon_deg : 0);
  const deltaEarth = currentStep?.delta_earth_deg ?? (currentStep ? currentStep.earth_el_deg - currentStep.earth_horizon_deg : 0);
  const dteMarginDb = currentStep?.dte_link_db ?? -45;

  return (
    <div className="hud-panel rounded-xl p-3 flex flex-col gap-2.5 text-slate-100">
      {/* Header with Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold tracking-wider uppercase text-slate-100">
            360° Horizon Sky-Dome
          </span>
        </div>
        <div className="flex items-center rounded-md bg-slate-900 border border-slate-700/80 p-0.5 text-[10px] font-mono-tech">
          <button
            type="button"
            onClick={() => setViewType('polar')}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              viewType === 'polar'
                ? 'bg-sky-500/25 border border-sky-400/50 text-sky-200 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            POLAR 360°
          </button>
          <button
            type="button"
            onClick={() => setViewType('panorama')}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              viewType === 'panorama'
                ? 'bg-sky-500/25 border border-sky-400/50 text-sky-200 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PANORAMA
          </button>
        </div>
      </div>

      {viewType === 'polar' ? (
        <div className="flex items-center justify-center relative">
          <svg viewBox="0 0 260 250" className="w-full max-w-[260px] h-auto select-none">
            <defs>
              <radialGradient id="skyGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0B111C" stopOpacity="1" />
                <stop offset="70%" stopColor="#080C14" stopOpacity="1" />
                <stop offset="100%" stopColor="#05070B" stopOpacity="1" />
              </radialGradient>
              <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FEF08A" stopOpacity="1" />
                <stop offset="40%" stopColor="#EAB308" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#CA8A04" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="earthGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#BAE6FD" stopOpacity="1" />
                <stop offset="60%" stopColor="#0284C7" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0369A1" stopOpacity="0" />
              </radialGradient>
              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Sky Dome Disk */}
            <circle
              cx={polarData.cx}
              cy={polarData.cy}
              r={polarData.maxR}
              fill="url(#skyGrad)"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="1.2"
            />

            {/* Shaded LOLA Topographic Horizon Mask */}
            {polarData.terrainMaskPath && (
              <path
                d={polarData.terrainMaskPath}
                fill="rgba(245, 158, 11, 0.18)"
                fillRule="evenodd"
              />
            )}
            {polarData.rimPath && (
              <path
                d={polarData.rimPath}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.8"
                filter="url(#glowEffect)"
                opacity="0.95"
              />
            )}

            {/* Elevation Reference Rings: 0° Horizontal & +10° Zenithward */}
            <circle
              cx={polarData.cx}
              cy={polarData.cy}
              r={polarData.r0}
              fill="none"
              stroke="rgba(148, 163, 184, 0.35)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <circle
              cx={polarData.cx}
              cy={polarData.cy}
              r={polarData.r10}
              fill="none"
              stroke="rgba(148, 163, 184, 0.2)"
              strokeDasharray="2 3"
              strokeWidth="0.8"
            />

            {/* Cardinal Crosshairs */}
            <line
              x1={polarData.cx}
              y1={polarData.cy - polarData.maxR}
              x2={polarData.cx}
              y2={polarData.cy + polarData.maxR}
              stroke="rgba(148, 163, 184, 0.15)"
              strokeWidth="0.8"
            />
            <line
              x1={polarData.cx - polarData.maxR}
              y1={polarData.cy}
              x2={polarData.cx + polarData.maxR}
              y2={polarData.cy}
              stroke="rgba(148, 163, 184, 0.15)"
              strokeWidth="0.8"
            />

            {/* 14-Day Sun Grazing Path */}
            {polarData.sunSegments.map((seg, i) => (
              <line
                key={`s-${i}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={seg.visible ? '#F59E0B' : '#EF4444'}
                strokeWidth={seg.isNearCurrent ? 2.5 : 1.4}
                strokeOpacity={seg.isNearCurrent ? 1.0 : 0.6}
                strokeDasharray={seg.visible ? undefined : '2 2'}
              />
            ))}

            {/* 14-Day Earth Libration Wobble Loop */}
            {polarData.earthSegments.map((seg, i) => (
              <line
                key={`e-${i}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={seg.visible ? '#38BDF8' : '#EF4444'}
                strokeWidth={2.0}
                strokeOpacity={seg.visible ? 0.95 : 0.75}
              />
            ))}

            {/* Current Earth Disk & Libration Position */}
            {polarData.curEarth && currentStep && (
              <g>
                <circle
                  cx={polarData.curEarth.x}
                  cy={polarData.curEarth.y}
                  r={8.5}
                  fill="url(#earthGlow)"
                  filter="url(#glowEffect)"
                />
                <circle
                  cx={polarData.curEarth.x}
                  cy={polarData.curEarth.y}
                  r={4.2}
                  fill={currentStep.earth_visible ? '#38BDF8' : '#EF4444'}
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                />
              </g>
            )}

            {/* Current Sun Disk */}
            {polarData.curSun && currentStep && (
              <g>
                <circle
                  cx={polarData.curSun.x}
                  cy={polarData.curSun.y}
                  r={10}
                  fill="url(#sunGlow)"
                  filter="url(#glowEffect)"
                />
                <circle
                  cx={polarData.curSun.x}
                  cy={polarData.curSun.y}
                  r={4.8}
                  fill={currentStep.sun_visible ? '#F59E0B' : '#EF4444'}
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                />
              </g>
            )}

            {/* Cardinal and Elevation Labels */}
            <text x={polarData.cx} y={15} textAnchor="middle" fill="#38BDF8" fontSize="10" fontWeight="700">
              N (0°)
            </text>
            <text x={polarData.cx + polarData.maxR + 13} y={polarData.cy + 3} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              E (90°)
            </text>
            <text x={polarData.cx} y={polarData.cy + polarData.maxR + 14} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              S (180°)
            </text>
            <text x={polarData.cx - polarData.maxR - 13} y={polarData.cy + 3} textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
              W (270°)
            </text>
            <text
              x={polarData.cx + 4}
              y={polarData.cy - polarData.r0 - 2}
              fill="#94A3B8"
              fontSize="8"
              fontWeight="700"
              textAnchor="start"
              dominantBaseline="auto"
            >
              0° HORIZ
            </text>
            <text
              x={polarData.cx + 4}
              y={polarData.cy - polarData.r10 - 2}
              fill="#64748B"
              fontSize="8"
              fontWeight="600"
              textAnchor="start"
              dominantBaseline="auto"
            >
              +10°
            </text>
          </svg>
        </div>
      ) : (
        <div className="w-full">
          <svg viewBox={`0 0 ${panoData.w} ${panoData.h}`} className="w-full h-auto select-none">
            <defs>
              <linearGradient id="panoSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B111C" />
                <stop offset="100%" stopColor="#05070B" />
              </linearGradient>
            </defs>

            {/* Plot background */}
            <rect
              x={panoData.padL}
              y={panoData.padT}
              width={panoData.plotW}
              height={panoData.plotH}
              fill="url(#panoSky)"
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth="0.8"
            />

            {/* Horizontal Reference Grids */}
            <line
              x1={panoData.padL}
              y1={panoData.y0}
              x2={panoData.padL + panoData.plotW}
              y2={panoData.y0}
              stroke="rgba(148, 163, 184, 0.3)"
              strokeDasharray="3 3"
              strokeWidth="0.9"
            />
            <line
              x1={panoData.padL}
              y1={panoData.y10}
              x2={panoData.padL + panoData.plotW}
              y2={panoData.y10}
              stroke="rgba(148, 163, 184, 0.15)"
              strokeDasharray="2 3"
              strokeWidth="0.7"
            />

            {/* Unfolded LOLA Terrain Silhouette */}
            {panoData.terrainPoly && (
              <path
                d={panoData.terrainPoly}
                fill="rgba(245, 158, 11, 0.2)"
                stroke="#F59E0B"
                strokeWidth="1.8"
                opacity="0.95"
              />
            )}

            {/* Sun Path */}
            {panoData.sunPts.map((pt, i) => {
              if (i === 0) return null;
              const prev = panoData.sunPts[i - 1];
              if (Math.abs(pt.az - prev.az) > 120) return null;
              return (
                <line
                  key={`ps-${i}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={pt.x}
                  y2={pt.y}
                  stroke={pt.visible ? '#F59E0B' : '#EF4444'}
                  strokeWidth="1.8"
                  strokeOpacity={pt.visible ? 0.95 : 0.6}
                />
              );
            })}

            {/* Earth Path / Libration Loop */}
            {panoData.earthPts.map((pt, i) => {
              if (i === 0) return null;
              const prev = panoData.earthPts[i - 1];
              if (Math.abs(pt.az - prev.az) > 120) return null;
              return (
                <line
                  key={`pe-${i}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={pt.x}
                  y2={pt.y}
                  stroke={pt.visible ? '#38BDF8' : '#EF4444'}
                  strokeWidth="1.8"
                  strokeOpacity={0.9}
                />
              );
            })}

            {/* Current Sun & Earth on Panorama */}
            {panoData.curSun && currentStep && (
              <circle
                cx={panoData.curSun.x}
                cy={panoData.curSun.y}
                r={4.5}
                fill={currentStep.sun_visible ? '#F59E0B' : '#EF4444'}
                stroke="#FFFFFF"
                strokeWidth="1"
              />
            )}
            {panoData.curEarth && currentStep && (
              <circle
                cx={panoData.curEarth.x}
                cy={panoData.curEarth.y}
                r={4.2}
                fill={currentStep.earth_visible ? '#38BDF8' : '#EF4444'}
                stroke="#FFFFFF"
                strokeWidth="1"
              />
            )}

            {/* Y-Axis Labels */}
            <text x={panoData.padL - 4} y={panoData.y0 + 3} textAnchor="end" fill="#94A3B8" fontSize="8" fontWeight="700">
              0° HORIZ
            </text>
            <text x={panoData.padL - 4} y={panoData.y10 + 3} textAnchor="end" fill="#64748B" fontSize="8" fontWeight="600">
              +10°
            </text>

            {/* X-Axis Azimuth Ticks */}
            {[
              { az: 0, label: 'N' },
              { az: 90, label: 'E' },
              { az: 180, label: 'S' },
              { az: 270, label: 'W' },
              { az: 360, label: 'N' },
            ].map((tick) => (
              <text
                key={`tick-${tick.az}`}
                x={panoData.padL + (tick.az / 360) * panoData.plotW}
                y={panoData.h - 6}
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="9"
                fontWeight="600"
              >
                {tick.label}
              </text>
            ))}
          </svg>
        </div>
      )}

      {/* Operational Alt-Azimuth & Clearance Margins */}
      {currentStep && (
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-tech">
          {/* Sun Status Card */}
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-2 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Sun className="w-3.5 h-3.5" />
                SUN POS
              </span>
              <span
                className={`flex items-center gap-1 px-1.5 py-0.2 rounded font-bold text-[10px] ${
                  currentStep.sun_visible
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}
              >
                {currentStep.sun_visible ? 'LIT' : 'ECLIPSE'}
              </span>
            </div>
            <div className="text-slate-100">
              EL <strong className="text-amber-400">+{currentStep.sun_el_deg.toFixed(2)}°</strong> · AZ {currentStep.sun_az_deg.toFixed(1)}°
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-1 mt-0.5">
              <span>MARGIN (δ):</span>
              <span className={`font-bold ${deltaSun >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {deltaSun >= 0 ? `+${deltaSun.toFixed(2)}°` : `${deltaSun.toFixed(2)}°`}
              </span>
            </div>
          </div>

          {/* Earth / DTE Status Card */}
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-2 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sky-400 font-bold">
                <Radio className="w-3.5 h-3.5" />
                EARTH DTE
              </span>
              <span
                className={`flex items-center gap-1 px-1.5 py-0.2 rounded font-bold text-[10px] ${
                  currentStep.earth_visible
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}
              >
                {currentStep.earth_visible ? (
                  <>
                    <ShieldCheck className="w-3 h-3" /> CLEAR
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3 h-3" /> BLOCKED
                  </>
                )}
              </span>
            </div>
            <div className="text-slate-100">
              EL <strong className="text-sky-400">{currentStep.earth_el_deg.toFixed(2)}°</strong> · AZ {currentStep.earth_az_deg.toFixed(1)}°
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-1 mt-0.5">
              <span>MARGIN (δ):</span>
              <span className={`font-bold ${deltaEarth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {deltaEarth >= 0 ? `+${deltaEarth.toFixed(2)}°` : `${deltaEarth.toFixed(2)}°`} ({dteMarginDb.toFixed(1)} dB)
              </span>
            </div>
          </div>
        </div>
      )}

      {mode === 'explorer' && (
        <p className="text-[11px] leading-relaxed text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-2 shadow-sm">
          At the Lunar South Pole, the Sun skims horizontally around the horizon, and Earth wobbles
          in a closed optical libration figure-8 loop. The amber contour represents the real LOLA
          crater terrain mask including lunar spherical curvature.
        </p>
      )}
    </div>
  );
};
