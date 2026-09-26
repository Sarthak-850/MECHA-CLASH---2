import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine';
import { GameRenderer } from '../game/renderer';
import { ARENA_HEIGHT, ARENA_WIDTH, CAMPAIGN_LEVELS, BASE_HP, MAX_LIVES } from '../game/constants';
import { ArenaColorTheme } from '../types/game';
import { CountdownOverlay } from './CountdownOverlay';
import { RoundEndOverlay } from './RoundEndOverlay';
import { PauseModal } from './PauseModal';
import { VictoryModal } from './VictoryModal';
import { DefeatModal } from './DefeatModal';
import { MultiplayerModal } from './MultiplayerModal';
import { VirtualControls } from './VirtualControls';
import { soundManager } from '../audio/soundManager';
import {
  RotateCw,
  Volume2,
  VolumeX,
  Shield,
  Zap,
  Flame,
  Maximize2,
  Minimize2,
  Activity,
} from 'lucide-react';
import { isFullscreenActive, isMobileClient } from '../utils/fullscreen';
import { BatteryIndicator } from './BatteryIndicator';

interface GameCanvasProps {
  engine: GameEngine;
  onMainMenu: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onMultiplayerRematch?: () => void;
  opponentDisconnected?: boolean;
  disconnectMessage?: string;
  rematchRequested?: boolean;
  opponentRematchReady?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engine,
  onMainMenu,
  onToggleFullscreen,
  isFullscreen: parentIsFullscreen,
  onMultiplayerRematch,
  opponentDisconnected = false,
  disconnectMessage,
  rematchRequested = false,
  opponentRematchReady = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const reqIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const lastHpRef = useRef({ vexHp: -1, novaHp: -1, vexLives: -1, novaLives: -1, round: -1, score: -1 });
  const frameCountRef = useRef(0);
  const fpsTimeRef = useRef(performance.now());
  const currentFpsRef = useRef(60);
  const currentFrameTimeRef = useRef(16.6);
  const countdownStepRef = useRef(engine.countdownStep);

