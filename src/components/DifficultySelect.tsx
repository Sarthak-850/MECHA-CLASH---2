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
    icon: <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />,
  },
  {
    level: 'MEDIUM',
    name: 'MEDIUM',
    tag: 'TIER 2',
    colorClass: 'text-cyan-400 bg-cyan-950/40',
    borderClass: 'border-cyan-500/30 hover:border-cyan-400',
    icon: <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />,
  },
  {
    level: 'HARD',
    name: 'HARD',
    tag: 'TIER 3',
    colorClass: 'text-amber-400 bg-amber-950/40',
    borderClass: 'border-amber-500/30 hover:border-amber-400',
    icon: <Swords className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />,
  },
  {
    level: 'EXTREME_HARD',
    name: 'EXTREME HARD',
    tag: 'TIER 4',
    colorClass: 'text-orange-400 bg-orange-950/40',
    borderClass: 'border-orange-500/30 hover:border-orange-400',
    icon: <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />,
  },
  {
    level: 'HARDCORE',
    name: 'HARDCORE',
    tag: 'MAX TIER',
    colorClass: 'text-rose-500 bg-rose-950/40',
    borderClass: 'border-rose-500/40 hover:border-rose-500',
    icon: <Skull className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />,
  },
];

export const DifficultySelect: React.FC<DifficultySelectProps> = ({
  onSelect,
  onBack,
}) => {
  return (
    <div
      className="relative w-full min-h-screen min-h-[100dvh] flex flex-col items-center justify-between p-3 xs:p-4 sm:p-8 bg-slate-950 overflow-y-auto overflow-x-hidden select-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 12px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 12px)',
      }}
    >
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between z-10 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-xs font-mono-data text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </button>
        <span className="font-display font-semibold text-[11px] sm:text-xs text-slate-400 tracking-widest uppercase">
          AI COMBAT TIER
        </span>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-xl flex flex-col items-center my-auto z-10 py-1 sm:py-2">
        <h2 className="font-display font-black text-2xl xs:text-3xl sm:text-4xl text-white tracking-wider uppercase mb-1 text-center">
          SELECT DIFFICULTY
        </h2>
        <p className="text-[11px] sm:text-xs text-slate-400 font-mono-data mb-3 sm:mb-5 text-center max-w-md">
          Higher tiers feature faster AI reaction times and tactical counter-attacks.
        </p>

        {/* 5 Difficulty Cards */}
        <div className="w-full flex flex-col gap-2 sm:gap-2.5">
          {DIFFICULTY_ITEMS.map((item) => {
            const config = AI_DIFFICULTIES[item.level];
            return (
              <button
                key={item.level}
                type="button"
                onClick={() => onSelect(item.level)}
                className={`w-full group flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl bg-slate-900/90 border ${item.borderClass} transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-98 cursor-pointer text-left`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-display font-bold text-xs sm:text-sm text-white tracking-wide">
                        {item.name}
                      </span>
                      <span
                        className={`text-[8px] xs:text-[9px] font-mono-data font-semibold px-1 py-0.2 rounded border border-current shrink-0 ${item.colorClass}`}
                      >
                        {item.tag}
                      </span>
                    </div>
                    <div className="text-[10px] xs:text-[11px] sm:text-xs text-slate-400 font-mono-data mt-0.5 truncate">
                      {config.description}
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end text-[10px] font-mono-data text-slate-500 group-hover:text-slate-300 transition-colors shrink-0 ml-2">
                  <span>Reactions: {Math.round(config.reactionDelay * 1000)}ms</span>
                  <span>Prediction: {Math.round(config.predictionStrength * 100)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-2xl text-center text-[9px] sm:text-[10px] font-mono-data text-slate-400 z-10 mt-1">
        NOVA AI OPERATES VIA REAL-TIME PREDICTIVE KINEMATICS
      </div>
    </div>
  );
};
