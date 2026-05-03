import { CalendarGridWeek } from '@/components/calendar/CalendarGridWeek';
import { CalendarSidebar } from '@/components/sidebar/CalendarSidebar';

export default function CalendarPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <CalendarSidebar />
      <main className="flex-1 overflow-hidden">
        <CalendarGridWeek />
      </main>
    </div>
  );
}
