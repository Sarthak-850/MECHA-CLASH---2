import React from 'react';
import { DifficultyLevel } from '../types/game';
import { AI_DIFFICULTIES } from '../game/constants';
import { ArrowLeft, Swords, Shield, Zap, Skull, Flame } from 'lucide-react';

interface DifficultySelectProps {
  onSelect: (diff: DifficultyLevel) => void;
  onBack: () => void;
}

const DIFFICULTY_ITEMS: {
  level: DifficultyLevel;
  name: string;
  tag: string;
  colorClass: string;
  borderClass: string;
  icon: React.ReactNode;
}[] = [
  {
    level: 'NORMAL',
    name: 'NORMAL',
    tag: 'TIER 1',
    colorClass: 'text-emerald-400 bg-emerald-950/40',
    borderClass: 'border-emerald-500/30 hover:border-emerald-400',
    icon: <Shield className="w-5 h-5 text-emerald-400" />,
  },
  {
    level: 'MEDIUM',
    name: 'MEDIUM',
    tag: 'TIER 2',
    colorClass: 'text-cyan-400 bg-cyan-950/40',
    borderClass: 'border-cyan-500/30 hover:border-cyan-400',
    icon: <Zap className="w-5 h-5 text-cyan-400" />,
  },
  {
    level: 'HARD',
    name: 'HARD',
    tag: 'TIER 3',
    colorClass: 'text-amber-400 bg-amber-950/40',
    borderClass: 'border-amber-500/30 hover:border-amber-400',
    icon: <Swords className="w-5 h-5 text-amber-400" />,
  },
  {
    level: 'EXTREME_HARD',
    name: 'EXTREME HARD',
    tag: 'TIER 4',
    colorClass: 'text-orange-400 bg-orange-950/40',
    borderClass: 'border-orange-500/30 hover:border-orange-400',
    icon: <Flame className="w-5 h-5 text-orange-400" />,
  },
  {
    level: 'HARDCORE',
    name: 'HARDCORE',
    tag: 'MAX TIER',
    colorClass: 'text-rose-500 bg-rose-950/40',
    borderClass: 'border-rose-500/40 hover:border-rose-500',
    icon: <Skull className="w-5 h-5 text-rose-500" />,
  },
];

export const DifficultySelect: React.FC<DifficultySelectProps> = ({
  onSelect,
  onBack,
}) => {
  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between p-4 sm:p-8 bg-slate-950 overflow-y-auto select-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 16px)',
      }}
    >
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-3xl flex items-center justify-between z-10 mb-2 sm:mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-xs font-mono-data text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> BACK
        </button>
        <span className="font-display font-semibold text-xs text-slate-400 tracking-widest uppercase">
          QUICK DUEL CONFIGURATION
        </span>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-2xl flex flex-col items-center my-auto z-10 py-2">
        <h2 className="font-display font-black text-2xl sm:text-4xl text-white tracking-wider uppercase mb-1 text-center">
          SELECT AI DIFFICULTY
        </h2>
        <p className="text-xs text-slate-400 font-mono-data mb-4 sm:mb-6 text-center">
          Choose NOVA AI neural combat tier. Higher tiers feature predictive interception and rapid dodges.
        </p>

        {/* 5 Difficulty Cards */}
        <div className="w-full flex flex-col gap-2.5 sm:gap-3">
          {DIFFICULTY_ITEMS.map((item) => {
            const config = AI_DIFFICULTIES[item.level];
            return (
              <button
                key={item.level}
                onClick={() => onSelect(item.level)}
                className={`w-full group flex items-center justify-between p-3 sm:p-4 rounded-xl bg-slate-900/90 border ${item.borderClass} transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-98 cursor-pointer text-left`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-xs sm:text-base text-white tracking-wide">
                        {item.name}
                      </span>
                      <span
                        className={`text-[9px] sm:text-[10px] font-mono-data font-semibold px-1.5 py-0.5 rounded border border-current ${item.colorClass}`}
                      >
                        {item.tag}
                      </span>
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-400 font-mono-data mt-0.5">
                      “{config.description}”
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end text-[11px] font-mono-data text-slate-500 group-hover:text-slate-300 transition-colors">
                  <span>Reactions: {Math.round(config.reactionDelay * 1000)}ms</span>
                  <span>Prediction: {Math.round(config.predictionStrength * 100)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-3xl text-center text-[10px] sm:text-[11px] font-mono-data text-slate-400 z-10 mt-2">
        AI BEHAVIOR IS PURE REAL-TIME DECISION MAKING · NO RIGGED DAMAGE OR HEALTH ADVANTAGES
      </div>
    </div>
  );
};
