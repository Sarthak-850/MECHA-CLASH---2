import React, { useState } from 'react';
import { GameEngine } from '../game/engine';
import { Trophy, Skull, RotateCcw, Home, WifiOff, Loader2, Check } from 'lucide-react';

interface MultiplayerModalProps {
  engine: GameEngine;
  isVictory: boolean;
  onRematch: () => void;
  onLeave: () => void;
  opponentDisconnected?: boolean;
  disconnectMessage?: string;
  rematchRequested?: boolean;
  opponentRematchReady?: boolean;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  engine,
  isVictory,
  onRematch,
  onLeave,
  opponentDisconnected = false,
  disconnectMessage,
  rematchRequested = false,
  opponentRematchReady = false,
}) => {
  const [requestedLocal, setRequestedLocal] = useState(false);

  const handleRematchClick = () => {
    setRequestedLocal(true);
    onRematch();
  };

  const isHost = engine.localRole === 'PLAYER_1';
  const myRoundsWon = isHost ? engine.vexRoundsWon : engine.novaRoundsWon;
  const oppRoundsWon = isHost ? engine.novaRoundsWon : engine.vexRoundsWon;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 select-none animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900/95 border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col items-center max-h-[92vh] overflow-y-auto">
        {/* Opponent Disconnect Case */}
        {opponentDisconnected ? (
          <>
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-md shadow-rose-500/20">
              <WifiOff className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <h2 className="font-display font-black text-2xl sm:text-4xl text-rose-400 tracking-wider uppercase mb-1 drop-shadow-[0_0_20px_rgba(244,63,94,0.4)] text-center">
              OPPONENT DISCONNECTED
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 font-mono-data tracking-wide text-center mb-6">
              {disconnectMessage || 'The other pilot left the arena or lost connection.'}
            </p>

            <button
              onClick={onLeave}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/25 active:scale-98 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>RETURN TO MAIN MENU</span>
            </button>
          </>
        ) : (
          <>
            {/* Victory or Defeat Icon */}
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-2 sm:mb-3 shadow-md ${
                isVictory
                  ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-cyan-500/20'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-rose-500/20'
              }`}
            >
              {isVictory ? (
                <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
              ) : (
                <Skull className="w-6 h-6 sm:w-7 sm:h-7" />
              )}
            </div>

            <h2
              className={`font-display font-black text-3xl sm:text-5xl tracking-wider uppercase mb-0.5 sm:mb-1 text-center drop-shadow-md ${
                isVictory ? 'text-cyan-400 glow-cyan' : 'text-rose-400'
              }`}
            >
              {isVictory ? 'VICTORY!' : 'DEFEATED'}
            </h2>

            <span className="text-xs text-slate-400 font-mono-data tracking-wide uppercase mb-4 text-center">
              ONLINE MULTIPLAYER DUEL RESULT
            </span>

            {/* Scoreboard Card */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-around mb-6">
              {/* Local Player */}
              <div className="flex flex-col items-center">
                <span className="font-display font-extrabold text-cyan-400 text-sm sm:text-base">
                  {engine.localPlayerName} (YOU)
                </span>
                <span className="text-[10px] font-mono-data text-slate-400">
                  {isHost ? 'VEX CHASSIS' : 'NOVA CHASSIS'}
                </span>
                <span className="font-display font-black text-3xl sm:text-4xl text-white mt-1">
                  {myRoundsWon}
                </span>
              </div>

              <div className="font-display font-black text-lg text-slate-600">VS</div>

              {/* Remote Player */}
              <div className="flex flex-col items-center">
                <span className="font-display font-extrabold text-red-400 text-sm sm:text-base">
                  {engine.remotePlayerName}
                </span>
                <span className="text-[10px] font-mono-data text-slate-400">
                  {isHost ? 'NOVA CHASSIS' : 'VEX CHASSIS'}
                </span>
                <span className="font-display font-black text-3xl sm:text-4xl text-white mt-1">
                  {oppRoundsWon}
                </span>
              </div>
            </div>

            {/* Rematch Status indicator */}
            {(requestedLocal || rematchRequested) && (
              <div className="w-full mb-4 p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono-data text-center flex items-center justify-center gap-2">
                {opponentRematchReady ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>BOTH PLAYERS READY! STARTING REMATCH...</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span>WAITING FOR OPPONENT TO ACCEPT REMATCH...</span>
                  </>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={handleRematchClick}
                disabled={requestedLocal || rematchRequested}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-display font-bold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/25 active:scale-98 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{requestedLocal || rematchRequested ? 'REMATCH REQUESTED' : 'REQUEST REMATCH'}</span>
              </button>

              <button
                onClick={onLeave}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-display text-xs tracking-wider uppercase transition-all active:scale-98 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>LEAVE TO MAIN MENU</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
