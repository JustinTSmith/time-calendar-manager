'use client';

import { useEffect, useState } from 'react';
import { useCalendarsQuery } from '@/hooks/useCalendars';
import { useCalendarStore } from '@/store/calendarStore';
import { CalendarSetsSection } from './CalendarSetsSection';
import { AccountSection } from './AccountSection';
import { ConnectCalendarSheet } from './ConnectCalendarSheet';

function SidebarSkeleton() {
  return (
    <div className="p-3 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-100 rounded-md" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 bg-slate-100 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function CalendarSidebar() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { data, isLoading } = useCalendarsQuery();
  const initVisibility = useCalendarStore((s) => s.initVisibility);

  useEffect(() => {
    if (data) {
      const visibleIds = data.accounts.flatMap((acct) =>
        acct.calendars.filter((cal) => cal.isVisible).map((cal) => cal.id),
      );
      initVisibility(visibleIds);
    }
  }, [data, initVisibility]);

  return (
    <aside className="w-64 h-full flex flex-col border-r border-slate-200 bg-white shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-100">
        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className="flex items-center gap-1.5 w-full px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add Calendar
        </button>
      </div>

      {isLoading ? (
        <SidebarSkeleton />
      ) : data ? (
        <div className="flex-1">
          {data.calendarSets.length > 0 && (
            <CalendarSetsSection calendarSets={data.calendarSets} />
          )}
          <div className="py-1">
            {data.accounts.map((account) => (
              <AccountSection key={account.id} account={account} />
            ))}
          </div>
          {data.accounts.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-slate-400">No calendars connected yet.</p>
              <button
                type="button"
                onClick={() => setIsSheetOpen(true)}
                className="mt-2 text-sm text-blue-500 hover:text-blue-600"
              >
                Add one now →
              </button>
            </div>
          )}
        </div>
      ) : null}

      <ConnectCalendarSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} />
    </aside>
  );
}
