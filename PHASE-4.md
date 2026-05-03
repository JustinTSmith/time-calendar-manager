# Phase 4 — Calendar Automations

> **Agent brief:** Add four automation types that run silently in the background to manage calendar hygiene: Travel Time blocking, Buffer Time, Calendar Sync (mirror), and Event Copy. Users configure these rules from a settings panel; the automations engine processes them whenever calendar events change.

**Read before starting:** `PRD.md` (Section F5), `ARCHITECTURE.md`, phases 1–3

**Estimated output:** ~4,000 lines of code  
**Prerequisite:** Phase 3 acceptance criteria all passing

---

## Deliverables Checklist

- [ ] Automations CRUD API
- [ ] Automation engine (event hook → trigger evaluator → action executor)
- [ ] Travel Time automation (with Google Maps Distance Matrix)
- [ ] Buffer Time automation
- [ ] Calendar Sync (mirror) automation
- [ ] Event Copy automation
- [ ] Automations UI (list, create, enable/disable, edit, delete)
- [ ] Automation run log (per automation: last run, events affected)
- [ ] Unit tests for each automation type

---

## Step 1: Automations Schema

Already defined in PRD.md. Confirm `automations` table exists in `packages/db/src/schema.ts`.

Add one more table for the run log:

```sql
CREATE TABLE automation_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  triggered_by_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  actions_taken JSONB NOT NULL DEFAULT '[]',  -- array of { type, event_id, description }
  status        TEXT NOT NULL DEFAULT 'success',  -- 'success' | 'error'
  error_message TEXT,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX automation_runs_automation_id ON automation_runs(automation_id);
```

---

## Step 2: Automations API

**File:** `apps/api/src/routes/automations.ts`

All routes require auth.

### GET /api/v1/automations
```
Returns all automations for user with last run info
Response 200: {
  data: Array<Automation & {
    last_run_at: string | null,
    last_run_status: 'success' | 'error' | null,
    total_runs: number
  }>
}
```

### POST /api/v1/automations
```
Body:
{
  type: 'travel_time' | 'buffer' | 'sync' | 'event_copy'
  name: string
  trigger_config: object  // validated by Zod schema per type
  action_config: object   // validated by Zod schema per type
}

Zod schemas per type:

TravelTimeTrigger: { apply_to_calendar_ids: string[], home_address: string }
TravelTimeAction:  { commute_mode: 'driving'|'transit'|'walking'|'cycling',
                     add_before: boolean, add_after: boolean,
                     block_calendar_id: string, buffer_extra_minutes: number }

BufferTrigger:     { apply_to_calendar_ids: string[], min_duration_minutes: number }
BufferAction:      { buffer_before_minutes: number, buffer_after_minutes: number,
                     block_calendar_id: string, block_title: string }

SyncTrigger:       { source_calendar_id: string }
SyncAction:        { target_calendar_id: string, title_override: string | null,
                     hide_details: boolean, copy_color: boolean, event_color: string | null }

EventCopyTrigger:  { source_calendar_id: string, filter?: { title_contains?: string } }
EventCopyAction:   { target_calendar_id: string,
                     title_transform: 'prefix'|'suffix'|'replace'|'none',
                     title_value: string, color_override: string | null }

Validate all calendar IDs belong to user.
Response 201: { data: Automation }
```

### PATCH /api/v1/automations/:id
```
Body: { name?, trigger_config?, action_config?, is_enabled? }
Response 200: { data: Automation }
```

### DELETE /api/v1/automations/:id
```
Also delete all linked automation events (mirror events created by this automation)
Response 204
```

### GET /api/v1/automations/:id/runs
```
Query: { page?, per_page? (default 20) }
Response 200: { data: AutomationRun[], meta: PaginationMeta }
```

---

## Step 3: Automation Engine Architecture

**File:** `apps/api/src/services/automations/automation-engine.ts`

The engine hooks into the event lifecycle. It runs after any event is created or updated.

```typescript
class AutomationEngine {
  async onEventSaved(event: Event, action: 'created' | 'updated'): Promise<void> {
    // 1. Load all enabled automations for the event's calendar owner
    const userId = await getCalendarOwner(event.calendar_id)
    const automations = await db.query.automations.findMany({
      where: and(eq(automations.userId, userId), eq(automations.isEnabled, true))
    })

    // 2. For each automation, check if trigger matches
    for (const automation of automations) {
      const triggered = await this.evaluateTrigger(automation, event, action)
      if (triggered) {
        // 3. Execute action asynchronously (BullMQ job)
        await automationQueue.add('execute', { automationId: automation.id, eventId: event.id })
      }
    }
  }

  async onEventDeleted(event: Event): Promise<void> {
    // Find any automation-created events linked to this event
    // Delete them (e.g., travel blocks, buffer blocks, mirror events)
    await cleanupLinkedAutomationEvents(event.id)
  }
}
```

