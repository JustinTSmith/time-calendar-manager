'use client';

import { formatWeekRangeLabel } from '@/lib/dateUtils';

interface WeekNavBarProps {
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function WeekNavBar({ currentDate, onPrev, onNext, onToday }: WeekNavBarProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToday}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Today
      </button>
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          aria-label="Previous week"
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onNext}
          aria-label="Next week"
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <h2 className="text-base font-semibold text-slate-800">
        {formatWeekRangeLabel(currentDate)}
      </h2>
    </div>
  );
}
