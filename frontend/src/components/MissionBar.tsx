import React, { useState } from 'react';
import {
  Calendar,
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Moon,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
  Battery,
  Wifi,
  Sun,
  Truck,
  Globe2,
  X,
  Check,
} from 'lucide-react';
import {
  AppMode,
  CameraPreset,
  CandidateSite,
  LandingState,
  MissionViewMode,
  RoverState,
  RoverTelemetry,
} from '../types/lunar';
import { missionAudio } from '../services/missionAudio';

interface MissionBarProps {
  sites: CandidateSite[];
  selectedSite: CandidateSite;
  onSelectSite: (site: CandidateSite) => void;
  startDate: string;
  onChangeStartDate: (date: string) => void;
  durationDays: number;
  onChangeDurationDays: (days: number) => void;
  slipDays: number;
  onChangeSlipDays: (days: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetTime: () => void;
  stepIndex: number;
  totalSteps: number;
  currentUtcIso?: string;
  mode: AppMode;
  onToggleMode: () => void;
  cameraPreset: CameraPreset;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  showSlopeHeatmap: boolean;
  onToggleSlopeHeatmap: () => void;
  showHazardOverlay: boolean;
  onToggleHazardOverlay: () => void;
  missionViewMode: MissionViewMode;
  onToggleMissionViewMode: () => void;
  landingState: LandingState;
  onTriggerLanding: () => void;
  roverState: RoverState;
  onCycleRoverState: () => void;
  roverTelemetry: RoverTelemetry | null;
  operationalView?: 'orbital_globe' | 'surface_planner' | 'rover_ops';
  onSelectOperationalView?: (view: 'orbital_globe' | 'surface_planner' | 'rover_ops') => void;
  onOpenTour?: () => void;
}

export const MissionBar: React.FC<MissionBarProps> = ({
  sites,
  selectedSite,
  onSelectSite,
  startDate,
  onChangeStartDate,
  durationDays,
  onChangeDurationDays,
  slipDays,
  onChangeSlipDays,
  isPlaying,
  onTogglePlay,
  onResetTime,
  stepIndex,
  totalSteps,
  currentUtcIso,
  mode,
  onToggleMode,
  cameraPreset: _cameraPreset,
  onSelectCameraPreset: _onSelectCameraPreset,
  showSlopeHeatmap,
  onToggleSlopeHeatmap,
  showHazardOverlay,
  onToggleHazardOverlay,
  missionViewMode: _missionViewMode,
  onToggleMissionViewMode: _onToggleMissionViewMode,
  landingState,
  onTriggerLanding,
  roverState,
  onCycleRoverState,
  roverTelemetry,
  operationalView = 'surface_planner',
  onSelectOperationalView,
  onOpenTour,
}) => {
  const [isMuted, setIsMuted] = React.useState<boolean>(missionAudio.getMuted());
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [customLat, setCustomLat] = useState<string>(selectedSite.lat_deg.toFixed(2));
  const [customLon, setCustomLon] = useState<string>(selectedSite.lon_deg.toFixed(2));
  const [customName, setCustomName] = useState<string>('');
  const [coordError, setCoordError] = useState<string | null>(null);

  const formattedUtc = currentUtcIso
    ? currentUtcIso.replace('T', ' ').slice(0, 16) + ' UTC'
    : '2026-10-15 00:00 UTC';

  const handleApplyCustomCoordinate = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);

    if (isNaN(lat) || lat > -80.0 || lat < -90.0) {
      setCoordError('Latitude must be within the South Pole region (-80.00° to -90.00°).');
      return;
    }
    if (isNaN(lon) || lon < -180.0 || lon > 180.0) {
      setCoordError('Longitude must be between -180.00° and +180.00°.');
      return;
    }

    setCoordError(null);
    const siteName =
      customName.trim() ||
      `Custom (${Math.abs(lat).toFixed(2)}°S, ${
        lon >= 0 ? `${lon.toFixed(2)}°E` : `${Math.abs(lon).toFixed(2)}°W`
      })`;

    const customSite: CandidateSite = {
      id: `custom_${lat.toFixed(2)}_${lon.toFixed(2)}`,
      name: siteName,
      region: 'South Polar Custom Target',
      lat_deg: Number(lat.toFixed(4)),
      lon_deg: Number(lon.toFixed(4)),
      mission_context: `Custom South Polar coordinate at ${lat.toFixed(2)}°S, ${lon.toFixed(
        2
      )}°E evaluated via LOLA DEM heightfield and analytical ephemeris.`,
      science_highlight:
        'Targeted custom polar exploration site evaluating local terrain horizon mask and Direct-to-Earth communication.',
      is_custom: true,
    };

