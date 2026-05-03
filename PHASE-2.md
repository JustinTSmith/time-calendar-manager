# Phase 2 — Integrations

> **Agent brief:** Extend the working Phase 1 app with all remaining calendar providers, all task integrations, Calendar Sets, additional calendar views (Month + Agenda), and the Command Palette. Phase 1 must be fully working before starting here.

**Read before starting:** `PRD.md`, `ARCHITECTURE.md`, `PHASE-1.md` (understand what already exists)

**Estimated output:** ~10,000 lines of code  
**Prerequisite:** Phase 1 acceptance criteria all passing

---

## Deliverables Checklist

### Calendar Providers
- [ ] iCloud (CalDAV) calendar connect + sync
- [ ] Fastmail (CalDAV) calendar connect + sync
- [ ] Generic CalDAV calendar connect + sync (Yahoo, Nextcloud, Zoho)
- [ ] Subscription calendars (iCal URL / .ics feeds)
- [ ] Calendar Sets — create, edit, toggle, persist

### Task Integrations
- [ ] Notion (database tasks)
- [ ] Todoist
- [ ] Linear (issues)
- [ ] ClickUp
- [ ] Google Tasks (via existing Google OAuth)
- [ ] Microsoft To Do (via existing Microsoft OAuth)
- [ ] Zapier bridge (webhook in/out)

### Calendar Views
- [ ] Month view
- [ ] Agenda view (scrollable list)
- [ ] 2-Week view variant

### UI Improvements
- [ ] Command palette (Cmd+K)
- [ ] Keyboard shortcuts (all from PRD.md Section F1.8)
- [ ] Color customization per calendar and per event
- [ ] Calendar sidebar improvements: calendar sets chips, grouped by account

### Sync Infrastructure
- [ ] Task sync worker (BullMQ repeatable jobs, 60s interval)
- [ ] Bidirectional conflict resolution (last-write-wins)
- [ ] Integration status monitoring (errors surfaced in UI)

---

## Step 1: CalDAV Provider

CalDAV powers iCloud, Fastmail, and any generic CalDAV server.

**File:** `apps/api/src/services/calendar-sync/caldav-sync.ts`

Use the `tsdav` package:
```typescript
import { createDAVClient } from 'tsdav'

async function connectCalDAV(url: string, username: string, password: string) {
  const client = await createDAVClient({
    serverUrl: url,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav'
  })
  const calendars = await client.fetchCalendars()
  // Map to our Calendar model
  // Store credentials encrypted in calendar_accounts
}
```

**iCloud-specific:**
- Server URL: `https://caldav.icloud.com`
- Auth: Apple ID email + app-specific password (NOT main Apple ID password)
- UI must link to Apple's instructions for generating an app-specific password

**Fastmail-specific:**
- Server URL: `https://caldav.fastmail.com`
- Auth: Fastmail username + app password (OAuth available — prefer OAuth if provider supports it)

**Sync for CalDAV:**
```typescript
async function syncCalDAV(accountId: string, calendarId: string) {
  // Use WebDAV PROPFIND to get event list with ETags
  // Compare with stored ETags in DB
  // Fetch changed events (REPORT request)
  // Update DB
  // CalDAV doesn't push webhooks — poll every 60s via BullMQ
}
```

**API route:** `POST /api/v1/calendar-accounts/caldav`
```
Body: { url: string, username: string, password: string, display_name?: string }
- Validate credentials by attempting a PROPFIND
- On success: create calendar_account, fetch calendars, start sync
- Store credentials encrypted (AES-256-GCM using ENCRYPTION_KEY from env)
Response 201: { data: { account: CalendarAccount, calendars: Calendar[] } }
```

---

## Step 2: Subscription Calendars (iCal Feeds)

**File:** `apps/api/src/services/calendar-sync/ical-subscription.ts`

```typescript
import ical from 'node-ical'  // package: node-ical

async function syncSubscription(calendar: Calendar) {
  // calendar.subscription_url is the .ics URL
  const response = await fetch(calendar.subscription_url!)
  const icsText = await response.text()
  const events = ical.parseICS(icsText)
  // Map to our Event model
  // Mark all events is_read_only=true
  // Upsert by provider_event_id (uid from iCal)
}
```

- Schedule refresh every 12 hours via BullMQ repeatable job
- UI: "Add subscription calendar" button → paste URL → name the calendar → assign color

**API route:** `POST /api/v1/calendar-accounts/subscription`
```
Body: { url: string, name: string, color?: string }
- Fetch and parse the .ics URL to validate
- Create calendar_account (provider='subscription')
- Create calendar with is_subscription=true, is_read_only=true
- Run initial sync
Response 201: { data: { calendar: Calendar } }
```

---

## Step 3: Calendar Sets

