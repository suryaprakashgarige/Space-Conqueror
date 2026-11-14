import React, { useState } from 'react';
import {
  Route,
  ArrowUpRight,
  CalendarClock,
  Sun,
  Radio,
  Mountain,
} from 'lucide-react';
import { BackupRecommendation, CandidateSite } from '../types/lunar';

interface BackupFinderProps {
  recommendations: BackupRecommendation[];
  slipDays: number;
  loading: boolean;
  onApplyRecommendation: (site: CandidateSite, recommendedSlipDays: number) => void;
  onChangeSlipDays?: (days: number) => void;
}

export const BackupFinder: React.FC<BackupFinderProps> = ({
  recommendations,
  slipDays,
  loading,
  onApplyRecommendation,
  onChangeSlipDays,
}) => {
  const [sortBy, setSortBy] = useState<'score' | 'solar' | 'dte'>('score');

  const sortedRecs = [...recommendations].sort((a, b) => {
    if (sortBy === 'solar') {
      return b.summary.solar_illumination_pct - a.summary.solar_illumination_pct;
    }
    if (sortBy === 'dte') {
      return b.summary.dte_comms_pct - a.summary.dte_comms_pct;
    }
    return b.summary.suitability_score - a.summary.suitability_score;
  });

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header with active slip readout */}
      <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-2">
        <span className="flex items-center gap-1.5 text-slate-100 font-bold">
          <Route className="w-3.5 h-3.5 text-sky-400" />
          LAUNCH-SLIP CONTINGENCY BACKUPS
        </span>
        <span className="font-mono-tech text-sky-300 font-bold bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 rounded shadow-sm">
          SLIP: {slipDays >= 0 ? `+${slipDays}` : slipDays}D
        </span>
      </div>

      {/* Quick Launch-Slip Preset Buttons */}
      {onChangeSlipDays && (
        <div className="flex flex-col gap-1.5 bg-slate-900 border border-slate-800 p-2 rounded-lg">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 font-semibold">
            <span>QUICK SLIP OFFSET (+1 to +30 DAYS):</span>
            <span className="text-slate-200 font-bold">
              {slipDays >= 0 ? `+${slipDays}` : slipDays}d
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[0, 3, 7, 14, 21, 28, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChangeSlipDays(d)}
                className={`text-[10px] font-mono-tech px-2 py-0.5 rounded border transition-all cursor-pointer ${
                  slipDays === d
                    ? 'bg-sky-500 text-slate-950 font-bold border-transparent shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                {d === 0 ? 'Nominal (0d)' : `+${d}d`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort Filter Chips */}
      <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 font-semibold">
        <span>SORT CONTINGENCIES:</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSortBy('score')}
            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              sortBy === 'score'
                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-400/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SCORE
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setSortBy('solar')}
            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              sortBy === 'solar'
                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-400/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SOLAR
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setSortBy('dte')}
            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              sortBy === 'dte'
                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-400/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DTE
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-[11px] font-mono-tech text-sky-400 py-4 text-center font-bold">
          EVALUATING ALTERNATE WINDOWS & CELESTIAL TRADE-OFFS...
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-2 max-h-[290px] overflow-y-auto hud-scroll pr-0.5">
          {sortedRecs.map((rec, idx) => {
            const isWinner = idx === 0;
            return (
              <div
                key={`${rec.site.id}-${rec.recommended_slip_days}`}
                className={`rounded-lg border p-2.5 transition-all flex flex-col gap-1.5 ${
                  isWinner
                    ? 'bg-slate-900/90 border-2 border-emerald-500/70 shadow-md'
                    : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md font-mono-tech text-[10px] font-bold flex items-center justify-center shrink-0 ${
                        isWinner
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {rec.site.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0 font-mono-tech">
                    <div
                      className={`text-xs font-bold ${
                        rec.score_delta >= 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {rec.summary.suitability_score.toFixed(1)}{' '}
                      <span className="text-[10px]">
                        ({rec.score_delta >= 0 ? '+' : ''}
                        {rec.score_delta.toFixed(1)})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono-tech text-slate-400">
                  <span className="flex items-center gap-1 text-sky-300 font-bold">
                    <CalendarClock className="w-3 h-3 text-sky-400" />
                    {rec.recommended_slip_days >= 0
                      ? `+${rec.recommended_slip_days}d slip`
                      : `${rec.recommended_slip_days}d slip`}
                  </span>
                  <span>•</span>
                  <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                    <Sun className="w-2.5 h-2.5 text-amber-400" />
                    {rec.summary.solar_illumination_pct.toFixed(0)}%
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                    <Radio className="w-2.5 h-2.5 text-emerald-400" />
                    {rec.summary.dte_comms_pct.toFixed(0)}%
                  </span>
                  <span>•</span>
                  <span className="text-slate-300 font-medium flex items-center gap-0.5">
                    <Mountain className="w-2.5 h-2.5 text-slate-400" />
                    {rec.summary.terrain_slope_deg.toFixed(1)}°
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug font-sans bg-slate-950/70 p-1.5 rounded border border-slate-800">
                  {rec.reason}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    onApplyRecommendation(rec.site, rec.recommended_slip_days)
                  }
                  className="mt-0.5 flex items-center justify-center gap-1 w-full py-1.5 rounded bg-sky-600 hover:bg-sky-500 border border-sky-400/40 text-[11px] font-bold text-white transition-all cursor-pointer shadow-sm"
                >
                  Apply Backup Window ({rec.recommended_slip_days >= 0 ? `+${rec.recommended_slip_days}d` : `${rec.recommended_slip_days}d`}) <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
