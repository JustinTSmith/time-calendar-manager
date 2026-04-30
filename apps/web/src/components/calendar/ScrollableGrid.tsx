'use client';

import { useEffect, useRef } from 'react';
import { isSameDay } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';
import { DayColumn } from './DayColumn';
import { TimeGutter } from './TimeGutter';
import { HOUR_HEIGHT, TOTAL_HEIGHT } from '@/lib/constants';

interface ScrollableGridProps {
  days: Date[];
  timedEvents: CalendarEvent[];
  today: Date;
}

export function ScrollableGrid({ days, timedEvents, today }: ScrollableGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to 8am on initial render
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * HOUR_HEIGHT;
    }
  }, []);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="flex" style={{ height: TOTAL_HEIGHT }}>
        <TimeGutter />
        {days.map((day) => (
          <DayColumn
            key={day.toISOString()}
            day={day}
            isToday={isSameDay(day, today)}
            events={timedEvents}
          />
        ))}
      </div>
    </div>
  );
}