**Already in schema from Phase 1. Implement the routes and UI now.**

**API routes** (`apps/api/src/routes/calendars.ts` — add to existing file):
```
GET  /api/v1/calendar-sets          → list all sets for user
POST /api/v1/calendar-sets          → { name: string, calendar_ids: string[] }
PATCH /api/v1/calendar-sets/:id     → { name?, calendar_ids? }
DELETE /api/v1/calendar-sets/:id    → delete set (does NOT affect calendars)
```

**Frontend — Calendar Sets UI:**
```typescript
// In CalendarSidebar.tsx — add above the calendar list
<section>
  <h3>Calendar Sets</h3>
  <div className="flex flex-wrap gap-1">
    {calendarSets.map(set => (
      <Chip
        key={set.id}
        active={activeSetIds.includes(set.id)}
        onClick={() => toggleSet(set.id)}
        color={set.color}
      >
        {set.name}
      </Chip>
    ))}
    <CreateSetButton />
  </div>
</section>
```

**Active set logic in store:**
```typescript
// src/stores/calendar.store.ts
interface CalendarStore {
  activeSetIds: string[]  // empty = show all
  visibleCalendarIds: string[]  // derived from activeSetIds + per-calendar visibility
  toggleSet: (setId: string) => void
  // When sets are active: visibleCalendarIds = union of all calendars in active sets
  // When no sets active: visibleCalendarIds = all calendars where is_visible=true
}
```

---

## Step 4: Month View

**File:** `src/components/calendar/MonthView.tsx`

```typescript
interface MonthViewProps {
  currentDate: Date        // any date in the target month
  events: Event[]
  onEventClick: (event: Event) => void
  onDayClick: (date: Date) => void  // switches to day view for that date
  onSlotClick: (date: Date) => void // quick-create for that day
}
```

**Rendering:**
- Grid: 5–6 rows × 7 columns
- Each cell: date number + event chips (max 3 visible, "+N more" link)
- Event chips: colored pill with truncated title
- All-day events: span multiple cells
- Click "+N more" → opens a popover listing all events for that day
- Current day: highlighted cell background

---

## Step 5: Agenda View

**File:** `src/components/calendar/AgendaView.tsx`

```typescript
interface AgendaViewProps {
  startDate: Date  // first day to show
  events: Event[]
  onEventClick: (event: Event) => void
}
```

**Rendering:**
- Infinite scroll list, grouped by day
- Day header: "Monday, January 15" (bold)
- Each event row: time range (left), color bar (2px), title + calendar name
- If no events for a day: show "No events"
- Load 60 days initially; load more on scroll to bottom
- Past days: slightly muted text

---

## Step 6: Task Integration — Architecture

All task integrations follow the same pattern. Create a base interface:

**File:** `apps/api/src/services/task-sync/base-sync.ts`
```typescript
interface TaskSyncProvider {
  provider: string
  fullSync(integration: TaskIntegration): Promise<void>
  incrementalSync(integration: TaskIntegration): Promise<void>
  pushUpdate(integration: TaskIntegration, task: Task): Promise<void>
  pushCompletion(integration: TaskIntegration, task: Task): Promise<void>
  mapToTask(raw: unknown, userId: string, integrationId: string): Partial<Task>
  mapFromTask(task: Task): unknown
}
```

**Task sync worker:** `apps/api/src/workers/task-sync.worker.ts`
- BullMQ repeatable job: every 60 seconds per active integration
- Job: `{ integrationId: string, type: 'full' | 'incremental' }`
- On task change in TaskTime → immediate push job (separate queue: `task-write`)

---

## Step 7: Notion Integration

**File:** `apps/api/src/services/task-sync/notion-sync.ts`

**OAuth Flow:**
- Initiation: `GET /api/v1/task-integrations/notion/auth`
  - Redirect to Notion OAuth: `https://api.notion.com/v1/oauth/authorize`
  - Scopes: read_content, update_content
- Callback: `GET /api/v1/task-integrations/notion/callback`
  - Exchange code for token
  - Fetch workspace info
  - Redirect user to integration config UI (select which database to sync)

**Config step (after OAuth):**
- `GET /api/v1/task-integrations/notion/databases` → calls Notion Search API, returns user's databases
- User selects a database
- `PATCH /api/v1/task-integrations/:id/config` with `{ database_id, property_map }`

**Property mapping** (stored in `config` JSONB):
```json
{
  "database_id": "abc123",
  "property_map": {
    "title": "Name",
    "due_date": "Due",
    "status": "Status",
    "priority": "Priority",
    "done_value": "Done"
  }
}
```

