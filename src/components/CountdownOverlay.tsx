import React from 'react';

interface CountdownOverlayProps {
  round: number;
  count: number; // 3, 2, 1, 0 (FIGHT)
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  round,
  count,
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 select-none">
      {/* Subtle radial shadow backdrop */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />

      <div className="relative flex flex-col items-center animate-pulse">
        <span className="font-display font-bold text-sm sm:text-base text-cyan-400 tracking-widest uppercase mb-2">
          ROUND {round}
        </span>

        {count > 0 ? (
          <div className="font-display font-black text-5xl xs:text-6xl sm:text-8xl text-white tracking-tighter drop-shadow-[0_0_35px_rgba(6,182,212,0.8)]">
            {count}
          </div>
        ) : (
          <div className="font-display font-black text-4xl xs:text-5xl sm:text-7xl text-amber-400 tracking-wider drop-shadow-[0_0_40px_rgba(245,158,11,0.9)] animate-bounce">
            FIGHT!
          </div>
        )}
      </div>
    </div>
  );
};
