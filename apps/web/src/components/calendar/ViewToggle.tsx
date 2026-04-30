'use client';

import type { CalendarView } from '@/types/calendar';
import { clsx } from 'clsx';

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

interface ViewToggleProps {
  current: CalendarView;
  onChange: (view: CalendarView) => void;
}

export function ViewToggle({ current, onChange }: ViewToggleProps) {
  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
      {VIEWS.map((v) => (
        <button
          key={v.value}
          aria-pressed={current === v.value}
          onClick={() => onChange(v.value)}
          className={clsx(
            'px-3 py-1.5 font-medium transition-colors',
            current === v.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