  // Reactive state synced with engine
  const [gameState, setGameState] = useState(engine.gameState);
  const [countdownStep, setCountdownStep] = useState(engine.countdownStep);
  const [roundWinner, setRoundWinner] = useState(engine.roundWinner);
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());
  const [, setHudTick] = useState(0);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);

  // Fullscreen & Mobile tracking
  const [localFullscreen, setLocalFullscreen] = useState(isFullscreenActive());
  const isFullscreen = parentIsFullscreen ?? localFullscreen;
  const [isMobile] = useState<boolean>(() => isMobileClient());

  // Touch and orientation detection
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissPortraitNotice, setDismissPortraitNotice] = useState(false);

  // Synchronize fullscreen state
  useEffect(() => {
    const handleFullscreenSync = () => {
      setLocalFullscreen(isFullscreenActive());
    };

    document.addEventListener('fullscreenchange', handleFullscreenSync);
    document.addEventListener('webkitfullscreenchange', handleFullscreenSync);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenSync);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenSync);
    };
  }, []);

  // Initialize and track touch detection + orientation
  useEffect(() => {
    const checkTouchAndOrientation = () => {
      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;

      setIsTouchDevice(hasTouch);
      if (hasTouch) {
        setShowTouchControls(true);
      }

      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 900;
      setIsPortrait(portrait);
    };

    checkTouchAndOrientation();

    // Any touch pointer anywhere turns on touch controls automatically
    const handleGlobalPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        setIsTouchDevice(true);
        setShowTouchControls(true);
      }
    };

    window.addEventListener('resize', checkTouchAndOrientation, { passive: true });
    window.addEventListener('orientationchange', checkTouchAndOrientation);
    window.addEventListener('pointerdown', handleGlobalPointerDown, { passive: true });

    return () => {
      window.removeEventListener('resize', checkTouchAndOrientation);
      window.removeEventListener('orientationchange', checkTouchAndOrientation);
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
    };
  }, []);

  // Hook engine callbacks
  useEffect(() => {
    engine.onStateChange = (newState) => {
      setGameState(newState);
      setCountdownStep(engine.countdownStep);
      setRoundWinner(engine.roundWinner);
      setHudTick((t) => t + 1);
    };

    return () => {
      engine.onStateChange = undefined;
    };
  }, [engine]);

  // Keyboard Event Handlers (Preserved 100% for desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyF',
          'KeyG',
          'KeyP',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
        ].includes(e.code)
      ) {
        e.preventDefault();
      }

      engine.keys[e.code] = true;

      if (e.code === 'KeyP') {
        if (engine.gameState === 'BATTLE') {
          engine.pause();
        } else if (engine.gameState === 'PAUSED') {
          lastTimeRef.current = performance.now();
          engine.resume();
        }
      }

      if (e.code === 'KeyO') {
        setShowDebugOverlay((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engine.keys[e.code] = false;
    };

    const handleBlur = () => {
      engine.keys = {};
      engine.setJoystickVector(0, 0);
      if (engine.gameState === 'BATTLE') {
        engine.pause();
      }
    };

    const handleFocus = () => {
      lastTimeRef.current = performance.now();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [engine]);

  // Main Animation / Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    rendererRef.current = new GameRenderer(ctx);
    lastTimeRef.current = performance.now();

    const loop = (currentTime: number) => {
      // Authoritative Clamped Simulation Delta
      const rawDt = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      // Clamp delta between 1ms (1000fps) and 50ms (20fps) to eliminate spikes on tab focus / lag
      const dt = Math.max(0.001, Math.min(0.05, rawDt));

      // Rolling FPS calculation for telemetry
      frameCountRef.current++;
      if (currentTime - fpsTimeRef.current >= 400) {
        currentFpsRef.current = Math.round((frameCountRef.current * 1000) / (currentTime - fpsTimeRef.current));
        currentFrameTimeRef.current = Math.round((dt * 1000) * 10) / 10;
        frameCountRef.current = 0;
        fpsTimeRef.current = currentTime;
      }
      engine.metrics.fps = currentFpsRef.current;
      engine.metrics.frameTimeMs = currentFrameTimeRef.current;

      // Update engine physics & logic with authoritative simulation delta
      engine.update(dt);

      // Render frame
      if (rendererRef.current) {
        let theme: ArenaColorTheme = 'CYAN_MATRIX';
        if (engine.gameMode === 'CAMPAIGN') {
          const camp = CAMPAIGN_LEVELS[engine.currentLevel - 1];
          if (camp) theme = camp.arenaColorTheme;
        } else if (engine.difficulty === 'HARD' || engine.difficulty === 'EXTREME_HARD') {
          theme = 'CRIMSON_FORGE';
        } else if (engine.difficulty === 'HARDCORE') {
          theme = 'GOLD_CORE';
        }

        rendererRef.current.render(
          dt,
          engine.vex,
          engine.nova,
          engine.powerUps,
          engine.obstacles,
          engine.hazards,
          engine.collapsingPlatforms,
          engine.barriers,
          engine.particles,
          engine.floatingTexts,
          engine.screenShake,
          theme
        );
      }

      // Check for HUD telemetry changes (hp, lives, round, score)
      if (
        Math.abs(engine.vex.hp - lastHpRef.current.vexHp) > 0.1 ||
        Math.abs(engine.nova.hp - lastHpRef.current.novaHp) > 0.1 ||
        engine.vex.lives !== lastHpRef.current.vexLives ||
        engine.nova.lives !== lastHpRef.current.novaLives ||
        engine.currentRound !== lastHpRef.current.round ||
        engine.score !== lastHpRef.current.score
      ) {
        lastHpRef.current = {
          vexHp: engine.vex.hp,
          novaHp: engine.nova.hp,
          vexLives: engine.vex.lives,
          novaLives: engine.nova.lives,
          round: engine.currentRound,
          score: engine.score,
        };
        setHudTick((t) => t + 1);
      }

      // Sync state for countdown or round status changes without re-triggering effect
      if (engine.gameState === 'COUNTDOWN' && countdownStepRef.current !== engine.countdownStep) {
        countdownStepRef.current = engine.countdownStep;
        setCountdownStep(engine.countdownStep);
      }

      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (reqIdRef.current) {
        cancelAnimationFrame(reqIdRef.current);
      }
    };
  }, [engine]);

  // Action handlers
  const handlePause = useCallback(() => {
    engine.pause();
  }, [engine]);

  const handleResume = useCallback(() => {
    lastTimeRef.current = performance.now();
    engine.resume();
  }, [engine]);

  const handleRestart = useCallback(() => {
    engine.startMatch(engine.gameMode, engine.difficulty, engine.currentLevel);
  }, [engine]);

  const handleNextLevel = useCallback(() => {
    if (engine.gameMode === 'CAMPAIGN') {
      const nextLvl = engine.currentLevel + 1;
      engine.startMatch('CAMPAIGN', engine.difficulty, nextLvl);
    } else if (engine.gameMode === 'ENDLESS') {
      const nextLvl = engine.currentLevel + 1;
      engine.startMatch('ENDLESS', engine.difficulty, nextLvl);
    }
  }, [engine]);

  const handleToggleMute = useCallback(() => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  }, []);

  // HUD Dynamic Calculations
  const vex = engine.vex;
  const nova = engine.nova;
  const vexHpPct = Math.max(0, Math.min(100, (vex.hp / BASE_HP) * 100));
  const novaHpPct = Math.max(0, Math.min(100, (nova.hp / BASE_HP) * 100));
  const dashReady = vex.dashCooldown <= 0;
  const dashPct = dashReady ? 100 : Math.max(0, 100 - (vex.dashCooldown / vex.maxDashCooldown) * 100);

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

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-screen h-screen h-[100dvh] max-h-[100dvh] flex flex-col items-center justify-center bg-slate-950 overflow-hidden select-none touch-none"
      style={{
        contain: 'strict',
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* =========================================================================
          HUD OVERLAY: ABSOLUTE POSITIONING WITH env(safe-area-inset-*) & DYNAMIC UNITS (vw/dvh)
          ========================================================================= */}
      <header
        className="absolute top-0 left-0 right-0 pointer-events-none select-none z-20 w-full"
        style={{
          height: 'clamp(52px, 12dvh, 85px)',
        }}
      >
        {/* ================= LEFT: PLAYER 1 (YOU / VEX) HUD PANEL ================= */}
        <div
          className="absolute pointer-events-auto bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-md shadow-cyan-950/30 select-none z-20"
          style={{
            top: 'max(env(safe-area-inset-top, 0px), 1dvh)',
            left: 'max(env(safe-area-inset-left, 0px), 1.5vw)',
            width: 'clamp(94px, 26vw, 210px)',
            maxWidth: 'calc(50vw - 42px)',
            padding: 'clamp(3px, 0.8vw, 8px)',
          }}
        >
          {/* Player Name and Lives */}
          <div className="flex items-center justify-between mb-0.5 sm:mb-1">
            <div className="flex items-center gap-1 min-w-0">
              <span
                className="font-display font-extrabold text-cyan-400 tracking-wider truncate"
                style={{ fontSize: 'clamp(9px, 2.5vw, 13px)' }}
              >
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
                    width: 'clamp(5px, 1.2vw, 9px)',
                    height: 'clamp(5px, 1.2vw, 9px)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Health Bar Gauge - scaled via dynamic dvh units */}
          <div
            className="w-full bg-slate-900 rounded-xs overflow-hidden border border-slate-800 relative"
            style={{
              height: 'clamp(6px, 1.2dvh, 11px)',
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-100 ease-out"
              style={{ width: `${vexHpPct}%` }}
            />
          </div>

          {/* HP Numbers and Dash Indicator */}
          <div
            className="flex justify-between items-center mt-0.5 font-mono-data text-slate-300"
            style={{ fontSize: 'clamp(8px, 2vw, 10px)' }}
          >
            <span className="font-semibold text-cyan-300">
              {Math.ceil(vex.hp)}{' '}
              <span className="text-slate-400 font-normal" style={{ fontSize: 'clamp(7px, 1.6vw, 9px)' }}>
                / 100
              </span>
            </span>

            {/* Desktop Dash indicator */}
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[8px] text-slate-400">DASH</span>
              <div className="w-8 h-1 bg-slate-800 rounded-xs overflow-hidden">
                <div
                  className={`h-full transition-all ${dashReady ? 'bg-cyan-400' : 'bg-slate-500'}`}
                  style={{ width: `${dashPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Buffs */}
          <div
            className="flex items-center gap-0.5 sm:gap-1 mt-0.5 overflow-hidden"
            style={{ minHeight: 'clamp(8px, 1.5dvh, 14px)' }}
          >
            {vex.hasShield && (
              <span
                className="flex items-center gap-0.5 font-mono-data text-blue-300 bg-blue-950/80 px-1 py-0.2 rounded border border-blue-500/40 shrink-0"
                style={{ fontSize: 'clamp(7px, 1.6vw, 9px)' }}
              >
                <Shield className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
                <span className="hidden xs:inline">SHIELD</span>
              </span>
            )}
            {vex.hasPowerAttack && (
              <span
                className="flex items-center gap-0.5 font-mono-data text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/40 shrink-0"
                style={{ fontSize: 'clamp(7px, 1.6vw, 9px)' }}
              >
                <Flame className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
                <span className="hidden xs:inline">2× ATK</span>
              </span>
            )}
            {vex.speedBoostTimer > 0 && (
              <span
                className="flex items-center gap-0.5 font-mono-data text-emerald-300 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/40 shrink-0"
                style={{ fontSize: 'clamp(7px, 1.6vw, 9px)' }}
              >
                <Zap className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
                <span className="hidden xs:inline">SPEED</span>
              </span>
            )}
          </div>
        </div>

        {/* ================= CENTER: MATCH STATUS & QUICK CONTROLS ================= */}
        <div
          className="absolute pointer-events-auto flex flex-col items-center bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-md shrink-0 -translate-x-1/2 z-20"
          style={{
            top: 'max(env(safe-area-inset-top, 0px), 1dvh)',
            left: '50%',
            width: 'clamp(74px, 20vw, 136px)',
            padding: 'clamp(2px, 0.6vw, 4px) clamp(4px, 1vw, 8px)',
          }}
        >
          <div
            className="font-display text-slate-400 uppercase tracking-widest leading-none truncate max-w-full"
            style={{ fontSize: 'clamp(7px, 1.8vw, 10px)' }}
          >
            {engine.isMultiplayer
              ? `ROOM ${engine.multiplayerRoomCode}`
              : engine.gameMode === 'CAMPAIGN'
              ? `LVL ${engine.currentLevel}`
              : engine.gameMode === 'ENDLESS'
              ? `ENDLESS ${engine.currentLevel}`
              : `${engine.difficulty}`}
          </div>

          <div
            className="font-display font-black text-white tracking-wider glow-cyan leading-tight mt-0.5"
            style={{ fontSize: 'clamp(11px, 2.6vw, 15px)' }}
          >
            RND {engine.currentRound}
          </div>

          <div
            className="flex items-center gap-1 font-mono-data text-slate-300"
            style={{ fontSize: 'clamp(7px, 1.8vw, 10px)' }}
          >
            {engine.isMultiplayer ? (
              <span className="text-purple-400 font-semibold tracking-wider">ONLINE 1V1</span>
            ) : (
              <span className="text-cyan-400 font-semibold">{engine.score.toLocaleString()}</span>
            )}
          </div>

          {/* Quick Action Buttons Row */}
          <div className="flex items-center gap-1 mt-0.5">
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-0.5 sm:p-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-2.5 h-2.5 xs:w-3 xs:h-3" /> : <Volume2 className="w-2.5 h-2.5 xs:w-3 xs:h-3" />}
            </button>

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

            {/* Telemetry Debug Toggle */}
            <button
              type="button"
              onClick={() => setShowDebugOverlay((v) => !v)}
              className={`p-0.5 sm:p-1 rounded border transition-colors cursor-pointer ${
                showDebugOverlay
                  ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                  : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white'
              }`}
              title="Toggle Performance Telemetry (O)"
              aria-label="Debug Telemetry"
            >
              <Activity className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
            </button>

            {!engine.isMultiplayer && (
              <button
                type="button"
                onClick={handlePause}
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

        {/* ================= RIGHT: NOVA (AI OR PLAYER 2) HUD PANEL ================= */}
        <div
          className={`absolute pointer-events-auto bg-slate-950/85 backdrop-blur-md rounded-lg shadow-md select-none z-20 ${
            nova.isBoss ? 'border border-amber-500/60 shadow-amber-950/40' : 'border border-red-500/30 shadow-red-950/30'
          }`}
          style={{
            top: isMobile
              ? 'calc(max(env(safe-area-inset-top, 0px), 1dvh) + clamp(18px, 2.8dvh, 24px))'
              : 'max(env(safe-area-inset-top, 0px), 1dvh)',
            right: 'max(env(safe-area-inset-right, 0px), 1.5vw)',
            width: 'clamp(94px, 26vw, 210px)',
            maxWidth: 'calc(50vw - 42px)',
            padding: 'clamp(3px, 0.8vw, 8px)',
          }}
        >
          {/* Player Name and Lives */}
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
                    width: 'clamp(5px, 1.2vw, 9px)',
                    height: 'clamp(5px, 1.2vw, 9px)',
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-1 min-w-0 justify-end">
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
                className={`font-display font-extrabold tracking-wider truncate ${
                  nova.isBoss ? 'text-amber-400' : 'text-red-500'
                }`}
                style={{ fontSize: 'clamp(9px, 2.5vw, 13px)' }}
              >
                {p2DisplayName}
              </span>
            </div>
          </div>

          {/* Health Bar Gauge - scaled via dynamic dvh units */}
          <div
            className="w-full bg-slate-900 rounded-xs overflow-hidden border border-slate-800 relative"
            style={{
              height: 'clamp(6px, 1.2dvh, 11px)',
            }}
          >
            <div
              className="h-full bg-gradient-to-l from-red-600 to-rose-400 transition-all duration-100 ease-out ml-auto"
              style={{ width: `${novaHpPct}%` }}
            />
          </div>

          {/* HP Numbers */}
          <div
            className="flex justify-between items-center mt-0.5 font-mono-data text-slate-300"
            style={{ fontSize: 'clamp(8px, 2vw, 10px)' }}
          >
            <div className="flex items-center gap-1 truncate max-w-[45px] xs:max-w-[65px] sm:max-w-none">
              <span className="text-slate-400 truncate" style={{ fontSize: 'clamp(7px, 1.6vw, 9px)' }}>
                {engine.difficulty}
              </span>
            </div>
            <span className="font-semibold text-red-400">
              {Math.ceil(nova.hp)}{' '}
              <span className="text-slate-400 font-normal" style={{ fontSize: 'clamp(7px, 1.6vw, 9px)' }}>
                / 100
              </span>
            </span>
          </div>

          {/* AI Buffs */}
          <div
            className="flex items-center justify-end gap-0.5 sm:gap-1 mt-0.5 overflow-hidden"
            style={{ minHeight: 'clamp(8px, 1.5dvh, 14px)' }}
          >
            {nova.hasShield && (
              <span
                className="flex items-center gap-0.5 font-mono-data text-blue-300 bg-blue-950/80 px-1 py-0.2 rounded border border-blue-500/40 shrink-0"
                style={{ fontSize: 'clamp(7px, 1.6vw, 9px)' }}
              >
                <Shield className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
                <span className="hidden xs:inline">SHIELD</span>
              </span>
            )}
            {nova.hasPowerAttack && (
              <span
                className="flex items-center gap-0.5 font-mono-data text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/40 shrink-0"
                style={{ fontSize: 'clamp(7px, 1.6vw, 9px)' }}
              >
                <Flame className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
                <span className="hidden xs:inline">2× ATK</span>
              </span>
            )}
            {nova.speedBoostTimer > 0 && (
              <span
                className="flex items-center gap-0.5 font-mono-data text-emerald-300 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/40 shrink-0"
                style={{ fontSize: 'clamp(7px, 1.6vw, 9px)' }}
              >
                <Zap className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
                <span className="hidden xs:inline">SPEED</span>
              </span>
            )}
          </div>
        </div>

        {/* Battery Percentage Indicator in Top-Right HUD Area for Mobile Users */}
        <BatteryIndicator
          className="absolute pointer-events-auto"
          style={{
            top: 'max(env(safe-area-inset-top, 0px), 0.5dvh)',
            right: 'max(env(safe-area-inset-right, 0px), 1.5vw)',
            zIndex: 35,
          }}
        />
      </header>

      {/* Development Performance Telemetry Panel */}
      {showDebugOverlay && (
        <aside
          aria-label="Performance Telemetry"
          className="absolute z-50 bg-slate-950/95 border border-cyan-500/60 rounded-xl p-3 font-mono text-[10px] text-cyan-300 shadow-2xl backdrop-blur-md pointer-events-auto max-w-[270px] w-full"
          style={{
            top: 'calc(max(env(safe-area-inset-top, 0px), 1dvh) + clamp(55px, 11dvh, 75px))',
            left: 'max(env(safe-area-inset-left, 0px), 1.5vw)',
          }}
        >
          <div className="flex justify-between items-center pb-1.5 mb-2 border-b border-cyan-900/80 font-bold text-white tracking-wider">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              TELEMETRY
            </span>
            <button
              onClick={() => setShowDebugOverlay(false)}
              className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white text-[9px] cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
            <span>FPS:</span>
            <span className="text-right text-emerald-400 font-bold font-mono-data">
              {engine.metrics.fps} ({engine.metrics.frameTimeMs}ms)
            </span>
            <span>Sim dt:</span>
            <span className="text-right text-cyan-300 font-mono-data">{engine.metrics.simulationDt}ms</span>
            <span>Particles:</span>
            <span className="text-right font-mono-data">{engine.metrics.activeParticles} / 180</span>
            <span>Texts:</span>
            <span className="text-right font-mono-data">{engine.metrics.activeFloatingTexts}</span>
            <span>Screen Shake:</span>
            <span className="text-right font-mono-data">{engine.metrics.screenShake}</span>
            <span>VEX Pos:</span>
            <span className="text-right font-mono-data">{engine.metrics.vexPos.x}, {engine.metrics.vexPos.y}</span>
            <span>NOVA Pos:</span>
            <span className="text-right font-mono-data">{engine.metrics.novaPos.x}, {engine.metrics.novaPos.y}</span>
            <span>AI State:</span>
            <span className="text-right text-amber-300 truncate">{engine.metrics.aiState || 'IDLE'}</span>
            <span>AI Personality:</span>
            <span className="text-right text-purple-300 truncate">{engine.metrics.aiPersonality || 'BALANCED'}</span>
            <span>Network:</span>
            <span className="text-right font-semibold text-cyan-400">
              {engine.metrics.isMultiplayer ? `ONLINE (${engine.multiplayerRoomCode})` : 'LOCAL'}
            </span>
          </div>
          <div className="mt-2 pt-1 border-t border-slate-800/80 text-[8px] text-slate-400 text-center">
            Toggle with [O] key or HUD telemetry icon
          </div>
        </aside>
      )}

      {/* Portrait Suggestion Notice (Non-blocking, dismissible) */}
      {isPortrait && isTouchDevice && !dismissPortraitNotice && (
        <div
          className="absolute z-40 bg-slate-900/95 border border-cyan-500/50 text-cyan-300 py-1.5 px-3 rounded-lg shadow-xl flex items-center gap-2 backdrop-blur-md max-w-[90vw] text-center -translate-x-1/2 left-1/2"
          style={{
            top: 'calc(max(env(safe-area-inset-top, 0px), 1dvh) + clamp(54px, 12dvh, 72px))',
          }}
        >
          <RotateCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-[10px] text-slate-200 font-mono-data leading-tight">
            Rotate phone to landscape for widescreen
          </span>
          <button
            onClick={() => setDismissPortraitNotice(true)}
            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white text-[9px] font-mono-data cursor-pointer uppercase"
          >
            ✕
          </button>
        </div>
      )}

      {/* Responsive Aspect-Ratio Preserving Game Arena */}
      <div
        className={`relative w-full flex flex-col items-center justify-center [container-type:size] ${
          isPortrait ? 'mt-[clamp(24px,7dvh,42px)] mb-[clamp(90px,20dvh,130px)]' : ''
        }`}
      >
        {/* Arena Frame */}
        <div
          className="relative flex items-center justify-center shadow-2xl transition-all"
          style={{
            width: isPortrait
              ? 'min(100vw, calc((100dvh - clamp(180px, 30dvh, 220px)) * 1.6))'
              : 'min(100vw, calc(100dvh * 1.6))',
            maxWidth: isPortrait
              ? '100vw'
              : 'min(1280px, calc((100dvh - 8px) * 1.6))',
            maxHeight: isPortrait
              ? 'min(calc(100dvh - clamp(180px, 30dvh, 220px)), calc(100vw * 0.625))'
              : 'min(100dvh, calc(100vw * 0.625))',
            aspectRatio: '960 / 600',
          }}
        >
          <canvas
            ref={canvasRef}
            width={ARENA_WIDTH}
            height={ARENA_HEIGHT}
            className={`w-full h-full block bg-slate-950 ${
              isFullscreen ? 'rounded-none border-0' : 'rounded-lg sm:rounded-xl border border-slate-800/80'
            } shadow-2xl object-contain`}
          />

          {/* Countdown Overlay */}
          {gameState === 'COUNTDOWN' && (
            <CountdownOverlay round={engine.currentRound} count={countdownStep} />
          )}

          {/* Round End Overlay */}
          {gameState === 'ROUND_END' && (
            <RoundEndOverlay winner={roundWinner} round={engine.currentRound} />
          )}

          {/* Pause Modal (Single player only) */}
          {!engine.isMultiplayer && gameState === 'PAUSED' && (
            <PauseModal
              onResume={handleResume}
              onRestart={handleRestart}
              onMainMenu={onMainMenu}
            />
          )}

          {/* Single Player Victory Modal */}
          {!engine.isMultiplayer && gameState === 'VICTORY' && (
            <VictoryModal
              engine={engine}
              onNextLevel={handleNextLevel}
              onPlayAgain={handleRestart}
              onMainMenu={onMainMenu}
            />
          )}

          {/* Single Player Defeat Modal */}
          {!engine.isMultiplayer && gameState === 'DEFEAT' && (
            <DefeatModal
              engine={engine}
              onRetry={handleRestart}
              onMainMenu={onMainMenu}
            />
          )}

          {/* Multiplayer Match End or Opponent Disconnected Modal */}
          {engine.isMultiplayer && (gameState === 'VICTORY' || gameState === 'DEFEAT' || opponentDisconnected) && (
            <MultiplayerModal
              engine={engine}
              isVictory={gameState === 'VICTORY'}
              onRematch={onMultiplayerRematch || handleRestart}
              onLeave={onMainMenu}
              opponentDisconnected={opponentDisconnected}
              disconnectMessage={disconnectMessage}
              rematchRequested={rematchRequested}
              opponentRematchReady={opponentRematchReady}
            />
          )}
        </div>
      </div>

      {/* Mobile Virtual Controls - pinned to bottom */}
      {showTouchControls && (gameState === 'BATTLE' || gameState === 'COUNTDOWN') && (
        <div className="absolute inset-0 pointer-events-none select-none z-30 flex items-end justify-between">
          <VirtualControls engine={engine} />
        </div>
      )}
    </div>
  );
};
