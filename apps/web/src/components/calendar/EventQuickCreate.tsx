'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { format } from 'date-fns';
import { X, ChevronRight } from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import { MOCK_CALENDARS } from '@/data/mockEvents';
import { calculateEndTime, getDefaultDuration } from '@/lib/eventUtils';

const DURATION_OPTIONS = [
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
] as const;

export function EventQuickCreate() {
  const {
    draftEvent,
    isQuickCreateOpen,
    quickCreatePosition,
    closeQuickCreate,
    addEvent,
    openEventModalFromDraft,
  } = useCalendarStore();

  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [calendarId, setCalendarId] = useState(MOCK_CALENDARS[0]?.id || '');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (isQuickCreateOpen) {
      setTitle('');
      setDuration(30);
      setCalendarId(draftEvent?.calendarId || MOCK_CALENDARS[0]?.id || '');
      // Focus title input after a short delay to allow popover to mount
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isQuickCreateOpen, draftEvent]);

  const handleSave = useCallback(() => {
    if (!title.trim() || !draftEvent?.startAt) return;

    const startAt = draftEvent.startAt;
    const endAt = calculateEndTime(startAt, duration);
    const calendar = MOCK_CALENDARS.find((c) => c.id === calendarId);

    addEvent({
      title: title.trim(),
      startAt,
      endAt,
      calendarId,
      color: calendar?.color || '#4285F4',
      isTimeBlock: false,
      isAllDay: false,
    });

    closeQuickCreate();
  }, [title, duration, calendarId, draftEvent, addEvent, closeQuickCreate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        closeQuickCreate();
      }
    },
    [handleSave, closeQuickCreate]
  );

  const handleMoreOptions = useCallback(() => {
    if (!draftEvent?.startAt) return;

    const startAt = draftEvent.startAt;
    const endAt = calculateEndTime(startAt, duration);
    const calendar = MOCK_CALENDARS.find((c) => c.id === calendarId);

    // Update draft event with current values before opening modal
    useCalendarStore.setState({
      draftEvent: {
        ...draftEvent,
        title: title.trim() || undefined,
        endAt,
        calendarId,
        color: calendar?.color || '#4285F4',
        isTimeBlock: false,
        isAllDay: false,
      },
    });

    openEventModalFromDraft();
  }, [draftEvent, duration, calendarId, title, openEventModalFromDraft]);

  if (!isQuickCreateOpen || !draftEvent?.startAt || !quickCreatePosition) {
    return null;
  }

  const selectedCalendar = MOCK_CALENDARS.find((c) => c.id === calendarId);

  return (
    <Popover.Root open={isQuickCreateOpen} onOpenChange={(open) => !open && closeQuickCreate()}>
      <Popover.Trigger asChild>
        <div style={{ position: 'fixed', left: quickCreatePosition.x, top: quickCreatePosition.y }} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 rounded-lg bg-white p-4 shadow-lg border border-slate-200"
          sideOffset={5}
          align="start"
          onEscapeKeyDown={closeQuickCreate}
          onPointerDownOutside={closeQuickCreate}
        >
          {/* Title input */}
          <div className="flex items-center gap-2 mb-4">
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add title"
              className="flex-1 text-lg font-semibold placeholder:text-slate-400 border-none outline-none focus:ring-0 p-0"
            />
            <Popover.Close className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </Popover.Close>
          </div>

          {/* Date and time */}
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
            <span>{format(draftEvent.startAt, 'EEEE, MMMM d')}</span>
            <span>·</span>
            <span>{format(draftEvent.startAt, 'h:mm a')}</span>
            <span>–</span>
            <span>{format(calculateEndTime(draftEvent.startAt, duration), 'h:mm a')}</span>
          </div>

          {/* Duration buttons */}
          <div className="flex gap-2 mb-4">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.minutes}
                onClick={() => setDuration(option.minutes)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  duration === option.minutes
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Calendar selector */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
              Calendar
            </label>
            <div className="relative">
              <select
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {MOCK_CALENDARS.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedCalendar?.color }}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleMoreOptions}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
            >
              More options
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
