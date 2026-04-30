'use client';

import { create } from 'zustand';
import type { CalendarView } from '@/types/calendar';
import { prevWeek, nextWeek } from '@/lib/dateUtils';

interface CalendarStore {
  view: CalendarView;
  currentDate: Date;
  visibleCalendarIds: string[];

  setView: (view: CalendarView) => void;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToToday: () => void;
  setVisibleCalendarIds: (ids: string[]) => void;
}

export const useCalendarStore = create<CalendarStore>((set) => ({
  view: 'week',
  currentDate: new Date(),
  visibleCalendarIds: ['cal-work', 'cal-personal'],

  setView: (view) => set({ view }),
  goToPrevWeek: () => set((s) => ({ currentDate: prevWeek(s.currentDate) })),
  goToNextWeek: () => set((s) => ({ currentDate: nextWeek(s.currentDate) })),
  goToToday: () => set({ currentDate: new Date() }),
  setVisibleCalendarIds: (ids) => set({ visibleCalendarIds: ids }),
}));
