import React, { useState } from 'react';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_LEVELS } from '../game/constants';
import {
  ArrowLeft,
  Lock,
  Play,
  ShieldCheck,
  AlertTriangle,
  Skull,
  Crown,
  Swords,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface CampaignSelectProps {
  unlockedLevel: number;
  onSelectLevel: (level: number) => void;
  onBack: () => void;
}

export const CampaignSelect: React.FC<CampaignSelectProps> = ({
  unlockedLevel,
  onSelectLevel,
  onBack,
}) => {
  // Determine which chapter the player's current unlocked level belongs to
  const initialChapter = Math.min(
    5,
    Math.max(1, Math.ceil(Math.min(unlockedLevel, 50) / 10))
  );
  const [selectedChapterId, setSelectedChapterId] = useState<number>(initialChapter);

  const selectedChapter =
    CAMPAIGN_CHAPTERS.find((c) => c.id === selectedChapterId) ||
    CAMPAIGN_CHAPTERS[0];

  const levelsInChapter = CAMPAIGN_LEVELS.filter(
    (lvl) => lvl.chapter === selectedChapterId
  );

  const totalLevels = CAMPAIGN_LEVELS.length;
  const clearedLevels = Math.min(totalLevels, Math.max(0, unlockedLevel - 1));
  const progressPercent = Math.round((clearedLevels / totalLevels) * 100);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between p-3 sm:p-6 bg-slate-950 overflow-y-auto select-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 12px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 12px)',
      }}
    >
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />

      {/* Top Header */}
      <div className="w-full max-w-5xl flex items-center justify-between z-10 mb-2 sm:mb-4 gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-xs font-mono-data text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" /> BACK
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline font-display font-semibold text-xs text-slate-400 tracking-widest uppercase">
            OPERATIONAL CAMPAIGN MAP
          </span>
          {unlockedLevel <= 50 && (
            <button
              onClick={() => onSelectLevel(unlockedLevel)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-cyan-950 cursor-pointer active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>CONTINUE LVL {unlockedLevel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Title & Progress Bar */}
      <div className="w-full max-w-5xl text-center z-10 mb-3 sm:mb-5">
        <h2 className="font-display font-black text-2xl sm:text-4xl text-white tracking-wider uppercase mb-1">
          CAMPAIGN SECTORS
        </h2>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-mono-data mb-2">
          <span>PROGRESS:</span>
          <span className="text-cyan-400 font-bold">
            {clearedLevels} / {totalLevels} SECTORS CLEARED ({progressPercent}%)
          </span>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full max-w-md mx-auto h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Chapter Selection Tabs */}
      <div className="w-full max-w-5xl z-10 mb-4 sm:mb-6">
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
          {CAMPAIGN_CHAPTERS.map((ch) => {
            const isCurrent = ch.id === selectedChapterId;
            const [startLvl, endLvl] = ch.levelRange;
            const isUnlocked = unlockedLevel >= startLvl;
            const isCompleted = unlockedLevel > endLvl;
            const chapterClearedCount = Math.max(
              0,
              Math.min(10, unlockedLevel - startLvl)
            );

            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChapterId(ch.id)}
                className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-slate-900 border-cyan-500/80 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                    : isUnlocked
                    ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700 opacity-90'
                    : 'bg-slate-950/40 border-slate-900/60 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-display font-bold text-[10px] sm:text-xs ${
                      isCurrent ? 'text-cyan-400' : 'text-slate-300'
                    }`}
                  >
                    CH. {ch.id}
                  </span>
                  {isCompleted ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : !isUnlocked ? (
                    <Lock className="w-3 h-3 text-slate-600" />
                  ) : (
                    <span className="text-[9px] font-mono-data text-cyan-400">
                      {chapterClearedCount}/10
                    </span>
                  )}
                </div>

                <div className="text-[10px] sm:text-[11px] font-display font-semibold text-white truncate">
                  {ch.title.split(': ')[1] || ch.title}
                </div>
                <div className="text-[8px] sm:text-[9px] text-slate-400 font-mono-data mt-0.5">
                  LVL {startLvl}–{endLvl}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chapter Subheading & Details */}
      <div className="w-full max-w-5xl z-10 mb-3 flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h3 className="font-display font-bold text-sm sm:text-base text-cyan-400 tracking-wide uppercase">
            {selectedChapter.title}
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-400 font-mono-data">
            {selectedChapter.description}
          </p>
        </div>
        <span className="text-[10px] sm:text-xs font-mono-data text-slate-400 shrink-0 ml-2">
          {selectedChapter.subtitle}
        </span>
      </div>

      {/* 10 Levels Grid in Selected Chapter */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 z-10 my-auto mb-4">
        {levelsInChapter.map((stage) => {
          const isUnlocked = stage.level <= unlockedLevel;
          const isCompleted = stage.level < unlockedLevel;

          return (
            <div
              key={stage.level}
              className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                isUnlocked
                  ? stage.isBoss
                    ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/20'
                    : 'bg-slate-900/90 border-slate-700/80 hover:border-cyan-500/60 shadow-md'
                  : 'bg-slate-950/60 border-slate-900 opacity-60'
              } flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-display font-bold text-xs sm:text-sm text-white">
                      {stage.title}
                    </span>

                    {/* Boss Badge */}
                    {stage.isBoss && (
                      <span className="flex items-center gap-1 text-[9px] font-mono-data font-bold text-amber-300 bg-amber-950/90 px-1.5 py-0.5 rounded border border-amber-500/50 shadow-xs">
                        {stage.bossTier === 'FINAL_BOSS' ? (
                          <Crown className="w-3 h-3 text-yellow-400" />
                        ) : stage.bossTier === 'MAJOR_BOSS' ? (
                          <Skull className="w-3 h-3 text-rose-400" />
                        ) : (
                          <Swords className="w-3 h-3 text-amber-400" />
                        )}
                        {stage.bossTier === 'FINAL_BOSS'
                          ? 'FINAL BOSS'
                          : stage.bossTier === 'MAJOR_BOSS'
                          ? 'MAJOR BOSS'
                          : stage.bossTier === 'MINI_BOSS'
                          ? 'MINI BOSS'
                          : 'BOSS'}
                      </span>
                    )}

                    {/* Cleared Checkmark */}
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-[9px] font-mono-data text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3" /> CLEARED
                      </span>
                    )}
                  </div>

                  <span className="text-[9px] font-mono-data uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                    {stage.difficulty}
                  </span>
                </div>

                <div className="text-[11px] text-cyan-400 font-display mb-1 flex items-center justify-between">
                  <span>{stage.subtitle}</span>
                  {stage.arenaLayout && (
                    <span className="text-[9px] font-mono-data text-slate-400">
                      GRID: {stage.arenaLayout.replace('_', ' ')}
                    </span>
                  )}
                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono-data leading-relaxed line-clamp-2 mb-2">
                  {stage.briefing}
                </p>

                {/* Hazards Badges */}
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-2.5">
                  {stage.hazardsEnabled ? (
                    stage.hazardTypes.map((hz) => (
                      <span
                        key={hz}
                        className="flex items-center gap-1 text-[8px] sm:text-[9px] font-mono-data uppercase px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300"
                      >
                        {hz === 'ELECTRIC' && <Zap className="w-2.5 h-2.5" />}
                        {hz === 'COLLAPSE' && <AlertTriangle className="w-2.5 h-2.5" />}
                        {hz === 'BARRIER' && <AlertTriangle className="w-2.5 h-2.5" />}
                        {hz}
                      </span>
                    ))
                  ) : (
                    <span className="text-[8px] sm:text-[9px] font-mono-data uppercase px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400">
                      NO HAZARDS
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              {isUnlocked ? (
                <button
                  onClick={() => onSelectLevel(stage.level)}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-display font-bold text-xs tracking-wider uppercase transition-all shadow-md active:scale-98 cursor-pointer ${
                    stage.isBoss
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-950'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{stage.isBoss ? 'CHALLENGE BOSS' : 'DEPLOY TO SECTOR'}</span>
                </button>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 font-mono-data text-[10px] sm:text-xs uppercase">
                  <Lock className="w-3 h-3" /> COMPLETE LEVEL {stage.level - 1} TO UNLOCK
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl text-center text-[10px] sm:text-[11px] font-mono-data text-slate-400 z-10 mt-1">
        50 LEVELS ACROSS 5 CHAPTERS • PROGRESS SAVED IN LOCAL STORAGE
      </div>
    </div>
  );
};
