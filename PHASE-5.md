# Phase 5 — AI Planner

> **Agent brief:** Add the AI daily planning system. This is the product's flagship differentiator. It analyzes the user's calendar events, tasks, working hours, and Focus Frames to produce a structured daily plan with task-time suggestions. The AI suggests; the user approves. Nothing is placed on the calendar without explicit user action.

**Read before starting:** `PRD.md` (Section F4), `ARCHITECTURE.md`, phases 1–4

**Estimated output:** ~4,000 lines of code  
**Prerequisite:** Phase 4 acceptance criteria all passing  
**New dependency:** Anthropic Claude API (`@anthropic-ai/sdk`)

---

## Deliverables Checklist

- [ ] AI Frames CRUD (define focus windows)
- [ ] Frames displayed as background overlay on calendar grid
- [ ] Daily plan generation (Claude API with rule-based fallback)
- [ ] Daily plan panel in UI (Today's Plan tab)
- [ ] Accept / Reject / Reschedule suggestion actions
- [ ] Recommendations panel (conflicts, overdue, at-risk, capacity, rollover)
- [ ] 6:00 AM plan generation cron job + push notification
- [ ] Plan regeneration on calendar changes
- [ ] "Regenerate plan" manual button
- [ ] Planner API routes
- [ ] Unit tests for planner logic (including Claude API mock)

---

## Step 1: AI Frames

### API Routes (`apps/api/src/routes/planner.ts`)

```
GET  /api/v1/planner/frames        → list frames for user
POST /api/v1/planner/frames        → create frame
PATCH /api/v1/planner/frames/:id   → update frame
DELETE /api/v1/planner/frames/:id  → delete frame
```

**POST body (Zod):**
```typescript
{
  name: string,                          // e.g., "Deep Work"
  color: string,                         // hex color, default '#8B5CF6'
  days_of_week: number[],               // 1=Mon..7=Sun, min 1
  start_time: string,                   // "HH:MM" format
  end_time: string,                     // "HH:MM" format, must be after start_time
  is_focus: boolean,                    // default true
  preferred_tags: string[],             // optional
  is_enabled: boolean                   // default true
}
```

### Frontend — Frames UI

**Route:** `(app)/settings/planner/page.tsx`

- List of frames with: color swatch, name, days, time range, toggle, edit/delete
- "Add Frame" button → opens sheet form
- Time pickers for start/end (use `shadcn/ui` TimeInput or a select-based picker)
- Day-of-week multi-select: clickable pill buttons (M T W T F S S)

### Frontend — Frames Overlay on Calendar

In `CalendarGrid.tsx`, render frames as background elements:

```typescript
// After rendering the time grid, before rendering events:
{frames.filter(f => f.is_enabled && f.days_of_week.includes(getDayOfWeek(columnDate))).map(frame => {
  const top = timeToPixels(frame.start_time)
  const height = timeToPixels(frame.end_time) - top
  return (
    <div
      key={frame.id}
      className="absolute inset-x-0 opacity-15 pointer-events-none rounded"
      style={{ top, height, backgroundColor: frame.color }}
    />
  )
})}
```

Frames appear as a subtle tinted background stripe. They are `pointer-events-none` so they don't interfere with clicking the grid.

---

## Step 2: Daily Plan Data Model

The `daily_plans` table stores generated plans. The `items` JSONB column holds an array:

```typescript
interface PlanItem {
  id: string                    // UUID, generated locally
  type: 'event' | 'task_suggestion'
  event_id?: string             // if type='event'
  task_id?: string              // if type='task_suggestion'
  suggested_start: string       // ISO8601
  suggested_end: string         // ISO8601
  reason: string                // human-readable explanation
  status: 'pending' | 'accepted' | 'rejected' | 'rescheduled'
  accepted_event_id?: string    // set after user accepts suggestion
}

interface DailyPlanRecommendation {
  id: string
  type: 'conflict' | 'overdue' | 'at_risk' | 'capacity' | 'rollover'
  task_id?: string
  event_id?: string
  message: string
  action_label: string          // "Schedule", "Reschedule", "Dismiss"
  dismissed_at?: string
}
```

---

## Step 3: Plan Generation Service

**File:** `apps/api/src/services/planner/plan-generator.ts`

```typescript
async function generateDailyPlan(userId: string, date: Date): Promise<DailyPlan>
```

### Step 3a: Gather context

```typescript
async function gatherPlanContext(userId: string, date: Date) {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const [user, events, tasks, frames, overdueTasks, yesterdayIncomplete] = await Promise.all([
    getUser(userId),
    getEventsForDay(userId, date),  // all calendar events for the day
    getTasksForPlanning(userId, date),  // open tasks due today or with no due date, sorted by priority
    getFrames(userId, date),
    getOverdueTasks(userId, date),  // status=open, due_date < today
    getYesterdayIncompleteTasks(userId, date)  // status=open, had scheduled_event on yesterday
  ])

  // Calculate free slots (gaps between events within working hours)
  const freeSlots = calculateFreeSlots(user.working_hours, events, date)

  return { user, events, tasks, frames, overdueTasks, yesterdayIncomplete, freeSlots }
}
```

### Step 3b: Build Claude prompt

```typescript
async function buildPlannerPrompt(context: PlanContext): Promise<string> {
  return `You are a daily planning assistant. Your job is to schedule tasks into the available time slots in a user's calendar for today.

## Today: ${format(context.date, 'EEEE, MMMM d, yyyy')}

## Working Hours
${formatWorkingHours(context.user.working_hours)}

## Already Scheduled Events (do NOT move these)
${context.events.map(e => `- ${format(e.start_at, 'h:mm a')}–${format(e.end_at, 'h:mm a')}: ${e.title}`).join('\n')}

## Available Time Slots
${context.freeSlots.map(s => `- ${format(s.start, 'h:mm a')}–${format(s.end, 'h:mm a')} (${s.durationMinutes} min)`).join('\n')}

## Focus Frames (preferred windows for deep work)
${context.frames.map(f => `- ${f.name}: ${f.start_time}–${f.end_time} (tags: ${f.preferred_tags.join(', ') || 'any'})`).join('\n')}

## Tasks to Schedule (in order of priority)
${context.tasks.slice(0, 20).map((t, i) => `${i + 1}. "${t.title}" — ${t.duration_minutes ?? 60} min, priority: ${PRIORITY_LABELS[t.priority]}, due: ${t.due_date ?? 'no due date'}, tags: ${t.tags.join(', ')}`).join('\n')}

## Instructions
- Fit as many tasks as possible into the available slots
- Prefer placing focus-tagged tasks inside matching Focus Frames
- Leave at least 10 minutes between consecutive time blocks
- Do not schedule tasks outside working hours
- Return ONLY valid JSON, no prose

## Response Format
{
  "scheduled_tasks": [
    {
      "task_index": 1,
      "suggested_start": "2025-01-15T09:00:00",
      "suggested_end": "2025-01-15T10:30:00",
      "reason": "Scheduled in Deep Work frame — high priority"
    }
  ],
  "unscheduled_tasks": [2, 4, 5],
  "notes": "Day is 85% booked. Tasks 2, 4, 5 could not fit today."
}`
}
```

### Step 3c: Call Claude API

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function callClaude(prompt: string): Promise<ClaudeScheduleResponse> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: 'You are a productivity assistant that schedules tasks into calendar slots. Always respond with valid JSON only.',
    messages: [{ role: 'user', content: prompt }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`)
  }
}
```

### Step 3d: Fallback (rule-based)

If Claude API is unavailable or returns invalid JSON, use a rule-based fallback:

```typescript
function ruleBasedScheduler(context: PlanContext): ClaudeScheduleResponse {
  const scheduledTasks: ScheduledTask[] = []
  let remainingSlots = [...context.freeSlots]

  // Sort tasks: priority ASC, then due date ASC
  const sortedTasks = [...context.tasks].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    if (a.due_date && b.due_date) return compareAsc(new Date(a.due_date), new Date(b.due_date))
    return 0
  })

  for (const [index, task] of sortedTasks.entries()) {
    const durationMin = task.duration_minutes ?? 60
    const slot = findFittingSlot(remainingSlots, durationMin, context.frames, task.tags)
    if (!slot) continue

    scheduledTasks.push({
      task_index: index + 1,
      suggested_start: slot.start.toISOString(),
      suggested_end: addMinutes(slot.start, durationMin).toISOString(),
      reason: `Scheduled by priority (${PRIORITY_LABELS[task.priority]})`
    })

    // Remove used time from remaining slots
    remainingSlots = subtractTime(remainingSlots, slot.start, addMinutes(slot.start, durationMin))
  }

  return { scheduled_tasks: scheduledTasks, unscheduled_tasks: [], notes: '' }
}
```

### Step 3e: Assemble and save the plan

```typescript
async function generateDailyPlan(userId: string, date: Date): Promise<DailyPlan> {
  const context = await gatherPlanContext(userId, date)
  const prompt = await buildPlannerPrompt(context)

  let aiResponse: ClaudeScheduleResponse
  try {
    aiResponse = await callClaude(prompt)
  } catch (err) {
    console.error('Claude API failed, using fallback:', err)
    aiResponse = ruleBasedScheduler(context)
  }

  // Build plan items
  const items: PlanItem[] = []

  // Add existing events as confirmed items
  for (const event of context.events) {
    items.push({
      id: generateId(),
      type: 'event',
      event_id: event.id,
      suggested_start: event.start_at.toISOString(),
      suggested_end: event.end_at.toISOString(),
      reason: 'Scheduled meeting',
      status: 'accepted'
    })
  }

  // Add AI-suggested tasks as pending items
  for (const suggested of aiResponse.scheduled_tasks) {
    const task = context.tasks[suggested.task_index - 1]
    items.push({
      id: generateId(),
      type: 'task_suggestion',
      task_id: task.id,
      suggested_start: suggested.suggested_start,
      suggested_end: suggested.suggested_end,
      reason: suggested.reason,
      status: 'pending'
    })
  }

  // Sort by suggested_start
  items.sort((a, b) => new Date(a.suggested_start).getTime() - new Date(b.suggested_start).getTime())

  // Build recommendations
  const recommendations = await buildRecommendations(context, items)

  // Upsert daily plan
  const plan = await db.insert(dailyPlans).values({
    userId,
    date: format(date, 'yyyy-MM-dd'),
    items,
    recommendations,
    generatedAt: new Date(),
    status: 'active'
  }).onConflictDoUpdate({
    target: [dailyPlans.userId, dailyPlans.date],
    set: { items, recommendations, generatedAt: new Date(), modifiedAt: null }
  }).returning()

  return plan[0]
}
```

---

## Step 4: Recommendations Engine

**File:** `apps/api/src/services/planner/recommendations.ts`

```typescript
async function buildRecommendations(context: PlanContext, planItems: PlanItem[]): Promise<DailyPlanRecommendation[]> {
  const recs: DailyPlanRecommendation[] = []

  // 1. Overdue tasks
  for (const task of context.overdueTasks) {
    recs.push({
      id: generateId(),
      type: 'overdue',
      task_id: task.id,
      message: `"${task.title}" was due ${formatRelative(new Date(task.due_date!), new Date())}`,
      action_label: 'Reschedule'
    })
  }

  // 2. Rollover from yesterday
  for (const task of context.yesterdayIncomplete) {
    recs.push({
      id: generateId(),
      type: 'rollover',
      task_id: task.id,
      message: `From yesterday: "${task.title}" was not completed`,
      action_label: 'Schedule today'
    })
  }

  // 3. At-risk tasks (due within 3 days, not yet scheduled, has duration estimate)
  const atRiskTasks = await getAtRiskTasks(context.userId, 3)
  for (const task of atRiskTasks) {
    const daysUntilDue = differenceInDays(new Date(task.due_date!), new Date())
    recs.push({
      id: generateId(),
      type: 'at_risk',
      task_id: task.id,
      message: `"${task.title}" is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} — needs ${task.duration_minutes} min`,
      action_label: 'Schedule'
    })
  }

  // 4. Capacity warning (>80% of working hours booked with meetings)
  const workingMinutes = calculateWorkingMinutes(context.user.working_hours, context.date)
  const meetingMinutes = context.events.reduce((sum, e) => sum + differenceInMinutes(e.end_at, e.start_at), 0)
  const capacityPercent = meetingMinutes / workingMinutes
  if (capacityPercent > 0.8) {
    recs.push({
      id: generateId(),
      type: 'capacity',
      message: `Heavy meeting day (${Math.round(capacityPercent * 100)}% booked). Consider rescheduling some tasks.`,
      action_label: 'View tasks'
    })
  }

  // 5. Conflict: existing time block overlaps a meeting
  const timeBlocks = planItems.filter(i => i.type === 'task_suggestion' && i.status === 'accepted')
  for (const block of timeBlocks) {
    const conflictingEvent = context.events.find(e =>
      new Date(e.start_at) < new Date(block.suggested_end) &&
      new Date(e.end_at) > new Date(block.suggested_start)
    )
    if (conflictingEvent) {
      const task = await getTask(block.task_id!)
      recs.push({
        id: generateId(),
        type: 'conflict',
        task_id: block.task_id,
        event_id: conflictingEvent.id,
        message: `"${task?.title}" conflicts with "${conflictingEvent.title}"`,
        action_label: 'Reschedule'
      })
    }
  }

  return recs
}
```

---

## Step 5: Planner API Routes

**File:** `apps/api/src/routes/planner.ts` (extend with plan routes)

```
GET  /api/v1/planner/today
GET  /api/v1/planner/:date           (date = YYYY-MM-DD)
POST /api/v1/planner/generate        Body: { date?: string }
POST /api/v1/planner/items/:item_id/accept
POST /api/v1/planner/items/:item_id/reject
POST /api/v1/planner/items/:item_id/reschedule   Body: { start_at, end_at }
GET  /api/v1/planner/recommendations
POST /api/v1/planner/recommendations/:id/dismiss
```

### POST .../items/:item_id/accept
```typescript
// Find the plan for today, find the item by item_id
// Validate item.type === 'task_suggestion' and item.status === 'pending'
// Create a calendar event:
//   - title: task.title
//   - start_at: item.suggested_start
//   - end_at: item.suggested_end
//   - is_time_block: true
//   - task_id: item.task_id
//   - calendar_id: user's primary calendar
// Update item.status = 'accepted', item.accepted_event_id = new event ID
// Update task.scheduled_event_id = new event ID
// Save plan
// Emit plan:updated to user's socket room
Response 200: { data: { item: PlanItem, event: Event } }
```

### POST .../items/:item_id/reject
```typescript
// Find item, set status = 'rejected'
// Emit plan:updated
Response 200: { data: { item: PlanItem } }
```

### POST .../items/:item_id/reschedule
```typescript
// Validate: item.status can be 'pending' or 'accepted'
// If 'accepted': delete the existing accepted_event_id event first
// Create new event at new time
// Update item: status='accepted', suggested_start, suggested_end, accepted_event_id
// Emit plan:updated
Response 200: { data: { item: PlanItem, event: Event } }
```

### POST .../recommendations/:id/dismiss
```typescript
// Set recommendation.dismissed_at = NOW()
// dismissed recommendations are filtered out until next plan generation
Response 204
```

---

## Step 6: Plan Regeneration Triggers

**1. Scheduled generation (6:00 AM):**
```typescript
// In apps/api/src/workers/plan-scheduler.worker.ts
// BullMQ cron job: '0 6 * * *' (6 AM daily)
// Process: for each active user, queue plan generation job
// The job calls generateDailyPlan(userId, today)
// After generation: send push notification (if mobile tokens registered)
```

**2. On calendar event change:**
```typescript
// In event routes (after event create/update/delete):
// If the changed event is today:
//   Invalidate the current plan's conflict recommendations
//   Re-run buildRecommendations() and update plan.recommendations
//   Emit plan:updated to user's socket room
// Do NOT regenerate the full plan (expensive) — just update recommendations
```

**3. Manual regeneration:**
`POST /api/v1/planner/generate` → calls `generateDailyPlan()` and overwrites existing plan for that date.

---

## Step 7: AI Planner Frontend

### `src/components/planner/PlannerPanel.tsx`

Right sidebar panel with two tabs: "Today's Plan" and "Recommendations".

Panel toggle: button in top-right corner of app shell with badge count (recommendations count).

**Today's Plan tab:**

```tsx
<div className="flex flex-col gap-1 p-4">
  {planItems.map(item => (
    <PlanItemRow key={item.id} item={item} />
  ))}
  <Button variant="outline" onClick={handleRegenerate} className="mt-4">
    <RefreshCw className="w-4 h-4 mr-2" />
    Regenerate plan
  </Button>
</div>
```

**`PlanItemRow.tsx`:**

```tsx
interface PlanItemRowProps {
  item: PlanItem
}

// For type='event':
// Shows: colored dot, time, event title — no actions (already confirmed)

// For type='task_suggestion', status='pending':
// Shows: time range, task title, reason text (muted), [✓ Accept] [✗ Reject] buttons

// For type='task_suggestion', status='accepted':
// Shows: colored task icon, time range, task title (strikethrough if done), [Reschedule] button

// For type='task_suggestion', status='rejected':
// Show muted/strikethrough with undo option
```

**Accept action:**
```typescript
async function handleAccept(item: PlanItem) {
  await apiClient(`/planner/items/${item.id}/accept`, { method: 'POST' })
  // TanStack Query invalidates plan → re-renders with updated item
}
```

**Recommendations tab:**

```tsx
{recommendations.filter(r => !r.dismissed_at).map(rec => (
  <RecommendationCard key={rec.id} recommendation={rec} />
))}
```

**`RecommendationCard.tsx`:**
- Icon based on type (⚠️ overdue, ↩️ rollover, ⏰ at-risk, 🔥 capacity, ⚡ conflict)
- Message text
- Action button → calls appropriate API (accept/schedule/reschedule)
- Dismiss (×) button → POST .../recommendations/:id/dismiss

### `src/hooks/useDailyPlan.ts`
```typescript
function useDailyPlan(date?: Date) {
  const dateStr = format(date ?? new Date(), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['plan', dateStr],
    queryFn: () => apiClient<DailyPlan>(`/planner/${dateStr}`),
    staleTime: 10_000
  })
}
```

### Socket integration for plan updates
In `SocketProvider.tsx`:
```typescript
socket.on('plan:updated', (data: { plan: DailyPlan }) => {
  queryClient.setQueryData(['plan', format(new Date(), 'yyyy-MM-dd')], data.plan)
})
```

---

## Step 8: 6 AM Notification

When the daily plan generates:

**Desktop notification (Phase 6 adds mobile push — handle here with a stub):**
```typescript
// For now: emit via Socket.io
io.to(`user:${userId}`).emit('notification', {
  title: 'Your plan for today is ready',
  body: `${events.length} meetings · ${pendingSuggestions.length} tasks to schedule`
})
```

**Web Push API (optional, if implementing service workers):**
Use the `web-push` npm package for browser push notifications when the app is not focused.

---

## Phase 5 Acceptance Criteria

### Frames
- [ ] Create a Frame "Deep Work" Mon–Fri 9–11am → purple overlay appears on calendar in that time slot
- [ ] Disable frame → overlay disappears
- [ ] Frame does not block clicking/dragging on the calendar

### Plan Generation
- [ ] GET /planner/today returns a plan with events + task suggestions
- [ ] Suggestions are placed in free slots (not overlapping existing events)
- [ ] Tasks with matching Frame tags are placed inside Frame windows
- [ ] If Claude API key is missing/fails → rule-based fallback generates a plan (test by unsetting key)

### Accept / Reject
- [ ] Accept a suggestion → calendar event created immediately, item shows as "accepted"
- [ ] Reject a suggestion → item grays out, no event created
- [ ] Regenerate plan → previous rejected items are removed; new suggestions generated

### Recommendations
- [ ] Task with due_date = yesterday → appears as "overdue" recommendation
- [ ] Day with >80% meeting load → capacity warning appears
- [ ] Task with due_date = tomorrow, duration > 0, not scheduled → "at-risk" recommendation
- [ ] Yesterday's incomplete time-block task → "rollover" recommendation

### Real-Time
- [ ] Open planner panel in two browser sessions
- [ ] Accept a suggestion in session 1 → plan updates in session 2 within 2s

### Regeneration
- [ ] "Regenerate plan" button calls generate API, plan refreshes within 5s
- [ ] Adding a new calendar event that conflicts with an accepted suggestion → conflict recommendation appears without full regeneration

---

## Unit Tests

**`apps/api/src/services/planner/__tests__/plan-generator.test.ts`**
- Mock Claude API: returns valid JSON schedule
- Test: tasks are placed in free slots, not overlapping events
- Test: tasks with matching frame tags placed inside frame windows
- Test: Claude failure → fallback fires, still produces a plan

**`apps/api/src/services/planner/__tests__/recommendations.test.ts`**
- Test: overdue task → overdue recommendation generated
- Test: >80% booking → capacity recommendation generated
- Test: accepted time block overlaps meeting → conflict recommendation
- Test: dismissed recommendation filtered from output

**`apps/api/src/services/planner/__tests__/availability.test.ts`** (reuse from Phase 3)
- Test: `calculateFreeSlots` correctly identifies gaps between events within working hours
