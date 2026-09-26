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
import { HUD } from './HUD';

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
          PREMIUM SCI-FI BATTLE HUD (VEX vs NOVA VISOR & TRANSLUCENT MATCH PANEL)
          ========================================================================= */}
      <HUD
        engine={engine}
        onPause={handlePause}
        onResume={handleResume}
        onToggleMute={handleToggleMute}
        isMuted={isMuted}
        onToggleFullscreen={onToggleFullscreen}
        isFullscreen={isFullscreen}
        onToggleDebug={() => setShowDebugOverlay((v) => !v)}
        showDebugOverlay={showDebugOverlay}
      />

      {/* Battery Percentage Indicator in Top-Right for Mobile Users */}
      <BatteryIndicator
        className="absolute pointer-events-auto"
        style={{
          top: 'calc(max(env(safe-area-inset-top, 0px), 6px) + clamp(56px, 12dvh, 72px))',
          right: 'max(env(safe-area-inset-right, 0px), 8px)',
          zIndex: 35,
        }}
      />

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
