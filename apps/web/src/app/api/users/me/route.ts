import { NextRequest, NextResponse } from 'next/server';
import type { UserSettings } from '@/types/settings';
import { DEFAULT_WORKING_HOURS } from '@/types/settings';

// In-memory store for mock persistence within a server session
let mockUser: UserSettings = {
  id: 'user-1',
  name: 'Justin Smith',
  email: 'justintsmith@gmail.com',
  timezone: 'America/Vancouver',
  weekStartsOn: 'monday',
  defaultEventDuration: 30,
  timeFormat: '12h',
  workingHours: DEFAULT_WORKING_HOURS,
};

export async function GET() {
  return NextResponse.json(mockUser);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  mockUser = { ...mockUser, ...body };
  return NextResponse.json(mockUser);
}
