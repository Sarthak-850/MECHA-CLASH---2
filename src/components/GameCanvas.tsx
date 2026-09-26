import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine';
import { GameRenderer } from '../game/renderer';
import { ARENA_HEIGHT, ARENA_WIDTH, CAMPAIGN_LEVELS } from '../game/constants';
import { ArenaColorTheme } from '../types/game';
import { HUD } from './HUD';
import { CountdownOverlay } from './CountdownOverlay';
import { RoundEndOverlay } from './RoundEndOverlay';
import { PauseModal } from './PauseModal';
import { VictoryModal } from './VictoryModal';
import { DefeatModal } from './DefeatModal';
import { MultiplayerModal } from './MultiplayerModal';
import { VirtualControls } from './VirtualControls';
import { soundManager } from '../audio/soundManager';
import { RotateCw } from 'lucide-react';
import { isFullscreenActive } from '../utils/fullscreen';
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

  // Reactive state synced with engine
  const [gameState, setGameState] = useState(engine.gameState);
  const [countdownStep, setCountdownStep] = useState(engine.countdownStep);
  const [roundWinner, setRoundWinner] = useState(engine.roundWinner);
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  // Fullscreen tracking
  const [localFullscreen, setLocalFullscreen] = useState(isFullscreenActive());
  const isFullscreen = parentIsFullscreen ?? localFullscreen;

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
    };

    return () => {
      engine.onStateChange = undefined;
    };
  }, [engine]);

  // Keyboard Event Handlers (Preserved 100% for desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default page scroll for game keys
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

      // Pause toggle
      if (e.code === 'KeyP') {
        if (engine.gameState === 'BATTLE') {
          engine.pause();
        } else if (engine.gameState === 'PAUSED') {
          engine.resume();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engine.keys[e.code] = false;
    };

    const handleBlur = () => {
      // Clear stuck keys if user tabs out or switches apps
      engine.keys = {};
      engine.setJoystickVector(0, 0);
      if (engine.gameState === 'BATTLE') {
        engine.pause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
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
      const dt = Math.min(0.05, (currentTime - lastTimeRef.current) / 1000);
      lastTimeRef.current = currentTime;

      // Update engine physics & logic
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

      // Sync state for countdown or round status changes
      if (engine.gameState === 'COUNTDOWN' && countdownStep !== engine.countdownStep) {
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
  }, [engine, countdownStep]);

  // Action handlers
  const handlePause = useCallback(() => {
    engine.pause();
  }, [engine]);

  const handleResume = useCallback(() => {
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
      {/* HUD Container & Overlay - pinned to top */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none select-none z-20 w-full">
        <HUD
          engine={engine}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={isFullscreen}
        />

        {/* Battery Percentage Indicator in Top-Right HUD Area for Mobile Users */}
        <BatteryIndicator
          className="absolute"
          style={{
            top: 'max(env(safe-area-inset-top, 0px), 4px)',
            right: 'max(env(safe-area-inset-right, 0px), 6px)',
          }}
        />
      </div>

      {/* Portrait Suggestion Notice (Non-blocking, dismissible) */}
      {isPortrait && isTouchDevice && !dismissPortraitNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-cyan-500/50 text-cyan-300 py-1.5 px-3 rounded-lg shadow-xl flex items-center gap-2 backdrop-blur-md max-w-[90vw] text-center">
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
        className={`relative w-full flex flex-col items-center justify-center ${
          isPortrait ? 'mt-8 sm:mt-10 mb-28 xs:mb-32' : ''
        }`}
      >
        {/* Arena Frame */}
        <div
          className="relative flex items-center justify-center shadow-2xl transition-all"
          style={{
            width: isPortrait
              ? 'min(100vw, calc((100dvh - 200px) * 1.6))'
              : 'min(100vw, calc(100dvh * 1.6))',
            maxWidth: isPortrait
              ? '100vw'
              : 'min(1280px, calc((100dvh - 8px) * 1.6))',
            maxHeight: isPortrait
              ? 'min(calc(100dvh - 200px), calc(100vw * 0.625))'
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
