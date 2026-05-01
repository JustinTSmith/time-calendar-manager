'use client';

import * as Popover from '@radix-ui/react-popover';
import { format } from 'date-fns';
import { Edit2, Trash2, X, Calendar, Clock, MapPin, Users } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';
import { MOCK_CALENDARS } from '@/data/mockEvents';

interface EventPopoverProps {
  event: CalendarEvent;
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}

export function EventPopover({ event, children, onEdit, onDelete }: EventPopoverProps) {
  const calendar = MOCK_CALENDARS.find((c) => c.id === event.calendarId);
  const hasAttendees = event.attendees && event.attendees.length > 0;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 rounded-lg bg-white p-4 shadow-lg border border-slate-200"
          sideOffset={5}
          align="start"
        >
          {/* Header with color bar */}
          <div className="flex items-start gap-3">
            <div
              className="w-1 h-12 rounded-full shrink-0"
              style={{ backgroundColor: event.color }}
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">{event.title}</h3>
              <p className="text-sm text-slate-500">{calendar?.name || 'Unknown calendar'}</p>
            </div>
            <Popover.Close className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </Popover.Close>
          </div>

          {/* Event details */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>
                {format(event.startAt, 'EEEE, MMMM d')}
                {!event.isAllDay && (
                  <>
                    {' · '}
                    {format(event.startAt, 'h:mm a')} – {format(event.endAt, 'h:mm a')}
                  </>
                )}
              </span>
            </div>

            {event.location && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {hasAttendees && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users className="w-4 h-4 text-slate-400" />
                <span>{event.attendees?.length} attendee(s)</span>
              </div>
            )}

            {event.description && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-sm text-slate-600 line-clamp-3">{event.description}</p>
              </div>
            )}

            {event.recurrenceRule && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Repeats {event.recurrenceRule.includes('DAILY') ? 'daily' : event.recurrenceRule.includes('WEEKLY') ? 'weekly' : 'monthly'}</span>
              </div>
            )}
          </div>

          {/* RSVP buttons if attendees */}
          {hasAttendees && (
            <div className="mt-4 flex gap-2">
              <button className="flex-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors">
                Accept
              </button>
              <button className="flex-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors">
                Decline
              </button>
              <button className="flex-1 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors">
                Maybe
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
