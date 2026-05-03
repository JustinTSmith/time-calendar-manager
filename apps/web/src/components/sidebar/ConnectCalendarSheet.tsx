'use client';

import type { CalendarProvider } from '@time-calendar-manager/types';
import { ProviderIcon } from './ProviderIcon';

const PROVIDERS: { provider: CalendarProvider; label: string }[] = [
  { provider: 'google', label: 'Google Calendar' },
  { provider: 'microsoft', label: 'Microsoft Outlook' },
  { provider: 'icloud', label: 'Apple iCloud' },
  { provider: 'caldav', label: 'CalDAV' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectCalendarSheet({ open, onOpenChange }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-80 bg-white shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Add Calendar</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-slate-500 mb-4">
            Connect a calendar account to get started.
          </p>
          <div className="space-y-2">
            {PROVIDERS.map(({ provider, label }) => (
              <button
                key={provider}
                type="button"
                disabled
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-slate-200 text-left hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ProviderIcon provider={provider} size={28} />
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-xs text-slate-400">Coming soon</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
