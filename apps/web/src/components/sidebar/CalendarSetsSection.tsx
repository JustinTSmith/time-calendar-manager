'use client';

import type { CalendarSetDto } from '@time-calendar-manager/types';
import { CalendarSetChip } from './CalendarSetChip';

interface Props {
  calendarSets: CalendarSetDto[];
}

export function CalendarSetsSection({ calendarSets }: Props) {
  if (calendarSets.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Calendar Sets
        </span>
        <button
          type="button"
          className="text-xs text-blue-500 hover:text-blue-600 font-medium"
        >
          + New Set
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {calendarSets.map((set, i) => (
          <CalendarSetChip key={set.id} set={set} index={i} />
        ))}
      </div>
    </div>
  );
}