**Hook into event lifecycle:**
- In `apps/api/src/routes/events.ts`, after event create/update: call `automationEngine.onEventSaved(event, action)`
- After event delete: call `automationEngine.onEventDeleted(event)`
- Also hook into the calendar sync service: when synced events change, trigger the engine

**Automation worker:** `apps/api/src/workers/automation.worker.ts`
```typescript
const worker = new Worker('automation', async (job) => {
  const { automationId, eventId } = job.data
  const [automation, event] = await Promise.all([
    loadAutomation(automationId),
    loadEvent(eventId)
  ])
  const executor = getExecutor(automation.type)
  await executor.execute(automation, event)
  await logRun(automationId, eventId, 'success')
}, { connection: redis, concurrency: 10 })

worker.on('failed', async (job, err) => {
  await logRun(job.data.automationId, job.data.eventId, 'error', err.message)
})
```

---

## Step 4: Travel Time Automation

**File:** `apps/api/src/services/automations/travel-time.executor.ts`

```typescript
interface TravelTimeExecutor {
  execute(automation: Automation, event: Event): Promise<void>
}
```

**Trigger evaluation:**
```typescript
function evaluateTrigger(automation: TravelTimeAutomation, event: Event): boolean {
  const { apply_to_calendar_ids } = automation.trigger_config
  // 1. Event is in one of the trigger calendars
  if (!apply_to_calendar_ids.includes(event.calendar_id)) return false
  // 2. Event has a location
  if (!event.location || event.location.trim() === '') return false
  // 3. Event is not itself an automation-created event
  if (event.automation_id) return false
  return true
}
```

**Execute:**
```typescript
async function execute(automation: Automation, event: Event) {
  const { home_address } = automation.trigger_config
  const { commute_mode, add_before, add_after, block_calendar_id, buffer_extra_minutes } = automation.action_config

  // 1. Call Google Maps Distance Matrix API
  const travelMinutes = await estimateTravelTime(home_address, event.location!, commute_mode)
  const totalMinutes = travelMinutes + buffer_extra_minutes

  // 2. Delete existing travel blocks for this event (in case of update)
  await deleteLinkedAutomationEvents(event.id, automation.id)

  // 3. Create travel-before block
  if (add_before) {
    const travelStart = subMinutes(event.start_at, totalMinutes)
    const travelEnd = event.start_at
    await createAutomationEvent({
      calendar_id: block_calendar_id,
      title: `Travel to ${event.title}`,
      start_at: travelStart,
      end_at: travelEnd,
      automation_id: automation.id,
      linked_event_id: event.id,  // add this column to events table
      is_all_day: false,
      status: 'confirmed'
    })
  }

  // 4. Create travel-after block
  if (add_after) {
    const travelStart = event.end_at
    const travelEnd = addMinutes(event.end_at, totalMinutes)
    await createAutomationEvent({
      calendar_id: block_calendar_id,
      title: `Travel from ${event.title}`,
      start_at: travelStart,
      end_at: travelEnd,
      automation_id: automation.id,
      linked_event_id: event.id,
      is_all_day: false,
      status: 'confirmed'
    })
  }
}
```

**Google Maps Distance Matrix:**
```typescript
async function estimateTravelTime(
  origin: string,
  destination: string,
  mode: 'driving' | 'transit' | 'walking' | 'cycling'
): Promise<number> {
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', origin)
  url.searchParams.set('destinations', destination)
  url.searchParams.set('mode', mode)
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!)

  const response = await fetch(url.toString())
  const data = await response.json()
  const duration = data.rows[0]?.elements[0]?.duration?.value  // seconds
  if (!duration) return 30  // fallback: 30 minutes

  return Math.ceil(duration / 60)  // convert to minutes
}
```

**Schema addition:** Add `linked_event_id UUID REFERENCES events(id) ON DELETE CASCADE` to `events` table. When the linked event is deleted, cascade deletes the travel block.

---

## Step 5: Buffer Time Automation

**File:** `apps/api/src/services/automations/buffer-time.executor.ts`

**Trigger evaluation:**
```typescript
function evaluateTrigger(automation: BufferAutomation, event: Event): boolean {
  const { apply_to_calendar_ids, min_duration_minutes } = automation.trigger_config
  if (!apply_to_calendar_ids.includes(event.calendar_id)) return false
  if (event.automation_id) return false  // don't buffer automation events
  const durationMin = differenceInMinutes(event.end_at, event.start_at)
  if (durationMin < min_duration_minutes) return false
  return true
}
```

