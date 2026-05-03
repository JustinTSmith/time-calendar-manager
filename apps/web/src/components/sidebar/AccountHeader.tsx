'use client';

import type { CalendarAccountDto } from '@time-calendar-manager/types';
import { ProviderIcon } from './ProviderIcon';

interface Props {
  account: CalendarAccountDto;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function AccountHeader({ account, isCollapsed, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 rounded-md group"
    >
      <ProviderIcon provider={account.provider} />
      <span className="flex-1 truncate text-sm font-medium text-slate-700 text-left">
        {account.email ?? account.provider}
      </span>
      <svg
        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
        viewBox="0 0 16 16"
        fill="none"
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
