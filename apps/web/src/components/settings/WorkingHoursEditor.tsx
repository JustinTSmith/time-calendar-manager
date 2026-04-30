'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { WorkingHours, DaySchedule, UserSettings } from '@/types/settings';

const DAYS = [
  { key: 'monday',    label: 'Mon' },
  { key: 'tuesday',   label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday',  label: 'Thu' },
  { key: 'friday',    label: 'Fri' },
  { key: 'saturday',  label: 'Sat' },
  { key: 'sunday',    label: 'Sun' },
] as const;

type DayKey = typeof DAYS[number]['key'];

type Props = {
  settings: UserSettings;
  onSave: (patch: Partial<UserSettings>) => Promise<{ success: boolean }>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
};

export function WorkingHoursEditor({ settings, onSave, onToast }: Props) {
  const [hours, setHours] = useState<WorkingHours>(settings.workingHours);

  useEffect(() => {
    setHours(settings.workingHours);
  }, [settings.workingHours]);

  function update(day: DayKey, patch: Partial<DaySchedule>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  function applyToWeekdays() {
    const mon = hours.monday;
    setHours((prev) => ({
      ...prev,
      tuesday:   { ...prev.tuesday,   start: mon.start, end: mon.end },
      wednesday: { ...prev.wednesday, start: mon.start, end: mon.end },
      thursday:  { ...prev.thursday,  start: mon.start, end: mon.end },
      friday:    { ...prev.friday,    start: mon.start, end: mon.end },
    }));
  }

  async function handleSave() {
    const result = await onSave({ workingHours: hours });
    onToast(result.success ? 'Working hours saved.' : 'Failed to save.', result.success ? 'success' : 'error');
  }

  const timeInputClass =
    'rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Day</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Start</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500 dark:text-slate-400">—</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">End</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500 dark:text-slate-400">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {DAYS.map(({ key, label }) => {
              const day = hours[key];
              return (
                <tr
                  key={key}
                  className={clsx(
                    'transition-colors',
                    !day.enabled && 'opacity-50'
                  )}
                >
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 w-16">{label}</td>
                  <td className="px-4 py-3">
                    {day.enabled ? (
                      <input
                        type="time"
                        value={day.start}
                        onChange={(e) => update(key, { start: e.target.value })}
                        className={timeInputClass}
                        disabled={!day.enabled}
                      />
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600 italic text-xs">Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400">
                    {day.enabled && '—'}
                  </td>
                  <td className="px-4 py-3">
                    {day.enabled && (
                      <input
                        type="time"
                        value={day.end}
                        onChange={(e) => update(key, { end: e.target.value })}
                        className={timeInputClass}
                        disabled={!day.enabled}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={day.enabled}
                      onClick={() => update(key, { enabled: !day.enabled })}
                      className={clsx(
                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                        day.enabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                      )}
                    >
                      <span
                        className={clsx(
                          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                          day.enabled ? 'translate-x-4' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={applyToWeekdays}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Apply Monday hours to all weekdays
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Save Working Hours
        </button>
      </div>
    </div>
  );
}
