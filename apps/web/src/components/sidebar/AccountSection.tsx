'use client';

import { useState } from 'react';
import type { CalendarAccountDto } from '@time-calendar-manager/types';
import { AccountHeader } from './AccountHeader';
import { CalendarRow } from './CalendarRow';

interface Props {
  account: CalendarAccountDto;
}

export function AccountSection({ account }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="py-1">
      <AccountHeader
        account={account}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed((v) => !v)}
      />
      {!isCollapsed && (
        <div className="ml-2">
          {account.calendars.map((cal) => (
            <CalendarRow key={cal.id} calendar={cal} />
          ))}
        </div>
      )}
    </div>
  );
}
