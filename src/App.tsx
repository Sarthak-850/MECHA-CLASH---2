/**
 * Mecha Clash - Main Application Controller
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { DifficultyLevel } from './types/game';
import { soundManager } from './audio/soundManager';
import { MainMenu } from './components/MainMenu';
import { DifficultySelect } from './components/DifficultySelect';
import { CampaignSelect } from './components/CampaignSelect';
import { HowToPlay } from './components/HowToPlay';
import { GameCanvas } from './components/GameCanvas';
import {
  isFullscreenActive,
  requestAppFullscreen,
  toggleAppFullscreen,
  isMobileClient,
} from './utils/fullscreen';

type AppScreen =
  | 'MENU'
  | 'DIFFICULTY_SELECT'
  | 'CAMPAIGN_SELECT'
  | 'HOW_TO_PLAY'
  | 'PLAYING';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('MENU');
  const [bestScore, setBestScore] = useState<number>(0);
  const [bestEndlessLevel, setBestEndlessLevel] = useState<number>(1);
  const [unlockedCampaignLevel, setUnlockedCampaignLevel] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(isFullscreenActive());

  const rootRef = useRef<HTMLElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Initialize engine once
  if (!engineRef.current) {
    engineRef.current = new GameEngine();
  }
  const engine = engineRef.current;

  // Track Fullscreen state changes from browser / user actions
  useEffect(() => {
    const handleFullscreenSync = () => {
      setIsFullscreen(isFullscreenActive());
    };

    document.addEventListener('fullscreenchange', handleFullscreenSync);
    document.addEventListener('webkitfullscreenchange', handleFullscreenSync);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenSync);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenSync);
    };
  }, []);

  // Load saved progression from localStorage
  const refreshStorageData = useCallback(() => {
    try {
      const savedScore = parseInt(
        localStorage.getItem('mecha_clash_best_score') || '0',
        10
      );
      const savedEndless = parseInt(
        localStorage.getItem('mecha_clash_best_endless_level') || '1',
        10
      );
      const savedCampaign = parseInt(
        localStorage.getItem('mecha_clash_campaign_unlocked') || '1',
        10
      );
      setBestScore(savedScore);
      setBestEndlessLevel(savedEndless);
      setUnlockedCampaignLevel(savedCampaign);
    } catch {
      // LocalStorage access fallback
    }
  }, []);

  useEffect(() => {
    refreshStorageData();
  }, [refreshStorageData]);

  // Helper: Request mobile fullscreen automatically inside existing user gesture without blocking
  const ensureMobileFullscreen = useCallback(() => {
    if (isMobileClient() && !isFullscreenActive()) {
      requestAppFullscreen(rootRef.current).catch(() => {
        // Silently continue if rejected or unsupported
      });
    }
  }, []);

  // Screen Transitions & Game Starters (Automatically requests fullscreen on mobile from existing Play taps)
  const handleStartQuickDuel = useCallback(() => {
    ensureMobileFullscreen();
    setCurrentScreen('DIFFICULTY_SELECT');
  }, [ensureMobileFullscreen]);

  const handleSelectDifficulty = useCallback(
    (diff: DifficultyLevel) => {
      ensureMobileFullscreen();
      engine.startMatch('QUICK_DUEL', diff, 1);
      setCurrentScreen('PLAYING');
    },
    [engine, ensureMobileFullscreen]
  );

  const handleStartCampaign = useCallback(() => {
    ensureMobileFullscreen();
    refreshStorageData();
    setCurrentScreen('CAMPAIGN_SELECT');
  }, [ensureMobileFullscreen, refreshStorageData]);

  const handleSelectCampaignLevel = useCallback(
    (level: number) => {
      ensureMobileFullscreen();
      engine.startMatch('CAMPAIGN', 'NORMAL', level);
      setCurrentScreen('PLAYING');
    },
    [engine, ensureMobileFullscreen]
  );

  const handleStartEndless = useCallback(() => {
    ensureMobileFullscreen();
    engine.startMatch('ENDLESS', 'NORMAL', 1);
    setCurrentScreen('PLAYING');
  }, [engine, ensureMobileFullscreen]);

  const handleHowToPlay = useCallback(() => {
    setCurrentScreen('HOW_TO_PLAY');
  }, []);

  const handleBackToMenu = useCallback(() => {
    engine.gameState = 'MENU';
    refreshStorageData();
    setCurrentScreen('MENU');
  }, [engine, refreshStorageData]);

  const handleToggleMute = useCallback(() => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    await toggleAppFullscreen(rootRef.current);
    setIsFullscreen(isFullscreenActive());
  }, []);

  return (
    <main
      ref={rootRef}
      className="w-screen h-screen h-[100dvh] bg-slate-950 flex flex-col items-center justify-center overflow-hidden select-none touch-none"
      style={{ touchAction: 'none' }}
    >
      {currentScreen === 'MENU' && (
        <MainMenu
          onQuickDuel={handleStartQuickDuel}
          onCampaign={handleStartCampaign}
          onEndless={handleStartEndless}
          onHowToPlay={handleHowToPlay}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          bestScore={bestScore}
          bestEndlessLevel={bestEndlessLevel}
          unlockedCampaignLevel={unlockedCampaignLevel}
        />
      )}

      {currentScreen === 'DIFFICULTY_SELECT' && (
        <DifficultySelect
          onSelect={handleSelectDifficulty}
          onBack={handleBackToMenu}
        />
      )}

      {currentScreen === 'CAMPAIGN_SELECT' && (
        <CampaignSelect
          unlockedLevel={unlockedCampaignLevel}
          onSelectLevel={handleSelectCampaignLevel}
          onBack={handleBackToMenu}
        />
      )}

      {currentScreen === 'HOW_TO_PLAY' && (
        <HowToPlay onBack={handleBackToMenu} />
      )}

      {currentScreen === 'PLAYING' && (
        <GameCanvas
          engine={engine}
          onMainMenu={handleBackToMenu}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
        />
      )}
    </main>
  );
}
