import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Award,
  Columns,
} from 'lucide-react';
import { CandidateSite, ComparisonResult } from '../types/lunar';
import {
  generateSiteTerrain,
  simulateMissionAnalytical,
} from '../services/analyticalPhysics';

interface SiteComparatorProps {
  sites: CandidateSite[];
  siteA: CandidateSite;
  siteBId: string;
  onChangeSiteB: (id: string) => void;
  comparison: ComparisonResult | null;
  onSelectSite: (site: CandidateSite) => void;
  loading: boolean;
  startUtc?: string;
  durationDays?: number;
  slipDays?: number;
}

export const SiteComparator: React.FC<SiteComparatorProps> = ({
  sites,
  siteA,
  siteBId,
  onChangeSiteB,
  comparison,
  onSelectSite,
  loading,
  startUtc = '2026-11-15T00:00:00Z',
  durationDays = 14,
  slipDays = 0,
}) => {
  const [viewMode, setViewMode] = useState<'matrix' | 'h2h'>('matrix');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(() =>
    sites.map((s) => s.id)
  );

  const siteB = sites.find((s) => s.id === siteBId) ?? sites[1] ?? sites[0];

  const toggleSiteInclusion = (id: string) => {
    setSelectedSiteIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev; // Keep at least 2 sites
        return prev.filter((sId) => sId !== id);
      }
      return [...prev, id];
    });
  };

  // Compute live multi-site comparison matrix (2 to 6 sites side-by-side)
  const matrixData = useMemo(() => {
    const includedSites = sites.filter((s) => selectedSiteIds.includes(s.id));
    return includedSites
      .map((site) => {
        const terrain = generateSiteTerrain(site);
        const sim = simulateMissionAnalytical(
          site,
          terrain,
          startUtc,
          durationDays,
          slipDays
        );
        return {
          site,
          summary: sim.summary,
        };
      })
      .sort((a, b) => b.summary.suitability_score - a.summary.suitability_score);
  }, [sites, selectedSiteIds, startUtc, durationDays, slipDays]);

  const bestSite = matrixData[0]?.site;

  const rows = comparison
    ? [
        {
          label: 'Window Score',
          a: comparison.sim_a.summary.suitability_score,
          b: comparison.sim_b.summary.suitability_score,
          unit: '',
          higherBetter: true,
          max: 100,
        },
        {
          label: 'Solar Illum',
          a: comparison.sim_a.summary.solar_illumination_pct,
          b: comparison.sim_b.summary.solar_illumination_pct,
          unit: '%',
          higherBetter: true,
          max: 100,
        },
        {
          label: 'DTE Comms',
          a: comparison.sim_a.summary.dte_comms_pct,
          b: comparison.sim_b.summary.dte_comms_pct,
          unit: '%',
          higherBetter: true,
          max: 100,
        },
        {
          label: 'Max Eclipse',
          a: comparison.sim_a.summary.longest_eclipse_hr,
          b: comparison.sim_b.summary.longest_eclipse_hr,
          unit: 'h',
          higherBetter: false,
          max: 120,
        },
        {
          label: 'Terrain Slope',
          a: comparison.sim_a.summary.terrain_slope_deg,
          b: comparison.sim_b.summary.terrain_slope_deg,
          unit: '°',
          higherBetter: false,
          max: 25,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-2.5">
      {/* Switcher: Multi-Site Matrix vs Head-to-Head */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
          <Columns className="w-3.5 h-3.5 text-sky-400" />
          <span>SITE COMPARISON</span>
        </div>
        <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-[10px] font-mono-tech">
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
              viewMode === 'matrix'
                ? 'bg-sky-500/25 border border-sky-400/50 text-sky-200 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2–6 SITE MATRIX
          </button>
          <button
            type="button"
            onClick={() => setViewMode('h2h')}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
              viewMode === 'h2h'
                ? 'bg-sky-500/25 border border-sky-400/50 text-sky-200 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            HEAD-TO-HEAD
          </button>
        </div>
      </div>

      {viewMode === 'matrix' ? (
        <div className="flex flex-col gap-2">
          {/* Site Filter Pills */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-mono-tech text-slate-400 uppercase mr-1 font-semibold">
              COMPARE:
            </span>
            {sites.map((s) => {
              const active = selectedSiteIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSiteInclusion(s.id)}
                  className={`text-[10px] px-2 py-0.5 rounded-md border font-mono-tech transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {/* Matrix Winner Callout */}
          {bestSite && (
            <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-2 flex items-center justify-between text-xs shadow-sm">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-200 font-medium">
                  Rank #1 Leader:{' '}
                  <strong className="text-emerald-300 font-bold">{bestSite.name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectSite(bestSite)}
                className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold cursor-pointer transition-colors"
              >
                TARGET THIS SITE
              </button>
            </div>
          )}

          {/* Side-by-Side Trade Matrix Table */}
          <div className="overflow-x-auto hud-scroll">
            <table className="w-full text-left border-collapse text-[11px] font-mono-tech">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                  <th className="py-1 px-1.5 font-bold">SITE CANDIDATE</th>
                  <th className="py-1 px-1.5 text-right font-bold">SCORE</th>
                  <th className="py-1 px-1.5 text-right font-bold">SOLAR %</th>
                  <th className="py-1 px-1.5 text-right font-bold">DTE %</th>
                  <th className="py-1 px-1.5 text-right font-bold">MAX ECL</th>
                  <th className="py-1 px-1.5 text-right font-bold">SLOPE</th>
                  <th className="py-1 px-1 text-center font-bold">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {matrixData.map(({ site, summary }, idx) => {
                  const isCurrent = site.id === siteA.id;
                  const isLeader = idx === 0;
                  return (
                    <tr
                      key={site.id}
                      className={`hover:bg-slate-850/60 transition-colors ${
                        isCurrent ? 'bg-sky-950/30' : ''
                      }`}
                    >
                      <td className="py-1.5 px-1.5 font-sans font-medium text-slate-200 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 text-slate-400 font-mono-tech font-bold">
                          #{idx + 1}
                        </span>
                        <span className="truncate max-w-[110px]" title={site.name}>
                          {site.name}
                        </span>
                        {isLeader && (
                          <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-mono-tech font-bold border border-emerald-500/30">
                            WIN
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-300 font-mono-tech font-bold border border-sky-500/30">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-1.5 px-1.5 text-right font-bold ${
                          summary.suitability_score >= 75
                            ? 'text-emerald-400'
                            : summary.suitability_score >= 50
                              ? 'text-sky-400'
                              : 'text-amber-400'
                        }`}
                      >
                        {summary.suitability_score.toFixed(1)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-amber-400 font-semibold">
                        {summary.solar_illumination_pct.toFixed(0)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-emerald-400 font-semibold">
                        {summary.dte_comms_pct.toFixed(0)}%
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-slate-300">
                        {summary.longest_eclipse_hr.toFixed(0)}h
                      </td>
                      <td
                        className={`py-1.5 px-1.5 text-right font-semibold ${
                          summary.terrain_slope_deg <= 10
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {summary.terrain_slope_deg.toFixed(1)}°
                      </td>
                      <td className="py-1.5 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectSite(site)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 font-semibold transition-colors cursor-pointer"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Site A vs Site B Selector */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 text-xs">
            <div className="rounded-lg bg-sky-500/20 border border-sky-400/40 px-2 py-1.5 truncate font-semibold text-sky-200">
              {siteA.name}
            </div>
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={siteB.id}
              onChange={(e) => onChangeSiteB(e.target.value)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-100 font-medium outline-none focus:border-sky-400"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {loading && (
            <div className="text-[11px] font-mono-tech text-sky-400 py-3 text-center font-bold">
              COMPUTING TRADE MATRIX...
            </div>
          )}

          {!loading && comparison && (
            <>
              {/* Winner Banner */}
              <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-2 flex items-start gap-2 shadow-sm">
                <Award className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-snug text-emerald-200 font-medium">
                  {comparison.rationale}
                </div>
              </div>

              {/* Metric Bars */}
              <div className="flex flex-col gap-2">
                {rows.map((r) => {
                  const aWins = r.higherBetter ? r.a >= r.b : r.a <= r.b;
                  const pctA = Math.min(100, (r.a / r.max) * 100);
                  const pctB = Math.min(100, (r.b / r.max) * 100);
                  return (
                    <div
                      key={r.label}
                      className="rounded-lg bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span
                          className={`font-mono-tech font-bold ${
                            aWins ? 'text-sky-300' : 'text-slate-400'
                          }`}
                        >
                          {r.a.toFixed(1)}
                          {r.unit}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          {r.label}
                        </span>
                        <span
                          className={`font-mono-tech font-bold ${
                            !aWins ? 'text-amber-300' : 'text-slate-400'
                          }`}
                        >
                          {r.b.toFixed(1)}
                          {r.unit}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 h-1.5">
                        <div className="bg-slate-800 rounded-full overflow-hidden flex justify-end">
                          <div
                            className="h-full bg-sky-500 rounded-full"
                            style={{ width: `${pctA}%` }}
                          />
                        </div>
                        <div className="bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-500 rounded-full"
                            style={{ width: `${pctB}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onSelectSite(siteB)}
                className="w-full py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white border border-sky-400/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Target {siteB.name}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
