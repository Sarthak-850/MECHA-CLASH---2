import React, { useState, useEffect } from 'react';
import { GameEngine } from '../game/engine';
import { BASE_HP, MAX_LIVES } from '../game/constants';
import { Volume2, VolumeX, Shield, Zap, Flame, Award, Battery, BatteryCharging, BatteryLow, BatteryMedium, BatteryFull, Maximize2, Minimize2 } from 'lucide-react';
import { isMobileClient } from '../utils/fullscreen';

interface BatteryState {
  level: number; // 0 to 100
  charging: boolean;
}

interface HUDProps {
  engine: GameEngine;
  onPause: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  engine,
  onPause,
  onToggleMute,
  isMuted,
  onToggleFullscreen,
  isFullscreen = false,
}) => {
  const vex = engine.vex;
  const nova = engine.nova;

  // Battery status tracking for mobile players
  const [battery, setBattery] = useState<BatteryState | null>(null);
  const [isMobile] = useState<boolean>(() => isMobileClient());

  useEffect(() => {
    // Battery tracking is only relevant for mobile devices
    if (!isMobile) return;

    let batteryManager: any = null;
    let isMounted = true;

    const updateBatteryInfo = (manager: any) => {
      if (!isMounted || !manager) return;
      const level = Math.round((manager.level ?? 1) * 100);
      const charging = Boolean(manager.charging);
      setBattery({ level, charging });
    };

    // Navigator getBattery API (supported on Chrome/Android browsers)
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((manager: any) => {
          if (!isMounted) return;
          batteryManager = manager;
          updateBatteryInfo(manager);

          manager.addEventListener('levelchange', () => updateBatteryInfo(manager));
          manager.addEventListener('chargingchange', () => updateBatteryInfo(manager));
        })
        .catch(() => {
          // Gracefully fallback to simulated / estimated battery if API blocked
          if (isMounted) {
            setBattery({ level: 85, charging: false });
          }
        });
    } else {
      // Graceful fallback display for mobile devices without getBattery (e.g. iOS Safari)
      setBattery({ level: 100, charging: false });
    }

    // Update battery status every 30 seconds as requested
    const interval = setInterval(() => {
      if (batteryManager) {
        updateBatteryInfo(batteryManager);
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isMobile]);

  const vexHpPct = Math.max(0, Math.min(100, (vex.hp / BASE_HP) * 100));
  const novaHpPct = Math.max(0, Math.min(100, (nova.hp / BASE_HP) * 100));

  const dashReady = vex.dashCooldown <= 0;
  const dashPct = dashReady
    ? 100
    : Math.max(0, 100 - (vex.dashCooldown / vex.maxDashCooldown) * 100);

  return (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none select-none z-20 flex flex-col justify-between"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 8px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 8px)',
      }}
    >
      {/* Top Header Bar */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-4">
        {/* VEX (Player) Panel */}
        <div className="flex-1 max-w-[135px] xs:max-w-[170px] sm:max-w-xs pointer-events-auto bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 rounded-lg p-1.5 sm:p-2.5 shadow-lg shadow-cyan-950/30">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="font-display font-extrabold text-cyan-400 text-xs sm:text-sm tracking-wider">
                VEX
              </span>
              <span className="hidden sm:inline text-[10px] text-slate-400 font-mono-data uppercase">
                [PLAYER]
              </span>
            </div>
            {/* Lives */}
            <div className="flex items-center gap-1" title={`${vex.lives} Lives Remaining`}>
              {Array.from({ length: MAX_LIVES }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rotate-45 border transition-all ${
                    idx < vex.lives
                      ? 'bg-cyan-400 border-cyan-200 shadow-xs shadow-cyan-400'
                      : 'bg-slate-900 border-slate-700 opacity-40'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Health Bar */}
          <div className="h-2 sm:h-3 bg-slate-900 rounded-xs overflow-hidden border border-slate-800 relative">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-100 ease-out"
              style={{ width: `${vexHpPct}%` }}
            />
          </div>

          <div className="flex justify-between items-center mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-mono-data text-slate-300">
            <span className="font-semibold text-cyan-300">
              {Math.ceil(vex.hp)} <span className="text-[8px] sm:text-[10px] text-slate-400 font-normal">/ 100</span>
            </span>

            {/* Desktop Dash indicator */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">DASH [G]</span>
              <div className="w-12 h-1.5 bg-slate-800 rounded-xs overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    dashReady ? 'bg-cyan-400' : 'bg-slate-500'
                  }`}
                  style={{ width: `${dashPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Buffs */}
          <div className="flex items-center gap-1 sm:gap-2 mt-1 min-h-[14px] sm:min-h-[18px]">
            {vex.hasShield && (
              <span className="flex items-center gap-0.5 text-[8px] sm:text-[10px] font-mono-data text-blue-300 bg-blue-950/80 px-1 py-0.5 rounded border border-blue-500/40">
                <Shield className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> SHIELD
              </span>
            )}
            {vex.hasPowerAttack && (
              <span className="flex items-center gap-0.5 text-[8px] sm:text-[10px] font-mono-data text-amber-300 bg-amber-950/80 px-1 py-0.5 rounded border border-amber-500/40">
                <Flame className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> 2× ATK
              </span>
            )}
            {vex.speedBoostTimer > 0 && (
              <span className="flex items-center gap-0.5 text-[8px] sm:text-[10px] font-mono-data text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40">
                <Zap className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> SPEED
              </span>
            )}
          </div>
        </div>

        {/* Center Match Status & Quick Actions */}
        <div className="flex flex-col items-center pointer-events-auto bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg px-2 sm:px-4 py-1 sm:py-2 shadow-lg">
          <div className="font-display text-[9px] sm:text-xs text-slate-400 uppercase tracking-widest leading-tight">
            {engine.gameMode === 'CAMPAIGN'
              ? `CH. ${Math.ceil(engine.currentLevel / 10)} • LVL ${engine.currentLevel}`
              : engine.gameMode === 'ENDLESS'
              ? `ENDLESS ${engine.currentLevel}`
              : `${engine.difficulty}`}
          </div>

          <div className="font-display font-black text-sm sm:text-lg text-white tracking-wider glow-cyan leading-tight">
            RND {engine.currentRound}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs font-mono-data text-slate-300 mt-0.5">
            <span className="text-cyan-400 font-semibold">{engine.score.toLocaleString()}</span>
            {engine.winStreak > 0 && (
              <span className="hidden xs:flex items-center gap-0.5 text-amber-400">
                <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {engine.winStreak}W
              </span>
            )}
          </div>

          {/* Quick Action Buttons & Mobile Indicators */}
          <div className="flex items-center gap-1 sm:gap-2 mt-1 sm:mt-1.5">
            {/* Subtle Battery Level Indicator for Mobile Players */}
            {isMobile && battery !== null && (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[9px] font-mono-data tracking-tight"
                title={`Battery: ${battery.level}%${battery.charging ? ' (Charging)' : ''} • Updates every 30s`}
                aria-label={`Battery ${battery.level} percent`}
              >
                {battery.charging ? (
                  <BatteryCharging className="w-3 h-3 text-emerald-400 shrink-0 animate-pulse" />
                ) : battery.level <= 20 ? (
                  <BatteryLow className="w-3 h-3 text-rose-400 shrink-0" />
                ) : battery.level <= 60 ? (
                  <BatteryMedium className="w-3 h-3 text-amber-400 shrink-0" />
                ) : (
                  <BatteryFull className="w-3 h-3 text-emerald-400 shrink-0" />
                )}
                <span
                  className={`font-semibold leading-none ${
                    battery.charging
                      ? 'text-emerald-300'
                      : battery.level <= 20
                      ? 'text-rose-400'
                      : battery.level <= 60
                      ? 'text-amber-300'
                      : 'text-slate-300'
                  }`}
                >
                  {battery.level}%
                </span>
              </div>
            )}

            <button
              onClick={onToggleMute}
              className="p-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
            </button>

            {/* Mobile friendly Pause Button */}
            <button
              onClick={onPause}
              className="flex items-center justify-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
              title="Pause Game (P)"
              aria-label="Pause"
            >
              <span className="font-display font-black text-xs sm:text-sm tracking-widest text-cyan-400">
                Ⅱ
              </span>
              <span className="hidden sm:inline text-[10px] font-mono-data ml-0.5">
                PAUSE [P]
              </span>
            </button>
          </div>
        </div>

        {/* NOVA (AI) Panel */}
        <div
          className={`flex-1 max-w-[135px] xs:max-w-[170px] sm:max-w-xs pointer-events-auto bg-slate-950/85 backdrop-blur-md rounded-lg p-1.5 sm:p-2.5 shadow-lg ${
            nova.isBoss
              ? 'border border-amber-500/60 shadow-amber-950/40 ring-1 ring-amber-500/30'
              : 'border border-red-500/30 shadow-red-950/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            {/* Lives */}
            <div className="flex items-center gap-1" title={`${nova.lives} Lives Remaining`}>
              {Array.from({ length: MAX_LIVES }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rotate-45 border transition-all ${
                    idx < nova.lives
                      ? nova.isBoss
                        ? 'bg-amber-400 border-amber-200 shadow-xs shadow-amber-400'
                        : 'bg-red-500 border-red-200 shadow-xs shadow-red-500'
                      : 'bg-slate-900 border-slate-700 opacity-40'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span
                className={`hidden sm:inline text-[10px] font-mono-data uppercase ${
                  nova.isBoss ? 'text-amber-400 font-bold' : 'text-slate-400'
                }`}
              >
                {nova.isBoss
                  ? nova.bossTier === 'FINAL_BOSS'
                    ? '[FINAL BOSS]'
                    : nova.bossTier === 'MAJOR_BOSS'
                    ? '[MAJOR BOSS]'
                    : '[BOSS]'
                  : '[AI]'}
              </span>
              <span
                className={`font-display font-extrabold text-xs sm:text-sm tracking-wider truncate max-w-[85px] sm:max-w-none ${
                  nova.isBoss ? 'text-amber-400' : 'text-red-500'
                }`}
              >
                {nova.name}
              </span>
            </div>
          </div>

          {/* Health Bar */}
          <div className="h-2 sm:h-3 bg-slate-900 rounded-xs overflow-hidden border border-slate-800 relative">
            <div
              className="h-full bg-gradient-to-l from-red-600 to-rose-400 transition-all duration-100 ease-out ml-auto"
              style={{ width: `${novaHpPct}%` }}
            />
          </div>

          <div className="flex justify-between items-center mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-mono-data text-slate-300">
            <div className="flex items-center gap-1 truncate max-w-[90px] sm:max-w-none">
              <span className="text-slate-400 text-[9px] sm:text-[10px]">
                {engine.difficulty}
              </span>
              {nova.aiPersonality && (
                <span className="text-[8px] font-mono-data text-amber-300/90 bg-amber-950/60 px-1 py-0.2 rounded border border-amber-500/30">
                  {nova.aiPersonality}
                </span>
              )}
            </div>
            <span className="font-semibold text-red-400">
              {Math.ceil(nova.hp)} <span className="text-[8px] sm:text-[10px] text-slate-400 font-normal">/ 100</span>
            </span>
          </div>

          {/* AI Buffs */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 mt-1 min-h-[14px] sm:min-h-[18px]">
            {nova.hasShield && (
              <span className="flex items-center gap-0.5 text-[8px] sm:text-[10px] font-mono-data text-blue-300 bg-blue-950/80 px-1 py-0.5 rounded border border-blue-500/40">
                <Shield className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> SHIELD
              </span>
            )}
            {nova.hasPowerAttack && (
              <span className="flex items-center gap-0.5 text-[8px] sm:text-[10px] font-mono-data text-amber-300 bg-amber-950/80 px-1 py-0.5 rounded border border-amber-500/40">
                <Flame className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> 2× ATK
              </span>
            )}
            {nova.speedBoostTimer > 0 && (
              <span className="flex items-center gap-0.5 text-[8px] sm:text-[10px] font-mono-data text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40">
                <Zap className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> SPEED
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-Only Small & Clean Fullscreen Toggle Button */}
      {isMobile && onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="pointer-events-auto fixed z-50 flex items-center justify-center rounded-lg bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 active:text-white backdrop-blur-md shadow-lg shadow-cyan-950/20 active:scale-90 transition-all duration-150 cursor-pointer opacity-80 hover:opacity-100 focus:opacity-100"
          style={{
            width: '36px',
            height: '36px',
            top: 'max(12px, env(safe-area-inset-top, 12px))',
            right: 'max(12px, env(safe-area-inset-right, 12px))',
            touchAction: 'manipulation',
          }}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-cyan-400 transition-transform duration-150" />
          ) : (
            <Maximize2 className="w-4 h-4 text-cyan-400 transition-transform duration-150" />
          )}
        </button>
      )}
    </div>
  );
};
