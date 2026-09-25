import React, { useRef, useState, useCallback, useEffect } from 'react';
import { GameEngine } from '../game/engine';
import { Zap, FastForward, Sparkles } from 'lucide-react';

interface VirtualControlsProps {
  engine: GameEngine;
}

const JOYSTICK_MAX_RADIUS = 50; // max pixel distance knob travels from center

export const VirtualControls: React.FC<VirtualControlsProps> = ({ engine }) => {
  // Joystick State
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickPointerId = useRef<number | null>(null);
  const joystickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);

  // Button States for visual press feedback
  const [isAttackPressed, setIsAttackPressed] = useState(false);
  const [isDashPressed, setIsDashPressed] = useState(false);
  const [isUltimatePressed, setIsUltimatePressed] = useState(false);

  // Cooldown values polled on animation frame or synced with VEX
  const [dashCooldown, setDashCooldown] = useState(0);
  const [attackCooldown, setAttackCooldown] = useState(0);
  const [ultimateCooldown, setUltimateCooldown] = useState(0);

  // Sync cooldowns with engine state for HUD/buttons
  useEffect(() => {
    let animId: number;
    const pollCooldowns = () => {
      if (engine.vex) {
        setDashCooldown(Math.max(0, engine.vex.dashCooldown));
        setAttackCooldown(Math.max(0, engine.vex.attackCooldown));
        setUltimateCooldown(Math.max(0, engine.vex.ultimateCooldown || 0));
      }
      animId = requestAnimationFrame(pollCooldowns);
    };
    animId = requestAnimationFrame(pollCooldowns);
    return () => cancelAnimationFrame(animId);
  }, [engine]);

  // --- JOYSTICK POINTER HANDLERS ---
  const handleJoystickPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (joystickPointerId.current !== null) return; // already tracking a finger
      joystickPointerId.current = e.pointerId;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // pointer capture fallback
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      joystickCenter.current = { x: centerX, y: centerY };

      // Calculate initial offset
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, JOYSTICK_MAX_RADIUS);
      const angle = Math.atan2(dy, dx);

      const kx = Math.cos(angle) * clampedDist;
      const ky = Math.sin(angle) * clampedDist;

      setKnobPos({ x: kx, y: ky });
      setIsJoystickActive(true);

      // Normalized vector between -1 and 1
      const normX = kx / JOYSTICK_MAX_RADIUS;
      const normY = ky / JOYSTICK_MAX_RADIUS;
      engine.setJoystickVector(normX, normY);
    },
    [engine]
  );

  const handleJoystickPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (joystickPointerId.current !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();

      const dx = e.clientX - joystickCenter.current.x;
      const dy = e.clientY - joystickCenter.current.y;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, JOYSTICK_MAX_RADIUS);
      const angle = Math.atan2(dy, dx);

      const kx = Math.cos(angle) * clampedDist;
      const ky = Math.sin(angle) * clampedDist;

      setKnobPos({ x: kx, y: ky });

      // Normalized vector
      const normX = kx / JOYSTICK_MAX_RADIUS;
      const normY = ky / JOYSTICK_MAX_RADIUS;
      engine.setJoystickVector(normX, normY);
    },
    [engine]
  );

  const handleJoystickPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (joystickPointerId.current !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // fallback
      }

      joystickPointerId.current = null;
      setKnobPos({ x: 0, y: 0 });
      setIsJoystickActive(false);
      engine.setJoystickVector(0, 0);
    },
    [engine]
  );

  // --- ATTACK BUTTON HANDLERS ---
  const handleAttackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsAttackPressed(true);
      engine.triggerPlayerAttack();
    },
    [engine]
  );

  const handleAttackPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsAttackPressed(false);
    },
    []
  );

  // --- DASH BUTTON HANDLERS ---
  const handleDashPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDashPressed(true);
      engine.triggerPlayerDash();
    },
    [engine]
  );

  const handleDashPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDashPressed(false);
    },
    []
  );

  // --- ULTIMATE BUTTON HANDLERS ---
  const handleUltimatePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsUltimatePressed(true);
      engine.triggerPlayerUltimate();
    },
    [engine]
  );

  const handleUltimatePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsUltimatePressed(false);
    },
    []
  );

  const dashReady = dashCooldown <= 0;
  const attackReady = attackCooldown <= 0;
  const ultimateReady = ultimateCooldown <= 0;

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none z-30 flex items-end justify-between overflow-hidden"
      style={{
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
      }}
    >
      {/* ================= LEFT SIDE: VIRTUAL JOYSTICK ================= */}
      <div className="relative pointer-events-auto touch-none select-none mb-1 ml-1 sm:mb-3 sm:ml-3">
        <div
          ref={joystickBaseRef}
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
          className={`relative rounded-full flex items-center justify-center border-2 backdrop-blur-md transition-colors duration-200 cursor-pointer ${
            isJoystickActive
              ? 'bg-slate-900/85 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.4)]'
              : 'bg-slate-950/70 border-slate-700/60 shadow-lg'
          }`}
          style={{
            width: 'clamp(116px, 24vw, 144px)',
            height: 'clamp(116px, 24vw, 144px)',
            touchAction: 'none',
          }}
          aria-label="Movement Joystick"
        >
          {/* Subtle directional indicators on the base */}
          <div className="absolute top-2 w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
          <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
          <div className="absolute left-2 w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
          <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-cyan-400/40" />

          {/* Concentric guide ring */}
          <div className="w-16 h-16 rounded-full border border-slate-700/40 pointer-events-none" />

          {/* Interactive Joystick Knob */}
          <div
            className={`absolute rounded-full flex items-center justify-center border-2 pointer-events-none shadow-md ${
              isJoystickActive
                ? 'bg-gradient-to-br from-cyan-400 to-cyan-600 border-white text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.8)] scale-105'
                : 'bg-gradient-to-br from-slate-800 to-slate-900 border-cyan-500/50 text-cyan-400'
            }`}
            style={{
              width: 'clamp(48px, 11vw, 60px)',
              height: 'clamp(48px, 11vw, 60px)',
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              transition: isJoystickActive ? 'none' : 'transform 0.18s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            {/* Center dot / arrow grid */}
            <div className={`w-3 h-3 rounded-full ${isJoystickActive ? 'bg-slate-950' : 'bg-cyan-400 animate-pulse'}`} />
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDE: ACTION BUTTONS (ULTIMATE, DASH, ATTACK) ================= */}
      <div className="relative pointer-events-auto touch-none select-none flex items-end gap-2.5 sm:gap-4 mb-1 mr-1 sm:mb-3 sm:mr-3">
        {/* ULTIMATE BUTTON (Special Ability: Energy Burst) */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onPointerDown={handleUltimatePointerDown}
            onPointerUp={handleUltimatePointerUp}
            onPointerCancel={handleUltimatePointerUp}
            disabled={!ultimateReady}
            className={`relative rounded-full flex flex-col items-center justify-center border-2 transition-all duration-100 cursor-pointer overflow-hidden ${
              isUltimatePressed && ultimateReady
                ? 'scale-90 bg-fuchsia-400 border-white shadow-[0_0_25px_rgba(232,121,249,0.9)]'
                : ultimateReady
                ? 'bg-slate-900/90 border-fuchsia-500/70 text-fuchsia-400 shadow-[0_0_18px_rgba(217,70,239,0.4)] active:scale-95'
                : 'bg-slate-950/75 border-slate-800 text-slate-500 opacity-80'
            }`}
            style={{
              width: 'clamp(58px, 13vw, 70px)',
              height: 'clamp(58px, 13vw, 70px)',
              touchAction: 'none',
            }}
            aria-label="Ultimate"
          >
            <Sparkles
              className={`w-4 h-4 sm:w-5 sm:h-5 mb-0.5 transition-transform ${
                isUltimatePressed ? 'scale-115 rotate-12' : ''
              } ${ultimateReady ? 'text-fuchsia-400 animate-pulse' : 'text-slate-600'}`}
            />
            <span className="font-display font-black text-[9px] sm:text-[11px] tracking-wider uppercase leading-none">
              BURST
            </span>

            {/* Cooldown Overlay */}
            {!ultimateReady && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[1px] flex flex-col items-center justify-center">
                <span className="font-mono-data font-bold text-[11px] text-fuchsia-400/90">
                  {ultimateCooldown.toFixed(1)}s
                </span>
                <span className="text-[7px] font-mono-data text-slate-400 uppercase tracking-tighter">
                  WAIT
                </span>
              </div>
            )}
          </button>
          <span className="text-[8px] font-mono-data text-slate-400 uppercase mt-1 tracking-wider hidden sm:block">
            {ultimateReady ? 'BURST [SPC]' : `${ultimateCooldown.toFixed(1)}S`}
          </span>
        </div>

        {/* DASH BUTTON (Secondary thumb action) */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onPointerDown={handleDashPointerDown}
            onPointerUp={handleDashPointerUp}
            onPointerCancel={handleDashPointerUp}
            disabled={!dashReady}
            className={`relative rounded-full flex flex-col items-center justify-center border-2 transition-all duration-100 cursor-pointer overflow-hidden ${
              isDashPressed && dashReady
                ? 'scale-90 bg-amber-400 border-white shadow-[0_0_25px_rgba(245,158,11,0.9)]'
                : dashReady
                ? 'bg-slate-900/90 border-amber-500/70 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.35)] active:scale-95'
                : 'bg-slate-950/75 border-slate-800 text-slate-500 opacity-80'
            }`}
            style={{
              width: 'clamp(62px, 14vw, 76px)',
              height: 'clamp(62px, 14vw, 76px)',
              touchAction: 'none',
            }}
            aria-label="Dash"
          >
            <FastForward
              className={`w-5 h-5 mb-0.5 transition-transform ${
                isDashPressed ? 'scale-110' : ''
              } ${dashReady ? 'text-amber-400' : 'text-slate-600'}`}
            />
            <span className="font-display font-black text-[10px] sm:text-xs tracking-wider uppercase leading-none">
              DASH
            </span>

            {/* Cooldown Overlay */}
            {!dashReady && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[1px] flex flex-col items-center justify-center">
                <span className="font-mono-data font-bold text-xs text-amber-400/90">
                  {dashCooldown.toFixed(1)}s
                </span>
                <span className="text-[8px] font-mono-data text-slate-400 uppercase tracking-tighter">
                  WAIT
                </span>
              </div>
            )}
          </button>
          <span className="text-[9px] font-mono-data text-slate-400 uppercase mt-1 tracking-wider hidden sm:block">
            {dashReady ? 'READY [G]' : `${dashCooldown.toFixed(1)}S`}
          </span>
        </div>

        {/* ATTACK BUTTON (Primary thumb action, prominent and largest) */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onPointerDown={handleAttackPointerDown}
            onPointerUp={handleAttackPointerUp}
            onPointerCancel={handleAttackPointerUp}
            className={`relative rounded-full flex flex-col items-center justify-center border-2 transition-all duration-100 cursor-pointer overflow-hidden ${
              isAttackPressed
                ? 'scale-90 bg-cyan-400 border-white text-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.9)]'
                : attackReady
                ? 'bg-slate-900/95 border-cyan-400 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.45)] active:scale-95'
                : 'bg-slate-900/80 border-cyan-600/50 text-cyan-400 opacity-90'
            }`}
            style={{
              width: 'clamp(72px, 17vw, 88px)',
              height: 'clamp(72px, 17vw, 88px)',
              touchAction: 'none',
            }}
            aria-label="Attack"
          >
            <Zap
              className={`w-6 h-6 sm:w-7 sm:h-7 mb-0.5 fill-current transition-transform ${
                isAttackPressed ? 'scale-125 rotate-6' : ''
              }`}
            />
            <span className="font-display font-black text-xs sm:text-sm tracking-wider uppercase leading-none">
              ATTACK
            </span>

            {/* Attack Cooldown flash */}
            {!attackReady && (
              <div className="absolute inset-0 bg-cyan-950/40 pointer-events-none" />
            )}
          </button>
          <span className="text-[9px] font-mono-data text-slate-400 uppercase mt-1 tracking-wider hidden sm:block">
            SLASH [F]
          </span>
        </div>
      </div>
    </div>
  );
};
