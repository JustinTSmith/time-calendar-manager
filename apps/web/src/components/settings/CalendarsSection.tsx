'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import type { CalendarAccount } from '@/types/settings';

const PROVIDER_LABELS: Record<CalendarAccount['provider'], string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
};

const PROVIDER_COLORS: Record<CalendarAccount['provider'], string> = {
  google: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  microsoft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  apple: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

type Props = {
  onToast: (msg: string, type?: 'success' | 'error') => void;
};

export function CalendarsSection({ onToast }: Props) {
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/calendars/accounts');
      const data: CalendarAccount[] = await res.json();
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  async function handleDisconnect(id: string) {
    setDisconnecting(id);
    try {
      const res = await fetch(`/api/calendars/accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        onToast('Calendar account disconnected.');
      } else {
        onToast('Failed to disconnect account.', 'error');
      }
    } catch {
      onToast('Failed to disconnect account.', 'error');
    } finally {
      setDisconnecting(null);
      setConfirmId(null);
    }
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">Loading calendar accounts…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Connected Accounts</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage your connected calendar providers.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No calendar accounts connected.</p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add Calendar
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center justify-between px-4 py-4 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={clsx(
                    'shrink-0 rounded-md px-2 py-1 text-xs font-medium',
                    PROVIDER_COLORS[account.provider]
                  )}
                >
                  {PROVIDER_LABELS[account.provider]}
                </span>
                <span className="truncate text-sm text-slate-700 dark:text-slate-300">{account.email}</span>
                {account.status !== 'active' && (
                  <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
                    {account.status}
                  </span>
                )}
              </div>

              {confirmId === account.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Remove this account?</span>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(account.id)}
                    disabled={disconnecting === account.id}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {disconnecting === account.id ? 'Removing…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(account.id)}
                  className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                >
                  Disconnect
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Calendar Account
      </button>
    </div>
  );
}
