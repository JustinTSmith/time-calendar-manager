# Phase 1 — Core MVP

> **Agent brief:** Build a fully working calendar + task + time-blocking app. By the end of this phase, a user can connect Google or Outlook, see all their events in a day/week calendar view, manage native tasks in a sidebar, and drag tasks onto the calendar to create time blocks. No AI, no automations, no booking pages — just the core.

**Read before starting:**
- `PRD.md` — full product specification
- `ARCHITECTURE.md` — tech stack decisions (do not deviate)

**Estimated output:** ~8,000 lines of code  
**Phase duration:** Complete before starting Phase 2

---

## Prerequisites

- Node.js 20 LTS installed
- pnpm installed globally (`npm i -g pnpm`)
- PostgreSQL 15 running locally (or Docker)
- Redis 7 running locally (or Docker)
- Google Cloud Console project with Calendar API enabled + OAuth 2.0 credentials
- Microsoft Azure app registration with Calendar permissions

---

## Deliverables Checklist

- [ ] Monorepo scaffold (Turborepo + pnpm workspaces)
- [ ] `packages/db` — Drizzle schema + migrations for Phase 1 tables
- [ ] `packages/types` — Shared TypeScript types
- [ ] `apps/api` — Fastify API server
- [ ] Auth: email/password signup + login + JWT refresh
- [ ] Google Calendar OAuth connect + bidirectional sync
- [ ] Microsoft Outlook OAuth connect + bidirectional sync
- [ ] Events API (CRUD)
- [ ] Tasks API (CRUD, lists)
- [ ] Time blocking API (POST /tasks/:id/schedule)
- [ ] `apps/web` — Next.js 14 App Router frontend
- [ ] Auth UI (login, signup, OAuth callback)
- [ ] Calendar sidebar (calendar list, visibility toggle)
- [ ] Day view calendar grid (custom, pixel-accurate)
- [ ] Week view calendar grid
- [ ] Event quick-create (click/drag on grid)
- [ ] Event edit modal (full fields)
- [ ] Task panel sidebar (task list, CRUD, drag handles)
- [ ] Drag task → calendar → creates time block
- [ ] Real-time sync via Socket.io (events update without refresh)
- [ ] Basic settings page (working hours, theme, time format)
- [ ] Docker Compose for local dev (postgres + redis)
- [ ] Vitest unit tests for services
- [ ] Playwright e2e smoke tests for critical paths

---

## Step 1: Monorepo Scaffold

### Files to create:

**`package.json` (root)**
```json
{
  "name": "tasktime",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "db:migrate": "turbo db:migrate",
    "db:studio": "cd packages/db && pnpm drizzle-kit studio"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

**`pnpm-workspace.yaml`**
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**`turbo.json`**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "db:migrate": { "cache": false }
  }
}
```

**`docker-compose.yml`**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: tasktime
      POSTGRES_USER: tasktime
      POSTGRES_PASSWORD: password
    ports: ['5432:5432']
    volumes: ['postgres_data:/var/lib/postgresql/data']
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    volumes: ['redis_data:/data']
volumes:
  postgres_data:
  redis_data:
```

---

## Step 2: `packages/db`

### Schema tables for Phase 1 (from PRD.md Section 5):
- `users`
- `calendar_accounts`
- `calendars`
- `calendar_sets`
- `events`
- `tasks`
- `task_lists`

### Files:
- `packages/db/src/schema.ts` — Full Drizzle schema matching PRD.md Section 5 exactly
- `packages/db/src/client.ts` — Drizzle client (see ARCHITECTURE.md)
- `packages/db/src/index.ts` — Re-export schema + client
- `packages/db/drizzle.config.ts` — Points to schema, sets migrations folder
- `packages/db/package.json` — Dependencies: `drizzle-orm`, `drizzle-kit`, `postgres`

**Requirements:**
- Use `pgEnum` for `status` fields, `provider` fields, etc.
- Add all indexes specified in PRD.md Section 5
- `users.working_hours` stored as `jsonb` with the default from PRD.md
- `events.attendees` stored as `jsonb` array: `[{ email: string, name: string, responseStatus: 'accepted'|'declined'|'tentative'|'needsAction' }]`
- `events.reminders` stored as `jsonb`: `[{ method: 'popup'|'email', minutes: number }]`
- Run `drizzle-kit generate` to create initial migration after schema is defined

---

## Step 3: `packages/types`

Create shared TypeScript interfaces that mirror the Drizzle schema select types. These are used by both `apps/api` and `apps/web`.

```typescript
// packages/types/src/index.ts
export type User = { id: string; email: string; name: string; timezone: string; ... }
export type CalendarAccount = { ... }
export type Calendar = { ... }
export type Event = { ... }
export type Task = { ... }
export type TaskList = { ... }

