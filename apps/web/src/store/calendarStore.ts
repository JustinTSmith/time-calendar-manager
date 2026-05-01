'use client';

import { create } from 'zustand';
import type { CalendarEvent, CalendarView } from '@/types/calendar';
import { prevWeek, nextWeek } from '@/lib/dateUtils';
import { MOCK_EVENTS } from '@/data/mockEvents';

interface CalendarStore {
  view: CalendarView;
  currentDate: Date;
  visibleCalendarIds: string[];
  events: CalendarEvent[];
  
  // Modal/Popover state
  selectedEventId: string | null;
  isEventModalOpen: boolean;
  draftEvent: Partial<CalendarEvent> | null;
  isQuickCreateOpen: boolean;
  quickCreatePosition: { x: number; y: number } | null;

  setView: (view: CalendarView) => void;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToToday: () => void;
  setVisibleCalendarIds: (ids: string[]) => void;
  
  // Event CRUD
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  deleteEventRecurring: (id: string, scope: 'this' | 'following' | 'all') => void;
  
  // Modal/Popover actions
  openEventModal: (eventId?: string | null) => void;
  closeEventModal: () => void;
  openQuickCreate: (draft: Partial<CalendarEvent>, position: { x: number; y: number }) => void;
  closeQuickCreate: () => void;
  openEventModalFromDraft: () => void;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  view: 'week',
  currentDate: new Date(),
  visibleCalendarIds: ['cal-work', 'cal-personal'],
  events: MOCK_EVENTS,
  
  selectedEventId: null,
  isEventModalOpen: false,
  draftEvent: null,
  isQuickCreateOpen: false,
  quickCreatePosition: null,

  setView: (view) => set({ view }),
  goToPrevWeek: () => set((s) => ({ currentDate: prevWeek(s.currentDate) })),
  goToNextWeek: () => set((s) => ({ currentDate: nextWeek(s.currentDate) })),
  goToToday: () => set({ currentDate: new Date() }),
  setVisibleCalendarIds: (ids) => set({ visibleCalendarIds: ids }),
  
  addEvent: (event) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set((state) => ({ events: [...state.events, newEvent] }));
  },
  
  updateEvent: (id, updates) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    }));
  },
  
  deleteEvent: (id) => {
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
    }));
  },
  
  deleteEventRecurring: (id, scope) => {
    // For now, simple delete. In real implementation, would handle recurrence logic
    if (scope === 'this') {
      get().deleteEvent(id);
    } else if (scope === 'following' || scope === 'all') {
      get().deleteEvent(id);
    }
  },
  
  openEventModal: (eventId = null) => {
    set({ 
      selectedEventId: eventId, 
      isEventModalOpen: true,
      isQuickCreateOpen: false,
    });
  },
  
  closeEventModal: () => {
    set({ 
      isEventModalOpen: false, 
      selectedEventId: null,
      draftEvent: null,
    });
  },
  
  openQuickCreate: (draft, position) => {
    set({
      draftEvent: draft,
      isQuickCreateOpen: true,
      quickCreatePosition: position,
    });
  },
  
  closeQuickCreate: () => {
    set({
      isQuickCreateOpen: false,
      draftEvent: null,
      quickCreatePosition: null,
    });
  },
  
  openEventModalFromDraft: () => {
    const { draftEvent } = get();
    if (draftEvent) {
      set({
        isQuickCreateOpen: false,
        selectedEventId: null,
        isEventModalOpen: true,
      });
    }
  },
}));
