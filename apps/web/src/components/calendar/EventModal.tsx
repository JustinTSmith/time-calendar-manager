'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  format,
  setHours,
  setMinutes,
  startOfDay,
  isSameDay,
  addMinutes,
} from 'date-fns';
import {
  X,
  MapPin,
  AlignLeft,
  Bell,
  Users,
  Video,
  Calendar,
  Clock,
  Trash2,
  ChevronDown,
  Plus,
  XCircle,
} from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import { MOCK_CALENDARS } from '@/data/mockEvents';
import type { CalendarEvent, RecurrenceType, Attendee, Reminder } from '@/types/calendar';
import {
  snapTo15Minutes,
  generateRecurrenceRule,
  getDurationMinutes,
} from '@/lib/eventUtils';

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom...' },
];

const REMINDER_OPTIONS = [
  { minutes: 0, label: 'At time of event' },
  { minutes: 5, label: '5 minutes before' },
  { minutes: 10, label: '10 minutes before' },
  { minutes: 15, label: '15 minutes before' },
  { minutes: 30, label: '30 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 120, label: '2 hours before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 2880, label: '2 days before' },
  { minutes: 10080, label: '1 week before' },
];

interface EventModalProps {
  // Event to edit, or null for creating new
  event: CalendarEvent | null;
  // Draft event from quick create (when opening from "More options")
  draftEvent?: Partial<CalendarEvent> | null;
}

