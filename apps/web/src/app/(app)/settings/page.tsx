'use client';

import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { useSettings } from '@/hooks/useSettings';
import { Toast } from '@/components/ui/Toast';
import { GeneralSection } from '@/components/settings/GeneralSection';
import { WorkingHoursEditor } from '@/components/settings/WorkingHoursEditor';
import { ThemeToggle } from '@/components/settings/ThemeToggle';
import { CalendarsSection } from '@/components/settings/CalendarsSection';
import type { UserSettings } from '@/types/settings';

type Tab = 'general' | 'working-hours' | 'appearance' | 'calendars';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general',       label: 'General' },
  { id: 'working-hours', label: 'Working Hours' },
  { id: 'appearance',    label: 'Appearance' },
  { id: 'calendars',     label: 'Calendars' },
];

type ToastState = { message: string; type: 'success' | 'error'; key: number } | null;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [toast, setToast] = useState<ToastState>(null);
  const { settings, loading, save } = useSettings();

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  const handleSave = useCallback(
    async (patch: Partial<UserSettings>) => {
      return save(patch);
    },
    [save]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your profile, working hours, and preferences.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {loading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
              <p className="mt-3 text-sm text-slate-400">Loading settings…</p>
            </div>
          ) : !settings ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Failed to load settings.
            </div>
          ) : (
            <>
              {activeTab === 'general' && (
                <GeneralSection settings={settings} onSave={handleSave} onToast={showToast} />
              )}
              {activeTab === 'working-hours' && (
                <WorkingHoursEditor settings={settings} onSave={handleSave} onToast={showToast} />
              )}
              {activeTab === 'appearance' && (
                <div className="space-y-8">
                  <ThemeToggle />
                </div>
              )}
              {activeTab === 'calendars' && (
                <CalendarsSection onToast={showToast} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
