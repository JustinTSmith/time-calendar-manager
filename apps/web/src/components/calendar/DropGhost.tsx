'use client';

import { format } from 'date-fns';

interface DropGhostProps {
  top: number;
  height: number;
  title: string;
  durationMinutes: number;
}

export function DropGhost({ top, height, title, durationMinutes }: DropGhostProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 overflow-hidden rounded border-2 border-dashed border-indigo-400 bg-indigo-100/80 px-2 py-1"
      style={{
        top,
        height: Math.max(height, 24),
      }}
    >
      <p className="truncate text-xs font-medium text-indigo-900">{title}</p>
      <p className="truncate text-xs text-indigo-700">
        {durationMinutes} min
      </p>
    </div>
  );
}
