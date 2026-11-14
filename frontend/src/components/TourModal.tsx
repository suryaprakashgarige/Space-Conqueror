import React, { useEffect, useState } from 'react';
import {
  Compass,
  Globe2,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Sun,
  Truck,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { DrawerTab } from '../types/lunar';

export interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchOperationalView: (view: 'orbital_globe' | 'surface_planner' | 'rover_ops') => void;
  onSwitchDrawerTab: (tab: DrawerTab) => void;
  onOpenDrawer?: (open: boolean) => void;
}

interface TourStep {
  step: number;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  onActivate: (
    onSwitchOperationalView: (view: 'orbital_globe' | 'surface_planner' | 'rover_ops') => void,
    onSwitchDrawerTab: (tab: DrawerTab) => void,
    onOpenDrawer?: (open: boolean) => void
  ) => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    badge: 'NASA SPACE APPS 2026',
    title: 'Welcome to Space Conqueror — Artemis III Lunar Navigator',
    subtitle: 'High-Fidelity Polar Illumination, Horizon Masking & Comms Simulator',
    description:
      'Planning lunar south pole missions requires navigating extreme 1.5° grazing solar elevation angles, multi-kilometer crater shadows, and Earth direct-to-earth line-of-sight occultations. This cockpit provides NASA planners with real-time terrain ray-marching, orbital ephemeris, and autonomous rover traversal.',
    icon: <Sparkles className="w-5 h-5 text-sky-400" />,
    onActivate: (switchView) => {
      switchView('surface_planner');
    },
  },
  {
    step: 2,
    badge: 'STEP 2 / 5 · 3D ORBITAL RECON',
    title: 'Interactive 3D Moon Globe & Custom Polar Coordinates',
    subtitle: 'Photorealistic Solar Terminator & South Pole Regional Selector',
    description:
      'Rotate the high-resolution 3D Moon Globe to inspect the live lunar solar terminator, crater topography, and subsolar latitude. Click any candidate landing site or input custom polar coordinates (-80° to -90° S) in the top Mission Bar to evaluate arbitrary targets on the fly.',
    icon: <Globe2 className="w-5 h-5 text-sky-400" />,
    onActivate: (switchView) => {
      switchView('orbital_globe');
    },
  },
  {
    step: 3,
    badge: 'STEP 3 / 5 · HORIZON SKY-DOME',
    title: '360° Topographic Horizon & Live Event Countdowns',
    subtitle: 'LOLA DEM Ray-Marching with Spherical Curvature Drop-Off',
    description:
      'The left sky-dome projects local topographic ridge masks calculated from LOLA elevation data with lunar curvature correction (delta_h = -d²/(2R_moon)). Live countdown badges indicate exact hours remaining until next Sunset (or Sunrise) and Earthset (or Earthrise), coupled with incident solar flux (W/m²) and DTE link margin (dB).',
    icon: <Sun className="w-5 h-5 text-amber-400" />,
    onActivate: (switchView) => {
      switchView('surface_planner');
    },
  },
  {
    step: 4,
    badge: 'STEP 4 / 5 · LAUNCH-SLIP RESILIENCE',
    title: 'Launch-Slip Simulator & Multi-Site Comparator',
    subtitle: 'Evaluating Contingency Windows & Alternate Sites Under Rocket Delays',
    description:
      'Drag the SLIP slider (-30d to +30d) in the Mission Bar to simulate launch date slips. The right sidebar allows side-by-side comparison of illumination duty cycles, Direct-to-Earth availability, terrain slopes, and AI-ranked alternate landing sites to ensure mission success.',
    icon: <Compass className="w-5 h-5 text-sky-400" />,
    onActivate: (switchView, switchTab, openDrawer) => {
      switchView('surface_planner');
      switchTab('compare');
      openDrawer?.(true);
    },
  },
  {
    step: 5,
    badge: 'STEP 5 / 5 · SURFACE OPERATIONS',
    title: 'Artemis Lander & Lunar Polar Scout Rover Digital Twin',
    subtitle: 'Bilinear DEM Grounding, Dynamic Headlights & Dual-Hop Comms',
    description:
      'Switch into Lander & Rover Ops to watch the Lunar Polar Scout Rover traverse crater terrain. The rover features solar charging, automatic high-beam headlights in crater shadows, battery depletion safeguards, and a live dual-hop telemetry link (Rover ➔ Lander ➔ Earth).',
    icon: <Truck className="w-5 h-5 text-amber-400" />,
    onActivate: (switchView) => {
      switchView('rover_ops');
    },
  },
];

export const TourModal: React.FC<TourModalProps> = ({
  isOpen,
  onClose,
  onSwitchOperationalView,
  onSwitchDrawerTab,
  onOpenDrawer,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const step = TOUR_STEPS[currentStepIndex];

  // Whenever step index changes or modal opens, trigger the step's live view update
  useEffect(() => {
    if (!isOpen) return;
    const activeStep = TOUR_STEPS[currentStepIndex];
    if (activeStep) {
      activeStep.onActivate(onSwitchOperationalView, onSwitchDrawerTab, onOpenDrawer);
    }
  }, [isOpen, currentStepIndex, onSwitchOperationalView, onSwitchDrawerTab, onOpenDrawer]);

  // Keyboard navigation: Escape closes, Left/Right arrow moves steps
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (currentStepIndex < TOUR_STEPS.length - 1) {
          setCurrentStepIndex((i) => i + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((i) => i - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, onClose]);

  if (!isOpen) return null;

  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[450px] max-w-[94vw] select-none animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="relative rounded-2xl bg-slate-900/95 border border-sky-400/50 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-slate-100">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shadow-sm">
              {step.icon}
            </div>
            <div>
              <span className="text-[10px] font-bold font-mono-tech uppercase tracking-wider text-sky-400 block">
                {step.badge}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                Interactive Judge Onboarding Tour
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRestart}
              className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Restart Tour from Step 1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="py-3">
          <h3 className="text-sm font-bold text-slate-100 leading-snug">
            {step.title}
          </h3>
          <p className="text-[11px] font-medium text-sky-300 mt-0.5">
            {step.subtitle}
          </p>
          <p className="text-xs text-slate-300 leading-relaxed mt-2 text-justify">
            {step.description}
          </p>
        </div>

        {/* Progress Dots + Interactive Controls */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-800">
          {/* Step Progress Dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`transition-all rounded-full cursor-pointer ${
                  idx === currentStepIndex
                    ? 'w-5 h-2 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                    : 'w-2 h-2 bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Go to Step ${s.step}`}
              />
            ))}
            <span className="text-[10px] font-mono-tech text-slate-400 ml-1 font-semibold">
              {currentStepIndex + 1}/5
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {isFirst ? (
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-200 font-medium px-2 py-1 transition-colors cursor-pointer"
              >
                Skip Tour
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all cursor-pointer shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-[0_2px_10px_rgba(56,189,248,0.35)] cursor-pointer"
            >
              <span>{isLast ? 'Launch Cockpit' : isFirst ? 'Start Interactive Tour' : 'Next'}</span>
              {isLast ? <ArrowRight className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