**Execute:**
```typescript
async function execute(automation: Automation, event: Event) {
  const { buffer_before_minutes, buffer_after_minutes, block_calendar_id, block_title } = automation.action_config

  await deleteLinkedAutomationEvents(event.id, automation.id)

  if (buffer_before_minutes > 0) {
    await createAutomationEvent({
      calendar_id: block_calendar_id,
      title: block_title || 'Buffer',
      start_at: subMinutes(event.start_at, buffer_before_minutes),
      end_at: event.start_at,
      automation_id: automation.id,
      linked_event_id: event.id
    })
  }

  if (buffer_after_minutes > 0) {
    await createAutomationEvent({
      calendar_id: block_calendar_id,
      title: block_title || 'Buffer',
      start_at: event.end_at,
      end_at: addMinutes(event.end_at, buffer_after_minutes),
      automation_id: automation.id,
      linked_event_id: event.id
    })
  }
}
```

---

## Step 6: Calendar Sync (Mirror) Automation

**File:** `apps/api/src/services/automations/calendar-sync.executor.ts`

**Trigger evaluation:**
```typescript
function evaluateTrigger(automation: SyncAutomation, event: Event): boolean {
  const { source_calendar_id } = automation.trigger_config
  if (event.calendar_id !== source_calendar_id) return false
  if (event.is_mirror) return false  // never mirror a mirror (infinite loop prevention)
  if (event.automation_id) return false
  return true
}
```

**Execute (create/update mirror):**
```typescript
async function execute(automation: Automation, event: Event) {
  const { target_calendar_id, title_override, hide_details, copy_color, event_color } = automation.action_config

  // Find existing mirror for this event (same automation + linked_event_id)
  const existingMirror = await findMirrorEvent(event.id, automation.id)

  const mirrorData = {
    calendar_id: target_calendar_id,
    title: hide_details ? (title_override || 'Busy') : event.title,
    description: hide_details ? null : event.description,
    location: hide_details ? null : event.location,
    attendees: hide_details ? [] : event.attendees,
    start_at: event.start_at,
    end_at: event.end_at,
    is_all_day: event.is_all_day,
    status: event.status,
    color_override: copy_color ? event.color_override : (event_color || null),
    is_mirror: true,
    automation_id: automation.id,
    linked_event_id: event.id
  }

  if (existingMirror) {
    await updateEvent(existingMirror.id, mirrorData)
  } else {
    await createAutomationEvent(mirrorData)
  }
}
```

**Handle deletions:**
When the source event is deleted, the `ON DELETE CASCADE` on `linked_event_id` handles cleanup.

**Important:** Mirror events must NOT be pushed to provider calendars via the event-write queue. They should ONLY exist in the TaskTime database. This is because they represent an internal view — the user's "busy" block visible only to themselves.

Actually, reconsider: the user may WANT the mirror event on their actual calendar (e.g., blocking personal calendar from work meetings). In that case, they DO want it pushed to provider. Add a `sync_to_provider: boolean` field to `SyncAction` config (default: true).

---

## Step 7: Event Copy Automation

**File:** `apps/api/src/services/automations/event-copy.executor.ts`

Unlike Sync, Event Copy creates an independent copy (not linked). Changes to the original do NOT propagate.

**Trigger evaluation:**
```typescript
function evaluateTrigger(automation: EventCopyAutomation, event: Event, action: string): boolean {
  const { source_calendar_id, filter } = automation.trigger_config
  if (event.calendar_id !== source_calendar_id) return false
  if (event.is_mirror) return false
  if (action !== 'created') return false  // only copy on create, not on updates
  if (filter?.title_contains && !event.title.toLowerCase().includes(filter.title_contains.toLowerCase())) return false
  return true
}
```

**Execute:**
```typescript
async function execute(automation: Automation, event: Event) {
  const { target_calendar_id, title_transform, title_value, color_override } = automation.action_config

  let title = event.title
  if (title_transform === 'prefix') title = `${title_value}${event.title}`
  if (title_transform === 'suffix') title = `${event.title}${title_value}`
  if (title_transform === 'replace') title = title_value

  await createEvent({
    calendar_id: target_calendar_id,
    title,
    description: event.description,
    location: event.location,
    start_at: event.start_at,
    end_at: event.end_at,
    is_all_day: event.is_all_day,
    color_override: color_override ?? event.color_override,
    automation_id: automation.id  // marks it as auto-created (but NOT is_mirror)
    // Note: linked_event_id is NOT set — this is an independent copy
  })
}
```

---

## Step 8: Helper Utilities

**File:** `apps/api/src/services/automations/utils.ts`