export function EventModal({ event, draftEvent }: EventModalProps) {
  const { isEventModalOpen, closeEventModal, addEvent, updateEvent, deleteEvent, deleteEventRecurring } =
    useCalendarStore();

  // Form state
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState<Date>(new Date());
  const [endAt, setEndAt] = useState<Date>(new Date());
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [calendarId, setCalendarId] = useState(MOCK_CALENDARS[0]?.id || '');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [videoConferencing, setVideoConferencing] = useState<'google-meet' | 'zoom' | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('');

  // UI state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isEditing = !!event;
  const isRecurring = !!event?.recurrenceRule;

  // Initialize form when modal opens
  useEffect(() => {
    if (!isEventModalOpen) return;

    if (event) {
      // Editing existing event
      setTitle(event.title);
      setStartAt(event.startAt);
      setEndAt(event.endAt);
      setIsAllDay(event.isAllDay);
      setLocation(event.location || '');
      setDescription(event.description || '');
      setCalendarId(event.calendarId);
      setRecurrenceType(event.recurrenceType || (event.recurrenceRule ? 'custom' : 'none'));
      setVideoConferencing(event.videoConferencing || null);
      setReminders(event.reminders || []);
      setAttendees(event.attendees || []);
    } else if (draftEvent?.startAt) {
      // Creating from draft (quick create "More options")
      setTitle(draftEvent.title || '');
      setStartAt(draftEvent.startAt);
      setEndAt(draftEvent.endAt || addMinutes(draftEvent.startAt, 30));
      setIsAllDay(draftEvent.isAllDay || false);
      setLocation(draftEvent.location || '');
      setDescription(draftEvent.description || '');
      setCalendarId(draftEvent.calendarId || MOCK_CALENDARS[0]?.id || '');
      setRecurrenceType(draftEvent.recurrenceType || 'none');
      setVideoConferencing(draftEvent.videoConferencing || null);
      setReminders(draftEvent.reminders || []);
      setAttendees(draftEvent.attendees || []);
    } else {
      // Creating new event (default to current time rounded to 15 min)
      const now = new Date();
      const rounded = snapTo15Minutes(now);
      setTitle('');
      setStartAt(rounded);
      setEndAt(addMinutes(rounded, 30));
      setIsAllDay(false);
      setLocation('');
      setDescription('');
      setCalendarId(MOCK_CALENDARS[0]?.id || '');
      setRecurrenceType('none');
      setVideoConferencing(null);
      setReminders([]);
      setAttendees([]);
    }

    setIsDirty(false);
    setShowDeleteConfirm(false);
    setShowDiscardConfirm(false);
  }, [isEventModalOpen, event, draftEvent]);

  // Track form changes
  useEffect(() => {
    if (isEventModalOpen) {
      setIsDirty(true);
    }
  }, [title, startAt, endAt, isAllDay, location, description, calendarId, recurrenceType, videoConferencing, reminders, attendees]);

  const selectedCalendar = useMemo(
    () => MOCK_CALENDARS.find((c) => c.id === calendarId),
    [calendarId]
  );

  const handleSave = useCallback(() => {
    if (!title.trim()) return;

    const eventData = {
      title: title.trim(),
      startAt,
      endAt,
      calendarId,
      color: selectedCalendar?.color || '#4285F4',
      isTimeBlock: false,
      isAllDay,
      location: location || undefined,
      description: description || undefined,
      recurrenceRule:
        recurrenceType !== 'none' && recurrenceType !== 'custom'
          ? generateRecurrenceRule(recurrenceType, startAt)
          : undefined,
      recurrenceType,
      attendees: attendees.length > 0 ? attendees : undefined,
      reminders: reminders.length > 0 ? reminders : undefined,
      videoConferencing: videoConferencing || undefined,
    };

    if (isEditing && event) {
      updateEvent(event.id, eventData);
    } else {
      addEvent(eventData);
    }

    closeEventModal();
  }, [
    title,
    startAt,
    endAt,
    calendarId,
    selectedCalendar,
    isAllDay,
    location,
    description,
    recurrenceType,
    attendees,
    reminders,
    videoConferencing,
    isEditing,
    event,
    addEvent,
    updateEvent,
    closeEventModal,
  ]);

  const handleDelete = useCallback(
    (scope: 'this' | 'following' | 'all') => {
      if (!event) return;
      deleteEventRecurring(event.id, scope);
      setShowDeleteConfirm(false);
      closeEventModal();
    },
    [event, deleteEventRecurring, closeEventModal]
  );

  const handleClose = useCallback(() => {
    if (isDirty && !isEditing) {
      setShowDiscardConfirm(true);
    } else {
      closeEventModal();
    }
  }, [isDirty, isEditing, closeEventModal]);

  const addReminder = useCallback(() => {
    setReminders((prev) => [...prev, { method: 'notification', minutesBefore: 10 }]);
  }, []);

  const removeReminder = useCallback((index: number) => {
    setReminders((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateReminder = useCallback((index: number, updates: Partial<Reminder>) => {
    setReminders((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r))
    );
  }, []);

  const addAttendee = useCallback(() => {
    const email = newAttendeeEmail.trim();
    if (!email || !email.includes('@')) return;
    setAttendees((prev) => [...prev, { email, status: 'needsAction' }]);
    setNewAttendeeEmail('');
  }, [newAttendeeEmail]);

  const removeAttendee = useCallback((email: string) => {
    setAttendees((prev) => prev.filter((a) => a.email !== email));
  }, []);

  const handleAttendeeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addAttendee();
      }
    },
    [addAttendee]
  );

  return (
    <Dialog.Root open={isEventModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              {isEditing ? 'Edit event' : 'Add event'}
            </Dialog.Title>
            <Dialog.Close
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Form */}
          <div className="p-6 space-y-5">
            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add title"
              className="w-full text-xl font-semibold placeholder:text-slate-400 border-b border-slate-200 pb-2 outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />

            {/* Date/Time section */}
            <div className="space-y-3">
              {/* All-day toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">All day</span>
              </label>

              {/* Date/Time inputs */}
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={format(startAt, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const newDate = new Date(startAt);
                      newDate.setFullYear(year, month - 1, day);
                      setStartAt(newDate);
                      if (endAt < newDate) {
                        setEndAt(addMinutes(newDate, 30));
                      }
                    }}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {!isAllDay && (
                    <input
                      type="time"
                      value={format(startAt, 'HH:mm')}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const newDate = setMinutes(setHours(startAt, hours), minutes);
                        setStartAt(newDate);
                      }}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  )}
                </div>
              </div>

              {!isAllDay && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={format(endAt, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const [year, month, day] = e.target.value.split('-').map(Number);
                        const newDate = new Date(endAt);
                        newDate.setFullYear(year, month - 1, day);
                        setEndAt(newDate);
                      }}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <input
                      type="time"
                      value={format(endAt, 'HH:mm')}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const newDate = setMinutes(setHours(endAt, hours), minutes);
                        setEndAt(newDate);
                      }}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Calendar selector */}
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full shrink-0"
                style={{ backgroundColor: selectedCalendar?.color }}
              />
              <select
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                {MOCK_CALENDARS.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="flex items-start gap-3">
              <AlignLeft className="w-5 h-5 text-slate-400 mt-2" />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description"
                rows={3}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Recurrence */}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Video conferencing */}
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-slate-400" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setVideoConferencing(videoConferencing === 'google-meet' ? null : 'google-meet')
                  }
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    videoConferencing === 'google-meet'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Google Meet
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVideoConferencing(videoConferencing === 'zoom' ? null : 'zoom')
                  }
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    videoConferencing === 'zoom'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Zoom
                </button>
              </div>
            </div>

            {/* Reminders */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Reminders</span>
              </div>
              <div className="pl-8 space-y-2">
                {reminders.map((reminder, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={reminder.method}
                      onChange={(e) =>
                        updateReminder(index, { method: e.target.value as 'email' | 'notification' })
                      }
                      className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                    >
                      <option value="notification">Notification</option>
                      <option value="email">Email</option>
                    </select>
                    <select
                      value={reminder.minutesBefore}
                      onChange={(e) =>
                        updateReminder(index, { minutesBefore: Number(e.target.value) })
                      }
                      className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                    >
                      {REMINDER_OPTIONS.map((opt) => (
                        <option key={opt.minutes} value={opt.minutes}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeReminder(index)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addReminder}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add reminder
                </button>
              </div>
            </div>

            {/* Attendees */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Attendees</span>
              </div>
              <div className="pl-8 space-y-2">
                {attendees.map((attendee) => (
                  <div
                    key={attendee.email}
                    className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded-md"
                  >
                    <span className="flex-1 text-sm text-slate-700">{attendee.email}</span>
                    <button
                      onClick={() => removeAttendee(attendee.email)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={newAttendeeEmail}
                    onChange={(e) => setNewAttendeeEmail(e.target.value)}
                    onKeyDown={handleAttendeeKeyDown}
                    placeholder="Add email and press Enter"
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    onClick={addAttendee}
                    disabled={!newAttendeeEmail.includes('@')}
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
            {isEditing ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {isEditing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>

          {/* Delete confirmation for recurring events */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 bg-white/95 flex items-center justify-center p-6 rounded-xl">
              <div className="w-full max-w-sm space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  Delete recurring event
                </h3>
                <p className="text-sm text-slate-600">
                  This is a recurring event. What would you like to delete?
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleDelete('this')}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    This event only
                  </button>
                  <button
                    onClick={() => handleDelete('following')}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    This and following events
                  </button>
                  <button
                    onClick={() => handleDelete('all')}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    All events in the series
                  </button>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Discard changes confirmation */}
          {showDiscardConfirm && (
            <div className="absolute inset-0 bg-white/95 flex items-center justify-center p-6 rounded-xl">
              <div className="w-full max-w-sm space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Discard changes?</h3>
                <p className="text-sm text-slate-600">
                  You have unsaved changes. Are you sure you want to discard them?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDiscardConfirm(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                  >
                    Keep editing
                  </button>
                  <button
                    onClick={() => {
                      setShowDiscardConfirm(false);
                      closeEventModal();
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