// API response wrappers
export type ApiResponse<T> = { data: T }
export type ApiError = { error: { code: string; message: string; details?: unknown } }
export type PaginatedResponse<T> = { data: T[]; meta: { total: number; page: number; per_page: number; has_more: boolean } }
```

---

## Step 4: `apps/api` — Server Setup

### Entry point: `apps/api/src/index.ts`

```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { Server } from 'socket.io'

const app = Fastify({ logger: true })

// Plugins
await app.register(cors, { origin: process.env.WEB_URL, credentials: true })
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// Routes
await app.register(authRoutes, { prefix: '/api/v1/auth' })
await app.register(calendarRoutes, { prefix: '/api/v1' })
await app.register(eventRoutes, { prefix: '/api/v1' })
await app.register(taskRoutes, { prefix: '/api/v1' })

// Socket.io
const io = new Server(app.server, { cors: { origin: process.env.WEB_URL } })
// Auth middleware for Socket.io — validate JWT from handshake.auth.token

await app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
```

### Auth middleware
Create `apps/api/src/middleware/auth.ts`:
- Fastify `preHandler` hook
- Extract `Authorization: Bearer <token>` header
- Verify with `jose` library using `JWT_ACCESS_SECRET`
- Set `request.user = { id, email }` on success
- Return 401 with `AUTH_REQUIRED` or `AUTH_EXPIRED` code on failure

### Error handler
Create `apps/api/src/middleware/error-handler.ts`:
- Catches Zod validation errors → 422 with field details
- Catches known app errors (use a custom `AppError` class with `code` + `statusCode`)
- Catches unknown errors → 500 `INTERNAL_ERROR`

---

## Step 5: Auth Routes

**File:** `apps/api/src/routes/auth.ts`

### POST /api/v1/auth/signup
```
Body: { email: string, name: string, password: string, timezone: string }
- Validate with Zod
- Check email not already in use → 409 CONFLICT
- Hash password with bcrypt (rounds: 12)
- Create user in DB
- Create "Inbox" task list for user
- Issue access + refresh tokens
Response 201: { data: { user: User, access_token: string, refresh_token: string } }
```

### POST /api/v1/auth/login
```
Body: { email: string, password: string }
- Find user by email → 401 if not found
- Compare password with bcrypt → 401 if mismatch
- Issue tokens
Response 200: { data: { user: User, access_token: string, refresh_token: string } }
```

### POST /api/v1/auth/refresh
```
Body: { refresh_token: string }
- Verify JWT with JWT_REFRESH_SECRET
- Check token exists in refresh_tokens table (not revoked)
- Revoke old token, issue new pair
Response 200: { data: { access_token: string, refresh_token: string } }
```

### DELETE /api/v1/auth/session
```
Headers: Authorization required
- Revoke the refresh token for this session
Response 204
```

### GET /api/v1/auth/google
```
- Generate state (random 32 bytes hex, store in Redis with 10min TTL)
- Build Google OAuth URL with scopes: ['https://www.googleapis.com/auth/calendar', 'email', 'profile']
- Redirect 302 to Google
```

### GET /api/v1/auth/google/callback
```
Query: { code, state }
- Validate state from Redis → 400 if invalid/expired
- Exchange code for tokens via Google OAuth
- Fetch user profile (email, name) from Google
- Find or create user by email
- Store OAuth tokens encrypted in calendar_accounts table (provider='google')
- Trigger full calendar sync job
- Redirect to WEB_URL/auth/callback?access_token=&refresh_token=
```

### GET /api/v1/auth/microsoft and GET /api/v1/auth/microsoft/callback
Follow the same pattern as Google using Microsoft Graph API and MSAL.

---

## Step 6: Calendar Sync Service

**File:** `apps/api/src/services/calendar-sync/google-sync.ts`

### Full sync (on account connect):
```
1. GET https://www.googleapis.com/calendar/v3/users/me/calendarList
   → Create Calendar rows for each item
