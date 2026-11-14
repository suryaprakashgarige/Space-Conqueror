import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft,
  Compass,
  Database,
  Sparkles,
} from 'lucide-react';
import { CANDIDATE_SITES } from './data/fallbackSites';
import {
  AppMode,
  BackupRecommendation,
  CameraPreset,
  CandidateSite,
  ComparisonResult,
  DataSourceMode,
  DrawerTab,
  LandingState,
  MissionViewMode,
  RoverState,
  RoverTelemetry,
  SimulationResult,
  TerrainData,
} from './types/lunar';
import { generateSiteTerrain, simulateMissionAnalytical } from './services/analyticalPhysics';
import {
  createCustomSite,
  fetchBackupRecommendations,
  fetchComparison,
  fetchSites,
  fetchSimulation,
  fetchTerrain,
} from './services/lunarApi';
import { LunarViewport3D } from './components/LunarViewport3D';
import { MissionBar } from './components/MissionBar';
import { HorizonSkyDome } from './components/HorizonSkyDome';
import { TelemetryPanel } from './components/TelemetryPanel';
import { SouthPoleMap } from './components/SouthPoleMap';
import { SiteComparator } from './components/SiteComparator';
import { BackupFinder } from './components/BackupFinder';
import { TourModal } from './components/TourModal';

const DEFAULT_START_DATE = '2026-11-15';

