import React from 'react';
import { GameEngine } from '../game/engine';
import { Skull, RotateCcw, Home, Swords, ShieldAlert, Award, Zap } from 'lucide-react';

interface DefeatModalProps {
  engine: GameEngine;
  onRetry: () => void;
  onMainMenu: () => void;
}

export const DefeatModal: React.FC<DefeatModalProps> = ({
  engine,
  onRetry,
  onMainMenu,
}) => {
  const stats = engine.matchStats;
  const isEndless = engine.gameMode === 'ENDLESS';

  // Read saved best scores
  let bestScore = engine.score;
  let bestEndlessLevel = engine.currentLevel;
  try {
    bestScore = parseInt(localStorage.getItem('mecha_clash_best_score') || '0', 10);
    bestEndlessLevel = parseInt(
      localStorage.getItem('mecha_clash_best_endless_level') || '1',
      10
    );
  } catch {
    // fallback
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 select-none animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900/95 border border-red-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-red-950/60 flex flex-col items-center max-h-[92vh] overflow-y-auto">
        {/* Defeat Icon */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-2 sm:mb-3 shadow-md shadow-red-500/20">
          <Skull className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>

        <h2 className="font-display font-black text-3xl sm:text-5xl text-red-500 tracking-wider uppercase mb-0.5 sm:mb-1 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)] glow-crimson">
          DEFEATED
        </h2>
        <span className="text-xs text-slate-400 font-mono-data tracking-wide uppercase mb-4 sm:mb-5">
          {isEndless
            ? `LEVEL REACHED: ${engine.currentLevel}`
            : `VEX DESTROYED IN COMBAT`}
        </span>

        {/* Endless Callout Highlight */}
        {isEndless && (
          <div className="w-full bg-red-950/40 border border-red-500/30 rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4 text-center">
            <div className="text-[10px] sm:text-[11px] text-red-400 uppercase font-mono-data font-semibold">
              ENDLESS RUN CONCLUDED
            </div>
            <div className="font-display font-black text-xl sm:text-2xl text-white mt-0.5">
              LEVEL REACHED: {engine.currentLevel}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono-data mt-1">
              Best Endless Record: Level {bestEndlessLevel}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="w-full grid grid-cols-2 gap-2 sm:gap-2.5 mb-4 sm:mb-6 text-xs font-mono-data">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase">FINAL SCORE</span>
            <span className="text-white font-bold text-sm sm:text-base mt-0.5">
              {engine.score.toLocaleString()} PTS
            </span>
            <span className="text-[10px] text-slate-500">Record: {bestScore.toLocaleString()}</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-400" /> ROUNDS WON
            </span>
            <span className="text-amber-400 font-bold text-sm sm:text-base mt-0.5">
              {stats.roundWins} ROUNDS
            </span>
            <span className="text-[10px] text-slate-500">Lost: {stats.roundLosses}</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <Swords className="w-3 h-3 text-cyan-400" /> DMG DEALT
            </span>
            <span className="text-slate-200 font-semibold text-sm sm:text-base mt-0.5">
              {Math.round(stats.damageDealt)} HP
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400" /> POWER-UPS
            </span>
            <span className="text-slate-200 font-semibold text-sm sm:text-base mt-0.5">
              {stats.powerUpsCollected} TAKEN
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-2 sm:gap-2.5">
          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm tracking-wider uppercase rounded-xl transition-all shadow-md shadow-red-950 active:scale-98 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> RETRY MATCH
          </button>

          <button
            onClick={onMainMenu}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-display text-xs sm:text-sm tracking-wider uppercase rounded-xl transition-all active:scale-98 cursor-pointer"
          >
            <Home className="w-4 h-4" /> MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
