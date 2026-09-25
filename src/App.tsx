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
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { multiplayerClient } from './network/multiplayerClient';
import {
  isFullscreenActive,
  requestAppFullscreen,
  toggleAppFullscreen,
  isMobileClient,
} from './utils/fullscreen';

type AppScreen =
  | 'MENU'
  | 'MULTIPLAYER_LOBBY'
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

  // Multiplayer Match Over & Presence State
  const [opponentDisconnected, setOpponentDisconnected] = useState<boolean>(false);
  const [disconnectMessage, setDisconnectMessage] = useState<string>('');
  const [rematchRequested, setRematchRequested] = useState<boolean>(false);
  const [opponentRematchReady, setOpponentRematchReady] = useState<boolean>(false);

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

  // Connect engine outgoing multiplayer callbacks to multiplayerClient
  useEffect(() => {
    engine.onSendPlayerState = (state) => multiplayerClient.sendPlayerState(state);
    engine.onSendPlayerAttack = (attack) => multiplayerClient.sendPlayerAttack(attack);
    engine.onSendPlayerDash = (dx, dy) => multiplayerClient.sendPlayerDash(dx, dy);
    engine.onSendPlayerUltimate = (x, y) => multiplayerClient.sendPlayerUltimate(x, y);
    engine.onSendDamage = (role, dmg, crit, src, hp) =>
      multiplayerClient.sendDamage(role, dmg, crit, src, hp);
    engine.onSendCollectPowerUp = (id, role) => multiplayerClient.sendCollectPowerUp(id, role);
  }, [engine]);

  // Wire incoming network events to engine when in PLAYING screen
  useEffect(() => {
    if (currentScreen !== 'PLAYING') return;

    multiplayerClient.setCallbacks({
      onRemotePlayerState: (role, state) => {
        engine.applyRemotePlayerState(role, state);
      },
      onRemoteAttack: (attack) => {
        engine.applyRemoteAttack(attack);
      },
      onRemoteDash: (role, dx, dy) => {
        engine.applyRemoteDash(role, dx, dy);
      },
      onRemoteUltimate: (role, x, y) => {
        engine.applyRemoteUltimate(role, x, y);
      },
      onDamageApplied: (targetRole, damage, isCritical, source, newHp) => {
        engine.applyRemoteDamage(targetRole, damage, isCritical, source, newHp);
      },
      onPowerUpSpawn: (powerUp) => {
        engine.applyRemotePowerUpSpawn(powerUp);
      },
      onPowerUpCollected: (powerUpId, collectorRole) => {
        engine.applyRemotePowerUpCollected(powerUpId, collectorRole);
      },
      onRoundFinished: (round, winner, p1Wins, p2Wins, matchOver) => {
        engine.applyRemoteRoundFinished(round, winner, p1Wins, p2Wins, matchOver);
      },
      onMatchFinished: (winner, p1Wins, p2Wins) => {
        engine.applyRemoteMatchFinished(winner, p1Wins, p2Wins);
      },
      onCountdown: (step) => {
        engine.countdownStep = step;
        if (step === 0) {
          engine.gameState = 'BATTLE';
        } else {
          engine.gameState = 'COUNTDOWN';
        }
        if (engine.onStateChange) engine.onStateChange(engine.gameState);
      },
      onStartMatch: () => {
        setRematchRequested(false);
        setOpponentRematchReady(false);
        setOpponentDisconnected(false);
        engine.resetRoundEntities();
        engine.gameState = 'BATTLE';
        if (engine.onStateChange) engine.onStateChange(engine.gameState);
      },
      onRoomState: (room) => {
        if (engine.isMultiplayer) {
          const isHost = engine.localRole === 'PLAYER_1';
          const oppReady = isHost
            ? room.players.PLAYER_2?.rematchReady || false
            : room.players.PLAYER_1?.rematchReady || false;
          setOpponentRematchReady(oppReady);
        }
      },
      onOpponentDisconnected: (msg) => {
        if (engine.isMultiplayer) {
          setOpponentDisconnected(true);
          setDisconnectMessage(msg);
        }
      },
    });
  }, [currentScreen, engine]);

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

  // Screen Transitions & Game Starters
  const handleStartQuickDuel = useCallback(() => {
    ensureMobileFullscreen();
    setCurrentScreen('DIFFICULTY_SELECT');
  }, [ensureMobileFullscreen]);

  const handleStartMultiplayer = useCallback(() => {
    ensureMobileFullscreen();
    setCurrentScreen('MULTIPLAYER_LOBBY');
  }, [ensureMobileFullscreen]);

  const handleMultiplayerMatchStarting = useCallback(
    (
      role: 'PLAYER_1' | 'PLAYER_2',
      localName: string,
      remoteName: string,
      roomCode: string
    ) => {
      ensureMobileFullscreen();
      setOpponentDisconnected(false);
      setRematchRequested(false);
      setOpponentRematchReady(false);
      engine.startMultiplayerMatch(role, localName, remoteName, roomCode);
      setCurrentScreen('PLAYING');
    },
    [engine, ensureMobileFullscreen]
  );

  const handleMultiplayerRematch = useCallback(() => {
    setRematchRequested(true);
    multiplayerClient.requestRematch();
  }, []);

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
    if (engine.isMultiplayer) {
      multiplayerClient.leaveRoom();
      engine.isMultiplayer = false;
    }
    setOpponentDisconnected(false);
    setRematchRequested(false);
    setOpponentRematchReady(false);
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
          onMultiplayer={handleStartMultiplayer}
          onHowToPlay={handleHowToPlay}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          bestScore={bestScore}
          bestEndlessLevel={bestEndlessLevel}
          unlockedCampaignLevel={unlockedCampaignLevel}
        />
      )}

      {currentScreen === 'MULTIPLAYER_LOBBY' && (
        <MultiplayerLobby
          onBack={handleBackToMenu}
          onMatchStarting={handleMultiplayerMatchStarting}
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
          onMultiplayerRematch={handleMultiplayerRematch}
          opponentDisconnected={opponentDisconnected}
          disconnectMessage={disconnectMessage}
          rematchRequested={rematchRequested}
          opponentRematchReady={opponentRematchReady}
        />
      )}
    </main>
  );
}