**Sync logic:**
```typescript
// Full sync: query all pages in database
const pages = await notion.databases.query({ database_id: config.database_id })
// Map each page to a Task, upsert by source_id

// Incremental: filter by last_edited_time > integration.last_synced_at

// Push completion:
await notion.pages.update({
  page_id: task.source_id,
  properties: { [config.property_map.status]: { select: { name: config.property_map.done_value } } }
})
```

---

## Step 8: Todoist Integration

**File:** `apps/api/src/services/task-sync/todoist-sync.ts`

**Auth:** OAuth 2.0 at `https://todoist.com/oauth/authorize`

**Sync via Sync API:**
```typescript
// Full sync:
POST https://api.todoist.com/sync/v9/sync
Body: { token, sync_token: '*', resource_types: ['items', 'projects'] }

// Incremental:
POST https://api.todoist.com/sync/v9/sync
Body: { token, sync_token: <stored>, resource_types: ['items'] }
// Store new sync_token from response
```

**Field mapping:**
- `content` → `title`
- `due.date` → `due_date`
- `priority` → priority (Todoist: 4=p1/Urgent → TaskTime: 1; Todoist: 1=p4/None → TaskTime: 3)
- `checked` → `status` ('done' if checked=1)
- `project_id` → `list_id` (create matching task list)
- `labels` → `tags`

**Push completion:**
```typescript
POST https://api.todoist.com/sync/v9/sync
Body: { token, commands: [{ type: 'item_complete', uuid: uuid(), args: { id: task.source_id } }] }
```

---

## Step 9: Linear Integration

**File:** `apps/api/src/services/task-sync/linear-sync.ts`

**Auth:** OAuth 2.0 at `https://linear.app/oauth/authorize`

**Sync via GraphQL:**
```graphql
query Issues($teamId: String!, $after: String) {
  issues(filter: { team: { id: { eq: $teamId } } }, after: $after) {
    nodes {
      id title description dueDate priority
      state { name type }
      updatedAt
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Config:** User selects which Team(s) to sync after OAuth.

**Status mapping:**
- `state.type === 'backlog'` or `'unstarted'` → `open`
- `state.type === 'started'` → `in_progress`
- `state.type === 'completed'` → `done`
- `state.type === 'cancelled'` → `cancelled`

**Priority mapping:** Linear 0=No priority→3, 1=Urgent→1, 2=High→2, 3=Medium→3, 4=Low→4

**Webhooks:** Register Linear webhook to receive real-time issue updates:
```
POST /api/v1/webhooks/linear
Payload: { type: 'Issue', action: 'update', data: { id, ... } }
```

**Push updates:** Use Linear GraphQL mutation `issueUpdate` to sync status back.

---

## Step 10: ClickUp Integration

**File:** `apps/api/src/services/task-sync/clickup-sync.ts`

**Auth:** OAuth 2.0 at `https://app.clickup.com/api`

**Config:** After OAuth, let user select Space/Folder/List to sync.

**Sync:**
```
GET https://api.clickup.com/api/v2/list/{list_id}/task?include_closed=true&date_updated_gt=<timestamp>
```

**Field mapping:**
- `name` → `title`
- `due_date` (unix ms) → `due_date`
- `priority.priority` → priority ('urgent'→1, 'high'→2, 'normal'→3, 'low'→4)
- `status.status` → status mapping
- `time_estimate` (ms) → `duration_minutes`

**Push completion:**
```
PUT https://api.clickup.com/api/v2/task/{task_id}
Body: { status: 'complete' }
```

---

## Step 11: Google Tasks Integration

Uses the existing Google OAuth token (extend scope if needed: `https://www.googleapis.com/auth/tasks`).

**Sync:**
```
GET https://tasks.googleapis.com/tasks/v1/users/@me/lists
GET https://tasks.googleapis.com/tasks/v1/lists/{tasklist}/tasks?showCompleted=true&updatedMin=<RFC3339>
```

**Push completion:**
```
PATCH https://tasks.googleapis.com/tasks/v1/lists/{tasklist}/tasks/{taskId}
Body: { status: 'completed', completed: <RFC3339 timestamp> }
```

Create a new TaskIntegration record with `provider='google_tasks'`, linked to the user's Google CalendarAccount. No separate OAuth needed.

---

## Step 12: Microsoft To Do Integration

Uses existing Microsoft OAuth token (extend scope: `Tasks.ReadWrite`).

**Sync:**
```
GET https://graph.microsoft.com/v1.0/me/todo/lists
GET https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks?$filter=lastModifiedDateTime ge {timestamp}
```

**Push completion:**
```
PATCH https://graph.microsoft.com/v1.0/me/todo/lists/{listId}/tasks/{taskId}
Body: { status: 'completed' }
```

---

## Step 13: Zapier Bridge

**File:** `apps/api/src/routes/zapier.ts`

