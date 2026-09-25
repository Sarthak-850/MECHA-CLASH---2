import React, { useState, useEffect, useCallback } from 'react';
import { multiplayerClient } from '../network/multiplayerClient';
import { RoomStateSync } from '../types/multiplayer';
import {
  Users,
  Copy,
  Check,
  ArrowLeft,
  Swords,
  Shield,
  Loader2,
  AlertCircle,
  Wifi,
  Sparkles,
} from 'lucide-react';

interface MultiplayerLobbyProps {
  onBack: () => void;
  onMatchStarting: (
    role: 'PLAYER_1' | 'PLAYER_2',
    localName: string,
    remoteName: string,
    roomCode: string
  ) => void;
}

type LobbyView = 'MENU' | 'CREATE' | 'JOIN';

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onBack,
  onMatchStarting,
}) => {
  const [view, setView] = useState<LobbyView>('MENU');
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('mecha_clash_pilot_name') || 'Pilot';
    } catch {
      return 'Pilot';
    }
  });
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [createdRoomCode, setCreatedRoomCode] = useState<string>('');
  const [roomState, setRoomState] = useState<RoomStateSync | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [countdownMsg, setCountdownMsg] = useState<string | null>(null);

  // Save player name
  const handleNameChange = (val: string) => {
    const trimmed = val.substring(0, 16);
    setPlayerName(trimmed);
    try {
      localStorage.setItem('mecha_clash_pilot_name', trimmed);
    } catch {
      // ignore
    }
  };

  // Wire multiplayerClient callbacks
  useEffect(() => {
    multiplayerClient.setCallbacks({
      onRoomCreated: (code, _role) => {
        setCreatedRoomCode(code);
        setIsSubmitting(false);
        setErrorMsg(null);
      },
      onRoomJoined: (_code, _role) => {
        setIsSubmitting(false);
        setErrorMsg(null);
      },
      onRoomState: (room) => {
        setRoomState(room);
        if (room.status === 'STARTING') {
          setCountdownMsg('OPPONENT CONNECTED! LAUNCHING DUEL...');
        }
      },
      onCountdown: (step) => {
        if (step > 0) {
          setCountdownMsg(`BATTLE STARTS IN ${step}...`);
        } else {
          setCountdownMsg('FIGHT!');
        }
      },
      onStartMatch: (_round, _powerUps) => {
        const role = multiplayerClient.getRole();
        const code = multiplayerClient.getRoomCode();
        if (!role || !code) return;

        const p1Name = roomState?.players.PLAYER_1?.name || 'Player 1';
        const p2Name = roomState?.players.PLAYER_2?.name || 'Player 2';
        const localName = role === 'PLAYER_1' ? p1Name : p2Name;
        const remoteName = role === 'PLAYER_1' ? p2Name : p1Name;

        onMatchStarting(role, localName, remoteName, code);
      },
      onError: (msg) => {
        setErrorMsg(msg);
        setIsSubmitting(false);
      },
      onOpponentDisconnected: (msg) => {
        setErrorMsg(msg);
        setCountdownMsg(null);
      },
    });

    return () => {
      // Don't fully disconnect if starting match, but clear lobby callbacks
      multiplayerClient.setCallbacks({});
    };
  }, [onMatchStarting, roomState]);

  const handleCreateRoom = useCallback(async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    setView('CREATE');
    const validName = playerName.trim() || 'Pilot 1';
    await multiplayerClient.createRoom(validName);
  }, [playerName]);

  const handleJoinRoom = useCallback(async () => {
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('Please enter a room code.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    const validName = playerName.trim() || 'Pilot 2';
    await multiplayerClient.joinRoom(cleanCode, validName);
  }, [joinCodeInput, playerName]);

  const handleCancelRoom = useCallback(() => {
    multiplayerClient.leaveRoom();
    setCreatedRoomCode('');
    setRoomState(null);
    setErrorMsg(null);
    setCountdownMsg(null);
    setView('MENU');
  }, []);

  const handleCopyCode = useCallback(() => {
    if (!createdRoomCode) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(createdRoomCode);
      } else {
        const ta = document.createElement('textarea');
        ta.value = createdRoomCode;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback
    }
  }, [createdRoomCode]);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between p-4 sm:p-8 bg-slate-950 overflow-y-auto select-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 16px)',
      }}
    >
      {/* Dynamic Cyber Grid Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-slate-950/90 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 scanlines opacity-50 pointer-events-none" />

      {/* Top Header */}
      <div className="w-full max-w-2xl flex items-center justify-between z-10">
        <button
          onClick={view === 'MENU' ? onBack : handleCancelRoom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-xs font-mono-data text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{view === 'MENU' ? 'BACK TO MAIN' : 'BACK'}</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-[11px] font-mono-data">
          <Wifi className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>REAL-TIME MULTIPLAYER</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md flex flex-col items-center text-center z-10 my-auto py-4">
        {/* Title */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 text-xs font-mono-data tracking-wider uppercase mb-3">
          <Users className="w-3.5 h-3.5" /> 1V1 REAL-TIME ONLINE DUEL
        </div>

        <h1 className="font-display font-black text-3xl sm:text-5xl tracking-wider text-white uppercase drop-shadow-[0_0_25px_rgba(6,182,212,0.4)] mb-2">
          MULTIPLAYER <span className="text-cyan-400">ARENA</span>
        </h1>

        <p className="text-xs sm:text-sm font-mono-data text-slate-400 max-w-xs mb-6">
          Duel against a friend on any phone, tablet, or laptop over the internet in real time.
        </p>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="w-full mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-mono-data flex items-center gap-2.5 text-left animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* VIEW 1: LOBBY OPTIONS MENU */}
        {view === 'MENU' && (
          <div className="w-full flex flex-col gap-4">
            {/* Player Pilot Name Input */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-left">
              <label className="block text-[11px] font-mono-data text-slate-400 uppercase tracking-wider mb-1.5">
                YOUR PILOT CALLSIGN
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={16}
                placeholder="Enter pilot name..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white font-mono-data text-sm outline-none transition-colors"
              />
            </div>

            {/* Create Room Button */}
            <button
              onClick={handleCreateRoom}
              className="w-full group flex items-center justify-between py-3.5 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/40 hover:-translate-y-0.5 active:scale-98 cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Swords className="w-4 h-4" /> CREATE ROOM
              </span>
              <span className="text-[10px] font-mono-data opacity-75">HOST MATCH</span>
            </button>

            {/* Join Room Button */}
            <button
              onClick={() => {
                setErrorMsg(null);
                setView('JOIN');
              }}
              className="w-full group flex items-center justify-between py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-white font-display font-semibold text-sm tracking-wider uppercase transition-all hover:-translate-y-0.5 active:scale-98 cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-cyan-400" /> JOIN ROOM
              </span>
              <span className="text-[10px] font-mono-data text-cyan-400">ENTER CODE</span>
            </button>

            <button
              onClick={onBack}
              className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-display text-xs tracking-wider uppercase transition-all active:scale-98 cursor-pointer"
            >
              BACK TO MAIN MENU
            </button>
          </div>
        )}

        {/* VIEW 2: CREATE ROOM (HOST WAITING FOR OPPONENT) */}
        {view === 'CREATE' && (
          <div className="w-full flex flex-col items-center gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            {isSubmitting || !createdRoomCode ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <span className="text-xs font-mono-data text-slate-300">
                  ESTABLISHING SECURE ARENA CHANNEL...
                </span>
              </div>
            ) : (
              <>
                <div className="text-xs font-mono-data text-slate-400 uppercase tracking-wider">
                  ROOM CREATED — SHARE CODE WITH FRIEND
                </div>

                {/* Big Code Display */}
                <div className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-slate-950 border border-cyan-500/40 shadow-inner">
                  <span className="font-mono-data font-black text-3xl sm:text-4xl text-cyan-400 tracking-widest selection:bg-cyan-500">
                    {createdRoomCode}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-950 border border-cyan-500/50 hover:bg-cyan-900 text-cyan-300 text-xs font-mono-data transition-all cursor-pointer active:scale-95"
                    title="Copy Room Code"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300 font-bold">COPIED!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Match Status Countdown or Waiting */}
                {countdownMsg ? (
                  <div className="w-full py-2.5 px-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-display font-bold text-xs sm:text-sm tracking-wider uppercase animate-pulse">
                    <Sparkles className="w-4 h-4 inline-block mr-1.5" />
                    {countdownMsg}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-mono-data text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Waiting for opponent to connect...</span>
                  </div>
                )}

                {/* Players Box */}
                <div className="w-full flex flex-col gap-2 pt-2 border-t border-slate-800 text-left text-xs font-mono-data">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-cyan-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                      <span className="text-white font-semibold">
                        {playerName || 'Pilot 1'} <span className="text-cyan-400">(YOU)</span>
                      </span>
                    </div>
                    <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-display">
                      P1 • VEX CHASSIS
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          roomState?.players.PLAYER_2 ? 'bg-red-400' : 'bg-slate-700 animate-pulse'
                        }`}
                      />
                      <span
                        className={
                          roomState?.players.PLAYER_2
                            ? 'text-white font-semibold'
                            : 'text-slate-500 italic'
                        }
                      >
                        {roomState?.players.PLAYER_2?.name || 'WAITING FOR PLAYER...'}
                      </span>
                    </div>
                    <span className="text-[10px] text-red-400 uppercase tracking-wider font-display">
                      P2 • NOVA CHASSIS
                    </span>
                  </div>
                </div>

                {/* Cancel Button */}
                <button
                  onClick={handleCancelRoom}
                  className="w-full mt-2 py-2 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white font-display text-xs tracking-wider uppercase transition-all cursor-pointer"
                >
                  CANCEL ROOM
                </button>
              </>
            )}
          </div>
        )}

        {/* VIEW 3: JOIN ROOM */}
        {view === 'JOIN' && (
          <div className="w-full flex flex-col gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl text-left">
            <div>
              <label className="block text-[11px] font-mono-data text-slate-400 uppercase tracking-wider mb-1.5">
                YOUR PILOT CALLSIGN
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={16}
                placeholder="Enter pilot name..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white font-mono-data text-sm outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono-data text-slate-400 uppercase tracking-wider mb-1.5">
                ENTER 5-CHARACTER ROOM CODE
              </label>
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinRoom();
                }}
                maxLength={8}
                placeholder="e.g. 7K4P2"
                autoFocus
                className="w-full px-3 py-3 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-400 text-cyan-400 font-mono-data text-lg tracking-widest text-center uppercase outline-none transition-colors"
              />
            </div>

            {countdownMsg && (
              <div className="w-full py-2.5 px-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-display font-bold text-xs tracking-wider uppercase text-center animate-pulse">
                {countdownMsg}
              </div>
            )}

            <button
              onClick={handleJoinRoom}
              disabled={isSubmitting || !joinCodeInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-display font-bold text-sm tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/25 active:scale-98 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>CONNECTING...</span>
                </>
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  <span>JOIN ROOM</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setErrorMsg(null);
                setView('MENU');
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white font-display text-xs tracking-wider uppercase transition-all text-center cursor-pointer"
            >
              BACK
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-2xl flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] font-mono-data text-slate-400 z-10 gap-1 mt-2 text-center">
        <span>CROSS-DEVICE MULTIPLAYER • WI-FI & MOBILE DATA</span>
        <span>PEER SYNC OVER SECURE WEBSOCKETS</span>
      </div>
    </div>
  );
};
