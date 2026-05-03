'use client';

import { isSameDay, format } from 'date-fns';
import { clsx } from 'clsx';
import { TIME_GUTTER_WIDTH } from '@/lib/constants';

interface WeekHeaderProps {
  days: Date[];
  today: Date;
}

export function WeekHeader({ days, today }: WeekHeaderProps) {
  return (
    <div className="flex border-b border-slate-200 bg-white sticky top-0 z-20">
      {/* Spacer to align with the time gutter */}
      <div className="shrink-0 border-r border-slate-200" style={{ width: TIME_GUTTER_WIDTH }} />
      {days.map((day) => {
        const isToday = isSameDay(day, today);
        return (
          <div
            key={day.toISOString()}
            className="flex flex-1 flex-col items-center py-2 border-r border-slate-200 last:border-r-0"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {format(day, 'EEE')}
            </span>
            <span
              className={clsx(
                'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                isToday
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-800',
              )}
            >
              {format(day, 'd')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
