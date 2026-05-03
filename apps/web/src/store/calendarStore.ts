'use client';

import { create } from 'zustand';
import type { CalendarView } from '@/types/calendar';
import { prevWeek, nextWeek } from '@/lib/dateUtils';

interface CalendarStore {
  view: CalendarView;
  currentDate: Date;
  visibleCalendarIds: Set<string>;

  setView: (view: CalendarView) => void;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToToday: () => void;
  initVisibility: (ids: string[]) => void;
  toggleCalendarVisibility: (id: string) => void;
  setCalendarSetVisible: (ids: string[], visible: boolean) => void;
}

export const useCalendarStore = create<CalendarStore>((set) => ({
  view: 'week',
  currentDate: new Date(),
  visibleCalendarIds: new Set<string>(),

  setView: (view) => set({ view }),
  goToPrevWeek: () => set((s) => ({ currentDate: prevWeek(s.currentDate) })),
  goToNextWeek: () => set((s) => ({ currentDate: nextWeek(s.currentDate) })),
  goToToday: () => set({ currentDate: new Date() }),

  initVisibility: (ids) => set({ visibleCalendarIds: new Set(ids) }),

  toggleCalendarVisibility: (id) =>
    set((s) => {
      const next = new Set(s.visibleCalendarIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { visibleCalendarIds: next };
    }),

  setCalendarSetVisible: (ids, visible) =>
    set((s) => {
      const next = new Set(s.visibleCalendarIds);
      for (const id of ids) {
        if (visible) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return { visibleCalendarIds: next };
    }),
}));
