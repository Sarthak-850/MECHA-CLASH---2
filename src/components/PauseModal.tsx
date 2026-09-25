import React from 'react';
import { Play, RotateCcw, Home } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onMainMenu,
}) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 select-none">
      <div className="w-full max-w-xs sm:max-w-sm bg-slate-900 border border-slate-700/80 rounded-xl p-4 sm:p-6 shadow-2xl flex flex-col items-center max-h-[92dvh] overflow-y-auto">
        <h2 className="font-display font-black text-2xl xs:text-3xl sm:text-4xl text-white tracking-widest uppercase mb-0.5 glow-cyan">
          PAUSED
        </h2>
        <span className="text-[10px] sm:text-xs text-slate-400 font-mono-data mb-4 sm:mb-6">
          COMBAT SIMULATION SUSPENDED
        </span>

        <div className="w-full flex flex-col gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs sm:text-sm tracking-wider uppercase rounded-xl transition-all shadow-md shadow-cyan-950/50 cursor-pointer active:scale-98"
          >
            <Play className="w-4 h-4 fill-current" /> RESUME
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-display font-semibold text-xs sm:text-sm tracking-wider uppercase rounded-xl transition-all cursor-pointer active:scale-98"
          >
            <RotateCcw className="w-4 h-4" /> RESTART MATCH
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full flex items-center justify-center gap-2 py-2 sm:py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-display font-semibold text-xs sm:text-sm tracking-wider uppercase rounded-xl transition-all cursor-pointer active:scale-98"
          >
            <Home className="w-4 h-4" /> MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