```typescript
async function deleteLinkedAutomationEvents(linkedEventId: string, automationId: string) {
  // Find all events WHERE linked_event_id = linkedEventId AND automation_id = automationId
  // Delete them (hard delete is fine — these are automation artifacts)
  // Also push delete to provider calendars if sync_to_provider was true
}

async function createAutomationEvent(data: Partial<Event>): Promise<Event> {
  // Insert into events table
  // If sync_to_provider: add to event-write queue
  // Emit socket.io event:created to user room
}

async function findMirrorEvent(linkedEventId: string, automationId: string): Promise<Event | null> {
  return db.query.events.findFirst({
    where: and(
      eq(events.linkedEventId, linkedEventId),
      eq(events.automationId, automationId),
      isNull(events.deletedAt)
    )
  })
}
```

---

## Step 9: Automations UI

**Route:** `(app)/settings/automations/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Automations                          [+ New Rule]   │
├─────────────────────────────────────────────────────┤
│  [Toggle] Travel Time — Home → Office               │
│           Last run: 2 min ago · 3 events blocked    │
│           [Edit] [Delete]                           │
├─────────────────────────────────────────────────────┤
│  [Toggle] Buffer — 10min after meetings             │
│           Enabled · 15 total runs                   │
│           [Edit] [Delete]                           │
└─────────────────────────────────────────────────────┘
```

**"+ New Rule" → opens a sheet with steps:**

Step 1: Select automation type (4 cards with icon + name + description)
Step 2: Configure trigger (different form per type)
Step 3: Configure action (different form per type)
Step 4: Name + save

**Automation type cards:**
```tsx
const AUTOMATION_TYPES = [
  {
    type: 'travel_time',
    icon: Car,
    name: 'Travel Time',
    description: 'Block travel time before/after location-based meetings'
  },
  {
    type: 'buffer',
    icon: Clock,
    name: 'Buffer Time',
    description: 'Add buffer blocks before/after meetings'
  },
  {
    type: 'sync',
    icon: RefreshCw,
    name: 'Calendar Sync',
    description: 'Mirror events from one calendar to another'
  },
  {
    type: 'event_copy',
    icon: Copy,
    name: 'Event Copy',
    description: 'Copy new events between calendars with transformations'
  }
]
```

**Run log:** In the automation detail sheet, show the 10 most recent runs with status badge and affected event names.

---

## Step 10: Schema Migration

Add these columns to `events` table:
```sql
ALTER TABLE events ADD COLUMN linked_event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN linked_automation_id UUID REFERENCES automations(id) ON DELETE SET NULL;
```

Create the index:
```sql
CREATE INDEX events_linked_event_id ON events(linked_event_id) WHERE linked_event_id IS NOT NULL;
```

---

## Phase 4 Acceptance Criteria

### Travel Time
- [ ] Create a location-based event on a trigger calendar → travel block appears within 30s
- [ ] Travel block title is "Travel to [event title]"
- [ ] Move the original event 2 hours later → travel block moves with it
- [ ] Delete the original event → travel block disappears
- [ ] Two consecutive events at the same location → only one travel block between them (not duplicated)

### Buffer Time
- [ ] Enable buffer automation with 10 min after → a buffer event appears after each meeting
- [ ] Buffer event appears within 30s of meeting creation
- [ ] A 5-minute event below `min_duration_minutes` threshold → no buffer created

### Calendar Sync (Mirror)
- [ ] Enable sync from Work calendar → Personal calendar
- [ ] Create a work event → corresponding "Busy" block appears on personal calendar
- [ ] Edit the work event time → mirror updates within 30s
- [ ] Delete the work event → mirror deleted within 30s
- [ ] Mirror event shows "Read-only — managed by sync" message if user tries to edit it

### Event Copy
- [ ] Enable copy from Calendar A → Calendar B with prefix "[COPY] "
- [ ] Create event on Calendar A → a copy with "[COPY] " prefix appears on Calendar B
- [ ] Edit the original event → the copy does NOT update (independent)

### UI
- [ ] Toggle switch enables/disables automation without deleting it
- [ ] Editing an automation and saving applies new config immediately
- [ ] Run log shows the last 10 runs with event names and timestamps
- [ ] Deleting an automation with `sync_to_provider=true` also removes all mirrored events from provider calendar

---

## Unit Tests

**`apps/api/src/services/automations/__tests__/travel-time.test.ts`**
- Mock Google Maps API — returns 25 min travel time
- Create event with location → verify two travel blocks created at correct times
- Update event start time → verify travel blocks updated
- Delete event → verify travel blocks deleted

**`apps/api/src/services/automations/__tests__/calendar-sync.test.ts`**
- Create event on source calendar → verify mirror created on target
- Update source event → verify mirror updated
- `hide_details=true` → verify mirror has title='Busy', no description/attendees
- Mirror event → verify it does NOT trigger another sync (infinite loop check)

**`apps/api/src/services/automations/__tests__/buffer.test.ts`**
- Event >= min_duration → buffer before and after created
- Event < min_duration → no buffer created
- `buffer_before_minutes=0` → only after-buffer created
