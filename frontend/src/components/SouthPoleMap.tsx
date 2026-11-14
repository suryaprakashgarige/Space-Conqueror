import React, { useState } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import { SOUTH_POLE_LANDMARKS } from '../data/fallbackSites';
import { AppMode, CandidateSite } from '../types/lunar';

interface SouthPoleMapProps {
  sites: CandidateSite[];
  selectedSite: CandidateSite;
  onSelectSite: (site: CandidateSite) => void;
  onDropCustomPin: (latDeg: number, lonDeg: number) => void;
  mode: AppMode;
}

const CX = 135;
const CY = 135;
const MAX_R = 112; // 80°S outer ring

function latLonToXY(latDeg: number, lonDeg: number): { x: number; y: number } {
  const colat = Math.max(0, Math.min(10, 90 - Math.abs(latDeg)));
  const r = (colat / 10) * MAX_R;
  const rad = (lonDeg * Math.PI) / 180;
  return {
    x: CX + r * Math.sin(rad),
    y: CY - r * Math.cos(rad),
  };
}

export const SouthPoleMap: React.FC<SouthPoleMapProps> = ({
  sites,
  selectedSite,
  onSelectSite,
  onDropCustomPin,
  mode,
}) => {
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lon: number } | null>(null);

  const clientToLatLon = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 270;
    const sy = ((e.clientY - rect.top) / rect.height) * 270;
    const dx = sx - CX;
    const dy = CY - sy;
    const r = Math.hypot(dx, dy);
    if (r > MAX_R) return null;
    const lat = -(90 - (r / MAX_R) * 10);
    const lon = (Math.atan2(dx, dy) * 180) / Math.PI;
    return {
      lat: Number(lat.toFixed(2)),
      lon: Number(lon.toFixed(2)),
    };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = clientToLatLon(e);
    if (coords) {
      onDropCustomPin(coords.lat, coords.lon);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] font-mono-tech text-slate-400">
        <span className="flex items-center gap-1.5 text-sky-400 font-bold">
          <Crosshair className="w-3.5 h-3.5" />
          CLICK MAP TO DROP PIN (80°S–90°S)
        </span>
        {hoverCoords && (
          <span className="text-slate-200 font-semibold">
            {Math.abs(hoverCoords.lat).toFixed(2)}°S {Math.abs(hoverCoords.lon).toFixed(1)}°
            {hoverCoords.lon >= 0 ? 'E' : 'W'}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center shrink-0">
        <svg
          viewBox="0 0 270 270"
          className="w-full max-w-[195px] h-auto cursor-crosshair select-none"
          onMouseMove={(e) => setHoverCoords(clientToLatLon(e))}
          onMouseLeave={() => setHoverCoords(null)}
          onClick={handleSvgClick}
        >
          <defs>
            <radialGradient id="poleBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="60%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#05070B" />
            </radialGradient>
          </defs>

          <circle
            cx={CX}
            cy={CY}
            r={MAX_R}
            fill="url(#poleBg)"
            stroke="#334155"
            strokeWidth="1.2"
          />

          {/* Latitude Rings: 88, 86, 84, 82 */}
          {[88, 86, 84, 82].map((lat) => {
            const r = ((90 - lat) / 10) * MAX_R;
            return (
              <g key={lat}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={r}
                  fill="none"
                  stroke="#334155"
                  strokeDasharray="2 3"
                  strokeWidth="0.8"
                />
                <text x={CX + 3} y={CY - r + 8} fill="#94A3B8" fontSize="7.5" fontWeight="600">
                  {lat}°S
                </text>
              </g>
            );
          })}

          {/* Longitude Axes */}
          <line
            x1={CX}
            y1={CY - MAX_R}
            x2={CX}
            y2={CY + MAX_R}
            stroke="#334155"
            strokeWidth="0.8"
          />
          <line
            x1={CX - MAX_R}
            y1={CY}
            x2={CX + MAX_R}
            y2={CY}
            stroke="#334155"
            strokeWidth="0.8"
          />

          {/* Major Craters & Massifs */}
          {SOUTH_POLE_LANDMARKS.map((lm) => {
            const pos = latLonToXY(lm.lat_deg, lm.lon_deg);
            // 1 deg lunar latitude ~ 30.32 km -> 10 deg = 303.2 km
            const rPx = (lm.radius_km / 303.2) * MAX_R;
            return (
              <g key={lm.name} className="pointer-events-none">
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={rPx}
                  fill={lm.kind === 'crater' ? 'rgba(30, 41, 59, 0.7)' : 'rgba(245, 158, 11, 0.15)'}
                  stroke={lm.kind === 'crater' ? '#475569' : '#F59E0B'}
                  strokeWidth="0.8"
                />
                <text
                  x={pos.x}
                  y={pos.y + 2}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="6.5"
                  fontWeight="600"
                >
                  {lm.name}
                </text>
              </g>
            );
          })}

          {/* 90°S Pole Crosshair */}
          <circle cx={CX} cy={CY} r={2} fill="#E2E8F0" />
          <text x={CX + 4} y={CY + 7} fill="#E2E8F0" fontSize="7" fontWeight="700">
            90°S
          </text>

          {/* 0° Earth-Facing Axis Indicator */}
          <text x={CX} y={13} textAnchor="middle" fill="#10B981" fontSize="8" fontWeight="800">
            0° EARTH-FACING
          </text>
          <text x={CX + MAX_R + 10} y={CY + 3} textAnchor="middle" fill="#64748B" fontSize="8" fontWeight="600">
            90°E
          </text>
          <text x={CX} y={CY + MAX_R + 12} textAnchor="middle" fill="#64748B" fontSize="8" fontWeight="600">
            180°
          </text>
          <text x={CX - MAX_R - 11} y={CY + 3} textAnchor="middle" fill="#64748B" fontSize="8" fontWeight="600">
            90°W
          </text>

          {/* 6 Candidate Artemis Sites */}
          {sites.map((site) => {
            const p = latLonToXY(site.lat_deg, site.lon_deg);
            const active = site.id === selectedSite.id;
            return (
              <g
                key={site.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSite(site);
                }}
              >
                {active && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={9}
                    fill="rgba(56, 189, 248, 0.25)"
                    stroke="#38BDF8"
                    strokeWidth="1.2"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? 4.6 : 3.6}
                  fill={active ? '#38BDF8' : '#F59E0B'}
                  stroke="#0F172A"
                  strokeWidth="1.2"
                />
                <title>{site.name}</title>
              </g>
            );
          })}

          {/* Custom Pin Marker */}
          {selectedSite.is_custom && (() => {
            const cp = latLonToXY(selectedSite.lat_deg, selectedSite.lon_deg);
            return (
              <g className="pointer-events-none">
                <circle
                  cx={cp.x}
                  cy={cp.y}
                  r={10}
                  fill="rgba(16, 185, 129, 0.25)"
                  stroke="#10B981"
                  strokeDasharray="2 2"
                  strokeWidth="1.2"
                />
                <circle cx={cp.x} cy={cp.y} r={4.4} fill="#10B981" stroke="#0F172A" strokeWidth="1.2" />
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Selected Site Context Card */}
      <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-2.5 py-2 text-xs shrink-0 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-100 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            {selectedSite.name}
          </span>
          <span className="font-mono-tech text-[10px] text-sky-400 font-semibold">
            {Math.abs(selectedSite.lat_deg).toFixed(2)}°S,{' '}
            {Math.abs(selectedSite.lon_deg).toFixed(2)}°{selectedSite.lon_deg >= 0 ? 'E' : 'W'}
          </span>
        </div>
        <p className="text-[11px] text-slate-300 mt-1 leading-snug">
          {selectedSite.mission_context}
        </p>
        {mode === 'explorer' && (
          <p className="text-[11px] text-amber-300 font-medium mt-1 leading-snug">
            Science Value: {selectedSite.science_highlight}
          </p>
        )}
      </div>
    </div>
  );
};
