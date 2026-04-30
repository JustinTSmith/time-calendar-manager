import { NextRequest, NextResponse } from 'next/server';

// In-memory mock store for calendar accounts
const mockAccounts = new Set(['acct-1']);

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!mockAccounts.has(id)) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  mockAccounts.delete(id);
  return NextResponse.json({ success: true });
}
