import React from 'react';
import { GameEngine } from '../game/engine';
import { Trophy, ArrowRight, RotateCcw, Home, Clock, Swords, ShieldAlert, Award, Heart } from 'lucide-react';
import { CAMPAIGN_LEVELS } from '../game/constants';

interface VictoryModalProps {
  engine: GameEngine;
  onNextLevel: () => void;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  engine,
  onNextLevel,
  onPlayAgain,
  onMainMenu,
}) => {
  const stats = engine.matchStats;
  const isCampaign = engine.gameMode === 'CAMPAIGN';
  const isEndless = engine.gameMode === 'ENDLESS';
  const hasNextCampaignLevel = isCampaign && engine.currentLevel < CAMPAIGN_LEVELS.length;
  const showNextButton = hasNextCampaignLevel || isEndless;

  const minutes = Math.floor(stats.durationSeconds / 60);
  const seconds = Math.floor(stats.durationSeconds % 60);
  const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 select-none animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900/95 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-cyan-950/60 flex flex-col items-center max-h-[92vh] overflow-y-auto">
        {/* Victory Trophy Icon */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2 sm:mb-3 shadow-md shadow-cyan-500/20">
          <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>

        <h2 className="font-display font-black text-3xl sm:text-5xl text-cyan-400 tracking-wider uppercase mb-0.5 sm:mb-1 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)] glow-cyan text-center">
          {isCampaign && engine.currentLevel === 50 ? 'CAMPAIGN CONQUERED!' : 'VICTORY'}
        </h2>
        <span className="text-xs text-slate-400 font-mono-data tracking-wide uppercase mb-3 sm:mb-4 text-center">
          {isCampaign
            ? engine.currentLevel === 50
              ? 'LEVEL 50 CLEARED • APEX OVERLORD VANQUISHED'
              : `LEVEL ${engine.currentLevel} COMPLETE`
            : isEndless
            ? `ENDLESS WAVE ${engine.currentLevel} CLEARED`
            : `${engine.difficulty} DUEL WON`}
        </span>

        {isCampaign && engine.currentLevel === 50 && (
          <div className="w-full p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 text-[11px] font-mono-data text-center mb-4 leading-relaxed">
            ★ OUTSTANDING PILOT ACHIEVEMENT ★
            <br />
            You have successfully conquered all 50 Sectors of the Mecha Clash Campaign and defeated Apex Nova!
          </div>
        )}

        {/* Stats Grid */}
        <div className="w-full grid grid-cols-2 gap-2 sm:gap-2.5 mb-4 sm:mb-6 text-xs font-mono-data">
          {/* Total Score */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase">MATCH SCORE</span>
            <span className="text-cyan-400 font-bold text-sm sm:text-base mt-0.5">
              {engine.score.toLocaleString()} PTS
            </span>
          </div>

          {/* Match Duration */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <Clock className="w-3 h-3" /> DURATION
            </span>
            <span className="text-white font-semibold text-sm sm:text-base mt-0.5">
              {durationStr}
            </span>
          </div>

          {/* Damage Dealt */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <Swords className="w-3 h-3 text-cyan-400" /> DMG DEALT
            </span>
            <span className="text-slate-200 font-semibold text-sm sm:text-base mt-0.5">
              {Math.round(stats.damageDealt)} HP
            </span>
          </div>

          {/* Damage Received */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" /> DMG TAKEN
            </span>
            <span className="text-slate-200 font-semibold text-sm sm:text-base mt-0.5">
              {Math.round(stats.damageReceived)} HP
            </span>
          </div>

          {/* Win Streak */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-400" /> WIN STREAK
            </span>
            <span className="text-amber-400 font-bold text-sm sm:text-base mt-0.5">
              {engine.winStreak} WINS
            </span>
          </div>

          {/* Lives Remaining */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 sm:p-2.5 flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
              <Heart className="w-3 h-3 text-red-400" /> LIVES LEFT
            </span>
            <span className="text-white font-semibold text-sm sm:text-base mt-0.5">
              {engine.vex.lives} / 3
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-2 sm:gap-2.5">
          {showNextButton && (
            <button
              onClick={onNextLevel}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm tracking-wider uppercase rounded-xl transition-all shadow-md shadow-cyan-950 active:scale-98 cursor-pointer"
            >
              <span>{isEndless ? 'CONTINUE TO NEXT WAVE' : 'ADVANCE TO NEXT LEVEL'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onPlayAgain}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-display font-semibold text-sm tracking-wider uppercase rounded-xl transition-all active:scale-98 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> PLAY AGAIN
          </button>

          <button
            onClick={onMainMenu}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-transparent hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-display text-xs tracking-wider uppercase rounded-xl transition-all active:scale-98 cursor-pointer"
          >
            <Home className="w-4 h-4" /> MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
