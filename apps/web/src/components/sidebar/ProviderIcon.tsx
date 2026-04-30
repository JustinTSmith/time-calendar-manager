'use client';

import type { CalendarProvider } from '@time-calendar-manager/types';

const CONFIG: Record<CalendarProvider, { bg: string; label: string }> = {
  google: { bg: '#DB4437', label: 'G' },
  microsoft: { bg: '#0078D4', label: 'M' },
  icloud: { bg: '#6B7280', label: 'A' },
  caldav: { bg: '#8B5CF6', label: 'C' },
};

interface Props {
  provider: CalendarProvider;
  size?: number;
}

export function ProviderIcon({ provider, size = 20 }: Props) {
  const { bg, label } = CONFIG[provider] ?? { bg: '#9CA3AF', label: '?' };
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.55 }}
    >
      {label}
    </span>
  );
}