2. For each calendar, GET events:
   GET /calendars/{calendarId}/events?timeMin=<now-30days>&timeMax=<now+180days>&singleEvents=true
3. Upsert events into DB (by provider_event_id)
4. Store nextSyncToken from response
5. Register push channel:
   POST /calendars/{calendarId}/events/watch
   Body: { id: uuid, type: 'web_hook', address: API_URL + '/api/v1/webhooks/google' }
```

### Incremental sync (on webhook or periodic):
```
1. GET /calendars/{calendarId}/events?syncToken=<stored_token>
2. Process changed events (status='cancelled' → soft-delete)
3. Store new nextSyncToken
4. Emit socket.io events to user room: event:created|updated|deleted
```

### Webhook endpoint: POST /api/v1/webhooks/google
```
- Validate X-Goog-Channel-ID and X-Goog-Resource-State headers
- Queue incremental sync job for the affected calendar
Response 200 (always, to acknowledge)
```

**File:** `apps/api/src/services/calendar-sync/microsoft-sync.ts`

Follow same pattern using Microsoft Graph API:
- `GET /me/calendarGroups` and `GET /me/calendars`
- `GET /me/calendars/{id}/events?$select=...&$top=100` with `@odata.nextLink` pagination
- Delta sync: `GET /me/calendars/{id}/events/delta?$deltatoken=<token>`
- Subscriptions: `POST /subscriptions` with `changeType: 'created,updated,deleted'`
- Webhook: POST /api/v1/webhooks/microsoft

**Sync worker:** `apps/api/src/workers/calendar-sync.worker.ts`
- BullMQ worker consuming `calendar-sync` queue
- Jobs: `{ type: 'full' | 'incremental', accountId: string, calendarId?: string }`
- Concurrency: 5 workers max

---

## Step 7: Events API

**File:** `apps/api/src/routes/events.ts`

All routes require auth middleware.

### GET /api/v1/events
```
Query: { start: string (ISO8601), end: string (ISO8601), calendar_ids?: string[] }
- Validate date range (max 90 days)
- Query events WHERE user_id = req.user.id AND start_at >= start AND end_at <= end AND deleted_at IS NULL
- If calendar_ids provided, filter by those
Response 200: { data: Event[] }
```

### POST /api/v1/events
```
Body: { calendar_id, title, start_at, end_at, is_all_day?, description?, location?,
        recurrence_rule?, attendees?, conferencing_provider?, reminders?, color_override? }
