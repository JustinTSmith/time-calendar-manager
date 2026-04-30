import { NextResponse } from 'next/server';
import type { CalendarAccount } from '@/types/settings';

let mockAccounts: CalendarAccount[] = [
  { id: 'acct-1', provider: 'google', email: 'justintsmith@gmail.com', status: 'active' },
];

export async function GET() {
  return NextResponse.json(mockAccounts);
}

export function removeMockAccount(id: string) {
  mockAccounts = mockAccounts.filter((a) => a.id !== id);
}