    onSelectSite(customSite);
    setIsCustomModalOpen(false);
  };

  return (
    <header className="hud-panel rounded-2xl px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shadow-2xl relative text-slate-100">
      {/* Brand & 3-Way Mode Switcher + Tour Button */}
      <div className="flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700/80">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-sky-400/40 flex items-center justify-center text-sky-300 shadow-sm">
            <Moon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-wider text-slate-100 flex items-center gap-1.5 uppercase">
              SPACE CONQUEROR
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono-tech border border-sky-400/40 font-bold">
                COCKPIT
              </span>
            </div>
            <div className="text-[10px] font-mono-tech text-slate-400">
              ARTEMIS III LUNAR SOUTH POLE NAVIGATOR
            </div>
          </div>
        </div>

        {/* Clean 3-Way Operational View Toggle */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-xs font-mono-tech">
          <button
            type="button"
            onClick={() => onSelectOperationalView?.('orbital_globe')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
              operationalView === 'orbital_globe'
                ? 'bg-sky-500/30 border border-sky-400/50 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="3D Moon Globe Pre-Launch Site Selector"
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ORBITAL GLOBE</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectOperationalView?.('surface_planner')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
              operationalView === 'surface_planner'
                ? 'bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Surface Horizon & Shadow Planner"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SURFACE PLANNER</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectOperationalView?.('rover_ops')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
              operationalView === 'rover_ops'
                ? 'bg-amber-500/30 border border-amber-400/50 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Artemis Lander & Rover Operations"
          >
            <Truck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">LANDER & ROVER OPS</span>
          </button>
        </div>

        {/* Prominent 'TAKE A TOUR' Button for Judges */}
        {onOpenTour && (
          <button
            type="button"
            onClick={onOpenTour}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-200 text-xs font-bold shadow-[0_0_12px_rgba(56,189,248,0.25)] transition-all cursor-pointer shrink-0"
            title="Launch interactive guided walkthrough for judges"
          >
            <Compass className="w-3.5 h-3.5 text-sky-300" />
            <span>🧭 TAKE A TOUR</span>
          </button>
        )}

        {/* Site Dropdown + Custom Pin Button */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 shadow-sm">
          <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <select
            value={selectedSite.id}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setIsCustomModalOpen(true);
                return;
              }
              const target = sites.find((s) => s.id === e.target.value);
              if (target) onSelectSite(target);
            }}
            className="bg-transparent text-xs text-slate-100 font-semibold outline-none cursor-pointer max-w-[190px] truncate"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                {s.name}
              </option>
            ))}
            <option value="__custom__" className="bg-slate-900 text-sky-300 font-bold">
              + Custom Lat/Lon Pin...
            </option>
          </select>

          <button
            type="button"
            onClick={() => {
              setCustomLat(selectedSite.lat_deg.toFixed(2));
              setCustomLon(selectedSite.lon_deg.toFixed(2));
              setIsCustomModalOpen(true);
            }}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
            title="Type custom South Pole coordinates (-80° to -90°)"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Surface Controls: Landing Trigger, Rover, Comms */}
      <div className="hidden 2xl:flex items-center gap-2">
        {/* Powered Descent Landing Trigger Button */}
        <button
          type="button"
          onClick={onTriggerLanding}
          disabled={landingState === 'descending'}
          className={`px-3 py-1.5 rounded-lg border text-xs font-mono-tech flex items-center gap-2 transition-all cursor-pointer ${
            landingState === 'descending'
              ? 'bg-amber-500/25 border-amber-400 text-amber-300 animate-pulse font-bold'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 text-slate-200 shadow-sm'
          }`}
          title="Trigger realistic powered descent landing sequence with retro thrusters"
        >
          <Rocket className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold">
            {landingState === 'descending'
              ? 'DESCENT BURNING...'
              : landingState === 'landed'
                ? 'RE-LAND VEHICLE'
                : 'LAND VEHICLE'}
          </span>
        </button>

        {/* Lunar rover deploy & traverse button */}
        <button
          type="button"
          onClick={onCycleRoverState}
          className={`px-3 py-1.5 rounded-lg border text-xs font-mono-tech flex items-center gap-2 transition-all cursor-pointer ${
            roverState === 'traversing'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm font-bold'
              : roverState === 'stopped'
                ? 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse font-bold'
                : roverState === 'deploying'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse font-bold'
                  : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800 shadow-sm'
          }`}
          title="Deploy the lunar rover down the lander ramp and cruise across the lunar terrain"
        >
          <Truck className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            ROVER:{' '}
            <strong className="text-slate-100">
              {roverState === 'stowed'
                ? 'STOWED (DEPLOY)'
                : roverState === 'deploying'
                  ? 'DEPLOYING'
                  : roverState === 'stopped'
                    ? 'STOPPED (DEPLETED)'
                    : 'TRAVERSING'}
            </strong>
          </span>
        </button>

        {/* Rover Battery Status */}
        {roverTelemetry && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono-tech transition-all shadow-sm ${
              roverTelemetry.batteryPct <= 10
                ? 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
                : roverTelemetry.isCharging
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-700/80 text-slate-300'
            }`}
          >
            {roverTelemetry.isCharging ? (
              <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <Battery
                className={`w-3.5 h-3.5 ${
                  roverTelemetry.batteryPct <= 10 ? 'text-red-400' : 'text-slate-400'
                }`}
              />
            )}
            <span>
              BATT: <strong>{roverTelemetry.batteryPct.toFixed(0)}%</strong>
              {roverTelemetry.isCharging && <span className="text-emerald-400 ml-1">⚡ CHG</span>}
            </span>
          </div>
        )}

        {/* Headlight status */}
        {roverTelemetry && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700/80 bg-slate-900 text-[11px] font-mono-tech shadow-sm">
            <Sun className={`w-3.5 h-3.5 ${roverTelemetry.headlightsOn ? 'text-amber-400' : 'text-slate-500'}`} />
            <span className="text-slate-400">
              HEADLIGHTS: <strong className="text-slate-200">{roverTelemetry.headlightsOn ? 'ON (AUTO)' : 'STANDBY'}</strong>
            </span>
          </div>
        )}

        {/* Dual-Hop Comms */}
        {roverTelemetry && (
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-[11px] font-mono-tech text-emerald-300 shadow-sm">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              COMMS: <strong>{roverTelemetry.dualHopOnline ? 'ONLINE' : 'BUFFERED'}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Temporal Controls & Launch-Slip Simulator */}
      <div className="flex flex-wrap items-center gap-2">
        {/* UTC Picker */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChangeStartDate(e.target.value)}
            className="bg-transparent text-slate-100 font-mono-tech font-semibold outline-none text-xs cursor-pointer"
          />
        </div>

        {/* Duration Pills */}
        <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700/80 p-0.5 text-xs font-mono-tech">
          {[7, 14, 28].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onChangeDurationDays(days)}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                durationDays === days
                  ? 'bg-sky-500/25 border border-sky-400/50 text-sky-300 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>

        {/* Launch-Slip Simulator Slider */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 shadow-sm">
          <div className="text-[10px] font-mono-tech text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <span>SLIP</span>
            <span
              className={`font-bold ${
                slipDays === 0
                  ? 'text-slate-200'
                  : slipDays > 0
                    ? 'text-amber-400'
                    : 'text-sky-400'
              }`}
            >
              {slipDays >= 0 ? `+${slipDays}` : slipDays}d
            </span>
          </div>
          <input
            type="range"
            min={-30}
            max={30}
            step={1}
            value={slipDays}
            onChange={(e) => onChangeSlipDays(Number(e.target.value))}
            className="cockpit-slider gold w-16 cursor-pointer"
            title="Simulate launch slip between -30 and +30 days"
          />
        </div>

        {/* Playback & Time Readout */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 shadow-sm">
          <button
            type="button"
            onClick={onTogglePlay}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isPlaying ? 'Pause mission playback' : 'Play mission time scrubbing'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onResetTime}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Reset playback to T+0h"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="text-right">
            <div className="text-xs font-bold font-mono-tech text-slate-100">
              {formattedUtc}
            </div>
            <div className="text-[10px] font-mono-tech text-slate-400">
              STEP {stepIndex + 1}/{totalSteps}
            </div>
          </div>
        </div>

        {/* Audio Mute/Unmute Toggle */}
        <button
          type="button"
          onClick={() => setIsMuted(missionAudio.toggleMute())}
          className={`p-1.5 rounded-lg border text-xs font-mono-tech flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
            !isMuted
              ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
              : 'bg-slate-900 border-slate-700/80 text-slate-500 hover:text-slate-300'
          }`}
          title={!isMuted ? 'Mute synthesized mission audio' : 'Unmute mission audio (thrusters, beeps, chimes)'}
        >
          {!isMuted ? <Volume2 className="w-3.5 h-3.5 text-sky-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden xl:inline text-[10px] font-semibold">{!isMuted ? 'AUDIO ON' : 'MUTED'}</span>
        </button>
      </div>

      {/* Right Tools: Overlays */}
      <div className="hidden lg:flex items-center gap-2">
        {/* Hazard Heatmap Toggle */}
        <button
          type="button"
          onClick={onToggleSlopeHeatmap}
          className={`px-2.5 py-1 rounded-lg border text-xs font-mono-tech flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
            showSlopeHeatmap
              ? 'bg-red-500/25 border-red-500/40 text-red-300 font-bold'
              : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Landing Slope Hazard Heatmap (>15° red alert)"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>SLOPE &gt;15°</span>
        </button>

        {/* Reticle Overlay Toggle */}
        <button
          type="button"
          onClick={onToggleHazardOverlay}
          className={`p-1.5 rounded-lg border text-xs font-mono-tech transition-colors cursor-pointer shadow-sm ${
            showHazardOverlay
              ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
              : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle 30m / 120m landing zone reticle rings"
        >
          <Compass className="w-3.5 h-3.5" />
        </button>

        {/* Mode Toggle: Planner vs Explorer */}
        <button
          type="button"
          onClick={onToggleMode}
          className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
            mode === 'explorer'
              ? 'bg-amber-500/25 border-amber-400/40 text-amber-300 font-bold'
              : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:text-slate-100'
          }`}
          title="Switch between Astronaut Planner Mode and Explorer Mode"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="uppercase text-[11px] font-mono-tech">
            {mode === 'explorer' ? 'EXPLORER' : 'PLANNER'}
          </span>
        </button>
      </div>

      {/* Custom Coordinates Popover / Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="rounded-2xl p-5 max-w-md w-full bg-slate-900 border-2 border-sky-400/50 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    Custom South Pole Coordinates
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono-tech">
                    Type target lat/lon to compute immediate 14-day simulation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyCustomCoordinate} className="flex flex-col gap-3.5">
              {coordError && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono-tech">
                  {coordError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono-tech text-slate-400 uppercase tracking-wider font-semibold">
                    Latitude (-80° to -90°)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="-90.00"
                      max="-80.00"
                      value={customLat}
                      onChange={(e) => setCustomLat(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono-tech outline-none focus:border-sky-400"
                      placeholder="-88.50"
                    />
                    <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-mono-tech">
                      °S
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono-tech text-slate-400 uppercase tracking-wider font-semibold">
                    Longitude (-180° to +180°)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="-180.00"
                      max="180.00"
                      value={customLon}
                      onChange={(e) => setCustomLon(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono-tech outline-none focus:border-sky-400"
                      placeholder="120.00"
                    />
                    <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-mono-tech">
                      °E
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono-tech text-slate-400 uppercase tracking-wider font-semibold">
                  Site Name (Optional)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400"
                  placeholder="e.g. Amundsen Rim Ridge Crest"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono-tech text-slate-400 uppercase tracking-wider font-semibold">
                  Quick South Pole Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Shackleton Peak', lat: '-89.67', lon: '129.78' },
                    { label: 'Malapert Massif', lat: '-85.99', lon: '-0.23' },
                    { label: 'Mons Mouton', lat: '-84.60', lon: '31.20' },
                    { label: 'Amundsen Basin', lat: '-84.50', lon: '85.00' },
                    { label: 'Connecting Ridge', lat: '-89.45', lon: '-137.30' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setCustomLat(p.lat);
                        setCustomLon(p.lon);
                        setCustomName(p.label);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-300 border border-slate-700 transition-colors font-mono-tech cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-slate-100 text-xs font-mono-tech cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs font-mono-tech flex items-center gap-1.5 shadow-md shadow-sky-500/20 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  COMPUTE SIMULATION
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
