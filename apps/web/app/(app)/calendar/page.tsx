import { Calendar } from '@/components/ui/calendar'

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Manage your schedule and events
        </p>
      </div>
      <div className="rounded-md border bg-card p-4 shadow-sm">
        <Calendar mode="single" className="rounded-md" />
      </div>
    </div>
  )
}
