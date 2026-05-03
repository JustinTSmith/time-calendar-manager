'use client';

import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  setAccessToken: (token: string) => set({ accessToken: token }),
  clearAuth: () => set({ accessToken: null }),
}));