- Validate calendar belongs to user
- Create event in DB
- Push to provider calendar API (async, queue job)
- Emit socket.io event:created to user room
Response 201: { data: Event }
```

### PATCH /api/v1/events/:id
```
Body: (any event fields)
- Validate event belongs to user
- If recurrence event and scope not provided → treat as 'this' only
- Update event in DB
- Push update to provider (async)
- Emit event:updated
Response 200: { data: Event }
```

### DELETE /api/v1/events/:id
```
Query: { scope?: 'this' | 'this_and_following' | 'all' }
- Validate event belongs to user
- Soft-delete (set deleted_at = NOW())
- Push delete to provider (async)
- Emit event:deleted
Response 204
```

### POST /api/v1/events/:id/duplicate
```
Body: { target_calendar_id?, title_prefix? }
- Clone event with new ID
- Apply title_prefix if provided
Response 201: { data: Event }
```

**Event write-back worker:** `apps/api/src/workers/event-write.worker.ts`
- Consumes `event-write` queue
- Job types: `create`, `update`, `delete` with provider (google|microsoft)
- Uses stored OAuth token for the calendar's account
- Retries up to 5 times with exponential backoff

---

## Step 8: Tasks API

**File:** `apps/api/src/routes/tasks.ts`

### GET /api/v1/tasks
```
Query: { status?, list_id?, due_before?, due_after?, tag?, search?, page?, per_page? }
- Query tasks WHERE user_id = req.user.id AND deleted_at IS NULL
- Filter by status, list_id, due_date range
- If search: WHERE title ILIKE '%{search}%'
- Order by: due_date ASC NULLS LAST, priority ASC, created_at DESC
Response 200: { data: Task[], meta: PaginationMeta }
```

### POST /api/v1/tasks
```
Body: { title, list_id?, due_date?, duration_minutes?, priority?, notes?, tags?, parent_task_id? }
- Default list_id to user's Inbox list
- Assign sort_order as MAX(sort_order) + 1 in the list
Response 201: { data: Task }
```

### PATCH /api/v1/tasks/:id
```
Body: (any task fields)
- Validate task belongs to user
- If status changes to 'done': set completed_at = NOW()
- If status changes from 'done': clear completed_at
Response 200: { data: Task }
```

### DELETE /api/v1/tasks/:id
```
- Soft-delete task
- Also soft-delete all child tasks (subtasks)
- If task has scheduled_event_id: do NOT delete the event (just unlink)
Response 204
```

### POST /api/v1/tasks/:id/complete
```
- Shortcut: set status='done', completed_at=NOW()
- If task has scheduled_event_id: update event title to add "✓" prefix
Response 200: { data: Task }
```

### POST /api/v1/tasks/:id/schedule
```
Body: { start_at: string, end_at: string, calendar_id: string }
- Validate no overlap with existing events (warn, but allow)
- Create Event with is_time_block=true, task_id=<task.id>
- Update task.scheduled_event_id = new event ID
- Return both
Response 201: { data: { task: Task, event: Event } }
```

**Task Lists Routes** (`/api/v1/task-lists`):
- GET: list all non-archived lists for user
- POST: create list
- PATCH /:id: update name/color/archived
- DELETE /:id: only if list is empty or user confirms; move tasks to Inbox

---

## Step 9: `apps/web` — Frontend Setup

### Next.js initialization
```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, fonts, providers
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── callback/page.tsx   # Handles ?access_token=&refresh_token=
│   │   └── (app)/
│   │       ├── layout.tsx      # App shell
│   │       └── page.tsx        # Calendar view (default: week view)
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   └── lib/
```

### Providers setup (`src/app/layout.tsx`)
Wrap children with:
1. `TanStack QueryClientProvider`
2. `ThemeProvider` (light/dark from shadcn/ui)
3. `SocketProvider` (custom: connects Socket.io when user is logged in)
4. `Toaster` (shadcn/ui toast notifications)

### Auth store (`src/stores/auth.store.ts`)
```typescript
// Zustand store
interface AuthStore {
  user: User | null
  accessToken: string | null
  setAuth: (user: User, accessToken: string) => void
  clearAuth: () => void
}
// Persist accessToken to localStorage (not HttpOnly — acceptable for this architecture)
// Refresh token stored in localStorage as well, used by API client on 401
```

### API client (`src/lib/api.ts`)
```typescript
// Thin wrapper around fetch
// - Automatically adds Authorization header
// - On 401: tries refresh, then retries request
// - On refresh fail: clears auth, redirects to /login
// - Returns typed responses
async function apiClient<T>(path: string, options?: RequestInit): Promise<T>
```

---

## Step 10: Calendar UI Components

### `src/components/calendar/CalendarGrid.tsx`
The central component. Renders the time grid.

**Props:**
```typescript
interface CalendarGridProps {
  view: 'day' | 'week'
  currentDate: Date
  events: Event[]
  frames?: AIFrame[]  // Phase 5 — accept but ignore for now
  onSlotClick: (date: Date, time: Date) => void
  onSlotDrag: (start: Date, end: Date) => void
  onEventClick: (event: Event) => void
  onEventDrop: (event: Event, newStart: Date, newEnd: Date) => void
  onEventResize: (event: Event, newEnd: Date) => void
  onTaskDrop: (task: Task, start: Date, end: Date) => void
}
```

**Internal rendering:**
```
Constants: HOUR_HEIGHT = 64 (px per hour), SLOT_HEIGHT = 16 (px per 15min)
Time column: 0:00–23:00, labels at each hour
Day columns: one per day in view (1 for day view, 7 for week view)
Events: absolutely positioned, calculate overlap columns (see ARCHITECTURE.md)
Current time line: red line, re-rendered every minute
```

**Drag interactions:**
- Click + drag on empty slot → `onSlotDrag(start, end)` → opens quick-create popover
- Drag existing event → `onEventDrop` (uses @dnd-kit)
- Drag event bottom edge → `onEventResize`
- Drop task from task panel → `onTaskDrop` — creates time block immediately

### `src/components/calendar/EventBlock.tsx`
Renders a single event on the grid.
```typescript
interface EventBlockProps {
  event: Event
  columnOffset: number   // 0..N for overlap column
  columnCount: number    // total overlapping columns
  isTimeBlock: boolean   // renders task icon if true
  onClick: () => void
}
```

### `src/components/calendar/EventPopover.tsx`
Appears on event click. Shows: title, time, calendar badge, location, attendees (avatars), description, Join button (if conferencing_url), Edit + Delete actions.

### `src/components/calendar/EventModal.tsx`
Full edit modal. Uses React Hook Form + Zod. Fields from PRD.md Section F1.4.

### `src/components/calendar/QuickCreatePopover.tsx`
Appears after click-drag on grid. Fields: title (autofocused), calendar selector, time display. Enter to save, Tab → More Options opens EventModal.

### `src/components/calendar/CalendarSidebar.tsx`
Left sidebar. Sections:
1. Mini month picker (navigate to date on click)
2. Calendar Sets (chips)
3. My Calendars (grouped by account, colored checkbox per calendar)

### `src/hooks/useCalendarEvents.ts`
```typescript
// TanStack Query hook
function useCalendarEvents(start: Date, end: Date, calendarIds?: string[]) {
  return useQuery({
    queryKey: ['events', start.toISOString(), end.toISOString(), calendarIds],
    queryFn: () => apiClient<Event[]>('/events?start=...&end=...'),
    staleTime: 30_000
  })
}
```

---

## Step 11: Task Panel

### `src/components/tasks/TaskPanel.tsx`
Collapsible right panel (or left sidebar extension). Structure:
- Filter bar: chips for All | Today | Overdue | No Date + search input
- List selector: dropdown showing all task lists
- Task list: virtual scroll using `@tanstack/react-virtual` for performance (render 50 tasks max without it)
- "+ New Task" input at bottom (press Enter to create)

### `src/components/tasks/TaskRow.tsx`
```typescript
interface TaskRowProps {
  task: Task
  draggable: true  // always draggable via @dnd-kit
}
```
Renders: checkbox, drag handle (shows on hover), title (strikethrough if done), due date chip (red if overdue), duration badge.

**Drag source setup** (using @dnd-kit):
```typescript
const { attributes, listeners, setNodeRef } = useDraggable({
  id: task.id,
  data: { type: 'task', task }
})
```

The `CalendarGrid` is a drop target listening for `data.type === 'task'` drops.

### Task Drop Handler (in `CalendarGrid`)
```typescript
function handleTaskDrop(task: Task, start: Date, end: Date) {
  const duration = task.duration_minutes ?? 60
  const actualEnd = end ?? addMinutes(start, duration)
  // Call POST /tasks/:id/schedule
  // On success: invalidate events query, update task in store
}
```

---

## Step 12: Real-Time Socket.io Integration

### `src/lib/socket.ts`
```typescript
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function connectSocket(accessToken: string) {
  socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
    auth: { token: accessToken },
    reconnection: true,
    reconnectionDelay: 1000
  })
  return socket
}
```

### `src/providers/SocketProvider.tsx`
- Connects socket when user is authenticated
- Disconnects on logout
- Listens for `event:created|updated|deleted` → calls `queryClient.invalidateQueries(['events'])`
- Listens for `task:updated` → calls `queryClient.invalidateQueries(['tasks'])`

---

## Step 13: Settings Page

**Route:** `(app)/settings/page.tsx`

Sections (tabs):
1. **Profile:** name, email (read-only), timezone selector
2. **Working Hours:** per-day toggles + start/end time pickers; saves to user.working_hours
3. **Appearance:** light/dark/system theme toggle
4. **Calendars:** list of connected accounts with disconnect button; "Add account" button

---

## Step 14: Onboarding (Minimal for Phase 1)

After signup, if user has no connected calendars, show a modal:
```
"Connect your calendar to get started"
[Connect Google Calendar]  [Connect Outlook]  [Skip for now]
```
This is not the full 4-step wizard (that's Phase 6) — just a modal prompt.

---

## Phase 1 Environment Setup

### Local dev startup sequence:
```bash
docker-compose up -d          # Start PostgreSQL + Redis
cd packages/db && pnpm db:migrate  # Run migrations
cd apps/api && pnpm dev       # Start API on :3001
cd apps/web && pnpm dev       # Start Next.js on :3000
```

### Required env files:
- `apps/api/.env` (copy from ARCHITECTURE.md, fill Google/Microsoft credentials)
- `apps/web/.env.local` (copy from ARCHITECTURE.md)

---

## Phase 1 Acceptance Criteria

All items must pass before moving to Phase 2.

### Auth
- [ ] User can sign up with email/password and receive JWT tokens
- [ ] User can log in and receive tokens
- [ ] Expired access token triggers automatic refresh
- [ ] Logging out invalidates the session

### Calendar Connection
- [ ] User can connect Google Calendar via OAuth
- [ ] After connecting, all Google calendars appear in sidebar within 10s
- [ ] User can connect Microsoft Outlook via OAuth
- [ ] Disconnecting an account removes its calendars from the sidebar

### Event Sync
- [ ] Events created in Google Calendar appear in TaskTime within 30s (webhook)
- [ ] Events created in TaskTime appear in Google Calendar within 5s
- [ ] Moving an event in TaskTime moves it in Google Calendar
- [ ] Deleting an event in TaskTime deletes it in Google Calendar

### Calendar UI
- [ ] Day view renders correct time grid with current time indicator
- [ ] Week view renders 7 columns; events render in correct time positions
- [ ] Clicking an empty time slot opens quick-create popover
- [ ] Dragging across a time range pre-fills start/end in quick-create
- [ ] Clicking an event opens popover with correct details
- [ ] Editing an event via modal updates it on the calendar
- [ ] Dragging an event to a new time reschedules it
- [ ] Resizing an event changes its duration

### Tasks
- [ ] User can create a task by typing in the task panel and pressing Enter
- [ ] Tasks show due date chip in red if overdue
- [ ] Completing a task (checkbox) hides it from active view
- [ ] User can create task lists and assign tasks to them

### Time Blocking
- [ ] Dragging a task from the panel onto the calendar creates a time block event
- [ ] The time block event shows a task icon indicator
- [ ] Completing the time block event marks the task as done
- [ ] Deleting the time block event unschedules the task

### Real-Time
- [ ] Opening the app in two browser tabs — creating an event in one tab appears in the other within 2s

### Performance
- [ ] Calendar loads 30 days of events in < 500ms on localhost

---

## Unit Tests to Write

**`apps/api/src/services/__tests__/calendar-sync.test.ts`**
- Test full sync processes all events from mock Google API response
- Test incremental sync handles cancelled events (soft-delete)
- Test webhook handler queues sync job

**`apps/api/src/routes/__tests__/events.test.ts`**
- Test GET /events returns only user's events
- Test POST /events creates event and queues write job
- Test DELETE /events/:id with scope='all' soft-deletes all recurring instances

**`apps/api/src/routes/__tests__/tasks.test.ts`**
- Test task scheduling creates event and links task
- Test completing a linked task marks event with checkmark

---

## E2E Tests to Write (Playwright)

**`apps/web/e2e/auth.spec.ts`**
- Sign up flow
- Login flow
- Logout flow

**`apps/web/e2e/calendar.spec.ts`**
- Connect Google Calendar (mock OAuth in test)
- Create event via click-drag
- Edit event
- Delete event

**`apps/web/e2e/tasks.spec.ts`**
- Create task
- Drag task to calendar (time block)
- Complete time block → task marked done