**Incoming (Zapier → TaskTime):**
```
POST /api/v1/zapier/tasks
Headers: { X-Api-Key: <user's api key> }
Body: { title, due_date?, priority?, list_name?, notes?, tags? }
- Find user by api_key (add api_key column to users table)
- Create native task
Response 201: { data: Task }
```

**Outgoing (TaskTime → Zapier):**
- Store user's Zapier webhook URL in settings
- On task create/update: POST to stored webhook URL
- Zapier catches the webhook and passes to the next step in their Zap

**API key management:**
```
GET  /api/v1/settings/api-key      → returns masked key or null
POST /api/v1/settings/api-key      → generates new key (bcrypt hash stored, plain returned once)
DELETE /api/v1/settings/api-key    → revokes key
```

---

## Step 14: Task Integrations UI

**Route:** `(app)/settings/integrations/page.tsx`

Layout: Grid of integration cards, each showing:
- Provider logo + name
- Status: Connected (green) | Not connected (grey) | Error (red)
- "Connect" button or "Configure" + "Disconnect" buttons
- Last synced timestamp
- Error message if status=error

**Integration detail sheet** (opens when clicking "Configure"):
- Shows current config (e.g., selected Notion database)
- "Change database" option
- "Sync now" button → POST /task-integrations/:id/sync
- "Disconnect" button

---

## Step 15: Command Palette (Cmd+K)

**File:** `src/components/ui/CommandPalette.tsx`

Use `cmdk` package:
```typescript
import { Command } from 'cmdk'
```

**Commands available in Phase 2:**
```
new-event       → "New Event" — focuses calendar, opens quick-create
new-task        → "New Task" — focuses task panel input
go-today        → "Go to Today" — navigates calendar to today
view-day        → "Day View"
view-week       → "Week View"
view-month      → "Month View"
view-agenda     → "Agenda View"
connect-calendar → "Connect Calendar" — opens settings/calendars
connect-integration → "Connect Task Integration"
toggle-theme    → "Toggle Dark Mode"
```

**Event/task search:** When user types 3+ characters not matching a command, search events and tasks by title and show results.

```typescript
// In command palette, on value change:
if (query.length >= 3) {
  const [events, tasks] = await Promise.all([
    searchEvents(query),
    searchTasks(query)
  ])
  // Show as search results with icons
}
```

**Keyboard trigger:**
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setOpen(true)
    }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [])
```

---

## Step 16: Color Customization

**Per-calendar color:**
- Already in schema (`calendars.color`)
- UI: color swatch picker in calendar sidebar (click calendar name → color picker popover)
- On change: `PATCH /api/v1/calendars/:id` with `{ color: '#hexcode' }`
- Colors cascade to all events in that calendar unless event has `color_override`

**Per-event color override:**
- In EventModal.tsx: add color swatch row
- On save: `PATCH /api/v1/events/:id` with `{ color_override: '#hexcode' }`

**Color picker component:** Use shadcn/ui popover + a grid of 12 predefined colors (Google Calendar style) + custom hex input.

---

## Phase 2 Acceptance Criteria

### CalDAV / iCloud
- [ ] User can enter CalDAV URL + credentials → calendars appear in sidebar
- [ ] iCloud events sync correctly (create, edit, delete both ways)

### Subscription Calendars
- [ ] User can paste an `.ics` URL → events appear on calendar
- [ ] Events from subscription calendars are read-only (edit modal shows "Read-only" notice)

### Calendar Sets
- [ ] User can create a Calendar Set with 2 calendars
- [ ] Activating the set hides all other calendars
- [ ] Multiple sets can be active simultaneously (union of calendars shown)

### Month View
- [ ] Events render as colored chips on correct days
- [ ] "+N more" link shows a popover with all events
- [ ] Clicking a day number switches to Day view for that date

### Agenda View
- [ ] Events sorted chronologically, grouped by day
- [ ] Scrolling to bottom loads more days

### Task Integrations
- [ ] User can connect Notion and select a database → tasks appear in task panel
- [ ] Completing a Notion task in TaskTime updates the Notion status
- [ ] User can connect Todoist → projects become task lists, tasks sync
- [ ] User can connect Linear → issues appear in task panel with correct status mapping
- [ ] Google Tasks sync without additional OAuth (uses existing Google connection)

### Zapier
- [ ] User can generate an API key
- [ ] A POST to `/api/v1/zapier/tasks` with the API key creates a task

### Command Palette
- [ ] Cmd+K opens palette
- [ ] Typing "new" shows "New Event" and "New Task" commands
- [ ] Selecting "New Event" opens quick-create
- [ ] Typing 3+ chars searches events and tasks by title

### Colors
- [ ] Clicking a calendar in the sidebar shows a color picker
- [ ] Changing color updates all events of that calendar immediately
