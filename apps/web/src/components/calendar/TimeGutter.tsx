'use client';

import { HOUR_HEIGHT, HOURS } from '@/lib/constants';

export function TimeGutter() {
  return (
    <div className="relative shrink-0 select-none" style={{ width: 52 }}>
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute right-2 text-xs text-slate-400 -translate-y-2"
          style={{ top: hour * HOUR_HEIGHT }}
        >
          {hour === 0 ? null : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
        </div>
      ))}
    </div>
  );
}
