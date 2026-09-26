import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Activity,
  Pause,
  Wifi,
} from 'lucide-react';

/* =============================================================================
   1. MEMOIZED CENTER MATCH PANEL
   Uses thin angular borders, backdrop-blur, semi-transparent sci-fi styling,
   and React.memo to minimize re-renders during high-frequency combat loops.
   ============================================================================= */
export interface CenterMatchPanelProps {
  currentRound: number;
  score: number;
  modeLabel: string;
  isMuted: boolean;
  isFullscreen: boolean;
  showDebugOverlay: boolean;
  isMultiplayer: boolean;
  onToggleMute: () => void;
  onToggleFullscreen?: () => void;
  onToggleDebug?: () => void;
  onPause: () => void;
}

export const CenterMatchPanel = React.memo<CenterMatchPanelProps>(function CenterMatchPanel({
  currentRound,
  score,
  modeLabel,
  isMuted,
  isFullscreen,
  showDebugOverlay,
  isMultiplayer,
  onToggleMute,
  onToggleFullscreen,
  onToggleDebug,
  onPause,
}) {
  const [displayScore, setDisplayScore] = useState<number>(score);
  const [scorePulsed, setScorePulsed] = useState<boolean>(false);
  const prevScoreRef = useRef<number>(score);

  // Score pulse and animated update only when score actually changes
  useEffect(() => {
    if (score !== prevScoreRef.current) {
      setScorePulsed(true);
      const pulseTimeout = setTimeout(() => setScorePulsed(false), 450);
      setDisplayScore(score);
      prevScoreRef.current = score;
      return () => clearTimeout(pulseTimeout);
    }
  }, [score]);

  return (
    <div className="pointer-events-auto flex flex-col items-center shrink-0 z-20">
      {/* Subtle Visual Connector VS lines */}
      <div className="hidden lg:flex items-center justify-center gap-2 mb-0.5 w-full opacity-60">
        <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-cyan-500/50" />
        <span className="text-[8px] font-display text-slate-400 uppercase tracking-widest">VS</span>
        <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-orange-500/50" />
      </div>

      {/* Sci-Fi Angular Framed Glass Card:
          - 1px outer gradient padding produces a crisp, thin angular chamfered border
          - 65-70% transparent backdrop-blur dark glass
          - Dual-tone cyan/orange edge glow */}
      <div
        className="relative p-[1px] select-none shadow-[0_12px_36px_rgba(0,0,0,0.6)] transition-all duration-200"
        style={{
          clipPath:
            'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)',
          background:
            'linear-gradient(135deg, rgba(6,182,212,0.65) 0%, rgba(255,255,255,0.22) 35%, rgba(255,255,255,0.14) 65%, rgba(249,115,22,0.65) 100%)',
          width: 'clamp(98px, 22vw, 158px)',
        }}
      >
        <div
          className="relative flex flex-col items-center bg-slate-950/70 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-1.5 transition-all duration-200"
          style={{
            clipPath:
              'polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px)',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.15)',
          }}
        >
          {/* Subtle Diagonal Glass Sheen Reflection */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

          {/* Holographic Chamfer Accent Corner Notches */}
          <div className="absolute top-1 left-2 w-1.5 h-[1px] bg-cyan-400/80 pointer-events-none" />
          <div className="absolute top-1 right-2 w-1.5 h-[1px] bg-orange-400/80 pointer-events-none" />
          <div className="absolute bottom-1 left-2 w-1.5 h-[1px] bg-cyan-400/50 pointer-events-none" />
          <div className="absolute bottom-1 right-2 w-1.5 h-[1px] bg-orange-400/50 pointer-events-none" />

          {/* TOP: Mode Label (Subtle, Uppercase, Futuristic, Centered) */}
          <div className="text-[7px] sm:text-[8px] md:text-[9px] font-mono-data tracking-[0.22em] text-slate-300/80 uppercase font-medium leading-none truncate max-w-full drop-shadow-[0_0_6px_rgba(6,182,212,0.3)]">
            {modeLabel}
          </div>

          {/* CENTER: Round Display (Visual Focal Point - Large, Bold Orbitron, High Contrast White, Cyan Glow) */}
          <div className="font-display font-black text-white tracking-wider text-xs sm:text-base md:text-lg leading-tight mt-0.5 sm:mt-1 drop-shadow-[0_0_12px_rgba(6,182,212,0.7)]">
            RND {currentRound}
          </div>

          {/* BELOW: Score / Metric Display (1,580 - Tabular Digits, Cyan Glow, Smooth Pulse) */}
          <div
            className={`flex items-center gap-1 font-mono-data leading-none mt-0.5 transition-all duration-300 ${
              scorePulsed ? 'scale-110 brightness-125 text-cyan-200' : 'text-cyan-300'
            }`}
          >
            <span className="font-bold text-[8px] sm:text-[10px] md:text-[11px] tracking-wide drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
              {displayScore.toLocaleString()}
            </span>
          </div>

          {/* BOTTOM: Action / Status Buttons [ sound ] [ fullscreen ] [ stats ] [ pause ] */}
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 mt-1 sm:mt-1.5 pt-1 border-t border-white/10 w-full">
            {/* Audio Mute/Unmute Toggle */}
            <button
              type="button"
              onClick={onToggleMute}
              className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm ${
                isMuted
                  ? 'bg-amber-950/30 border border-amber-500/40 text-amber-400 hover:border-amber-300 hover:shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  : 'bg-slate-900/60 border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-950/40 text-cyan-300 hover:shadow-[0_0_8px_rgba(6,182,212,0.4)]'
              }`}
              title={isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? (
                <VolumeX className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              ) : (
                <Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              )}
            </button>

            {/* Fullscreen Toggle */}
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg bg-slate-900/60 border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-950/40 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all cursor-pointer hover:shadow-[0_0_8px_rgba(6,182,212,0.4)] backdrop-blur-sm"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400" />
                ) : (
                  <Maximize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                )}
              </button>
            )}

            {/* Telemetry / Performance Stats Toggle */}
            {onToggleDebug && (
              <button
                type="button"
                onClick={onToggleDebug}
                className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm ${
                  showDebugOverlay
                    ? 'bg-cyan-950/70 border border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                    : 'bg-slate-900/60 border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-950/40 text-slate-400 hover:text-cyan-300'
                }`}
                title="Toggle Performance Telemetry (O)"
                aria-label="Toggle Telemetry"
              >
                <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </button>
            )}

            {/* Pause Button (Single-player only, disabled in multiplayer) */}
            {isMultiplayer ? (
              <div
                className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg bg-slate-900/40 border border-white/5 text-purple-400/70 flex items-center justify-center"
                title="Online match active (Pause unavailable)"
                aria-label="Online match"
              >
                <Wifi className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </div>
            ) : (
              <button
                type="button"
                onClick={onPause}
                className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg bg-slate-900/60 border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-950/40 text-cyan-400 hover:text-white flex items-center justify-center transition-all cursor-pointer hover:shadow-[0_0_8px_rgba(6,182,212,0.4)] backdrop-blur-sm"
                title="Pause Match (P)"
                aria-label="Pause Match"
              >
                <Pause className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/* =============================================================================
   2. MEMOIZED VEX (PLAYER 1) VISOR PANEL
   Isolated with React.memo so health updates do not cause center panel redraws.
   ============================================================================= */
interface VexVisorPanelProps {
  displayName: string;
  isMultiplayer: boolean;
  hp: number;
  lives: number;
  dashPct: number;
  dashReady: boolean;
  hasShield: boolean;
  hasPowerAttack: boolean;
  speedBoostTimer: number;
}

const VexVisorPanel = React.memo<VexVisorPanelProps>(function VexVisorPanel({
  displayName,
  isMultiplayer,
  hp,
  lives,
  dashPct,
  dashReady,
  hasShield,
  hasPowerAttack,
  speedBoostTimer,
}) {
  const hpPct = Math.max(0, Math.min(100, (hp / BASE_HP) * 100));
  const [ghostHp, setGhostHp] = useState<number>(hpPct);
  const [damaged, setDamaged] = useState<boolean>(false);
  const prevHpRef = useRef<number>(hpPct);
  const ghostTimerRef = useRef<any>(null);

  useEffect(() => {
    if (hpPct < prevHpRef.current) {
      setDamaged(true);
      const flashTimeout = setTimeout(() => setDamaged(false), 260);

      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
      ghostTimerRef.current = setTimeout(() => {
        setGhostHp(hpPct);
      }, 350);

      prevHpRef.current = hpPct;
      return () => clearTimeout(flashTimeout);
    } else {
      setGhostHp(hpPct);
      prevHpRef.current = hpPct;
    }
  }, [hpPct]);

  useEffect(() => {
    return () => {
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    };
  }, []);

  const isCritical = hpPct <= 25 && hpPct > 0;

  return (
    <div
      className={`pointer-events-auto relative flex flex-col transition-all duration-200 ${
        damaged ? 'scale-[0.985] brightness-125' : ''
      }`}
      style={{
        width: 'clamp(102px, 28vw, 240px)',
        maxWidth: 'calc(50vw - 52px)',
      }}
    >
      <div
        className={`relative rounded-xl p-1.5 sm:p-2.5 backdrop-blur-md border transition-all duration-200 ${
          isCritical
            ? 'bg-cyan-950/50 border-cyan-400/80 shadow-[0_0_18px_rgba(6,182,212,0.4)] animate-pulse'
            : 'bg-slate-950/65 border-cyan-500/30 hover:border-cyan-400/50 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]'
        }`}
        style={{
          clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
        }}
      >
        {/* Top Glass Highlight Reflection */}
        <div className="absolute top-0 left-0 right-2 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent pointer-events-none" />

        {/* Unit Callout & Lives Header */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* VEX Mecha Insignia Crest */}
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-[0_0_6px_rgba(6,182,212,0.3)]">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-cyan-400 fill-current">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 3.5l6 3.3v6.4l-6 3.3-6-3.3V8.8l6-3.3z" />
              </svg>
            </div>

            <div className="flex items-center gap-1 min-w-0">
              <span className="font-display font-extrabold text-cyan-300 text-[10px] sm:text-xs md:text-sm tracking-wider truncate uppercase drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                {displayName}
              </span>
              <span className="hidden sm:inline text-[8px] md:text-[9px] text-cyan-400/70 font-mono-data">
                {isMultiplayer ? 'P1' : 'YOU'}
              </span>
            </div>
          </div>

          {/* Lives Pips - Holographic Diamonds */}
          <div className="flex items-center gap-1 shrink-0" title={`${lives} Rounds / Lives Remaining`}>
            {Array.from({ length: MAX_LIVES }).map((_, idx) => (
              <div
                key={idx}
                className={`rotate-45 transition-all duration-300 ${
                  idx < lives
                    ? 'bg-cyan-400 border border-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                    : 'bg-slate-900/80 border border-slate-700/60 opacity-30'
                }`}
                style={{
                  width: 'clamp(5px, 1.2vw, 8px)',
                  height: 'clamp(5px, 1.2vw, 8px)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Sci-Fi Segmented Health Bar Container */}
        <div className="relative w-full rounded-sm overflow-hidden bg-slate-900/90 border border-slate-800 h-2 sm:h-2.5 md:h-3">
          {/* Background Grid Ticks */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_90%,rgba(0,0,0,0.5)_10%)] bg-[length:10%_100%] pointer-events-none z-10 opacity-70" />

          {/* Damage Ghost Bar (Fighting Game Delay Bar) */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-amber-400/80 transition-all duration-400 ease-out"
            style={{ width: `${ghostHp}%` }}
          />

          {/* Active Health Fill */}
          <div
            className={`absolute top-0 bottom-0 left-0 transition-all duration-200 ease-out ${
              isCritical
                ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]'
                : 'bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
            }`}
            style={{ width: `${hpPct}%` }}
          >
            {/* Inner Gloss Highlight */}
            <div className="w-full h-[35%] bg-white/30" />
          </div>
        </div>

        {/* HP Readout & Dash Gauge Footer */}
        <div className="flex justify-between items-center mt-1 text-[8px] sm:text-[9px] md:text-[10px] font-mono-data text-slate-300">
          <div className="flex items-center gap-1">
            <span className={`font-bold ${isCritical ? 'text-rose-400 animate-pulse' : 'text-cyan-300'}`}>
              {Math.ceil(hp)}
            </span>
            <span className="text-slate-500 font-normal text-[7px] sm:text-[8px]">/ 100</span>
          </div>

          {/* Desktop / Tablet Dash Gauge */}
          <div className="hidden xs:flex items-center gap-1">
            <span className="text-[7px] text-slate-400 uppercase tracking-tighter">DASH</span>
            <div className="w-8 sm:w-10 h-1 bg-slate-900 rounded-xs overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-75 ${
                  dashReady ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-600'
                }`}
                style={{ width: `${dashPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Active Power-Up Buff Badges */}
        <div className="flex items-center gap-1 mt-1 min-h-[12px] overflow-hidden">
          {hasShield && (
            <span
              className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-mono-data font-bold text-blue-300 bg-blue-950/70 px-1 py-0.2 rounded border border-blue-400/50 shadow-[0_0_6px_rgba(59,130,246,0.3)] animate-fadeIn shrink-0"
              title="Active Energy Shield: Blocks next incoming strike"
            >
              <Shield className="w-2 h-2 text-blue-400 shrink-0" />
              <span className="hidden xs:inline">SHIELD</span>
            </span>
          )}
          {hasPowerAttack && (
            <span
              className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-mono-data font-bold text-amber-300 bg-amber-950/70 px-1 py-0.2 rounded border border-amber-400/50 shadow-[0_0_6px_rgba(245,158,11,0.3)] animate-fadeIn shrink-0"
              title="2x Strike Damage Active"
            >
              <Flame className="w-2 h-2 text-amber-400 shrink-0" />
              <span className="hidden xs:inline">2× ATK</span>
            </span>
          )}
          {speedBoostTimer > 0 && (
            <span
              className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-mono-data font-bold text-emerald-300 bg-emerald-950/70 px-1 py-0.2 rounded border border-emerald-400/50 shadow-[0_0_6px_rgba(16,185,129,0.3)] animate-fadeIn shrink-0"
              title="Thruster Overdrive Active"
            >
              <Zap className="w-2 h-2 text-emerald-400 shrink-0" />
              <span className="hidden xs:inline">SPEED</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

/* =============================================================================
   3. MEMOIZED NOVA (OPPONENT / BOSS) VISOR PANEL
   Isolated with React.memo so player damage does not redraw opponent panels.
   ============================================================================= */
interface NovaVisorPanelProps {
  displayName: string;
  isMultiplayer: boolean;
  isBoss: boolean;
  personalityOrDiff: string;
  hp: number;
  lives: number;
  hasShield: boolean;
  hasPowerAttack: boolean;
  speedBoostTimer: number;
}

const NovaVisorPanel = React.memo<NovaVisorPanelProps>(function NovaVisorPanel({
  displayName,
  isMultiplayer,
  isBoss,
  personalityOrDiff,
  hp,
  lives,
  hasShield,
  hasPowerAttack,
  speedBoostTimer,
}) {
  const hpPct = Math.max(0, Math.min(100, (hp / BASE_HP) * 100));
  const [ghostHp, setGhostHp] = useState<number>(hpPct);
  const [damaged, setDamaged] = useState<boolean>(false);
  const prevHpRef = useRef<number>(hpPct);
  const ghostTimerRef = useRef<any>(null);

  useEffect(() => {
    if (hpPct < prevHpRef.current) {
      setDamaged(true);
      const flashTimeout = setTimeout(() => setDamaged(false), 260);

      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
      ghostTimerRef.current = setTimeout(() => {
        setGhostHp(hpPct);
      }, 350);

      prevHpRef.current = hpPct;
      return () => clearTimeout(flashTimeout);
    } else {
      setGhostHp(hpPct);
      prevHpRef.current = hpPct;
    }
  }, [hpPct]);

  useEffect(() => {
    return () => {
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    };
  }, []);

  const isCritical = hpPct <= 25 && hpPct > 0;

  return (
    <div
      className={`pointer-events-auto relative flex flex-col transition-all duration-200 ${
        damaged ? 'scale-[0.985] brightness-125' : ''
      }`}
      style={{
        width: 'clamp(102px, 28vw, 240px)',
        maxWidth: 'calc(50vw - 52px)',
      }}
    >
      <div
        className={`relative rounded-xl p-1.5 sm:p-2.5 backdrop-blur-md border transition-all duration-200 ${
          isCritical
            ? 'bg-rose-950/50 border-rose-400/80 shadow-[0_0_18px_rgba(244,63,94,0.4)] animate-pulse'
            : isBoss
            ? 'bg-slate-950/65 border-amber-500/50 hover:border-amber-400/70 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]'
            : 'bg-slate-950/65 border-orange-500/30 hover:border-orange-400/50 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]'
        }`}
        style={{
          clipPath: 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)',
        }}
      >
        {/* Top Glass Highlight Reflection */}
        <div className="absolute top-0 left-2 right-0 h-[1px] bg-gradient-to-r from-transparent via-orange-400/50 to-transparent pointer-events-none" />

        {/* Unit Callout & Lives Header (Right Aligned / Mirrored) */}
        <div className="flex items-center justify-between gap-1 mb-1">
          {/* Lives Pips - Opposing Red/Amber Holographic Diamonds */}
          <div className="flex items-center gap-1 shrink-0" title={`${lives} Rounds / Lives Remaining`}>
            {Array.from({ length: MAX_LIVES }).map((_, idx) => (
              <div
                key={idx}
                className={`rotate-45 transition-all duration-300 ${
                  idx < lives
                    ? isBoss
                      ? 'bg-amber-400 border border-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                      : 'bg-rose-500 border border-rose-200 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                    : 'bg-slate-900/80 border border-slate-700/60 opacity-30'
                }`}
                style={{
                  width: 'clamp(5px, 1.2vw, 8px)',
                  height: 'clamp(5px, 1.2vw, 8px)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5 min-w-0 justify-end">
            <div className="flex items-center gap-1 min-w-0 justify-end">
              <span className="hidden sm:inline text-[8px] md:text-[9px] text-orange-400/70 font-mono-data">
                {isMultiplayer ? 'P2' : isBoss ? 'BOSS' : 'AI'}
              </span>
              <span
                className={`font-display font-extrabold text-[10px] sm:text-xs md:text-sm tracking-wider truncate uppercase drop-shadow-[0_0_8px_rgba(249,115,22,0.5)] ${
                  isBoss ? 'text-amber-400' : 'text-orange-400'
                }`}
              >
                {displayName}
              </span>
            </div>

            {/* NOVA Mecha Insignia Crest */}
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-orange-500/10 border border-orange-400/40 flex items-center justify-center shrink-0 shadow-[0_0_6px_rgba(249,115,22,0.3)]">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-orange-400 fill-current">
                <path d="M12 2l4 7h6l-5 4 2 7-7-4-7 4 2-7-5-4h6l4-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Sci-Fi Segmented Health Bar Container (Mirrored - Empties right-to-left) */}
        <div className="relative w-full rounded-sm overflow-hidden bg-slate-900/90 border border-slate-800 h-2 sm:h-2.5 md:h-3">
          {/* Background Grid Ticks */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_90%,rgba(0,0,0,0.5)_10%)] bg-[length:10%_100%] pointer-events-none z-10 opacity-70" />

          {/* Damage Ghost Bar (Fighting Game Delay Bar - Right Aligned) */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-yellow-500/80 transition-all duration-400 ease-out"
            style={{ width: `${ghostHp}%` }}
          />

          {/* Active Health Fill (Right Aligned) */}
          <div
            className={`absolute top-0 bottom-0 right-0 transition-all duration-200 ease-out ${
              isCritical
                ? 'bg-gradient-to-l from-rose-600 via-amber-400 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]'
                : isBoss
                ? 'bg-gradient-to-l from-amber-600 via-orange-500 to-yellow-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                : 'bg-gradient-to-l from-red-600 via-rose-500 to-orange-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
            }`}
            style={{ width: `${hpPct}%` }}
          >
            {/* Inner Gloss Highlight */}
            <div className="w-full h-[35%] bg-white/30" />
          </div>
        </div>

        {/* HP Readout & AI Style Footer (Mirrored) */}
        <div className="flex justify-between items-center mt-1 text-[8px] sm:text-[9px] md:text-[10px] font-mono-data text-slate-300">
          <div className="hidden xs:flex items-center gap-1 truncate max-w-[80px]">
            <span className="text-slate-400 text-[7px] sm:text-[8px] uppercase truncate">
              {personalityOrDiff}
            </span>
          </div>

          <div className="flex items-center gap-1 justify-end ml-auto">
            <span className="text-slate-500 font-normal text-[7px] sm:text-[8px]">/ 100</span>
            <span className={`font-bold ${isCritical ? 'text-rose-400 animate-pulse' : 'text-orange-300'}`}>
              {Math.ceil(hp)}
            </span>
          </div>
        </div>

        {/* AI / Opponent Active Buff Badges */}
        <div className="flex items-center justify-end gap-1 mt-1 min-h-[12px] overflow-hidden">
          {hasShield && (
            <span
              className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-mono-data font-bold text-blue-300 bg-blue-950/70 px-1 py-0.2 rounded border border-blue-400/50 shadow-[0_0_6px_rgba(59,130,246,0.3)] animate-fadeIn shrink-0"
              title="Active Energy Shield"
            >
              <Shield className="w-2 h-2 text-blue-400 shrink-0" />
              <span className="hidden xs:inline">SHIELD</span>
            </span>
          )}
          {hasPowerAttack && (
            <span
              className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-mono-data font-bold text-amber-300 bg-amber-950/70 px-1 py-0.2 rounded border border-amber-400/50 shadow-[0_0_6px_rgba(245,158,11,0.3)] animate-fadeIn shrink-0"
              title="2x Strike Damage Active"
            >
              <Flame className="w-2 h-2 text-amber-400 shrink-0" />
              <span className="hidden xs:inline">2× ATK</span>
            </span>
          )}
          {speedBoostTimer > 0 && (
            <span
              className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-mono-data font-bold text-emerald-300 bg-emerald-950/70 px-1 py-0.2 rounded border border-emerald-400/50 shadow-[0_0_6px_rgba(16,185,129,0.3)] animate-fadeIn shrink-0"
              title="Thruster Overdrive Active"
            >
              <Zap className="w-2 h-2 text-emerald-400 shrink-0" />
              <span className="hidden xs:inline">SPEED</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

/* =============================================================================
   4. BATTLE HUD ROOT COMPONENT
   ============================================================================= */
export interface BattleHUDProps {
  engine: GameEngine;
  onPause: () => void;
  onResume?: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onToggleDebug?: () => void;
  showDebugOverlay?: boolean;
}

export const BattleHUD: React.FC<BattleHUDProps> = ({
  engine,
  onPause,
  onToggleMute,
  isMuted,
  onToggleFullscreen,
  isFullscreen = false,
  onToggleDebug,
  showDebugOverlay = false,
}) => {
  const vex = engine.vex;
  const nova = engine.nova;

  // Dash Status
  const dashReady = vex.dashCooldown <= 0;
  const dashPct = dashReady
    ? 100
    : Math.max(0, 100 - (vex.dashCooldown / vex.maxDashCooldown) * 100);

  // Player Names
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

  // Mode / Match Label
  const modeLabel = useMemo(() => {
    if (engine.isMultiplayer) {
      return '1V1 ONLINE';
    }
    if (engine.gameMode === 'CAMPAIGN') {
      return `CAMPAIGN • LVL ${engine.currentLevel}`;
    }
    if (engine.gameMode === 'ENDLESS') {
      return `ENDLESS • LVL ${engine.currentLevel}`;
    }
    return engine.difficulty || 'NORMAL';
  }, [
    engine.isMultiplayer,
    engine.gameMode,
    engine.currentLevel,
    engine.difficulty,
  ]);

  const opponentSubtitle = useMemo(() => {
    if (engine.isMultiplayer) return 'CONNECTED';
    return nova.aiPersonality || engine.difficulty;
  }, [engine.isMultiplayer, nova.aiPersonality, engine.difficulty]);

  return (
    <header
      className="absolute top-0 left-0 right-0 pointer-events-none select-none z-20 w-full flex items-start justify-between px-2 sm:px-4 md:px-6"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 6px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 8px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 8px)',
      }}
    >
      {/* LEFT: VEX MECHA COMBAT VISOR */}
      <VexVisorPanel
        displayName={p1DisplayName}
        isMultiplayer={engine.isMultiplayer}
        hp={vex.hp}
        lives={vex.lives}
        dashPct={dashPct}
        dashReady={dashReady}
        hasShield={vex.hasShield}
        hasPowerAttack={vex.hasPowerAttack}
        speedBoostTimer={vex.speedBoostTimer}
      />

      {/* CENTER: SEMI-TRANSPARENT ANGULAR MATCH PANEL (MEMOIZED) */}
      <CenterMatchPanel
        currentRound={engine.currentRound}
        score={engine.score}
        modeLabel={modeLabel}
        isMuted={isMuted}
        isFullscreen={isFullscreen}
        showDebugOverlay={showDebugOverlay}
        isMultiplayer={engine.isMultiplayer}
        onToggleMute={onToggleMute}
        onToggleFullscreen={onToggleFullscreen}
        onToggleDebug={onToggleDebug}
        onPause={onPause}
      />

      {/* RIGHT: NOVA / OPPONENT COMBAT VISOR */}
      <NovaVisorPanel
        displayName={p2DisplayName}
        isMultiplayer={engine.isMultiplayer}
        isBoss={Boolean(nova.isBoss)}
        personalityOrDiff={opponentSubtitle}
        hp={nova.hp}
        lives={nova.lives}
        hasShield={nova.hasShield}
        hasPowerAttack={nova.hasPowerAttack}
        speedBoostTimer={nova.speedBoostTimer}
      />
    </header>
  );
};

// Aliases for seamless imports
export const HUD = BattleHUD;
export default BattleHUD;
