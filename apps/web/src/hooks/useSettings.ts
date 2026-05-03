'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UserSettings } from '@/types/settings';

type SaveResult = { success: boolean };

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((data: UserSettings) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = useCallback(
    async (patch: Partial<UserSettings>): Promise<SaveResult> => {
      setSaving(true);
      try {
        const res = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const updated: UserSettings = await res.json();
        setSettings(updated);
        return { success: true };
      } catch {
        return { success: false };
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { settings, loading, saving, save };
}
