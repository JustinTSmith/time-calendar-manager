'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { UserSettings } from '@/types/settings';

// Curated list of common IANA timezones
const TIMEZONES = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/Denver',
  'America/Phoenix',
  'America/Chicago',
  'America/Winnipeg',
  'America/New_York',
  'America/Toronto',
  'America/Halifax',
  'America/St_Johns',
  'America/Sao_Paulo',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Stockholm',
  'Europe/Helsinki',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
];

type Props = {
  settings: UserSettings;
  onSave: (patch: Partial<UserSettings>) => Promise<{ success: boolean }>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
};

export function GeneralSection({ settings, onSave, onToast }: Props) {
  const [name, setName] = useState(settings.name);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [weekStartsOn, setWeekStartsOn] = useState(settings.weekStartsOn);
  const [defaultEventDuration, setDefaultEventDuration] = useState(settings.defaultEventDuration);
  const [timeFormat, setTimeFormat] = useState(settings.timeFormat);

  useEffect(() => {
    setName(settings.name);
    setTimezone(settings.timezone);
    setWeekStartsOn(settings.weekStartsOn);
    setDefaultEventDuration(settings.defaultEventDuration);
    setTimeFormat(settings.timeFormat);
  }, [settings]);

  async function handleSave() {
    const result = await onSave({ name, timezone, weekStartsOn, defaultEventDuration, timeFormat });
    onToast(result.success ? 'General settings saved.' : 'Failed to save.', result.success ? 'success' : 'error');
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  const radioGroupClass = 'flex gap-2';
  function RadioOption<T extends string | number>({
    value,
    current,
    label,
    onChange,
  }: {
    value: T;
    current: T;
    label: string;
    onChange: (v: T) => void;
  }) {
    const active = value === current;
    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        className={clsx(
          'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
          active
            ? 'border-blue-600 bg-blue-600 text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500'
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <Field label="Display Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          value={settings.email}
          readOnly
          className={clsx(inputClass, 'cursor-not-allowed opacity-60')}
        />
      </Field>

      <Field label="Timezone">
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className={inputClass}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Week Starts On">
        <div className={radioGroupClass}>
          <RadioOption value="sunday" current={weekStartsOn} label="Sunday" onChange={setWeekStartsOn} />
          <RadioOption value="monday" current={weekStartsOn} label="Monday" onChange={setWeekStartsOn} />
        </div>
      </Field>

      <Field label="Default Event Duration">
        <div className={radioGroupClass}>
          <RadioOption value={30} current={defaultEventDuration} label="30 min" onChange={setDefaultEventDuration} />
          <RadioOption value={60} current={defaultEventDuration} label="60 min" onChange={setDefaultEventDuration} />
        </div>
      </Field>

      <Field label="Time Format">
        <div className={radioGroupClass}>
          <RadioOption value="12h" current={timeFormat} label="12-hour" onChange={setTimeFormat} />
          <RadioOption value="24h" current={timeFormat} label="24-hour" onChange={setTimeFormat} />
        </div>
      </Field>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4">
      <label className="pt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div>{children}</div>
    </div>
  );
}
