'use client';

import * as Popover from '@radix-ui/react-popover';
import { CALENDAR_COLORS } from '@/lib/calendarColors';
import { ColorDot } from './ColorDot';

interface Props {
  currentColor: string | null;
  onSelect: (color: string) => void;
}

export function ColorPickerPopover({ currentColor, onSelect }: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <span>
          <ColorDot color={currentColor} onClick={() => {}} />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 p-2 bg-white rounded-lg shadow-lg border border-slate-200 w-[116px]"
          sideOffset={6}
          align="start"
        >
          <div className="grid grid-cols-4 gap-1.5">
            {CALENDAR_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                className="w-6 h-6 rounded-full ring-1 ring-black/10 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{
                  backgroundColor: hex,
                  boxShadow: currentColor === hex ? `0 0 0 2px white, 0 0 0 4px ${hex}` : undefined,
                }}
                onClick={() => onSelect(hex)}
                aria-label={hex}
              />
            ))}
          </div>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
