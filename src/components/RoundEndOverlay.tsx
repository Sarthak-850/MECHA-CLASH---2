import React from 'react';

interface RoundEndOverlayProps {
  winner: 'VEX' | 'NOVA' | null;
  round: number;
}

export const RoundEndOverlay: React.FC<RoundEndOverlayProps> = ({
  winner,
  round,
}) => {
  const isWon = winner === 'VEX';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 select-none">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" />

      <div className="relative flex flex-col items-center">
        <span className="font-display font-semibold text-xs text-slate-400 tracking-widest uppercase mb-1">
          ROUND {round} COMPLETE
        </span>

        {isWon ? (
          <div className="font-display font-black text-3xl xs:text-4xl sm:text-6xl md:text-7xl text-cyan-400 tracking-wider drop-shadow-[0_0_30px_rgba(6,182,212,0.8)] glow-cyan text-center">
            ROUND WON
          </div>
        ) : (
          <div className="font-display font-black text-3xl xs:text-4xl sm:text-6xl md:text-7xl text-red-500 tracking-wider drop-shadow-[0_0_30px_rgba(239,68,68,0.8)] glow-crimson text-center">
            ROUND LOST
          </div>
        )}

        <span className="text-xs text-slate-400 font-mono-data tracking-wide mt-3 animate-pulse">
          PREPARING NEXT ROUND...
        </span>
      </div>
    </div>
  );
};
