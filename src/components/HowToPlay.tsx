import React from 'react';
import { ArrowLeft, Swords, Shield, Zap, Flame, BatteryCharging, AlertTriangle, Smartphone, Keyboard } from 'lucide-react';

interface HowToPlayProps {
  onBack: () => void;
}

export const HowToPlay: React.FC<HowToPlayProps> = ({ onBack }) => {
  return (
    <div
      className="relative w-full min-h-screen min-h-[100dvh] flex flex-col items-center justify-between p-3 xs:p-4 sm:p-8 bg-slate-950 overflow-y-auto overflow-x-hidden select-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 12px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 12px)',
      }}
    >
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-xs font-mono-data text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> BACK
        </button>
        <span className="font-display font-semibold text-xs text-slate-400 tracking-widest uppercase">
          COMBAT FLIGHT MANUAL
        </span>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-4xl flex flex-col gap-4 sm:gap-6 z-10 my-auto py-2">
        <div className="text-center">
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white tracking-wider uppercase mb-1">
            HOW TO PLAY
          </h2>
          <p className="text-xs text-slate-400 font-mono-data">
            Master the core loop: <span className="text-cyan-400">MOVE</span> →{' '}
            <span className="text-white">ATTACK</span> →{' '}
            <span className="text-cyan-400">DODGE</span> →{' '}
            <span className="text-amber-400">DASH</span> →{' '}
            <span className="text-emerald-400">POWER-UP</span>
          </p>
        </div>

        {/* Dual Controls Grid (Desktop & Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mobile Touch Controls Card */}
          <div className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-4 sm:p-5 shadow-lg">
            <h3 className="font-display font-bold text-xs sm:text-sm text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" /> MOBILE / TOUCH CONTROLS
            </h3>

            <div className="space-y-2.5 font-mono-data text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-cyan-300">LEFT VIRTUAL JOYSTICK</span>
                <span className="text-slate-300 text-right text-[11px]">Hold & drag to move in any 360° direction</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-cyan-400">⚡ ATTACK BUTTON</span>
                <span className="text-slate-300 text-right text-[11px]">Tap bottom-right button to slash with blade</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-amber-400">➤ DASH BUTTON</span>
                <span className="text-slate-300 text-right text-[11px]">Tap to high-speed dash (has cooldown timer)</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-fuchsia-400">✨ BURST BUTTON</span>
                <span className="text-slate-300 text-right text-[11px]">Tap to unleash 360° Energy Shockwave</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Ⅱ PAUSE BUTTON</span>
                <span className="text-slate-300 text-right text-[11px]">Top bar button to pause / resume match</span>
              </div>
            </div>

            <div className="mt-3 p-2 rounded bg-cyan-950/40 border border-cyan-500/30 text-[11px] font-mono-data text-cyan-300">
              📱 Multi-touch enabled: Left thumb steers joystick while right thumb attacks or dashes simultaneously!
            </div>
          </div>

          {/* Desktop Keyboard Controls Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
            <h3 className="font-display font-bold text-xs sm:text-sm text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-slate-400" /> DESKTOP KEYBOARD CONTROLS
            </h3>

            <div className="space-y-2.5 font-mono-data text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 rounded border border-slate-700 font-bold">W</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 rounded border border-slate-700 font-bold">A</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 rounded border border-slate-700 font-bold">S</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 rounded border border-slate-700 font-bold">D</kbd>
                </div>
                <span className="text-slate-300 text-right text-[11px]">8-way omnidirectional movement</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <kbd className="px-2.5 py-0.5 bg-cyan-950 text-cyan-400 rounded border border-cyan-500/50 font-bold">F</kbd>
                <span className="text-slate-300 text-right text-[11px]">Plasma blade attack</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <kbd className="px-2.5 py-0.5 bg-amber-950 text-amber-400 rounded border border-amber-500/50 font-bold">G</kbd>
                <span className="text-slate-300 text-right text-[11px]">High-velocity invulnerable dash</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <kbd className="px-2.5 py-0.5 bg-fuchsia-950 text-fuchsia-400 rounded border border-fuchsia-500/50 font-bold">SPACE</kbd>
                <span className="text-slate-300 text-right text-[11px]">Energy Burst radial shockwave</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-2.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-bold">P</kbd>
                <span className="text-slate-300 text-right text-[11px]">Pause / Resume combat</span>
              </div>
            </div>

            <div className="mt-3 p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono-data text-slate-400">
              💡 Pro Tip: Dash (G) grants brief invulnerability. Use it to dodge opponent swings or rapidly close distance!
            </div>
          </div>
        </div>

        {/* Power-ups Section */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
          <h3 className="font-display font-bold text-xs sm:text-sm text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> BATTLEFIELD POWER-UPS
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 font-mono-data text-xs">
            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-950 border border-slate-800">
              <div className="p-1.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400 shrink-0">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-cyan-400 block text-[11px]">SPEED BOOST:</span>
                <span className="text-slate-400 text-[10px]">+45% move speed (6s)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-950 border border-slate-800">
              <div className="p-1.5 rounded bg-blue-950 border border-blue-500/40 text-blue-400 shrink-0">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-blue-400 block text-[11px]">SHIELD:</span>
                <span className="text-slate-400 text-[10px]">Absorbs next incoming hit</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-950 border border-slate-800">
              <div className="p-1.5 rounded bg-red-950 border border-red-500/40 text-red-400 shrink-0">
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-red-400 block text-[11px]">POWER ATTACK:</span>
                <span className="text-slate-400 text-[10px]">Next strike deals 2× damage</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-950 border border-slate-800">
              <div className="p-1.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400 shrink-0">
                <span className="font-bold text-xs px-0.5">✚</span>
              </div>
              <div>
                <span className="font-bold text-emerald-400 block text-[11px]">NANITE HEAL:</span>
                <span className="text-slate-400 text-[10px]">Restores +30 HP instantly</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded bg-slate-950 border border-slate-800">
              <div className="p-1.5 rounded bg-amber-950 border border-amber-500/40 text-amber-400 shrink-0">
                <BatteryCharging className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-amber-400 block text-[11px]">ENERGY REFILL:</span>
                <span className="text-slate-400 text-[10px]">Resets dash cooldown ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hazards Guide */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono-data text-xs">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded bg-amber-500/10 text-amber-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white uppercase text-[11px] sm:text-xs">DYNAMIC ARENA HAZARDS:</span>
              <p className="text-slate-400 text-[10px] sm:text-[11px] mt-0.5">
                Watch for amber warnings before platforms collapse into void abyss. Avoid high-voltage electric nodes and plasma barriers.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right text-slate-400 text-[10px] sm:text-[11px]">
            <span>100 HP · 3 LIVES PER MATCH</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-4xl text-center text-[10px] sm:text-[11px] font-mono-data text-slate-400 z-10 mt-2">
        WORKS ON DESKTOP KEYBOARD, ANDROID PHONES & TABLETS, AND IPHONES
      </div>
    </div>
  );
};
