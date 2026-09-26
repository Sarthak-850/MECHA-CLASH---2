import React, { useState } from 'react';
import { GameEngine } from '../game/engine';
import { BASE_HP, MAX_LIVES } from '../game/constants';
import {
  Volume2,
  VolumeX,
  Shield,
  Zap,
  Flame,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { isMobileClient } from '../utils/fullscreen';

interface HUDProps {
  engine: GameEngine;
  onPause: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  engine,
  onPause,
  onToggleMute,
  isMuted,
  onToggleFullscreen,
  isFullscreen = false,
}) => {
  const vex = engine.vex;
  const nova = engine.nova;
  const [isMobile] = useState<boolean>(() => isMobileClient());

  const vexHpPct = Math.max(0, Math.min(100, (vex.hp / BASE_HP) * 100));
  const novaHpPct = Math.max(0, Math.min(100, (nova.hp / BASE_HP) * 100));

  const dashReady = vex.dashCooldown <= 0;
  const dashPct = dashReady
    ? 100
    : Math.max(0, 100 - (vex.dashCooldown / vex.maxDashCooldown) * 100);

  const p1DisplayName = engine.isMultiplayer
    ? engine.localRole === 'PLAYER_1'
      ? engine.localPlayerName
      : engine.remotePlayerName
    : 'VEX';

  const p2DisplayName = engine.isMultiplayer
    ? engine.localRole === 'PLAYER_2'
      ? engine.localPlayerName
      : engine.remotePlayerName
    : nova.name;

  // Safe area top calculation: accounts for mobile top bar (battery indicator)
  const topOffset = isMobile
    ? 'calc(max(env(safe-area-inset-top, 0px), 2px) + 20px)'
    : 'max(env(safe-area-inset-top, 0px), 6px)';

  return (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none select-none z-20 w-full"
      style={{
        height: 'clamp(50px, 12dvh, 85px)',
      }}
    >
      {/* ================= LEFT: PLAYER 1 (YOU / VEX) HEALTH PANEL ================= */}
      <div
        className="absolute pointer-events-auto bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 rounded-lg p-1 xs:p-1.5 sm:p-2 shadow-md shadow-cyan-950/30 transition-all [container-type:inline-size]"
        style={{
          top: topOffset,
          left: 'max(env(safe-area-inset-left, 0px), 6px)',
          width: 'clamp(98px, 26vw, 210px)',
          maxWidth: 'calc(50vw - 44px)',
        }}
      >
        <div className="flex items-center justify-between mb-0.5 sm:mb-1">
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <span className="font-display font-extrabold text-cyan-400 text-[clamp(9px,2.8cqw,13px)] tracking-wider truncate">
              {p1DisplayName}
            </span>
            <span className="hidden md:inline text-[9px] text-slate-400 font-mono-data uppercase">
              {engine.isMultiplayer
                ? engine.localRole === 'PLAYER_1'
                  ? '[YOU]'
                  : '[P1]'
                : '[PLAYER]'}
            </span>
          </div>

          {/* Lives Indicator */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" title={`${vex.lives} Lives Remaining`}>
            {Array.from({ length: MAX_LIVES }).map((_, idx) => (
              <div
                key={idx}
                className={`rotate-45 border transition-all ${
                  idx < vex.lives
                    ? 'bg-cyan-400 border-cyan-200 shadow-xs shadow-cyan-400'
                    : 'bg-slate-900 border-slate-700 opacity-40'
                }`}
                style={{
                  width: 'clamp(5px, 1.8cqw, 9px)',
                  height: 'clamp(5px, 1.8cqw, 9px)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Dynamic Container-Queried Health Bar Gauge */}
        <div
          className="w-full bg-slate-900 rounded-xs overflow-hidden border border-slate-800 relative"
          style={{
            height: 'clamp(6px, 1.6cqw + 0.4dvh, 11px)',
          }}
        >
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-100 ease-out"
            style={{ width: `${vexHpPct}%` }}
          />
        </div>

        <div className="flex justify-between items-center mt-0.5 text-[clamp(8px,2cqw,10px)] font-mono-data text-slate-300">
          <span className="font-semibold text-cyan-300">
            {Math.ceil(vex.hp)} <span className="text-[clamp(7px,1.6cqw,9px)] text-slate-400 font-normal">/ 100</span>
          </span>

          {/* Desktop Dash indicator */}
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-[8px] text-slate-400">DASH [G]</span>
            <div className="w-8 h-1 bg-slate-800 rounded-xs overflow-hidden">
              <div
                className={`h-full transition-all ${
                  dashReady ? 'bg-cyan-400' : 'bg-slate-500'
                }`}
                style={{ width: `${dashPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Active Buffs */}
        <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5 min-h-[9px] xs:min-h-[11px] overflow-hidden">
          {vex.hasShield && (
            <span className="flex items-center gap-0.5 text-[clamp(7px,1.8cqw,9px)] font-mono-data text-blue-300 bg-blue-950/80 px-1 py-0.2 rounded border border-blue-500/40 shrink-0">
              <Shield className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
              <span className="hidden xs:inline">SHIELD</span>
            </span>
          )}
          {vex.hasPowerAttack && (
            <span className="flex items-center gap-0.5 text-[clamp(7px,1.8cqw,9px)] font-mono-data text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/40 shrink-0">
              <Flame className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
              <span className="hidden xs:inline">2× ATK</span>
            </span>
          )}
          {vex.speedBoostTimer > 0 && (
            <span className="flex items-center gap-0.5 text-[clamp(7px,1.8cqw,9px)] font-mono-data text-emerald-300 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/40 shrink-0">
              <Zap className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
              <span className="hidden xs:inline">SPEED</span>
            </span>
          )}
        </div>
      </div>

      {/* ================= CENTER: MATCH STATUS & QUICK CONTROLS ================= */}
      <div
        className="absolute pointer-events-auto flex flex-col items-center bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg px-1.5 xs:px-2 sm:px-3 py-0.5 sm:py-1 shadow-md shrink-0 -translate-x-1/2"
        style={{
          top: topOffset,
          left: '50%',
          width: 'clamp(76px, 20vw, 136px)',
        }}
      >
        <div className="font-display text-[clamp(7px,1.8vw,10px)] text-slate-400 uppercase tracking-widest leading-none truncate max-w-full">
          {engine.isMultiplayer
            ? `ROOM ${engine.multiplayerRoomCode}`
            : engine.gameMode === 'CAMPAIGN'
            ? `LVL ${engine.currentLevel}`
            : engine.gameMode === 'ENDLESS'
            ? `ENDLESS ${engine.currentLevel}`
            : `${engine.difficulty}`}
        </div>

        <div className="font-display font-black text-[clamp(11px,2.5vw,15px)] text-white tracking-wider glow-cyan leading-tight mt-0.5">
          RND {engine.currentRound}
        </div>

        <div className="flex items-center gap-1 text-[clamp(7px,1.8vw,10px)] font-mono-data text-slate-300">
          {engine.isMultiplayer ? (
            <span className="text-purple-400 font-semibold tracking-wider text-[8px] xs:text-[9px]">ONLINE 1V1</span>
          ) : (
            <span className="text-cyan-400 font-semibold">{engine.score.toLocaleString()}</span>
          )}
        </div>

        {/* Quick Action Buttons Row (Mute, Fullscreen, Pause) */}
        <div className="flex items-center gap-1 mt-0.5">
          {/* Mute Button */}
          <button
            type="button"
            onClick={onToggleMute}
            className="p-0.5 sm:p-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-2.5 h-2.5 xs:w-3 xs:h-3" /> : <Volume2 className="w-2.5 h-2.5 xs:w-3 xs:h-3" />}
          </button>

          {/* Fullscreen Button */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-0.5 sm:p-1 rounded bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-2.5 h-2.5 xs:w-3 xs:h-3 text-cyan-400" />
              ) : (
                <Maximize2 className="w-2.5 h-2.5 xs:w-3 xs:h-3 text-cyan-400" />
              )}
            </button>
          )}

          {/* Pause Button in Single Player */}
          {!engine.isMultiplayer && (
            <button
              type="button"
              onClick={onPause}
              className="flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
              title="Pause Game (P)"
              aria-label="Pause"
            >
              <span className="font-display font-black text-[9px] xs:text-[10px] text-cyan-400 leading-none">
                Ⅱ
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ================= RIGHT: NOVA (AI OR PLAYER 2) HEALTH PANEL ================= */}
      <div
        className={`absolute pointer-events-auto bg-slate-950/85 backdrop-blur-md rounded-lg p-1 xs:p-1.5 sm:p-2 shadow-md transition-all [container-type:inline-size] ${
          nova.isBoss
            ? 'border border-amber-500/60 shadow-amber-950/40'
            : 'border border-red-500/30 shadow-red-950/30'
        }`}
        style={{
          top: topOffset,
          right: 'max(env(safe-area-inset-right, 0px), 6px)',
          width: 'clamp(98px, 26vw, 210px)',
          maxWidth: 'calc(50vw - 44px)',
        }}
      >
        <div className="flex items-center justify-between mb-0.5 sm:mb-1">
          {/* Lives Indicator */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" title={`${nova.lives} Lives Remaining`}>
            {Array.from({ length: MAX_LIVES }).map((_, idx) => (
              <div
                key={idx}
                className={`rotate-45 border transition-all ${
                  idx < nova.lives
                    ? nova.isBoss
                      ? 'bg-amber-400 border-amber-200 shadow-xs shadow-amber-400'
                      : 'bg-red-500 border-red-200 shadow-xs shadow-red-500'
                    : 'bg-slate-900 border-slate-700 opacity-40'
                }`}
                style={{
                  width: 'clamp(5px, 1.8cqw, 9px)',
                  height: 'clamp(5px, 1.8cqw, 9px)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 justify-end">
            <span className="hidden md:inline text-[9px] font-mono-data uppercase text-slate-400">
              {engine.isMultiplayer
                ? engine.localRole === 'PLAYER_2'
                  ? '[YOU]'
                  : '[P2]'
                : nova.isBoss
                ? '[BOSS]'
                : '[AI]'}
            </span>
            <span
              className={`font-display font-extrabold text-[clamp(9px,2.8cqw,13px)] tracking-wider truncate ${
                nova.isBoss ? 'text-amber-400' : 'text-red-500'
              }`}
            >
              {p2DisplayName}
            </span>
          </div>
        </div>

        {/* Dynamic Container-Queried Health Bar Gauge */}
        <div
          className="w-full bg-slate-900 rounded-xs overflow-hidden border border-slate-800 relative"
          style={{
            height: 'clamp(6px, 1.6cqw + 0.4dvh, 11px)',
          }}
        >
          <div
            className="h-full bg-gradient-to-l from-red-600 to-rose-400 transition-all duration-100 ease-out ml-auto"
            style={{ width: `${novaHpPct}%` }}
          />
        </div>

        <div className="flex justify-between items-center mt-0.5 text-[clamp(8px,2cqw,10px)] font-mono-data text-slate-300">
          <div className="flex items-center gap-1 truncate max-w-[45px] xs:max-w-[65px] sm:max-w-none">
            <span className="text-slate-400 text-[clamp(7px,1.6cqw,9px)] truncate">
              {engine.difficulty}
            </span>
          </div>
          <span className="font-semibold text-red-400">
            {Math.ceil(nova.hp)} <span className="text-[clamp(7px,1.6cqw,9px)] text-slate-400 font-normal">/ 100</span>
          </span>
        </div>

        {/* AI Buffs */}
        <div className="flex items-center justify-end gap-0.5 sm:gap-1 mt-0.5 min-h-[9px] xs:min-h-[11px] overflow-hidden">
          {nova.hasShield && (
            <span className="flex items-center gap-0.5 text-[clamp(7px,1.8cqw,9px)] font-mono-data text-blue-300 bg-blue-950/80 px-1 py-0.2 rounded border border-blue-500/40 shrink-0">
              <Shield className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
              <span className="hidden xs:inline">SHIELD</span>
            </span>
          )}
          {nova.hasPowerAttack && (
            <span className="flex items-center gap-0.5 text-[clamp(7px,1.8cqw,9px)] font-mono-data text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/40 shrink-0">
              <Flame className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
              <span className="hidden xs:inline">2× ATK</span>
            </span>
          )}
          {nova.speedBoostTimer > 0 && (
            <span className="flex items-center gap-0.5 text-[clamp(7px,1.8cqw,9px)] font-mono-data text-emerald-300 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/40 shrink-0">
              <Zap className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
              <span className="hidden xs:inline">SPEED</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
