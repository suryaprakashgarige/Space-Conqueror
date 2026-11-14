import React from 'react';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Radio,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { AppMode, RoverTelemetry, SimulationResult, TelemetryStep } from '../types/lunar';

interface TelemetryPanelProps {
  simulation: SimulationResult;
  stepIndex: number;
  onScrubIndex: (idx: number) => void;
  mode: AppMode;
  roverTelemetry?: RoverTelemetry | null;
  currentStep?: TelemetryStep;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  simulation,
  stepIndex,
  onScrubIndex,
  roverTelemetry,
  currentStep: propStep,
}) => {
  const { summary, timeline } = simulation;
  const currentStep: TelemetryStep | undefined =
    propStep ?? timeline[stepIndex] ?? timeline[0];

  const slopeColor =
    summary.terrain_slope_deg > 15
      ? 'text-red-400'
      : summary.terrain_slope_deg > 10
        ? 'text-amber-400'
        : 'text-emerald-400';

  const scoreColor =
    summary.suitability_score >= 78
      ? 'text-emerald-400'
      : summary.suitability_score >= 55
        ? 'text-sky-400'
        : 'text-amber-400';

  const handleTimelinePointer = (e: React.MouseEvent<SVGSVGElement>) => {
    if (timeline.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(frac * (timeline.length - 1));
    onScrubIndex(idx);
  };

  const progressPct =
    timeline.length > 1 ? (stepIndex / (timeline.length - 1)) * 100 : 0;

  // Solar and Earth metrics
  const solarFlux =
    currentStep?.solar_flux_wm2 ??
    Math.round((currentStep?.solar_power_pct ?? 0) * 13.61);
  const dteDb = currentStep?.dte_link_db ?? -45;

  // Exact live countdown calculations starting from currentStepIndex + 1 forward
  let sunCountdownLabel = 'TIME TO SUNSET: > 336h (Continuous)';
  let earthCountdownLabel = 'TIME TO EARTHSET: > 336h (Continuous)';

  if (timeline.length > 0 && currentStep) {
    const curSunState = currentStep.sun_visible;
    const sunEvent = curSunState ? 'SUNSET' : 'SUNRISE';
    let sunStepDelta = -1;

    for (let j = stepIndex + 1; j < timeline.length; j++) {
      if (timeline[j].sun_visible !== curSunState) {
        sunStepDelta = j - stepIndex;
        break;
      }
    }
    if (sunStepDelta === -1) {
      for (let j = 0; j < stepIndex; j++) {
        if (timeline[j].sun_visible !== curSunState) {
          sunStepDelta = (timeline.length - 1 - stepIndex) + (j + 1);
          break;
        }
      }
    }

    const sunTimeStr =
      sunStepDelta > 0 ? `${(sunStepDelta * 1.0).toFixed(1)}h` : '> 336h (Continuous)';
    sunCountdownLabel = `TIME TO ${sunEvent}: ${sunTimeStr}`;

    const curEarthState = currentStep.earth_visible;
    const earthEvent = curEarthState ? 'EARTHSET' : 'EARTHRISE';
    let earthStepDelta = -1;

    for (let j = stepIndex + 1; j < timeline.length; j++) {
      if (timeline[j].earth_visible !== curEarthState) {
        earthStepDelta = j - stepIndex;
        break;
      }
    }
    if (earthStepDelta === -1) {
      for (let j = 0; j < stepIndex; j++) {
        if (timeline[j].earth_visible !== curEarthState) {
          earthStepDelta = (timeline.length - 1 - stepIndex) + (j + 1);
          break;
        }
      }
    }

    const earthTimeStr =
      earthStepDelta > 0 ? `${(earthStepDelta * 1.0).toFixed(1)}h` : '> 336h (Continuous)';
    earthCountdownLabel = `TIME TO ${earthEvent}: ${earthTimeStr}`;
  }

  // Synthetic or step terrain elevation profile for the synchronized track
  const elevTrack = timeline.map((step, i) => {
    const baseElev = step.terrain_elev_m ?? 1850;
    const variation = Math.sin((i / timeline.length) * Math.PI * 4) * 45;
    return baseElev + variation;
  });
  const minElev = Math.min(...elevTrack);
  const maxElev = Math.max(...elevTrack);
  const elevRange = Math.max(1, maxElev - minElev);

  const elevPolyPoints = elevTrack
    .map((elev, i) => {
      const x = (i / Math.max(1, timeline.length - 1)) * 1000;
      const y = 44 - ((elev - minElev) / elevRange) * 10;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' L ');
  const elevPoly = `M 0,45 L ${elevPolyPoints} L 1000,45 Z`;

  return (
    <div className="w-full h-full flex flex-col justify-between px-3.5 py-1.5 text-slate-100 select-none bg-slate-950/95 backdrop-blur-md">
      {/* Top Docked Status Strip */}
      <div className="flex items-center justify-between gap-2 shrink-0 border-b border-slate-800 pb-1">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-100">
            Mission Telemetry & 14-Day Operational Timeline
          </span>
        </div>

        {/* Sleek Merged Status Badges Docked at Top Center */}
        <div className="flex items-center gap-2">
          {!currentStep?.sun_visible ? (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold font-mono-tech shadow-sm">
              <AlertOctagon className="w-3 h-3 text-red-400" />
              SOLAR ECLIPSE · BATTERY OPS
            </div>
          ) : !currentStep?.earth_visible ? (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold font-mono-tech shadow-sm">
              <AlertOctagon className="w-3 h-3 text-red-400" />
              DTE BLACKOUT · TERRAIN OCCLUDED
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold font-mono-tech shadow-sm">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              SUN ELEV +{currentStep.sun_el_deg.toFixed(1)}° · DTE LINK +{currentStep.dte_link_db.toFixed(1)} dB
            </div>
          )}

          {roverTelemetry && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono-tech shadow-sm ${
                roverTelemetry.state === 'stopped'
                  ? 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse font-bold'
                  : 'bg-slate-900 border-slate-700/80 text-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  roverTelemetry.state === 'stopped' ? 'bg-red-400' : 'bg-emerald-400 animate-ping'
                }`}
              />
              ROVER: {roverTelemetry.state.toUpperCase()} ({roverTelemetry.distance_m}m) · BATT: {roverTelemetry.batteryPct.toFixed(0)}%
              {roverTelemetry.isCharging && ' ⚡'} · HEADLIGHTS: {roverTelemetry.headlightsOn ? 'ON' : 'OFF'}
            </div>
          )}
        </div>

        {/* Window Score and Landing Slope */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-[10px] font-mono-tech shadow-sm">
            <span className="text-slate-400">SLOPE:</span>
            <span className={`font-bold ${slopeColor}`}>{summary.terrain_slope_deg.toFixed(1)}°</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-sky-400/40 text-[10px] font-mono-tech shadow-sm">
            <ShieldCheck className={`w-3 h-3 ${scoreColor}`} />
            <span className="text-slate-300">SCORE:</span>
            <span className={`font-bold ${scoreColor}`}>{summary.suitability_score.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Main Operational Body */}
      <div className="flex items-stretch gap-3 flex-1 min-h-0 pt-1">
        {/* Left Operational KPI Cards */}
        <div className="flex items-stretch gap-2 shrink-0">
          {/* Solar Power KPI Card */}
          <div className="w-56 rounded-lg bg-slate-900/90 border border-slate-800 p-2 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Sun className="w-3.5 h-3.5" />
                SOLAR POWER
              </span>
              <span className="font-mono-tech text-amber-400 font-bold">
                {summary.solar_illumination_pct.toFixed(0)}% (14D)
              </span>
            </div>

            <div className="flex items-baseline justify-between py-0.5 leading-normal">
              <div>
                <span className="text-base font-bold font-mono-tech text-slate-100">
                  {solarFlux.toFixed(0)}
                </span>
                <span className="text-[10px] font-mono-tech text-slate-400 ml-1">W/m²</span>
              </div>
              <div className="text-[10px] font-mono-tech text-slate-400 leading-normal py-0.5">
                EL: <strong className="text-amber-400">{currentStep ? (currentStep.sun_el_deg >= 0 ? `+${currentStep.sun_el_deg.toFixed(1)}°` : `${currentStep.sun_el_deg.toFixed(1)}°`) : '--'}</strong>
              </div>
            </div>

            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold tracking-wide border shadow-xs ${
                currentStep?.sun_visible
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  : 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
              }`}
            >
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">{sunCountdownLabel}</span>
            </div>
          </div>

          {/* Earth DTE Comms KPI Card */}
          <div className="w-56 rounded-lg bg-slate-900/90 border border-slate-800 p-2 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
              <span className="flex items-center gap-1 text-sky-400 font-bold">
                <Radio className="w-3.5 h-3.5" />
                DTE LINK
              </span>
              <span className="font-mono-tech text-emerald-400 font-bold">
                {summary.dte_comms_pct.toFixed(0)}% (14D)
              </span>
            </div>

            <div className="flex items-baseline justify-between py-0.5 leading-normal">
              <div>
                <span
                  className={`text-base font-bold font-mono-tech ${
                    dteDb >= 3 ? 'text-emerald-400' : dteDb >= 0 ? 'text-amber-400' : 'text-red-400'
                  }`}
                >
                  {dteDb.toFixed(1)}
                </span>
                <span className="text-[10px] font-mono-tech text-slate-400 ml-1">dB Margin</span>
              </div>
              <div className="text-[10px] font-mono-tech text-slate-400 leading-normal py-0.5">
                EL: <strong className="text-sky-400">{currentStep ? (currentStep.earth_el_deg >= 0 ? `+${currentStep.earth_el_deg.toFixed(1)}°` : `${currentStep.earth_el_deg.toFixed(1)}°`) : '--'}</strong>
              </div>
            </div>

            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold tracking-wide border shadow-xs ${
                currentStep?.earth_visible
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
              }`}
            >
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">{earthCountdownLabel}</span>
            </div>
          </div>
        </div>

        {/* Right Full-Width 14-Day Synchronized Timeline & Scrubber */}
        <div className="flex-1 min-w-0 rounded-lg bg-slate-900/90 border border-slate-800 p-2 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400">
            <span className="font-bold text-slate-200 uppercase">
              14-Day Synchronized Timeline (Solar Illumination + Earth DTE + Terrain Profile)
            </span>
            {currentStep && (
              <span className="text-sky-400 font-bold">
                T+{currentStep.hour_offset}h ({currentStep.timestamp_utc.slice(5, 16).replace('T', ' ')} UTC)
              </span>
            )}
          </div>

          {/* SVG 3-Track Timeline in Dark Space Cockpit Palette */}
          <svg
            viewBox="0 0 1000 46"
            preserveAspectRatio="none"
            className="w-full h-11 cursor-pointer select-none rounded bg-slate-950 border border-slate-800"
            onClick={handleTimelinePointer}
            onMouseMove={(e) => {
              if (e.buttons === 1) handleTimelinePointer(e);
            }}
          >
            {/* Track 1: Solar Illumination (Amber) */}
            {timeline.map((step, i) => {
              const w = 1000 / Math.max(1, timeline.length);
              return (
                <rect
                  key={`sol-${i}`}
                  x={i * w}
                  y={2}
                  width={Math.max(1, w + 0.35)}
                  height={11}
                  fill={step.sun_visible ? '#F59E0B' : '#7F1D1D'}
                  opacity={step.sun_visible ? 0.95 : 0.65}
                />
              );
            })}

            {/* Track 2: Earth DTE Comms (Emerald) */}
            {timeline.map((step, i) => {
              const w = 1000 / Math.max(1, timeline.length);
              return (
                <rect
                  key={`dte-${i}`}
                  x={i * w}
                  y={15}
                  width={Math.max(1, w + 0.35)}
                  height={11}
                  fill={step.earth_visible ? '#10B981' : '#7F1D1D'}
                  opacity={step.earth_visible ? 0.92 : 0.65}
                />
              );
            })}

            {/* Track 3: Terrain Surface Elevation Profile (Sky Blue) */}
            <path d={elevPoly} fill="rgba(56, 189, 248, 0.15)" stroke="#38BDF8" strokeWidth="1" />

            {/* Current Step Scrubber Needle */}
            <line
              x1={(progressPct / 100) * 1000}
              y1={0}
              x2={(progressPct / 100) * 1000}
              y2={46}
              stroke="#38BDF8"
              strokeWidth="2.5"
            />
            <circle
              cx={(progressPct / 100) * 1000}
              cy={2}
              r={3.5}
              fill="#38BDF8"
              stroke="#0F172A"
              strokeWidth="1"
            />
          </svg>

          {/* Interactive Range Input & Legend Footer */}
          <div className="flex items-center justify-between gap-3 text-[10px] font-mono-tech text-slate-400 -mt-0.5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <span className="w-2 h-2 rounded-xs bg-[#F59E0B] inline-block" /> Solar Illumination
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-xs bg-[#10B981] inline-block" /> Earth DTE Window
              </span>
              <span className="flex items-center gap-1 text-sky-400 font-semibold">
                <span className="w-2 h-2 rounded-xs bg-[#38BDF8] inline-block" /> Terrain Height
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(0, timeline.length - 1)}
              value={stepIndex}
              onChange={(e) => {
                onScrubIndex(Number(e.target.value));
              }}
              className="cockpit-slider max-w-[320px] w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
