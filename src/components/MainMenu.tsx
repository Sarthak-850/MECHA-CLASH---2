import React from 'react';
import { Volume2, VolumeX, Swords, Shield, HelpCircle, Trophy, Flame, Users } from 'lucide-react';

interface MainMenuProps {
  onQuickDuel: () => void;
  onCampaign: () => void;
  onEndless: () => void;
  onMultiplayer: () => void;
  onHowToPlay: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  bestScore: number;
  bestEndlessLevel: number;
  unlockedCampaignLevel?: number;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onQuickDuel,
  onCampaign,
  onEndless,
  onMultiplayer,
  onHowToPlay,
  onToggleMute,
  isMuted,
  bestScore,
  bestEndlessLevel,
  unlockedCampaignLevel = 1,
}) => {
  return (
    <div
      className="relative w-full h-full min-h-[100dvh] flex flex-col items-center justify-between p-3 xs:p-4 sm:p-8 bg-slate-950 overflow-y-auto overflow-x-hidden select-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 12px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 12px)',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Dynamic Cyber Grid & Animated Horizon Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-slate-950/90 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />

      {/* Decorative Mecha Silhouettes on Left & Right for large screens */}
      <div className="absolute left-6 bottom-12 w-44 h-56 pointer-events-none opacity-20 hidden xl:flex flex-col items-center justify-center">
        <div className="w-32 h-32 border-2 border-cyan-400 rotate-45 rounded-xl animate-pulse" />
        <span className="font-display text-cyan-400 text-xs tracking-widest mt-6">
          VEX // PILOT UNIT
        </span>
      </div>

      <div className="absolute right-6 bottom-12 w-44 h-56 pointer-events-none opacity-20 hidden xl:flex flex-col items-center justify-center">
        <div className="w-32 h-32 border-2 border-red-500 rotate-45 rounded-xl animate-pulse" />
        <span className="font-display text-red-500 text-xs tracking-widest mt-6">
          NOVA // AI SENTINEL
        </span>
      </div>

      {/* Top Bar with Audio Toggle & Stats Badge */}
      <div className="w-full max-w-3xl flex items-center justify-between z-10 mb-1 sm:mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
          <span className="text-[10px] xs:text-[11px] sm:text-xs font-mono-data text-slate-400 tracking-wider">
            SYSTEM ONLINE · VER 1.2.0
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-[11px] sm:text-xs font-mono-data text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          {isMuted ? <VolumeX className="w-3 h-3 xs:w-3.5 xs:h-3.5" /> : <Volume2 className="w-3 h-3 xs:w-3.5 xs:h-3.5" />}
          <span>{isMuted ? 'MUTED' : 'AUDIO ON'}</span>
        </button>
      </div>

      {/* Hero Title Section */}
      <div className="flex flex-col items-center text-center z-10 my-auto py-1 sm:py-3 w-full max-w-md">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-[9px] xs:text-[10px] sm:text-xs font-mono-data tracking-widest uppercase mb-1.5 sm:mb-3 shadow-xs shadow-cyan-950">
          <Swords className="w-3 h-3 shrink-0" /> CYBERNETIC ARCADE COMBAT
        </div>

        <h1 className="font-display font-black text-3xl xs:text-4xl sm:text-6xl md:text-7xl tracking-wider text-white uppercase drop-shadow-[0_0_25px_rgba(6,182,212,0.4)]">
          MECHA <span className="text-cyan-400">CLASH</span>
        </h1>

        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 font-display tracking-wider text-slate-400 text-[10px] xs:text-xs sm:text-sm uppercase">
          <span>AI ARENA</span>
          <span>·</span>
          <span className="text-cyan-400">VEX</span>
          <span className="text-[9px] text-slate-600 font-mono-data">VS</span>
          <span className="text-red-400">NOVA</span>
        </div>

        {/* High Score & Record Badges */}
        <div className="flex items-center justify-center gap-2 xs:gap-3 sm:gap-5 mt-2 sm:mt-4 py-1.5 px-3 sm:px-4 rounded-xl bg-slate-900/80 border border-slate-800/90 text-[10px] xs:text-[11px] sm:text-xs font-mono-data text-slate-300">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-slate-400">BEST:</span>
            <span className="text-amber-400 font-bold">{bestScore.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Flame className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-slate-400">ENDLESS:</span>
            <span className="text-cyan-400 font-bold">LVL {bestEndlessLevel}</span>
          </div>
        </div>

        {/* Mode Navigation Buttons */}
        <div className="w-full flex flex-col gap-2 sm:gap-2.5 mt-3 sm:mt-6">
          {/* QUICK DUEL */}
          <button
            type="button"
            onClick={onQuickDuel}
            className="w-full group flex items-center justify-between py-2.5 xs:py-3 sm:py-3.5 px-4 sm:px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-md shadow-cyan-500/25 active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 xs:w-4 xs:h-4" /> QUICK DUEL
            </span>
            <span className="text-[9px] xs:text-[10px] font-mono-data opacity-75">1V1 AI BATTLE</span>
          </button>

          {/* MULTIPLAYER */}
          <button
            type="button"
            onClick={onMultiplayer}
            className="w-full group flex items-center justify-between py-2.5 xs:py-3 sm:py-3.5 px-4 sm:px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-display font-bold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-md shadow-purple-600/30 active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-purple-200" /> MULTIPLAYER
            </span>
            <span className="text-[9px] xs:text-[10px] font-mono-data text-purple-200 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-400/30">
              ONLINE 1V1
            </span>
          </button>

          {/* CAMPAIGN */}
          <button
            type="button"
            onClick={onCampaign}
            className="w-full group flex items-center justify-between py-2.5 xs:py-3 sm:py-3.5 px-4 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-white font-display font-semibold text-xs sm:text-sm tracking-wider uppercase transition-all active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-cyan-400" /> CAMPAIGN MODE
            </span>
            <span className="text-[9px] xs:text-[10px] font-mono-data text-cyan-400">
              {unlockedCampaignLevel > 1 ? `LVL ${unlockedCampaignLevel} / 50` : '50 LEVELS'}
            </span>
          </button>

          {/* ENDLESS */}
          <button
            type="button"
            onClick={onEndless}
            className="w-full group flex items-center justify-between py-2.5 xs:py-3 sm:py-3.5 px-4 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-white font-display font-semibold text-xs sm:text-sm tracking-wider uppercase transition-all active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-amber-400" /> ENDLESS SURVIVAL
            </span>
            <span className="text-[9px] xs:text-[10px] font-mono-data text-amber-400">INFINITE</span>
          </button>

          {/* HOW TO PLAY */}
          <button
            type="button"
            onClick={onHowToPlay}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-transparent hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-display text-[11px] sm:text-xs tracking-wider uppercase transition-all active:scale-98 cursor-pointer"
          >
            <HelpCircle className="w-3 h-3 xs:w-3.5 xs:h-3.5" /> HOW TO PLAY & CONTROLS
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-3xl flex flex-col sm:flex-row items-center justify-between text-[9px] xs:text-[10px] sm:text-[11px] font-mono-data text-slate-400 z-10 gap-1 mt-1 text-center">
        <span>DESKTOP: WASD + F + G · MOBILE: TOUCH CONTROLS</span>
        <span>NO INSTALLATION REQUIRED · INSTANT BATTLE</span>
      </div>
    </div>
  );
};
