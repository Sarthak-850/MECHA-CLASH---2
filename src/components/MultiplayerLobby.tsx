import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  RotateCcw,
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

  const timeoutTimerRef = useRef<any>(null);
  const roomStateRef = useRef<RoomStateSync | null>(null);
  roomStateRef.current = roomState;

  // Clear timeout timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, []);

  // Save player name to local storage
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
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
        setCreatedRoomCode(code);
        setIsSubmitting(false);
        setErrorMsg(null);
      },
      onRoomJoined: (_code, _role) => {
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
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

        const current = roomStateRef.current;
        const p1Name = current?.players.PLAYER_1?.name || 'Player 1';
        const p2Name = current?.players.PLAYER_2?.name || 'Player 2';
        const localName = role === 'PLAYER_1' ? p1Name : p2Name;
        const remoteName = role === 'PLAYER_1' ? p2Name : p1Name;

        onMatchStarting(role, localName, remoteName, code);
      },
      onError: (msg) => {
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
        setErrorMsg(msg);
        setIsSubmitting(false);
      },
      onOpponentDisconnected: (msg) => {
        setErrorMsg(msg);
        setCountdownMsg(null);
      },
    });

    return () => {
      // Don't wipe callbacks if moving to match
    };
  }, [onMatchStarting]);

  const handleCreateRoom = useCallback(async () => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    setErrorMsg(null);
    setCreatedRoomCode('');
    setIsSubmitting(true);
    setView('CREATE');

    // 7-second safety timeout so it NEVER stays stuck on loading
    timeoutTimerRef.current = setTimeout(() => {
      setIsSubmitting((submitting) => {
        if (submitting) {
          setErrorMsg('Unable to create room. Please check your connection.');
          return false;
        }
        return submitting;
      });
    }, 7000);

    const validName = playerName.trim() || 'Pilot 1';
    try {
      await multiplayerClient.createRoom(validName);
    } catch {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      setErrorMsg('Unable to create room. Please check your connection.');
      setIsSubmitting(false);
    }
  }, [playerName]);

  const handleJoinRoom = useCallback(async () => {
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('Please enter a room code.');
      return;
    }
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    setErrorMsg(null);
    setIsSubmitting(true);

    // 7-second safety timeout
    timeoutTimerRef.current = setTimeout(() => {
      setIsSubmitting((submitting) => {
        if (submitting) {
          setErrorMsg('Unable to join room. Please check your connection or code.');
          return false;
        }
        return submitting;
      });
    }, 7000);

    const validName = playerName.trim() || 'Pilot 2';
    try {
      await multiplayerClient.joinRoom(cleanCode, validName);
    } catch {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      setErrorMsg('Unable to connect to room. Please try again.');
      setIsSubmitting(false);
    }
  }, [joinCodeInput, playerName]);

  const handleCancelRoom = useCallback(() => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    multiplayerClient.leaveRoom();
    setCreatedRoomCode('');
    setRoomState(null);
    setErrorMsg(null);
    setCountdownMsg(null);
    setIsSubmitting(false);
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
      className="relative w-full h-full min-h-[100dvh] flex flex-col items-center justify-between p-3 xs:p-4 sm:p-8 bg-slate-950 overflow-y-auto overflow-x-hidden select-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 12px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 12px)',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Dynamic Cyber Grid Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-slate-950/90 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />

      {/* Top Header */}
      <div className="w-full max-w-xl flex items-center justify-between z-10 mb-2">
        <button
          type="button"
          onClick={view === 'MENU' ? onBack : handleCancelRoom}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-xs font-mono-data text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{view === 'MENU' ? 'MAIN MENU' : 'BACK'}</span>
        </button>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-[10px] sm:text-xs font-mono-data">
          <Wifi className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>REAL-TIME MULTIPLAYER</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-xs sm:max-w-md flex flex-col items-center text-center z-10 my-auto py-2">
        {/* Title */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 text-[10px] xs:text-xs font-mono-data tracking-wider uppercase mb-2">
          <Users className="w-3 h-3" /> 1V1 REAL-TIME DUEL
        </div>

        <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl tracking-wider text-white uppercase drop-shadow-[0_0_20px_rgba(6,182,212,0.4)] mb-1">
          MULTIPLAYER <span className="text-cyan-400">ARENA</span>
        </h1>

        <p className="text-[11px] sm:text-xs font-mono-data text-slate-400 max-w-xs mb-3 sm:mb-5">
          Duel against a friend on any phone, tablet, or laptop in real time.
        </p>

        {/* Global Error Banner (Only in Menu view, specific views handle inline) */}
        {errorMsg && view === 'MENU' && (
          <div className="w-full mb-3 p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-mono-data flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* VIEW 1: LOBBY OPTIONS MENU */}
        {view === 'MENU' && (
          <div className="w-full flex flex-col gap-2.5 sm:gap-3">
            {/* Player Pilot Name Input */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 text-left">
              <label className="block text-[10px] xs:text-[11px] font-mono-data text-slate-400 uppercase tracking-wider mb-1">
                YOUR PILOT CALLSIGN
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={16}
                placeholder="Enter pilot name..."
                className="w-full px-2.5 py-1.5 sm:py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white font-mono-data text-xs sm:text-sm outline-none transition-colors"
              />
            </div>

            {/* Create Room Button */}
            <button
              type="button"
              onClick={handleCreateRoom}
              className="w-full group flex items-center justify-between py-2.5 sm:py-3.5 px-4 sm:px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-md shadow-cyan-500/25 active:scale-98 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Swords className="w-4 h-4" /> CREATE ROOM
              </span>
              <span className="text-[9px] xs:text-[10px] font-mono-data opacity-75">HOST MATCH</span>
            </button>

            {/* Join Room Button */}
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setView('JOIN');
              }}
              className="w-full group flex items-center justify-between py-2.5 sm:py-3.5 px-4 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-white font-display font-semibold text-xs sm:text-sm tracking-wider uppercase transition-all active:scale-98 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" /> JOIN ROOM
              </span>
              <span className="text-[9px] xs:text-[10px] font-mono-data text-cyan-400">ENTER CODE</span>
            </button>

            <button
              type="button"
              onClick={onBack}
              className="w-full py-2 px-3 rounded-xl bg-transparent hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-display text-[11px] sm:text-xs tracking-wider uppercase transition-all active:scale-98 cursor-pointer"
            >
              BACK TO MAIN MENU
            </button>
          </div>
        )}

        {/* VIEW 2: CREATE ROOM (HOST WAITING FOR OPPONENT OR ERROR) */}
        {view === 'CREATE' && (
          <div className="w-full flex flex-col items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xl">
            {/* SUB-STATE 2A: ERROR ON CREATION (Never stuck!) */}
            {errorMsg && !createdRoomCode ? (
              <div className="w-full flex flex-col items-center gap-3 py-3 text-center animate-fadeIn">
                <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-rose-300 uppercase">
                    UNABLE TO CREATE ROOM
                  </h3>
                  <p className="text-xs font-mono-data text-slate-300 mt-1 max-w-xs">
                    {errorMsg}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full max-w-xs mt-1">
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs tracking-wider uppercase transition-all active:scale-95 cursor-pointer shadow-md shadow-cyan-500/20"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> RETRY
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelRoom}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-display font-semibold text-xs tracking-wider uppercase transition-all active:scale-95 cursor-pointer"
                  >
                    BACK
                  </button>
                </div>
              </div>
            ) : isSubmitting && !createdRoomCode ? (
              /* SUB-STATE 2B: LOADING SPINNER WITH CANCEL BUTTON */
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                <span className="text-xs font-mono-data text-slate-300 font-semibold tracking-wide">
                  CREATING ONLINE ARENA ROOM...
                </span>
                <span className="text-[10px] font-mono-data text-slate-500">
                  Connecting across devices...
                </span>
                <button
                  type="button"
                  onClick={handleCancelRoom}
                  className="mt-2 py-1.5 px-4 rounded-lg bg-slate-950 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-xs font-mono-data transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            ) : (
              /* SUB-STATE 2C: ROOM SUCCESSFULLY CREATED */
              <>
                <div className="text-[10px] xs:text-xs font-mono-data text-slate-400 uppercase tracking-wider">
                  SHARE THIS CODE WITH YOUR OPPONENT:
                </div>

                {/* Room Code Display */}
                <div className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-950 border border-cyan-500/40">
                  <span className="font-mono-data font-black text-2xl xs:text-3xl sm:text-4xl text-cyan-400 tracking-widest">
                    {createdRoomCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-950 border border-cyan-500/50 hover:bg-cyan-900 text-cyan-300 text-xs font-mono-data transition-all cursor-pointer active:scale-95"
                    title="Copy Room Code"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300 font-bold text-[10px]">COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px]">COPY</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Match Status Countdown or Waiting */}
                {countdownMsg ? (
                  <div className="w-full py-2 px-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-display font-bold text-xs tracking-wider uppercase animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 inline-block mr-1" />
                    {countdownMsg}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono-data text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Waiting for opponent to join...</span>
                  </div>
                )}

                {/* Players Box */}
                <div className="w-full flex flex-col gap-1.5 pt-2 border-t border-slate-800 text-left text-xs font-mono-data">
                  <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-slate-950 border border-cyan-500/20">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                      <span className="text-white font-semibold truncate text-[11px] sm:text-xs">
                        {playerName || 'Pilot 1'} <span className="text-cyan-400">(YOU)</span>
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-cyan-400 uppercase tracking-wider font-display shrink-0">
                      P1 • VEX
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          roomState?.players.PLAYER_2 ? 'bg-red-400' : 'bg-slate-700 animate-pulse'
                        }`}
                      />
                      <span
                        className={`truncate text-[11px] sm:text-xs ${
                          roomState?.players.PLAYER_2
                            ? 'text-white font-semibold'
                            : 'text-slate-500 italic'
                        }`}
                      >
                        {roomState?.players.PLAYER_2?.name || 'WAITING FOR OPPONENT...'}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-red-400 uppercase tracking-wider font-display shrink-0">
                      P2 • NOVA
                    </span>
                  </div>
                </div>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={handleCancelRoom}
                  className="w-full mt-1 py-1.5 sm:py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white font-display text-[11px] sm:text-xs tracking-wider uppercase transition-all cursor-pointer"
                >
                  CANCEL ROOM
                </button>
              </>
            )}
          </div>
        )}

        {/* VIEW 3: JOIN ROOM */}
        {view === 'JOIN' && (
          <div className="w-full flex flex-col gap-3 bg-slate-900/90 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xl text-left">
            {errorMsg && (
              <div className="w-full p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-mono-data flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] xs:text-[11px] font-mono-data text-slate-400 uppercase tracking-wider mb-1">
                YOUR PILOT CALLSIGN
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={16}
                placeholder="Enter pilot name..."
                className="w-full px-2.5 py-1.5 sm:py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white font-mono-data text-xs sm:text-sm outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] xs:text-[11px] font-mono-data text-slate-400 uppercase tracking-wider mb-1">
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
                className="w-full px-2.5 py-2 sm:py-2.5 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-400 text-cyan-400 font-mono-data text-base sm:text-lg tracking-widest text-center uppercase outline-none transition-colors"
              />
            </div>

            {countdownMsg && (
              <div className="w-full py-2 px-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-display font-bold text-xs tracking-wider uppercase text-center animate-pulse">
                {countdownMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleJoinRoom}
              disabled={isSubmitting || !joinCodeInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-display font-bold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-md shadow-cyan-500/25 active:scale-98 cursor-pointer"
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
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setView('MENU');
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white font-display text-[11px] sm:text-xs tracking-wider uppercase transition-all text-center cursor-pointer"
            >
              BACK
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-xl flex flex-col sm:flex-row items-center justify-between text-[9px] xs:text-[10px] sm:text-[11px] font-mono-data text-slate-400 z-10 gap-1 mt-1 text-center">
        <span>CROSS-DEVICE MULTIPLAYER • WI-FI & MOBILE DATA</span>
        <span>DEVICE INDEPENDENT • REAL-TIME WEBSOCKETS</span>
      </div>
    </div>
  );
};
