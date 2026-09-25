import React, { useState, useEffect } from 'react';
import {
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
} from 'lucide-react';
import { isMobileClient } from '../utils/fullscreen';

export interface BatteryState {
  level: number;
  charging: boolean;
}

interface BatteryIndicatorProps {
  className?: string;
  style?: React.CSSProperties;
}

export const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({
  className = '',
  style = {},
}) => {
  const [battery, setBattery] = useState<BatteryState | null>(null);
  const [isMobile] = useState<boolean>(() => isMobileClient());

  useEffect(() => {
    if (!isMobile) return;

    let batteryManager: any = null;
    let isMounted = true;

    const updateBatteryInfo = (manager: any) => {
      if (!isMounted || !manager) return;
      const level = Math.round((manager.level ?? 1) * 100);
      const charging = Boolean(manager.charging);
      setBattery({ level, charging });
    };

    // Query Battery Status API if supported
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
          if (isMounted) {
            setBattery({ level: 85, charging: false });
          }
        });
    } else {
      // Fallback for browsers without Battery Status API (e.g. Safari)
      setBattery({ level: 100, charging: false });
    }

    // Refresh battery telemetry every 30 seconds
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

  // Only display for mobile users as requested
  if (!isMobile || battery === null) {
    return null;
  }

  return (
    <div
      className={`pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/85 border border-slate-800 text-[9px] font-mono-data text-slate-300 backdrop-blur-md shadow-sm select-none z-30 ${className}`}
      style={{
        ...style,
      }}
      title={`Battery: ${battery.level}%${battery.charging ? ' (Charging)' : ''} • Updates every 30s`}
      aria-label={`Battery: ${battery.level}%`}
    >
      {battery.charging ? (
        <BatteryCharging className="w-2.5 h-2.5 text-emerald-400 shrink-0 animate-pulse" />
      ) : battery.level <= 20 ? (
        <BatteryLow className="w-2.5 h-2.5 text-rose-400 shrink-0" />
      ) : battery.level <= 60 ? (
        <BatteryMedium className="w-2.5 h-2.5 text-amber-400 shrink-0" />
      ) : (
        <BatteryFull className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
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
  );
};
