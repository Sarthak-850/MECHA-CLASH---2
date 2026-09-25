import React, { useRef, useState, useCallback, useEffect } from 'react';
import { GameEngine } from '../game/engine';
import { Zap, FastForward, Sparkles } from 'lucide-react';

interface VirtualControlsProps {
  engine: GameEngine;
}

export const VirtualControls: React.FC<VirtualControlsProps> = ({ engine }) => {
  // Joystick State
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickPointerId = useRef<number | null>(null);
  const joystickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickMaxRadiusRef = useRef<number>(36);
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

      if (joystickPointerId.current !== null) return;
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

      // Responsive max radius based on current base size
      const maxRadius = Math.max(24, Math.min(48, rect.width * 0.32));
      joystickMaxRadiusRef.current = maxRadius;

      // Calculate initial offset
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);

      const kx = Math.cos(angle) * clampedDist;
      const ky = Math.sin(angle) * clampedDist;

      setKnobPos({ x: kx, y: ky });
      setIsJoystickActive(true);

      // Normalized vector between -1 and 1
      const normX = kx / maxRadius;
      const normY = ky / maxRadius;
      engine.setJoystickVector(normX, normY);
    },
    [engine]
  );

  const handleJoystickPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (joystickPointerId.current !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();

      const maxRadius = joystickMaxRadiusRef.current || 36;
      const dx = e.clientX - joystickCenter.current.x;
      const dy = e.clientY - joystickCenter.current.y;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);

      const kx = Math.cos(angle) * clampedDist;
      const ky = Math.sin(angle) * clampedDist;

      setKnobPos({ x: kx, y: ky });

      // Normalized vector
      const normX = kx / maxRadius;
      const normY = ky / maxRadius;
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
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 8px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 8px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
      }}
    >
      {/* ================= LEFT SIDE: VIRTUAL JOYSTICK ================= */}
      <div className="relative pointer-events-auto touch-none select-none mb-1 ml-0.5 sm:mb-2 sm:ml-2">
        <div
          ref={joystickBaseRef}
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
          className={`relative rounded-full flex items-center justify-center border-2 backdrop-blur-md transition-colors duration-200 cursor-pointer ${
            isJoystickActive
              ? 'bg-slate-900/85 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
              : 'bg-slate-950/75 border-slate-700/60 shadow-lg'
          }`}
          style={{
            width: 'clamp(84px, 20vw, 126px)',
            height: 'clamp(84px, 20vw, 126px)',
            touchAction: 'none',
          }}
          aria-label="Movement Joystick"
        >
          {/* Subtle directional indicators on the base */}
          <div className="absolute top-1.5 w-1 h-1 rounded-full bg-cyan-400/40" />
          <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-cyan-400/40" />
          <div className="absolute left-1.5 w-1 h-1 rounded-full bg-cyan-400/40" />
          <div className="absolute right-1.5 w-1 h-1 rounded-full bg-cyan-400/40" />

          {/* Concentric guide ring */}
          <div className="w-1/2 h-1/2 rounded-full border border-slate-700/40 pointer-events-none" />

          {/* Interactive Joystick Knob */}
          <div
            className={`absolute rounded-full flex items-center justify-center border-2 pointer-events-none shadow-md ${
              isJoystickActive
                ? 'bg-gradient-to-br from-cyan-400 to-cyan-600 border-white text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.8)] scale-105'
                : 'bg-gradient-to-br from-slate-800 to-slate-900 border-cyan-500/50 text-cyan-400'
            }`}
            style={{
              width: 'clamp(36px, 8.5vw, 48px)',
              height: 'clamp(36px, 8.5vw, 48px)',
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              transition: isJoystickActive ? 'none' : 'transform 0.16s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            {/* Center dot */}
            <div className={`w-2.5 h-2.5 rounded-full ${isJoystickActive ? 'bg-slate-950' : 'bg-cyan-400 animate-pulse'}`} />
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDE: ERGONOMIC ACTION BUTTON CLUSTER ================= */}
      {/* Arranged in an arc/triangle pad so thumbs reach easily without horizontal screen crowding */}
      <div className="relative pointer-events-auto touch-none select-none flex flex-col items-end gap-1.5 sm:gap-2 mb-1 mr-0.5 sm:mb-2 sm:mr-2">
        {/* Top Row: ULTIMATE (BURST) BUTTON */}
        <div className="flex justify-end pr-3 sm:pr-5">
          <div className="flex flex-col items-center">
            <button
              type="button"
              onPointerDown={handleUltimatePointerDown}
              onPointerUp={handleUltimatePointerUp}
              onPointerCancel={handleUltimatePointerUp}
              disabled={!ultimateReady}
              className={`relative rounded-full flex flex-col items-center justify-center border-2 transition-all duration-100 cursor-pointer overflow-hidden ${
                isUltimatePressed && ultimateReady
                  ? 'scale-90 bg-fuchsia-400 border-white shadow-[0_0_20px_rgba(232,121,249,0.9)]'
                  : ultimateReady
                  ? 'bg-slate-900/90 border-fuchsia-500/70 text-fuchsia-400 shadow-[0_0_14px_rgba(217,70,239,0.4)] active:scale-95'
                  : 'bg-slate-950/80 border-slate-800 text-slate-500 opacity-80'
              }`}
              style={{
                width: 'clamp(44px, 11vw, 58px)',
                height: 'clamp(44px, 11vw, 58px)',
                touchAction: 'none',
              }}
              aria-label="Ultimate Burst"
            >
              <Sparkles
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5 transition-transform ${
                  isUltimatePressed ? 'scale-115 rotate-12' : ''
                } ${ultimateReady ? 'text-fuchsia-400 animate-pulse' : 'text-slate-600'}`}
              />
              <span className="font-display font-black text-[8px] sm:text-[9px] tracking-wider uppercase leading-none">
                BURST
              </span>

              {/* Cooldown Overlay */}
              {!ultimateReady && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[1px] flex flex-col items-center justify-center">
                  <span className="font-mono-data font-bold text-[9px] sm:text-[10px] text-fuchsia-400/90">
                    {ultimateCooldown.toFixed(1)}s
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Row: DASH + ATTACK BUTTONS */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* DASH BUTTON */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onPointerDown={handleDashPointerDown}
              onPointerUp={handleDashPointerUp}
              onPointerCancel={handleDashPointerUp}
              disabled={!dashReady}
              className={`relative rounded-full flex flex-col items-center justify-center border-2 transition-all duration-100 cursor-pointer overflow-hidden ${
                isDashPressed && dashReady
                  ? 'scale-90 bg-amber-400 border-white shadow-[0_0_20px_rgba(245,158,11,0.9)]'
                  : dashReady
                  ? 'bg-slate-900/90 border-amber-500/70 text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.35)] active:scale-95'
                  : 'bg-slate-950/80 border-slate-800 text-slate-500 opacity-80'
              }`}
              style={{
                width: 'clamp(46px, 12vw, 62px)',
                height: 'clamp(46px, 12vw, 62px)',
                touchAction: 'none',
              }}
              aria-label="Dash"
            >
              <FastForward
                className={`w-4 h-4 sm:w-4.5 sm:h-4.5 mb-0.5 transition-transform ${
                  isDashPressed ? 'scale-110' : ''
                } ${dashReady ? 'text-amber-400' : 'text-slate-600'}`}
              />
              <span className="font-display font-black text-[8px] sm:text-[10px] tracking-wider uppercase leading-none">
                DASH
              </span>

              {/* Cooldown Overlay */}
              {!dashReady && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[1px] flex flex-col items-center justify-center">
                  <span className="font-mono-data font-bold text-[9px] sm:text-xs text-amber-400/90">
                    {dashCooldown.toFixed(1)}s
                  </span>
                </div>
              )}
            </button>
          </div>

          {/* ATTACK BUTTON (Primary action, prominent) */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onPointerDown={handleAttackPointerDown}
              onPointerUp={handleAttackPointerUp}
              onPointerCancel={handleAttackPointerUp}
              className={`relative rounded-full flex flex-col items-center justify-center border-2 transition-all duration-100 cursor-pointer overflow-hidden ${
                isAttackPressed
                  ? 'scale-90 bg-cyan-400 border-white text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.9)]'
                  : attackReady
                  ? 'bg-slate-900/95 border-cyan-400 text-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.45)] active:scale-95'
                  : 'bg-slate-900/80 border-cyan-600/50 text-cyan-400 opacity-90'
              }`}
              style={{
                width: 'clamp(58px, 15vw, 78px)',
                height: 'clamp(58px, 15vw, 78px)',
                touchAction: 'none',
              }}
              aria-label="Attack"
            >
              <Zap
                className={`w-5 h-5 sm:w-6 sm:h-6 mb-0.5 fill-current transition-transform ${
                  isAttackPressed ? 'scale-120 rotate-6' : ''
                }`}
              />
              <span className="font-display font-black text-[10px] sm:text-xs tracking-wider uppercase leading-none">
                ATTACK
              </span>

              {/* Cooldown flash */}
              {!attackReady && (
                <div className="absolute inset-0 bg-cyan-950/40 pointer-events-none" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