export const App: React.FC = () => {
  const [sites, setSites] = useState<CandidateSite[]>(CANDIDATE_SITES);
  const [selectedSite, setSelectedSite] = useState<CandidateSite>(CANDIDATE_SITES[0]);

  const [startDate, setStartDate] = useState<string>(DEFAULT_START_DATE);
  const [durationDays, setDurationDays] = useState<number>(14);
  const [slipDays, setSlipDays] = useState<number>(0);

  const [terrain, setTerrain] = useState<TerrainData>(() =>
    generateSiteTerrain(CANDIDATE_SITES[0])
  );
  const [simulation, setSimulation] = useState<SimulationResult>(() =>
    simulateMissionAnalytical(
      CANDIDATE_SITES[0],
      generateSiteTerrain(CANDIDATE_SITES[0]),
      `${DEFAULT_START_DATE}T00:00:00Z`,
      14,
      0
    )
  );
  const [dataSource, setDataSource] = useState<DataSourceMode>('analytical');

  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(6);

  const [mode, setMode] = useState<AppMode>('planner');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('lander');
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<number>(0);
  const [showSlopeHeatmap, setShowSlopeHeatmap] = useState<boolean>(false);
  const [showHazardOverlay, setShowHazardOverlay] = useState<boolean>(true);

  // Optional mission visualisation states: 3D Moon Globe, Surface Horizon Planner, Lander & Rover Ops
  // Mission planners land directly on clean Surface Horizon & Shadow Planner (no forced cutscenes)
  const [operationalView, setOperationalView] = useState<'orbital_globe' | 'surface_planner' | 'rover_ops'>('surface_planner');
  const [missionViewMode, setMissionViewMode] = useState<MissionViewMode>('cockpit');
  const [landingState, setLandingState] = useState<LandingState>('landed');
  const [roverState, setRoverState] = useState<RoverState>('stowed');
  const [roverTelemetry, setRoverTelemetry] = useState<RoverTelemetry | null>(null);

  const [rightDrawerOpen, setRightDrawerOpen] = useState<boolean>(true);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  // Compare Tab State
  const [compareSiteBId, setCompareSiteBId] = useState<string>(CANDIDATE_SITES[2].id);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [compareLoading, setCompareLoading] = useState<boolean>(false);

  // Backup Tab State
  const [backups, setBackups] = useState<BackupRecommendation[]>([]);
  const [backupsLoading, setBackupsLoading] = useState<boolean>(false);

  // Guided Walkthrough Tour State
  const [isTourOpen, setIsTourOpen] = useState<boolean>(true);

  // Reflect project name "Space Conqueror" in the browser URL
  useEffect(() => {
    if (!window.location.pathname.toLowerCase().includes('space-conqueror')) {
      window.history.replaceState(null, '', '/space-conqueror');
    }
  }, []);

  const startUtcIso = useMemo(() => `${startDate}T00:00:00Z`, [startDate]);

  // Initial sites load (API -> static -> fallback)
  useEffect(() => {
    let active = true;
    fetchSites().then(({ sites: loaded }) => {
      if (!active || loaded.length === 0) return;
      setSites(loaded);
      setSelectedSite((prev) => (prev.is_custom ? prev : loaded[0]));
    });
    return () => {
      active = false;
    };
  }, []);

  // Load terrain + simulation whenever site, start date, duration, or slip changes
  useEffect(() => {
    let active = true;
    (async () => {
      const { terrain: tData } = await fetchTerrain(selectedSite);
      if (!active) return;
      setTerrain(tData);

      const simData = await fetchSimulation(
        selectedSite,
        tData,
        startUtcIso,
        durationDays,
        slipDays
      );
      if (!active) return;
      setSimulation(simData);
      setDataSource(simData.data_source);
      setStepIndex((prev) =>
        Math.min(prev, Math.max(0, simData.timeline.length - 1))
      );
    })();
    return () => {
      active = false;
    };
  }, [selectedSite, startUtcIso, durationDays, slipDays]);

  // Compute comparison when Compare tab is active
  useEffect(() => {
    if (drawerTab !== 'compare') return;
    let active = true;
    const siteB = sites.find((s) => s.id === compareSiteBId) ?? sites[1] ?? sites[0];
    setCompareLoading(true);
    fetchComparison(selectedSite, siteB, startUtcIso, durationDays, slipDays)
      .then((res) => {
        if (active) setComparison(res);
      })
      .finally(() => {
        if (active) setCompareLoading(false);
      });
    return () => {
      active = false;
    };
  }, [drawerTab, selectedSite, compareSiteBId, sites, startUtcIso, durationDays, slipDays]);

  // Compute backup recommendations when AI Backup tab is active
  useEffect(() => {
    if (drawerTab !== 'backup') return;
    let active = true;
    setBackupsLoading(true);
    fetchBackupRecommendations(selectedSite, startUtcIso, durationDays, slipDays)
      .then((res) => {
        if (active) setBackups(res);
      })
      .finally(() => {
        if (active) setBackupsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [drawerTab, selectedSite, startUtcIso, durationDays, slipDays]);

  // Mission Playback loop
  useEffect(() => {
    if (!isPlaying || simulation.timeline.length <= 1) return;
    const intervalMs = Math.max(45, Math.round(600 / playSpeed));
    const timer = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % simulation.timeline.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, playSpeed, simulation.timeline.length]);

  const currentStep = simulation.timeline[stepIndex] ?? simulation.timeline[0] ?? null;

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setCameraPresetTrigger((n) => n + 1);
  }, []);

  const handleDropCustomPin = useCallback((latDeg: number, lonDeg: number) => {
    const custom = createCustomSite(latDeg, lonDeg);
    setSelectedSite(custom);
    setStepIndex(0);
  }, []);

  const handleSelectSite = useCallback((site: CandidateSite) => {
    setSelectedSite(site);
    setStepIndex(0);
  }, []);

  const handleSetOperationalView = useCallback(
    (v: 'orbital_globe' | 'surface_planner' | 'rover_ops') => {
      setOperationalView(v);
      if (v === 'orbital_globe') {
        setMissionViewMode('moon_globe');
      } else if (v === 'surface_planner') {
        setMissionViewMode('cockpit');
        setLandingState('landed');
        setRoverState('stowed');
      } else {
        setMissionViewMode('cockpit');
        setLandingState('landed');
        setRoverState('traversing');
      }
    },
    []
  );

  const handleTriggerLanding = useCallback(() => {
    handleSetOperationalView('surface_planner');
  }, [handleSetOperationalView]);

  const handleLandingComplete = useCallback(() => {
    setLandingState('landed');
    setRoverState('stowed');
  }, []);

  const handleCycleRoverState = useCallback(() => {
    setRoverState((cur) => {
      if (cur === 'stowed') return 'deploying';
      if (cur === 'deploying') return 'traversing';
      if (cur === 'stopped') return 'traversing';
      return 'stowed';
    });
  }, []);

  const handleToggleMissionViewMode = useCallback(() => {
    handleSetOperationalView(
      operationalView === 'orbital_globe' ? 'surface_planner' : 'orbital_globe'
    );
  }, [operationalView, handleSetOperationalView]);

  const handleApplyBackup = useCallback(
    (site: CandidateSite, recommendedSlipDays: number) => {
      setSelectedSite(site);
      setSlipDays(recommendedSlipDays);
      setStepIndex(0);
    },
    []
  );

  const sourceLabel =
    dataSource === 'api'
      ? 'LIVE FASTAPI'
      : dataSource === 'static'
        ? 'STATIC PACK'
        : 'ANALYTICAL SIM';

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-950 font-sans">
      {/* Interactive Tour Walkthrough Modal */}
      <TourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onSwitchOperationalView={handleSetOperationalView}
        onSwitchDrawerTab={setDrawerTab}
        onOpenDrawer={setRightDrawerOpen}
      />

      {/* Top Mission Control Bar */}
      <header className="shrink-0 z-30 p-2.5 pb-1 pointer-events-auto">
        <MissionBar
          sites={sites}
          selectedSite={selectedSite}
          onSelectSite={handleSelectSite}
          startDate={startDate}
          onChangeStartDate={setStartDate}
          durationDays={durationDays}
          onChangeDurationDays={setDurationDays}
          slipDays={slipDays}
          onChangeSlipDays={setSlipDays}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onResetTime={() => {
            setIsPlaying(false);
            setStepIndex(0);
          }}
          stepIndex={stepIndex}
          totalSteps={simulation.timeline.length}
          currentUtcIso={currentStep?.timestamp_utc ?? simulation.effective_start_utc}
          mode={mode}
          onToggleMode={() => setMode((m) => (m === 'planner' ? 'explorer' : 'planner'))}
          cameraPreset={cameraPreset}
          onSelectCameraPreset={handleSelectCameraPreset}
          showSlopeHeatmap={showSlopeHeatmap}
          onToggleSlopeHeatmap={() => setShowSlopeHeatmap((v) => !v)}
          showHazardOverlay={showHazardOverlay}
          onToggleHazardOverlay={() => setShowHazardOverlay((v) => !v)}
          missionViewMode={missionViewMode}
          onToggleMissionViewMode={handleToggleMissionViewMode}
          landingState={landingState}
          onTriggerLanding={handleTriggerLanding}
          roverState={roverState}
          onCycleRoverState={handleCycleRoverState}
          roverTelemetry={roverTelemetry}
          operationalView={operationalView}
          onSelectOperationalView={handleSetOperationalView}
          onOpenTour={() => setIsTourOpen(true)}
        />
      </header>

      {/* Middle Main Workspace */}
      <main className="flex-1 min-h-0 relative overflow-hidden">
        {/* Full-Bleed 3D Lunar Viewport */}
        <div className="absolute inset-0 z-0">
          <LunarViewport3D
            terrain={terrain}
            currentStep={currentStep}
            cameraPreset={cameraPreset}
            cameraPresetTrigger={cameraPresetTrigger}
            showSlopeHeatmap={showSlopeHeatmap}
            showHazardOverlay={showHazardOverlay}
            missionViewMode={missionViewMode}
            landingState={landingState}
            onLandingComplete={handleLandingComplete}
            roverState={roverState}
            onUpdateRoverTelemetry={setRoverTelemetry}
            sites={sites}
            selectedSite={selectedSite}
            onSelectSite={handleSelectSite}
            onInitiateLanding={handleTriggerLanding}
          />
        </div>

        {/* Compact CAM: LANDER | ROVER | FREE pill in top-left of 3D viewport in surface/ops mode */}
        {operationalView !== 'orbital_globe' && (
          <div className="pointer-events-auto absolute top-3 left-3 z-20 flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-700/80 rounded-lg text-xs font-mono-tech shadow-xl backdrop-blur-md">
            <span className="text-slate-400 px-1 font-bold text-[10px]">CAM:</span>
            <button
              type="button"
              onClick={() => handleSelectCameraPreset('lander')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                cameraPreset === 'lander'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
              title="Lander Deck close inspection"
            >
              LANDER
            </button>
            <button
              type="button"
              onClick={() => handleSelectCameraPreset('rover')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                cameraPreset === 'rover'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
              title="Lunar rover chase camera"
            >
              ROVER
            </button>
            <button
              type="button"
              onClick={() => handleSelectCameraPreset('horizon')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                cameraPreset === 'horizon'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
              title="Free horizon exploration camera"
            >
              FREE
            </button>
          </div>
        )}

        {/* Left Horizon Sky Dome Widget */}
        <aside className="pointer-events-auto absolute top-12 left-3 z-10 w-[290px] hidden xl:flex flex-col gap-2 max-h-[calc(100%-4rem)] overflow-y-auto hud-scroll">
          <HorizonSkyDome
            horizon={simulation.horizon}
            timeline={simulation.timeline}
            currentStep={currentStep}
            mode={mode}
          />
        </aside>

        {/* Right Specialist Drawer */}
        <div className="pointer-events-auto absolute top-3 right-3 z-20 flex items-start gap-1.5 max-h-[calc(100%-1.5rem)]">
          <button
            type="button"
            onClick={() => setRightDrawerOpen((o) => !o)}
            className="hud-panel rounded-lg p-1.5 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer mt-1 shadow-lg"
            title={rightDrawerOpen ? 'Collapse mission drawer' : 'Expand mission drawer'}
          >
            {rightDrawerOpen ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {rightDrawerOpen && (
            <aside className="hud-panel rounded-xl p-2.5 w-[min(320px,calc(100vw-3rem))] max-h-[calc(100vh-12.5rem)] flex flex-col gap-2 shadow-2xl">
              {/* Drawer Navigation Tabs */}
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-950/80 border border-slate-800 p-1 text-[11px] font-medium shrink-0">
                <button
                  type="button"
                  onClick={() => setDrawerTab('overview')}
                  className={`py-1.5 rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    drawerTab === 'overview'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('compare')}
                  className={`py-1.5 rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    drawerTab === 'compare'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Compare
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('backup')}
                  className={`py-1.5 rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    drawerTab === 'backup'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Alternates
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 min-h-0 overflow-y-auto hud-scroll flex flex-col gap-2 pr-0.5">
                {drawerTab === 'overview' && (
                  <SouthPoleMap
                    sites={sites}
                    selectedSite={selectedSite}
                    onSelectSite={handleSelectSite}
                    onDropCustomPin={handleDropCustomPin}
                    mode={mode}
                  />
                )}

                {drawerTab === 'compare' && (
                  <SiteComparator
                    sites={sites}
                    siteA={selectedSite}
                    siteBId={compareSiteBId}
                    onChangeSiteB={setCompareSiteBId}
                    comparison={comparison}
                    onSelectSite={handleSelectSite}
                    loading={compareLoading}
                  />
                )}

                {drawerTab === 'backup' && (
                  <BackupFinder
                    recommendations={backups}
                    slipDays={slipDays}
                    loading={backupsLoading}
                    onApplyRecommendation={handleApplyBackup}
                  />
                )}

                <p className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[9px] leading-relaxed text-slate-400 shrink-0">
                  Planning prototype · terrain-aware Sun/Earth visibility uses NASA LRO LOLA and JPL DE421 data when the API or static pack is available. Scores are comparative heuristics, not landing certification.
                </p>
              </div>

              {/* Speed & Source Footer */}
              <div className="pt-1.5 border-t border-slate-800 flex flex-col gap-1 shrink-0">
                <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400">
                  <span className="font-semibold">SIM SPEED</span>
                  <div className="flex items-center gap-1">
                    {[1, 6, 24].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setPlaySpeed(spd)}
                        className={`px-1.5 py-0.5 rounded cursor-pointer font-bold transition-all ${
                          playSpeed === spd
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <Database className="w-3 h-3 text-sky-400" />
                    {sourceLabel}
                  </span>
                  <span className="font-medium text-slate-400">
                    ELEV {terrain.center_elev_m.toFixed(0)}m · {terrain.grid_size}×{terrain.grid_size}
                  </span>
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* Fixed-Height Bottom Telemetry Panel (100% visible on standard laptops, no vertical overflow) */}
      <footer className="h-44 shrink-0 overflow-hidden z-30 bg-slate-950/95 border-t border-slate-800 shadow-2xl">
        <TelemetryPanel
          simulation={simulation}
          stepIndex={stepIndex}
          onScrubIndex={(idx) => {
            setIsPlaying(false);
            setStepIndex(idx);
          }}
          mode={mode}
          roverTelemetry={roverTelemetry}
          currentStep={currentStep ?? undefined}
        />
      </footer>
    </div>
  );
};

export default App;
