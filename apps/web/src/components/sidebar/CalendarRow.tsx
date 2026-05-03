'use client';

import * as Checkbox from '@radix-ui/react-checkbox';
import type { CalendarDto } from '@time-calendar-manager/types';
import { useCalendarStore } from '@/store/calendarStore';
import { usePatchCalendar } from '@/hooks/useCalendars';
import { ColorPickerPopover } from './ColorPickerPopover';

interface Props {
  calendar: CalendarDto;
}

export function CalendarRow({ calendar }: Props) {
  const visibleCalendarIds = useCalendarStore((s) => s.visibleCalendarIds);
  const toggleCalendarVisibility = useCalendarStore((s) => s.toggleCalendarVisibility);
  const { mutate: patchCalendar } = usePatchCalendar();

  const isVisible = visibleCalendarIds.has(calendar.id);

  function handleVisibilityChange(checked: boolean) {
    toggleCalendarVisibility(calendar.id);
    patchCalendar({ id: calendar.id, is_visible: checked });
  }

  function handleColorSelect(color: string) {
    patchCalendar({ id: calendar.id, color });
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-50 group">
      <ColorPickerPopover currentColor={calendar.color} onSelect={handleColorSelect} />
      <span className="flex-1 truncate text-sm text-slate-700 select-none">{calendar.name}</span>
      <Checkbox.Root
        checked={isVisible}
        onCheckedChange={(v) => handleVisibilityChange(v === true)}
        className="w-4 h-4 rounded border border-slate-300 bg-white data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 shrink-0"
        aria-label={`Show ${calendar.name}`}
      >
        <Checkbox.Indicator>
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Checkbox.Indicator>
      </Checkbox.Root>
    </div>
  );
}
