# TaskTime — Product Requirements Document

> **Purpose:** This document is the authoritative specification for building TaskTime, an AI-powered daily planner that unifies calendars and tasks. It is written to be fed directly to AI coding assistants. Every section is designed to be unambiguous enough to implement without follow-up questions.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas](#2-user-personas)
3. [System Architecture](#3-system-architecture)
4. [Feature Specifications](#4-feature-specifications)
   - F1: Calendar Management
   - F2: Task Management
   - F3: Time Blocking
   - F4: AI Planner
   - F5: Calendar Automations
   - F6: Scheduling Links
   - F7: Team Features
   - F8: Notifications & Reminders
   - F9: Settings & Personalization
5. [Data Models](#5-data-models)
6. [API Contracts](#6-api-contracts)
7. [UI/UX Requirements](#7-uiux-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Pricing & Billing](#9-pricing--billing)
10. [Integrations Reference](#10-integrations-reference)
11. [Phased Roadmap](#11-phased-roadmap)

---

## 1. Product Overview

**Product Name:** TaskTime  
**Tagline:** "Daily plans designed by AI, perfected by you"  
**Category:** AI-powered daily planner / unified calendar + task manager

### Core Value Proposition

Knowledge workers use 3–5 separate tools to manage their time: Google Calendar for meetings, Notion or Linear for tasks, Calendly for scheduling, and some ad-hoc system for planning their day. TaskTime replaces all of these with a single application that:

1. Pulls all calendars and tasks into one view
2. Lets users drag tasks onto their calendar to block time
3. Generates AI-driven daily plans that adapt as the day changes
4. Provides scheduling links so others can book time without back-and-forth
5. Automates calendar hygiene (travel time, buffers, cross-account syncing)

### Competitive Positioning

| Feature | TaskTime | Google Calendar | Notion | Motion | Calendly |
|---|---|---|---|---|---|
| Multi-calendar unification | ✓ | Partial | ✗ | ✓ | ✗ |
| Task management | ✓ | ✗ | ✓ | ✓ | ✗ |
| AI daily planning | ✓ | ✗ | ✗ | ✓ | ✗ |
| Scheduling links | ✓ | ✗ | ✗ | ✗ | ✓ |
| Calendar automations | ✓ | ✗ | ✗ | ✗ | ✗ |
| Cross-platform (all OS) | ✓ | Web only | Web only | Web only | Web only |

---

## 2. User Personas

### P1: The Power User (Primary)
- **Profile:** Software engineer or product manager, 5–15 years experience
- **Tools:** Google Calendar (work) + iCloud (personal) + Linear or Notion for tasks
- **Pain:** Constant context-switching between apps; meetings fragment the day; hard to find time for deep work
- **Needs:** Unified view, time blocking, keyboard-first workflow, focus frames

### P2: The Team Manager
- **Profile:** Engineering manager, head of department, 10–20 direct/indirect reports
- **Tools:** Outlook + multiple team calendars + Asana/Jira
- **Pain:** Scheduling across team is painful; can't see team availability at a glance
- **Needs:** Team calendar overlay, round-robin scheduling links, shared calendar sets

### P3: The Freelancer / Consultant
- **Profile:** Independent contractor, coach, advisor
- **Tools:** Google Calendar + Calendly + Todoist
- **Pain:** Paying for Calendly separately; switching apps to check if time is free before proposals
- **Needs:** Embedded booking pages, clean public-facing scheduler, integrated with personal calendar

### P4: The Focus-First User
- **Profile:** Writer, researcher, or creative professional; often self-diagnosed ADHD
- **Tools:** Apple Calendar + Things 3 + some journaling app
- **Pain:** Doesn't know what to work on next; day gets hijacked by reactive work
- **Needs:** AI daily plan, Frames for protected focus time, rollover tracking, capacity warnings

---

## 3. System Architecture

### 3.1 Platform Targets

| Platform | Implementation |
|---|---|
| macOS | Electron or Tauri native app |
| Windows | Electron or Tauri native app |
| Linux | Electron or Tauri native app |
| iOS | React Native or Flutter |
| Android | React Native or Flutter |
| Web | React SPA (same codebase as desktop where possible) |

### 3.2 Backend Stack (Recommended)

- **Runtime:** Node.js (TypeScript) or Go
- **API Layer:** REST + WebSocket (or Server-Sent Events for push)
- **Database:** PostgreSQL (primary data store)
- **Cache / Sessions:** Redis
- **Queue:** Bull (Redis-backed) or similar for background sync jobs
- **File Storage:** S3-compatible (profile images, attachment previews)
- **Email:** SendGrid or Postmark (transactional: booking confirmations, reminders)
- **Payments:** Stripe

### 3.3 External Service Connections

| Service | Protocol | Auth |
|---|---|---|
| Google Calendar | REST (Google Calendar API v3) | OAuth 2.0 |
| Microsoft Outlook/Exchange | REST (Microsoft Graph API) | OAuth 2.0 |
| Apple iCloud Calendar | CalDAV | OAuth 2.0 / App-specific password |
| Fastmail | CalDAV | OAuth 2.0 |
| Generic CalDAV | CalDAV | Basic auth / OAuth |
| Notion | REST (Notion API) | OAuth 2.0 |
| Todoist | REST (Todoist Sync API) | OAuth 2.0 |
| ClickUp | REST (ClickUp API v2) | OAuth 2.0 |
| Linear | GraphQL (Linear API) | OAuth 2.0 |
| Google Tasks | REST (Google Tasks API) | OAuth 2.0 (shared with Calendar) |
| Microsoft To Do | REST (Microsoft Graph API) | OAuth 2.0 (shared with Calendar) |
| Apple Reminders | EventKit (local macOS/iOS only) | System permission |
| Obsidian | Local filesystem (markdown) | None (local only) |
| Zoom | REST (Zoom API) | OAuth 2.0 |
| Google Meet | Part of Google Calendar API | OAuth 2.0 |
| Microsoft Teams | REST (Microsoft Graph API) | OAuth 2.0 |
| Webex | REST (Webex API) | OAuth 2.0 |
| Zapier | Webhook / Zapier App | API key |

### 3.4 Sync Architecture

Calendar sync runs as background jobs:
- **Push:** Google and Microsoft provide webhooks for real-time event changes. Register channel subscriptions and refresh every 7 days.
- **Poll fallback:** For CalDAV / providers without webhooks, poll every 60 seconds using sync tokens / ETags.
- **Conflict resolution:** Server timestamp wins. Last-write wins for event fields. Deletions are soft-deleted (tombstoned) to allow sync propagation.
- **Task sync:** Poll integrations every 60 seconds (or on-demand trigger). Use cursor-based pagination and provider-specific change tokens where available.

---

## 4. Feature Specifications

---

### F1: Calendar Management

#### F1.1 Multi-Account Connection

**Behavior:**
- User can connect unlimited calendar accounts (Pro plan).
- Free trial allows unlimited accounts.
- Each account goes through OAuth 2.0 flow; tokens stored encrypted in database.
- After OAuth, the app fetches all calendars for that account.
- User sees a connection status indicator per account (syncing / connected / error).

**Acceptance Criteria:**
- [ ] User can initiate Google OAuth from Settings → Calendars → Add Account
- [ ] User can initiate Microsoft OAuth from the same flow
- [ ] User can enter CalDAV credentials (URL + username + password) for self-hosted calendars
- [ ] After connecting, all calendars from that account appear in the left sidebar within 10 seconds
- [ ] Disconnecting an account removes all its calendars and events from the local view (does NOT delete them from the source)
- [ ] If OAuth token expires/revokes, the UI shows a "Reconnect" prompt for that account

#### F1.2 Calendar Sets

**Behavior:**
A Calendar Set is a named group of calendars that can be toggled on/off as a unit. Think of them as "modes" — Work mode shows only work calendars; Personal mode shows only personal; All shows everything.

**Acceptance Criteria:**
- [ ] User can create a Calendar Set by selecting any combination of calendars across any connected accounts
- [ ] Calendar Sets appear as chips/tabs in the top of the calendar sidebar
- [ ] Clicking a Calendar Set hides all calendars not in the set and shows only those in the set
- [ ] Multiple Calendar Sets can be active simultaneously (they combine)
- [ ] User can name, rename, and delete Calendar Sets
- [ ] Calendar Sets are persisted per-user; sync across devices

#### F1.3 Calendar Views

**Behavior:**
The main area shows calendar events in one of five views:

| View | Description |
|---|---|
| Day | Single day, 24-hour time grid, current time indicator |
| Week | 7-day grid (Mon–Sun or Sun–Sat, per settings), time columns |
| 2-Week | 14-day grid, compressed rows |
| Month | Traditional month grid, events as chips |
| Agenda | List of upcoming events, grouped by day, scrollable |

**Acceptance Criteria:**
- [ ] User can switch views via keyboard shortcut (D=Day, W=Week, M=Month, A=Agenda) or view selector buttons
- [ ] Day/Week views show current time as a colored horizontal line
- [ ] All-day events appear in a fixed band at the top of Day/Week views
- [ ] Events from multiple calendars display in their respective calendar colors
- [ ] Events can overlap; overlapping events display side-by-side in columns
- [ ] Week view shows total event load per day (hours of meetings)
- [ ] 2-Week view is available as an optional extended range from Week view

#### F1.4 Event CRUD

**Create:**
- Click-and-drag on calendar to define a time slot → opens quick-create popover
- Quick-create fields: title, calendar selector, time (pre-filled from drag)
- Pressing Enter saves; pressing Tab → More Options opens full edit modal
- Full edit modal fields: title, calendar, date, start time, end time, all-day toggle, location, description, recurrence, attendees, conferencing link, reminders, color override

**Read:**
- Events display as colored blocks on the calendar grid
- Clicking an event opens a popover showing: title, time, calendar, location, attendees, description (truncated), conferencing join button
- Popover has Edit (pencil) and Delete (trash) actions

**Update:**
- Edit via popover → opens full edit modal
- Drag event to new time slot to reschedule
- Drag event edge to resize duration
- Changes sync to source calendar within 5 seconds

**Delete:**
- Delete button in popover or edit modal
- For recurring events: confirm dialog asks "Delete this event / This and following / All events"
- Soft-deleted locally; propagated to source calendar

**Recurrence (RFC 5545 RRULE support):**
- Daily, Weekly, Monthly, Yearly
- Custom: every N days/weeks/months
- End conditions: never, after N occurrences, on date
- UI shows human-readable summary ("Every Monday and Wednesday, until Dec 31")

**Acceptance Criteria:**
- [ ] Creating an event via click-drag sets start/end from the drag selection
- [ ] Event appears on calendar immediately (optimistic UI); syncs to source in background
- [ ] Editing an event opens modal pre-filled with current values
- [ ] Dragging an event to a different day or time updates it; undo available (Cmd+Z)
- [ ] Deleting a recurring event shows the three-option dialog
- [ ] All-day events appear in the all-day band and span multiple days correctly

#### F1.5 Reminders

- Per-event: user adds N reminders (e.g., 10 min before, 1 day before)
- Per-calendar: default reminder applied to all new events on that calendar
- Reminder types: push notification (desktop/mobile), email
- Reminder values: 5, 10, 15, 30 min; 1, 2 hours; 1, 2 days (plus custom)

#### F1.6 Meeting Links / Conferencing

- When creating/editing an event with attendees, user can click "Add conferencing" to attach a Zoom/Meet/Teams/Webex link
- Requires the respective conferencing integration to be connected (see F6)
- The generated link appears in the event description and in the popover as a prominent "Join" button
- Clicking Join opens the conferencing app directly

#### F1.7 Subscription Calendars

- User can paste an iCal feed URL (`.ics`) to subscribe to an external calendar
- Examples: public holiday calendars, sports schedules, class timetables
- Subscription calendars are read-only (cannot edit events)
- Refresh interval: every 12 hours
- Available on desktop only (not mobile, due to performance)

#### F1.8 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `N` | New event |
| `T` | New task |
| `D` | Day view |
| `W` | Week view |
| `M` | Month view |
| `A` | Agenda view |
| `←` / `→` | Previous / Next period |
| `Cmd+Z` | Undo last action |
| `Cmd+K` | Open command palette |
| `Esc` | Close modal/popover |
| `Enter` | Confirm quick-create |
| `/` | Focus task search |

---

### F2: Task Management

#### F2.1 Native Tasks

Every user has a native task store within TaskTime (no external integration required).

**Task fields:**
- `title` (required, string)
- `notes` (optional, rich text / markdown)
- `due_date` (optional, date or datetime)
- `duration_minutes` (optional, int — estimate of time needed, used by AI planner)
- `priority` (optional, 1=Urgent, 2=High, 3=Normal, 4=Low)
- `status` (open | in_progress | done | cancelled)
- `tags` (array of strings)
- `list_id` (which task list this belongs to)
- `subtasks` (array of nested tasks, max 2 levels deep)
- `scheduled_event_id` (FK to Event — set when task is time-blocked)
- `recurrence` (optional, same RRULE format as events)

**Task Lists:**
- Tasks are organized into Lists (equivalent to projects)
- User can create, rename, delete, and reorder lists
- Default list: "Inbox" (always exists, cannot be deleted)
- Lists can be archived (hidden from main view, preserved)

**Acceptance Criteria:**
- [ ] User can create a task from the task panel with just a title (Enter to save)
- [ ] Task panel shows tasks sorted by: due date (default), priority, or list
- [ ] User can filter tasks by: all, today, overdue, no due date, by list, by tag
- [ ] Completing a task (checkbox) marks it done; task disappears from active view
- [ ] Completed tasks visible in a "Completed" section (collapsible, sorted by completion date)
- [ ] Subtasks visible as indented items; completing all subtasks does NOT auto-complete parent
- [ ] Tasks with due dates show relative dates ("Today", "Tomorrow", "3 days", "Overdue")
- [ ] Overdue tasks display in red

#### F2.2 External Task Integrations

Each integration follows the same pattern:
1. User connects via OAuth (or API key for some providers)
2. User selects which workspace/database/project to sync
3. Tasks appear in a dedicated list named after the integration source
4. Changes made in TaskTime sync back to source; changes in source sync to TaskTime

**Supported integrations and field mappings:**

**Notion**
- User selects a Notion database (must have Date and Title properties at minimum)
- Property mapping: user maps Notion properties to TaskTime fields (title, due_date, status, priority)
- Syncs: title, due_date, status completion
- Bidirectional: checking a task done in TaskTime updates Notion status

**Todoist**
- Full bidirectional sync of tasks, due dates, priority, project
- Subtasks supported
- Labels map to TaskTime tags

**ClickUp**
- Sync tasks from selected Space/Folder/List
- Fields: title, due date, priority, status, time estimate
- Time estimate maps to `duration_minutes`
- Updates ClickUp's time tracker when event is created from task

**Linear**
- Sync issues from selected Team/Project
- Fields: title, description, due date, priority, status
- Status mapping: Backlog/Todo → open, In Progress → in_progress, Done → done, Cancelled → cancelled

**Google Tasks**
- Sync all task lists
- Simple fields: title, due date, notes, completed
- Bidirectional

**Microsoft To Do**
- Sync all task lists
- Fields: title, due date, notes, reminder, completed

**Apple Reminders** (macOS/iOS local only)
- Uses EventKit framework (local, no internet required)
- Sync all reminder lists
- Fields: title, due date, notes, completed, priority

**Obsidian** (local desktop only)
- Reads markdown files from a user-selected vault folder
- Parses tasks using `- [ ] Task title` syntax
- Supports metadata via Dataview format: `due:: 2025-01-15`, `priority:: high`
- Read-write: checking a task done in TaskTime writes `- [x]` back to the markdown file

**Zapier Bridge**
- User gets a TaskTime API key
- Zapier app supports: "New Task" trigger, "Create Task" action, "Update Task Status" action
- Enables TickTick, Things 3, Evernote, and 5,000+ other Zapier-supported apps

---

### F3: Time Blocking

Time blocking converts tasks into calendar events, linking the two objects together.

#### F3.1 Drag-and-Drop Time Blocking

**Behavior:**
- Tasks in the task panel have a drag handle (six-dot icon on hover)
- User drags a task from the panel onto the calendar grid
- Dropping creates a new calendar event on the primary calendar
- Event title = task title; duration = task's `duration_minutes` (default 60 min if not set)
- The task's `scheduled_event_id` is set to the new event's ID
- On the calendar, the event displays a small indicator (task icon) showing it's a time block

**Edits to a time-blocked event:**
- Moving the event (drag) → updates scheduled time only; task unchanged
- Resizing the event → updates `duration_minutes` on the task
- Marking event as "done" / completing via calendar popover → marks the task as done
- Deleting the event → removes the time block; task returns to unscheduled state

**Acceptance Criteria:**
- [ ] Dragging a task onto a calendar time slot creates an event; task shows a "scheduled" badge
- [ ] The event and task stay linked; changes to event duration reflect in task duration
- [ ] Completing the time-block event marks the underlying task done
- [ ] Deleting the event un-schedules the task without deleting it
- [ ] User can create multiple time blocks for the same task (e.g., split across days)
- [ ] Overlapping time blocks show a visual conflict warning

#### F3.2 Task Duration Slots

- When dragging a task, a ghost element follows the cursor
- The ghost snaps to 15-minute grid increments
- Ghost height = task's estimated duration (minimum 30 min display height)
- Scroll the calendar while dragging to reach other days

#### F3.3 Unscheduled Task View

- Tasks without `scheduled_event_id` appear in the task panel with a calendar icon button
- Clicking the calendar icon opens a mini date picker to schedule directly (sets start time but prompts user to pick time)
- Alternatively, inline scheduling: the AI can suggest a time slot (see F4)

---

### F4: AI Planner

The AI Planner analyzes the user's calendar, tasks, working hours, and Frames to produce a daily schedule and real-time recommendations.

**Key design principle:** The AI suggests; the user decides. Nothing is automatically moved or scheduled without explicit user approval.

#### F4.1 Daily Plan Generation

**Trigger:**
- Automatically generated each morning at 6:00 AM (user's local time)
- Can be manually triggered at any time from the planner panel
- Regenerated when the user accepts/rejects a recommendation (to reflect the new state)

**Algorithm inputs:**
- All calendar events for today (already scheduled meetings, time blocks)
- All tasks with `due_date = today` or `due_date < today` (overdue)
- Tasks flagged by user as "focus today" 
- Tasks with approaching deadlines (due within 3 days) and non-zero `duration_minutes`
- User's `working_hours` (e.g., 9am–6pm)
- Active Frames (focus windows — see F4.3)
- Free gaps between calendar events

**Algorithm output:**
A `DailyPlan` object containing an ordered list of `ScheduledItem` objects:

```
ScheduledItem {
  type: "event" | "task_suggestion"
  event_id?: string         // for type=event
  task_id?: string          // for type=task_suggestion
  suggested_start: datetime
  suggested_end: datetime
  reason: string            // human-readable: "Due today", "3-day deadline", etc.
  status: "pending" | "accepted" | "rejected"
}
```

**Display:**
- The AI Planner panel appears as a right sidebar or collapsible bottom drawer
- Shows a chronological list of the day's events + task suggestions
- Task suggestions have Accept (✓) and Reject (✗) buttons
- Accepting a suggestion creates a time-block event on the user's primary calendar
- Rejecting hides the suggestion from the plan (but the task remains in the task list)

**Acceptance Criteria:**
- [ ] Plan generates by 6:00 AM each day; user receives a push notification ("Your plan for today is ready")
- [ ] Plan shows existing calendar events interspersed with unscheduled task suggestions
- [ ] Each suggested task shows: title, estimated duration, reason for inclusion, suggested time slot
- [ ] Accepting a suggestion creates a calendar event; the plan updates to reflect the now-scheduled task
- [ ] Rejecting removes it from the plan view; does not affect the task itself
- [ ] User can re-run plan generation at any time ("Regenerate plan" button)
- [ ] If the day is already fully booked, the plan shows a "No available slots" warning

#### F4.2 Real-Time Recommendations (Recommendations Panel)

The recommendations panel is always visible (small badge count) and updates throughout the day when:
- A meeting is added that blocks a previously suggested task slot
- A task reaches overdue status
- The day is more than 80% booked with meetings
- An incomplete task from yesterday has no scheduled slot

**Recommendation types:**

| Type | Trigger | Suggested Action |
|---|---|---|
| Conflict | Meeting overlaps a time-blocked task | "Reschedule [Task] — it conflicts with [Meeting]" |
| Overdue | Task due date passed with status=open | "Reschedule [Task] (was due [date])" |
| At risk | Task due in ≤3 days, duration>0, not scheduled | "Schedule [Task] — due in 2 days, needs 1h" |
| Capacity | >80% of working hours booked | "Heavy day: [X]h of meetings. Reschedule [list] to tomorrow?" |
| Rollover | Yesterday's incomplete tasks | "From yesterday: [Task 1], [Task 2] — schedule them today?" |

**Acceptance Criteria:**
- [ ] Badge count on recommendations panel updates in real time as conditions change
- [ ] Each recommendation shows the task/event name and a 1-sentence explanation
- [ ] Each recommendation has an action button ("Schedule", "Reschedule", "Dismiss")
- [ ] Dismissed recommendations do not reappear for 24 hours (unless condition worsens)

#### F4.3 Frames (Focus Windows)

Frames are user-defined time blocks that the AI treats as protected or preferred work time.

**Frame fields:**
- `name` (e.g., "Deep Work", "Admin", "Creative")
- `days_of_week` (Mon=1 through Sun=7, multi-select)
- `start_time` / `end_time` (e.g., 09:00–11:00)
- `is_focus` (bool) — if true, AI will not schedule meetings in this window and will prefer to place focus tasks here
- `preferred_task_tags` (optional array) — AI prefers tasks with these tags during this frame

**Display:**
- Frames appear as a colored background overlay on the calendar (similar to all-day events but spanning the time range)
- Frames do not create calendar events and are invisible to attendees

**Acceptance Criteria:**
- [ ] User can create, edit, and delete Frames in Settings → AI Planner → Frames
- [ ] Frames appear as shaded background on the calendar in their respective time slots
- [ ] When generating a daily plan, the AI places matching tasks inside Frame windows first
- [ ] Focus frames are not suggested as availability for scheduling links (F6) by default

#### F4.4 Rollover

At 6:00 AM each day:
- Query all tasks with `status = open` and `due_date <= yesterday`
- Add them to today's recommendations panel as Rollover items
- Rollover items are sorted by overdue age (oldest first)
- User can: Schedule today, Schedule for later (pick date), or Dismiss

---

### F5: Calendar Automations

Automations are rules that run in the background and modify calendar events automatically. They are configured in Settings → Automations.

Each automation has:
- `name` (user-defined)
- `is_enabled` (toggle)
- `trigger_config` (JSON, varies by type)
- `action_config` (JSON, varies by type)

#### F5.1 Travel Time Blocking

**What it does:** When an event has a physical location, automatically creates a "Travel" event before (and optionally after) it.

**Trigger config:**
```json
{
  "apply_to_calendars": ["cal_id_1", "cal_id_2"],
  "home_address": "123 Main St, City, State"
}
```

**Action config:**
```json
{
  "commute_mode": "driving" | "transit" | "walking" | "cycling",
  "add_before": true,
  "add_after": true,
  "block_calendar": "cal_id_3",
  "buffer_extra_minutes": 5
}
```

**Behavior:**
- When a new event is created/updated with a `location` field, the automation triggers
- Calls a mapping/routing API to estimate travel time from `home_address` to event location
- Creates a new event titled "Travel to [Event Name]" (or "Travel from [Event Name]") on `block_calendar`
- Travel event is linked to the original event; if the original is moved, travel block updates automatically
- Travel event is created as "Busy" status; not shared with attendees

**Acceptance Criteria:**
- [ ] Travel blocks are created within 30 seconds of saving an event with a location
- [ ] Moving or deleting the original event moves or deletes the linked travel block
- [ ] Travel block title clearly references the original event
- [ ] If two consecutive events are in the same location, travel blocks are skipped between them

#### F5.2 Buffer Time

**What it does:** Automatically adds buffer time before and/or after meetings.

**Trigger config:**
```json
{
  "apply_to_calendars": ["cal_id_1"],
  "min_meeting_duration_minutes": 15
}
```

**Action config:**
```json
{
  "buffer_before_minutes": 5,
  "buffer_after_minutes": 10,
  "block_calendar": "cal_id_2",
  "block_title": "Buffer"
}
```

**Behavior:**
- When an event longer than `min_meeting_duration_minutes` is created, insert buffer blocks
- Buffer blocks are visible only to the user (created on their own calendar)
- If two meetings are back-to-back, buffer blocks still appear but may visually overlap (user aware of tight schedule)

**Acceptance Criteria:**
- [ ] Buffer blocks created within 30 seconds of meeting creation
- [ ] Buffer blocks update when meeting time changes
- [ ] Buffer blocks are deleted when the meeting is deleted

#### F5.3 Calendar Sync (Mirror)

**What it does:** Copies events from one calendar to another, maintaining sync. Used to show work meetings on a personal calendar (without sharing details).

**Trigger config:**
```json
{
  "source_calendar_id": "cal_id_1"
}
```

**Action config:**
```json
{
  "target_calendar_id": "cal_id_2",
  "title_override": "Busy",
  "hide_details": true,
  "copy_color": false,
  "event_color": "#808080"
}
```

**Behavior:**
- Events on source calendar are mirrored to target calendar
- If `hide_details=true`: copied event has title=`title_override`, no description, no attendees, no location
- If `hide_details=false`: full copy with all fields
- Mirrored events are tagged with a metadata field to identify them as mirrors (prevents infinite sync loops)
- Deletions on source propagate to mirror within 60 seconds

**Acceptance Criteria:**
- [ ] Mirror events appear on target calendar within 60 seconds of source event creation
- [ ] Editing the source event updates the mirror
- [ ] Deleting the source event deletes the mirror
- [ ] Mirror events cannot be edited directly (show a "managed by sync" notice)

#### F5.4 Event Copy with Transformation

**What it does:** A one-time or rule-based copy of events with transformation applied. Unlike Sync (F5.3), copies are independent after creation.

**Trigger:** Manual (user right-clicks event → "Copy to calendar with rules") or rule-based on matching criteria.

**Action config:**
```json
{
  "target_calendar_id": "cal_id_2",
  "title_transform": "prefix" | "suffix" | "replace",
  "title_value": "[COPY] ",
  "color_override": "#FF5733"
}
```

---

### F6: Scheduling Links (Booking Pages)

#### F6.1 Booking Page Creation

Users create public booking pages at `tasktime.app/book/[slug]` (or custom domain).

**Booking Page fields:**
- `slug` (URL-safe string, unique per user)
- `name` (display name, e.g., "30-min Chat")
- `description` (shown to booker, supports basic markdown)
- `duration_options` (array of minute values: [15, 30, 60])
- `calendar_ids` (calendars checked for availability conflicts)
- `buffer_before_minutes` (default: 0)
- `buffer_after_minutes` (default: 0)
- `advance_notice_hours` (minimum hours ahead a booking can be made, default: 1)
- `booking_window_days` (how many days ahead bookings are accepted, default: 60)
- `max_per_day` (maximum bookings per calendar day, default: unlimited)
- `working_hours_override` (optional, overrides user's global working hours for this page)
- `questions` (array of Question objects for the booking form)
- `conferencing_provider` (zoom | google_meet | teams | webex | none)
- `is_active` (bool)
- `color` (accent color for the public booking page)
- `booking_target_calendar_id` (which calendar new bookings are created on)

**Question object:**
```json
{
  "id": "q1",
  "label": "What would you like to discuss?",
  "type": "text" | "textarea" | "select" | "checkbox",
  "options": ["Option A", "Option B"],
  "required": true
}
```

#### F6.2 Availability Algorithm

When a visitor loads the booking page (`GET /booking/:slug/slots?date=2025-01-15&duration=30`):

1. Fetch all events from `calendar_ids` for the date range
2. Mark slots as unavailable if:
   - An existing event overlaps (including buffer time)
   - Slot is outside working hours (or `working_hours_override`)
   - Slot is before `now + advance_notice_hours`
   - Slot is after `now + booking_window_days` days
   - `max_per_day` bookings already exist for that date
3. Return available 30-min (or duration) slots at 15-min increments

**Acceptance Criteria:**
- [ ] Available slots are accurate to within 60 seconds (cache with short TTL)
- [ ] Slots respect all connected calendars, not just the primary
- [ ] Buffer time is factored into availability (no back-to-back bookings)
- [ ] Booking confirmation page shows a summary and ICS download link

#### F6.3 Booking Flow (Public Page)

1. Visitor lands on `tasktime.app/book/[slug]`
2. Page shows: name, description, duration picker, calendar date picker
3. After selecting date, available time slots appear
4. Visitor selects a slot, clicks "Next"
5. Booking form: Name (required), Email (required), any custom questions
6. Visitor submits → server validates slot is still available
7. If slot still free:
   - Creates event on `booking_target_calendar_id`
   - Sends confirmation email to visitor (with ICS attachment)
   - Sends notification to page owner
   - Displays "Booked!" confirmation with calendar download link
8. If slot taken (race condition):
   - Return to slot selection with "That slot was just taken" message

#### F6.4 Embed Widget

- Users can embed the booking page on their website via an `<iframe>` or a JavaScript snippet
- The embed is responsive; minimum width 320px
- Snippet is available from the booking page settings: copy `<script>` tag

#### F6.5 Team Scheduling Types

- **Round Robin:** Incoming bookings are distributed evenly across connected team members. Each member must have their own booking page connected.
- **Collective:** All team members must be free for the slot to be shown. Useful for group calls.

---

### F7: Team Features

#### F7.1 Team Accounts

- Team plans require a minimum of 2 seats
- One member is the Team Owner (manages billing and seats)
- Roles: Owner, Admin (can manage members), Member
- Inviting a member: Owner/Admin sends email invite → recipient creates account or logs in → joins team

#### F7.2 Team Calendar Overlay

- Team members can share their calendar availability with teammates
- Sharing levels: Free/Busy only | Full event details | None
- When a team member's calendar is shared, it appears in the sidebar under "Team" section
- Team member's events displayed in a muted version of their profile color

**Acceptance Criteria:**
- [ ] Team member can opt in/out of calendar sharing per account
- [ ] Viewing a team member's calendar shows their events in the main calendar view when toggled
- [ ] Free/Busy mode shows grey blocks with no title
- [ ] Full details mode shows event title and time

#### F7.3 Team Scheduling Links

- Team owner/admin can create booking pages of type "round_robin" or "collective"
- Team booking pages reference team member availability (all members must have connected their calendars)
- Bookings created via team pages assign to the round-robin member or create collective meetings

---

### F8: Notifications & Reminders

#### F8.1 Event Reminders

- Configurable per event: any number of reminders
- Configurable per calendar: default reminder applied to all new events
- Reminder lead times: 5 min, 10 min, 15 min, 30 min, 1h, 2h, 1 day, 2 days, custom (minutes)
- Delivery channels: desktop push notification, mobile push, email

#### F8.2 Daily Plan Notification

- Delivered at 6:00 AM user's local time
- Content: "Your plan for [Date] is ready. You have [N] meetings and [M] tasks to schedule."
- Tapping opens the app to the AI Planner panel
- User can configure delivery time (5:00 AM – 9:00 AM) or disable

#### F8.3 Booking Notifications

- When someone books via a scheduling link:
  - Owner receives: push notification + email with booker name, time, answers to questions
  - Booker receives: confirmation email with ICS calendar attachment + meeting details

#### F8.4 Task Due Notifications

- Day before due date: "Task '[Name]' is due tomorrow"
- Day of due date: "Task '[Name]' is due today"
- Overdue: daily reminder until task is completed or rescheduled
- All configurable in Settings → Notifications

---

### F9: Settings & Personalization

#### F9.1 Working Hours

- User defines working days (checkboxes: Mon–Sun)
- Per-day start and end time
- Used by: AI Planner (constrains task placement), Scheduling Links (constrains availability)
- Example: Mon–Fri 9:00 AM–6:00 PM; no working hours on weekends

#### F9.2 Time Zones

- User has a primary time zone (account-level)
- Per-event time zone override (for travel scenarios)
- Events display in user's primary time zone
- All-day events are timezone-agnostic (float)
- Calendar can display a secondary time zone column in Day/Week views

#### F9.3 General Settings

| Setting | Options | Default |
|---|---|---|
| Week starts on | Sunday / Monday | Monday |
| Default event duration | 15, 30, 45, 60 min | 30 min |
| Default video conferencing | Zoom / Meet / Teams / Webex / None | None |
| Theme | Light / Dark / System | System |
| Language | en, de, fr, es, pt, ja (initial set) | en |
| First day work hour | Time | 9:00 AM |
| Time format | 12h / 24h | System default |
| Date format | MM/DD/YY, DD/MM/YY, YYYY-MM-DD | System default |

#### F9.4 Keyboard Shortcuts

- All default shortcuts listed in F1.8 apply globally
- Users can remap shortcuts from Settings → Shortcuts
- Shortcut conflicts are detected and flagged

---

## 5. Data Models

### PostgreSQL Schema

```sql
-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  working_hours JSONB NOT NULL DEFAULT '{
    "monday":    {"start": "09:00", "end": "18:00", "enabled": true},
    "tuesday":   {"start": "09:00", "end": "18:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "18:00", "enabled": true},
    "thursday":  {"start": "09:00", "end": "18:00", "enabled": true},
    "friday":    {"start": "09:00", "end": "18:00", "enabled": true},
    "saturday":  {"start": "09:00", "end": "18:00", "enabled": false},
    "sunday":    {"start": "09:00", "end": "18:00", "enabled": false}
  }',
  preferences   JSONB NOT NULL DEFAULT '{}',
  plan          TEXT NOT NULL DEFAULT 'trial',
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Calendar accounts (OAuth connections)
CREATE TABLE calendar_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL, -- 'google' | 'microsoft' | 'icloud' | 'caldav' | 'fastmail'
  provider_account_id TEXT,      -- email or account identifier from provider
  display_name    TEXT,
  oauth_access_token  TEXT,      -- encrypted
  oauth_refresh_token TEXT,      -- encrypted
  oauth_expires_at    TIMESTAMPTZ,
  caldav_url      TEXT,          -- for CalDAV accounts
  sync_cursor     TEXT,          -- provider-specific sync token
  webhook_channel_id TEXT,       -- for Google push notifications
  webhook_expires_at  TIMESTAMPTZ,
  last_synced_at  TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active', -- 'active' | 'error' | 'disconnected'
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual calendars within an account
CREATE TABLE calendars (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES calendar_accounts(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_calendar_id  TEXT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  color                 TEXT NOT NULL DEFAULT '#4285F4',
  is_primary            BOOLEAN NOT NULL DEFAULT FALSE,
  is_visible            BOOLEAN NOT NULL DEFAULT TRUE,
  is_read_only          BOOLEAN NOT NULL DEFAULT FALSE,
  is_subscription       BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_url      TEXT,
  sync_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, provider_calendar_id)
);

-- Calendar sets
CREATE TABLE calendar_sets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  calendar_ids UUID[] NOT NULL DEFAULT '{}',
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id          UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_event_id    TEXT,
  title                TEXT NOT NULL DEFAULT '',
  description          TEXT,
  location             TEXT,
  start_at             TIMESTAMPTZ NOT NULL,
  end_at               TIMESTAMPTZ NOT NULL,
  is_all_day           BOOLEAN NOT NULL DEFAULT FALSE,
  timezone             TEXT,
  recurrence_rule      TEXT,          -- RFC 5545 RRULE string
  recurrence_id        TEXT,          -- for recurring event instances
  recurring_event_id   UUID REFERENCES events(id), -- parent recurring event
  status               TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'tentative' | 'cancelled'
  visibility           TEXT NOT NULL DEFAULT 'default', -- 'public' | 'private' | 'default'
  attendees            JSONB NOT NULL DEFAULT '[]',
  conferencing_url     TEXT,
  conferencing_provider TEXT,
  reminders            JSONB NOT NULL DEFAULT '[]',
  color_override       TEXT,
  is_time_block        BOOLEAN NOT NULL DEFAULT FALSE,
  task_id              UUID REFERENCES tasks(id) ON DELETE SET NULL,
  is_mirror            BOOLEAN NOT NULL DEFAULT FALSE, -- created by sync automation
  automation_id        UUID,          -- which automation created this (if mirror)
  organizer            JSONB,         -- {email, name}
  raw_data             JSONB,         -- full provider payload for debugging
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,   -- soft delete
  UNIQUE(calendar_id, provider_event_id)
);

CREATE INDEX events_user_date ON events(user_id, start_at, end_at) WHERE deleted_at IS NULL;
CREATE INDEX events_calendar ON events(calendar_id) WHERE deleted_at IS NULL;

-- Tasks
CREATE TABLE tasks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_id              UUID REFERENCES task_lists(id) ON DELETE SET NULL,
  parent_task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  source               TEXT NOT NULL DEFAULT 'native', -- 'native' | 'notion' | 'todoist' | 'clickup' | 'linear' | 'google_tasks' | 'ms_todo' | 'apple_reminders' | 'obsidian'
  source_id            TEXT,           -- provider's task ID
  source_url           TEXT,           -- deep link to task in source app
  title                TEXT NOT NULL DEFAULT '',
  notes                TEXT,           -- markdown
  due_date             DATE,
  due_datetime         TIMESTAMPTZ,    -- when time-specific
  duration_minutes     INT,            -- estimated time needed
  priority             INT DEFAULT 3 CHECK (priority BETWEEN 1 AND 4), -- 1=Urgent, 4=Low
  status               TEXT NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'done' | 'cancelled'
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  scheduled_event_id   UUID REFERENCES events(id) ON DELETE SET NULL,
  recurrence_rule      TEXT,
  sort_order           FLOAT NOT NULL DEFAULT 0,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX tasks_user_status ON tasks(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX tasks_user_due ON tasks(user_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX tasks_source ON tasks(source, source_id);

-- Task lists
CREATE TABLE task_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  source      TEXT NOT NULL DEFAULT 'native',
  source_id   TEXT,
  is_inbox    BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task integrations
CREATE TABLE task_integrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  display_name   TEXT,
  oauth_access_token  TEXT,   -- encrypted
  oauth_refresh_token TEXT,   -- encrypted
  oauth_expires_at    TIMESTAMPTZ,
  api_key        TEXT,         -- encrypted (for providers using API key)
  config         JSONB NOT NULL DEFAULT '{}', -- provider-specific: database_id, workspace_id, etc.
  sync_cursor    TEXT,
  last_synced_at TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'active',
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Booking pages
CREATE TABLE booking_pages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id                  UUID,
  slug                     TEXT NOT NULL UNIQUE,
  name                     TEXT NOT NULL,
  description              TEXT,
  duration_options         INT[] NOT NULL DEFAULT '{30}',
  calendar_ids             UUID[] NOT NULL DEFAULT '{}',
  booking_target_calendar_id UUID REFERENCES calendars(id),
  buffer_before_minutes    INT NOT NULL DEFAULT 0,
  buffer_after_minutes     INT NOT NULL DEFAULT 0,
  advance_notice_hours     INT NOT NULL DEFAULT 1,
  booking_window_days      INT NOT NULL DEFAULT 60,
  max_per_day              INT,
  working_hours_override   JSONB,
  questions                JSONB NOT NULL DEFAULT '[]',
  conferencing_provider    TEXT,
  booking_type             TEXT NOT NULL DEFAULT 'one_on_one', -- 'one_on_one' | 'round_robin' | 'collective'
  color                    TEXT NOT NULL DEFAULT '#6366F1',
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings (confirmed appointments)
CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_page_id UUID NOT NULL REFERENCES booking_pages(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id),
  booker_name     TEXT NOT NULL,
  booker_email    TEXT NOT NULL,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  answers         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'cancelled' | 'no_show'
  cancellation_token TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automations
CREATE TABLE automations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL, -- 'travel_time' | 'buffer' | 'sync' | 'event_copy'
  name           TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_config  JSONB NOT NULL DEFAULT '{}',
  is_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  run_count      INT NOT NULL DEFAULT 0,
  last_run_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Frames
CREATE TABLE ai_frames (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  color             TEXT NOT NULL DEFAULT '#8B5CF6',
  days_of_week      INT[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 1=Mon, 7=Sun
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  is_focus          BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_tags    TEXT[] NOT NULL DEFAULT '{}',
  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily plans
CREATE TABLE daily_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  items            JSONB NOT NULL DEFAULT '[]',
  recommendations  JSONB NOT NULL DEFAULT '[]',
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_at      TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'active', -- 'draft' | 'active' | 'completed'
  UNIQUE(user_id, date)
);

-- Teams
CREATE TABLE teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES users(id),
  plan       TEXT NOT NULL DEFAULT 'team',
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_members (
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  calendar_sharing TEXT NOT NULL DEFAULT 'none', -- 'none' | 'free_busy' | 'full'
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);
```

---

## 6. API Contracts

All endpoints are prefixed with `/api/v1`. Authentication via Bearer JWT token in `Authorization` header.

### 6.1 Auth

```
POST /auth/signup
  Body: { email, password, name, timezone }
  Response 201: { user, access_token, refresh_token }

POST /auth/login
  Body: { email, password }
  Response 200: { user, access_token, refresh_token }

POST /auth/refresh
  Body: { refresh_token }
  Response 200: { access_token, refresh_token }

DELETE /auth/session
  Response 204

GET /auth/google
  → Redirect to Google OAuth (includes state param)

GET /auth/google/callback?code=&state=
  → Redirect to app with tokens

GET /auth/microsoft
GET /auth/microsoft/callback
GET /auth/apple
GET /auth/apple/callback
  → Same pattern as Google
```

### 6.2 Calendar Accounts

```
GET /calendar-accounts
  Response 200: { accounts: CalendarAccount[] }

POST /calendar-accounts/caldav
  Body: { url, username, password, display_name }
  Response 201: { account: CalendarAccount, calendars: Calendar[] }

DELETE /calendar-accounts/:id
  Response 204

POST /calendar-accounts/:id/sync
  Response 202: { job_id }

GET /calendar-accounts/:id/status
  Response 200: { status, last_synced_at, error_message }
```

### 6.3 Calendars

```
GET /calendars
  Response 200: { calendars: Calendar[] }

PATCH /calendars/:id
  Body: { name?, color?, is_visible?, sync_enabled?, sort_order? }
  Response 200: { calendar: Calendar }

GET /calendar-sets
  Response 200: { sets: CalendarSet[] }

POST /calendar-sets
  Body: { name, calendar_ids[] }
  Response 201: { set: CalendarSet }

PATCH /calendar-sets/:id
  Body: { name?, calendar_ids? }
  Response 200: { set: CalendarSet }

DELETE /calendar-sets/:id
  Response 204
```

### 6.4 Events

```
GET /events
  Query: start (ISO 8601), end (ISO 8601), calendar_ids[] (optional)
  Response 200: { events: Event[] }

POST /events
  Body: {
    calendar_id, title, start_at, end_at, is_all_day?,
    description?, location?, recurrence_rule?, attendees?,
    conferencing_provider?, reminders?, color_override?
  }
  Response 201: { event: Event }

PATCH /events/:id
  Body: (any subset of Event fields)
  Response 200: { event: Event }

DELETE /events/:id
  Query: scope ("this" | "this_and_following" | "all") — for recurring events
  Response 204

POST /events/:id/duplicate
  Body: { target_calendar_id?, title_prefix? }
  Response 201: { event: Event }
```

### 6.5 Tasks

```
GET /tasks
  Query: status?, due_before? (date), due_after? (date), source?, list_id?, tag?, search?
  Response 200: { tasks: Task[], total: int }

POST /tasks
  Body: { title, list_id?, due_date?, duration_minutes?, priority?, notes?, tags? }
  Response 201: { task: Task }

PATCH /tasks/:id
  Body: (any subset of Task fields)
  Response 200: { task: Task }

DELETE /tasks/:id
  Response 204

POST /tasks/:id/complete
  Response 200: { task: Task }

POST /tasks/:id/schedule
  Body: { start_at, end_at, calendar_id }
  Response 201: { event: Event, task: Task }

GET /task-lists
  Response 200: { lists: TaskList[] }

POST /task-lists
  Body: { name, color? }
  Response 201: { list: TaskList }

PATCH /task-lists/:id
  Body: { name?, color?, is_archived? }
  Response 200: { list: TaskList }

DELETE /task-lists/:id
  Response 204
```

### 6.6 Task Integrations

```
GET /task-integrations
  Response 200: { integrations: TaskIntegration[] }

GET /task-integrations/:provider/auth
  → Redirect to provider OAuth

GET /task-integrations/:provider/callback
  → Handle callback, create integration

PATCH /task-integrations/:id/config
  Body: { config: {} }  -- provider-specific config (database_id, etc.)
  Response 200: { integration: TaskIntegration }

DELETE /task-integrations/:id
  Response 204

POST /task-integrations/:id/sync
  Response 202: { job_id }
```

### 6.7 AI Planner

```
GET /planner/today
  Response 200: { plan: DailyPlan }

GET /planner/:date
  Query: date (YYYY-MM-DD)
  Response 200: { plan: DailyPlan }

POST /planner/generate
  Body: { date? }  -- defaults to today
  Response 200: { plan: DailyPlan }

PATCH /planner/items/:item_id/accept
  Response 200: { item: PlanItem, event: Event }

PATCH /planner/items/:item_id/reject
  Response 200: { item: PlanItem }

PATCH /planner/items/:item_id/reschedule
  Body: { start_at, end_at }
  Response 200: { item: PlanItem, event: Event }

GET /planner/recommendations
  Response 200: { recommendations: Recommendation[] }

POST /planner/recommendations/:id/dismiss
  Response 204

GET /planner/frames
  Response 200: { frames: AIFrame[] }

POST /planner/frames
  Body: { name, color?, days_of_week[], start_time, end_time, is_focus?, preferred_tags? }
  Response 201: { frame: AIFrame }

PATCH /planner/frames/:id
  Body: (any subset)
  Response 200: { frame: AIFrame }

DELETE /planner/frames/:id
  Response 204
```

### 6.8 Booking Pages

```
GET /booking-pages
  Response 200: { pages: BookingPage[] }

POST /booking-pages
  Body: {
    slug, name, description?, duration_options[], calendar_ids[],
    booking_target_calendar_id, buffer_before_minutes?, buffer_after_minutes?,
    advance_notice_hours?, booking_window_days?, max_per_day?,
    questions?, conferencing_provider?, color?
  }
  Response 201: { page: BookingPage }

PATCH /booking-pages/:id
  Body: (any subset)
  Response 200: { page: BookingPage }

DELETE /booking-pages/:id
  Response 204

-- Public endpoints (no auth required)

GET /book/:slug
  Response 200: { page: PublicBookingPage }

GET /book/:slug/slots
  Query: date (YYYY-MM-DD), duration (minutes)
  Response 200: { slots: TimeSlot[] }
  TimeSlot: { start_at: ISO8601, end_at: ISO8601, available: bool }

POST /book/:slug
  Body: { duration, start_at, booker_name, booker_email, answers: {} }
  Response 201: { booking: Booking, ics_url: string }

DELETE /book/cancel/:token
  Response 200: { message: "Booking cancelled" }
```

### 6.9 Automations

```
GET /automations
  Response 200: { automations: Automation[] }

POST /automations
  Body: { type, name, trigger_config, action_config }
  Response 201: { automation: Automation }

PATCH /automations/:id
  Body: { name?, trigger_config?, action_config?, is_enabled? }
  Response 200: { automation: Automation }

DELETE /automations/:id
  Response 204
```

### 6.10 WebSocket / Real-Time

Connect to `wss://api.tasktime.app/ws` with `Authorization: Bearer <token>` header.

**Incoming messages (server → client):**

```json
{ "type": "event.created",  "data": { "event": Event } }
{ "type": "event.updated",  "data": { "event": Event } }
{ "type": "event.deleted",  "data": { "event_id": "uuid" } }
{ "type": "task.updated",   "data": { "task": Task } }
{ "type": "plan.updated",   "data": { "plan": DailyPlan } }
{ "type": "recommendation.added", "data": { "recommendation": Recommendation } }
{ "type": "sync.complete",  "data": { "account_id": "uuid", "calendar_ids": [] } }
```

**Outgoing messages (client → server):**

```json
{ "type": "ping" }
```

**Server responds:**
```json
{ "type": "pong" }
```

---

## 7. UI/UX Requirements

### 7.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]  [Nav: Calendar | Tasks | Settings]       [Profile]     │ ← Top Bar (48px)
├──────────┬──────────────────────────────────┬────────────────────┤
│          │  [View switcher] [← Today →]     │                    │
│ Calendar │                                  │  AI Planner /      │
│ Sidebar  │        Calendar Grid             │  Recommendations   │
│  (240px) │                                  │  Panel (300px)     │
│          │                                  │                    │
│ Tasks    │                                  │                    │
│ Panel    │                                  │                    │
│          │                                  │                    │
└──────────┴──────────────────────────────────┴────────────────────┘
```

**Left Sidebar (240px, collapsible):**
- Mini month navigator (click day → jump to day view)
- "My Calendars" section: list of calendar accounts/calendars with colored checkbox toggles
- "Calendar Sets" section: named sets as chips
- "Task Lists" section: list of task lists with counts
- "Team" section (if team member): team member calendars
- Collapse button → sidebar hides, calendar expands

**Task Panel (280px, toggled separately from sidebar):**
- Filter bar: All | Today | Overdue | No Date | search input
- List selector dropdown
- Task list (virtual scroll for performance)
- Each task row: [checkbox] [drag handle] [title] [due date chip] [duration chip]
- "+ New Task" button at bottom
- Drag handle visible on hover

**Calendar Grid (main area, flexible width):**
- Time column (left): hours labeled in user's time format
- Day columns: events as colored blocks
- Current time indicator: red horizontal line
- Drag zone for task drops (highlight on drag-over)

**AI Panel (300px, right side, collapsible):**
- "Today's Plan" tab: ordered list of events + suggestions
- "Recommendations" tab: badge count, list of action items
- Minimized state: just a badge button in the top-right

### 7.2 Event Block Design

- Background: calendar color at 80% opacity
- Border: 2px solid calendar color at 100%
- Text: title (bold, truncated), time (smaller)
- Time block events: show small task icon (📋) in top-right corner
- Past events: 40% opacity
- Conflict events: orange dashed border
- Conference join button: visible on hover

### 7.3 Command Palette (Cmd+K)

Opens a centered modal with a search input. Commands include:
- "New event" → focus on calendar to click
- "New task" → focus task panel input
- "Go to [date]" → parse natural date, navigate
- "Connect calendar"
- "Connect task integration"
- "Create booking page"
- Search for an existing event or task by title

### 7.4 Onboarding Flow

New users see a stepped wizard after email verification:

```
Step 1: Connect your calendar
  → Google / Outlook / Apple / Skip
  
Step 2: Connect your task tool (optional)
  → Notion / Todoist / Linear / ClickUp / Skip

Step 3: Set your working hours
  → Mon–Fri 9am–6pm (pre-filled, editable)

Step 4: Your first plan
  → "Generate my plan" button
  → Shows today's plan with any existing events
  
Done: "Let's go!" → lands on main calendar view
```

### 7.5 Quick-Create Popover

Appears when user clicks or drags on the calendar:
```
┌──────────────────────────────────┐
│  [Event title input...         ] │
│  [Calendar ▼] [Time: 2pm–3pm  ] │
│  [Enter to save] [More options]  │
└──────────────────────────────────┘
```

### 7.6 Responsive / Mobile Web

- Minimum supported width: 768px (tablet)
- Below 768px: show mobile app prompt
- On tablet: sidebar collapses to icon-only; task panel hides behind toggle

### 7.7 Accessibility

- All interactive elements keyboard-navigable (Tab, Shift+Tab, Enter, Space, Escape)
- ARIA labels on all icon buttons
- Color contrast: minimum WCAG AA (4.5:1 ratio)
- Focus indicators visible at all times
- Screen reader announcements for dynamic updates (plan changes, notifications)

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Metric | Target |
|---|---|
| Initial app load (desktop) | <3s on 10Mbps |
| Events load for 30-day range | <500ms |
| Task list load (first 100) | <200ms |
| Calendar sync propagation | <30s from source change |
| Task sync propagation | <60s from source change |
| Booking page slot calculation | <1s |
| WebSocket reconnection | <5s on network restore |

### 8.2 Reliability

- Backend: 99.9% monthly uptime
- Calendar sync: retry with exponential backoff on failure (max 5 retries)
- Offline mode (desktop): app loads cached events/tasks; operations queue and sync on reconnect
- Data loss prevention: optimistic UI with rollback on API failure

### 8.3 Security

- OAuth tokens encrypted at rest using AES-256
- JWT access tokens expire in 1 hour; refresh tokens in 30 days
- Refresh token rotation: each use issues a new refresh token
- HTTPS only (HSTS)
- Rate limiting: 100 req/min per user for read endpoints, 30 req/min for write
- Booking pages: 10 submissions/hour per IP to prevent spam
- No calendar credentials stored in plaintext (OAuth only, no password storage for external calendars)
- Row-level security: all queries scoped to `user_id`; no cross-user data leakage
- GDPR: data export endpoint, account deletion (purges all data within 30 days)

### 8.4 Scalability

- Horizontal scaling for API servers
- Database connection pooling (PgBouncer)
- Redis for session cache and rate limiting
- Background sync jobs run on worker processes (separate from API)
- CDN for static assets (desktop app, web frontend)

---

## 9. Pricing & Billing

### 9.1 Plans

| | Free Trial | Pro | Team |
|---|---|---|---|
| Duration | 14 days | Ongoing | Ongoing |
| Calendar accounts | Unlimited | Unlimited | Unlimited per seat |
| Task integrations | All | All | All |
| AI Planner | ✓ | ✓ | ✓ |
| Scheduling links | ✓ | ✓ | ✓ (team types) |
| Calendar automations | ✓ | ✓ | ✓ |
| Team features | ✗ | ✗ | ✓ |
| Monthly price | Free | $30/mo | $25/seat/mo |
| Annual price | — | $15/mo | $10/seat/mo |

After trial ends, account downgrades to read-only (can view but not create/edit). User prompted to subscribe.

### 9.2 Discounts

| Discount | Amount | Verification |
|---|---|---|
| Annual billing | 50% off monthly price | Applied automatically |
| Students / Academics | 25% off | Email domain check or manual verification |
| Nonprofits | 25% off | Manual verification |
| Competitor switcher | 15% off | Self-reported (honor system, coupon code) |

### 9.3 Stripe Integration

- Checkout: Stripe Checkout or embedded Stripe Elements
- Webhooks: handle `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- Metered billing for team seats: add/remove seats via Stripe subscription items (prorated)
- Coupon codes: Stripe coupon objects
- 30-day money-back: manual refund via Stripe dashboard or automated refund endpoint

### 9.4 Billing API

```
GET  /billing/subscription    → current plan details
POST /billing/checkout        → create Stripe checkout session
POST /billing/portal          → create Stripe billing portal session (manage/cancel)
POST /billing/webhook         → Stripe webhook handler (unauthed, verified by signature)
```

---

## 10. Integrations Reference

### 10.1 Google Calendar

- **API:** Google Calendar API v3
- **Auth:** OAuth 2.0 scopes: `https://www.googleapis.com/auth/calendar`
- **Push notifications:** Create watch channels on `events` resource; refresh every 7 days
- **Sync:** Use `syncToken` for incremental sync; fall back to full sync if token invalid
- **Meeting links:** Use `conferenceData` field when creating events; requires `sendUpdates: "all"`

### 10.2 Microsoft Graph (Outlook/Exchange/Teams/To Do)

- **API:** Microsoft Graph v1.0
- **Auth:** OAuth 2.0, scopes: `Calendars.ReadWrite`, `Tasks.ReadWrite`, `OnlineMeetings.ReadWrite`
- **Push notifications:** Create subscriptions on `/me/events`; refresh every 3 days (max subscription duration)
- **Sync:** Use `deltaToken` from `$delta` query parameter for incremental sync

### 10.3 Apple iCloud (CalDAV)

- **Protocol:** CalDAV (RFC 4791)
- **Server:** `https://caldav.icloud.com`
- **Auth:** OAuth 2.0 (Apple Sign In) + app-specific password for CalDAV
- **Sync:** WebDAV `PROPFIND` + `REPORT` requests; use ETags and `sync-collection` for incremental sync

### 10.4 Notion

- **API:** Notion API (notion.so/developers)
- **Auth:** OAuth 2.0 with `read_content write_content read_user` capabilities
- **Task sync:** Query database pages with filters; use `last_edited_time` as cursor
- **Property mapping:** Store user's mapping in `config` JSONB field of `task_integrations`

### 10.5 Todoist

- **API:** Todoist Sync API v9
- **Auth:** OAuth 2.0
- **Sync:** Use `sync_token` for incremental sync; subscribe to real-time sync via `sync_token`
- **Fields:** `content` → title, `due` → due_date, `priority` → priority (inverted: Todoist 4=Urgent)

### 10.6 Linear

- **API:** Linear GraphQL API
- **Auth:** OAuth 2.0
- **Sync:** Use `updatedAt` cursor; subscribe to webhooks for real-time updates
- **Fields:** `title`, `description`, `dueDate`, `priority` (0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low), `state.name` → status mapping

### 10.7 Zoom

- **API:** Zoom API v2
- **Auth:** OAuth 2.0, scope: `meeting:write`
- **Meeting creation:** `POST /users/me/meetings` with `type: 2` (scheduled meeting)
- **Return:** join URL + meeting ID attached to event `conferencing_url`

---

## 11. Phased Roadmap

Follow this sequence strictly. Each phase must be fully functional and tested before the next begins.

---

### Phase 1 — Core MVP

**Goal:** A working calendar app with native tasks and time blocking.

**Deliverables:**
- [ ] User auth (email + password, JWT)
- [ ] Google Calendar OAuth + sync (read + write)
- [ ] Microsoft Outlook OAuth + sync (read + write)
- [ ] Day view and Week view (fully functional)
- [ ] Event CRUD (create, edit, delete, drag to reschedule, resize)
- [ ] Native task management (task list, CRUD, subtasks)
- [ ] Time blocking (drag task → calendar → creates event)
- [ ] Task list panel in sidebar
- [ ] Basic settings (working hours, theme, time format)
- [ ] Web app (React SPA)

**Test checklist:**
- Create a Google Calendar event in TaskTime → appears in Google Calendar app within 30 sec
- Create a Google Calendar event in Google Calendar → appears in TaskTime within 30 sec
- Drag a task onto the calendar → event created; task shows "scheduled" badge
- Complete the time-block event → task marked done

---

### Phase 2 — Integrations

**Goal:** Support all major calendar and task providers.

**Deliverables:**
- [ ] iCloud / CalDAV calendar support
- [ ] Fastmail calendar support
- [ ] Subscription calendars (iCal URL)
- [ ] Calendar Sets (create, toggle, persist)
- [ ] Color customization per calendar and per event
- [ ] Notion task integration
- [ ] Todoist task integration
- [ ] Linear task integration
- [ ] Google Tasks integration
- [ ] Microsoft To Do integration
- [ ] Month view and Agenda view
- [ ] Command palette (Cmd+K)
- [ ] Keyboard shortcuts (all from F1.8)

**Test checklist:**
- Connect Notion database → tasks appear in TaskTime
- Mark a Notion task done in TaskTime → Notion page status updates
- Create a CalDAV event → syncs correctly
- Toggle a Calendar Set → only selected calendars visible

---

### Phase 3 — Scheduling Links

**Goal:** Built-in meeting scheduler that replaces Calendly.

**Deliverables:**
- [ ] Booking page creation UI
- [ ] Public booking page at `/book/:slug`
- [ ] Real-time availability calculation (respects all connected calendars)
- [ ] Booking confirmation flow (creates event, sends email, ICS download)
- [ ] Zoom / Google Meet / Teams link auto-generation on booking
- [ ] Buffer time settings on booking page
- [ ] Custom booking questions
- [ ] Embed snippet generation
- [ ] Booking management dashboard (view/cancel bookings)

**Test checklist:**
- Create a booking page → visit public URL → slot selection works with real availability
- Book a slot → event appears on host's calendar; confirmation email sent to booker
- Block a slot on the host's calendar → slot disappears from booking page within 60 sec
- Buffer time set to 15 min → no bookings can be made back-to-back within 15 min

---

### Phase 4 — Calendar Automations

**Goal:** Hands-free calendar hygiene.

**Deliverables:**
- [ ] Travel Time automation (requires location API, e.g., Google Maps Distance Matrix)
- [ ] Buffer Time automation
- [ ] Calendar Sync (mirror) automation
- [ ] Event Copy automation
- [ ] Automation management UI (list, enable/disable, edit)
- [ ] Automation run log / history

**Test checklist:**
- Create a location-based event → travel time block appears within 30 sec
- Move the event → travel block moves with it
- Configure calendar mirror → events from source calendar appear on target

---

### Phase 5 — AI Planner

**Goal:** AI-generated daily plans with proactive recommendations.

**Deliverables:**
- [ ] AI Frame definition UI
- [ ] Frames displayed as background overlay on calendar
- [ ] Daily plan generation algorithm (rule-based first, LLM-enhanced second)
- [ ] Daily plan panel in UI
- [ ] Accept/reject/reschedule plan suggestions
- [ ] Recommendations panel (conflicts, overdue, at-risk, capacity, rollover)
- [ ] 6:00 AM plan generation job + push notification
- [ ] Plan regeneration trigger on calendar changes
- [ ] "Regenerate plan" manual button

**AI model integration:**
- Use Claude API (`claude-sonnet-4-6`) for plan reasoning
- Prompt includes: today's events (JSON), unscheduled tasks (JSON), frames, working hours
- Output: ordered list of task placements with time slots and reason strings
- Fallback: if API unavailable, use rule-based heuristic (sort by priority + due date, fill gaps)

**Test checklist:**
- Set Frame "Deep Work" 9am–11am → AI places focus tasks in that window
- Leave a task unscheduled with today's due date → appears in recommendations
- Accept a plan suggestion → event created on calendar; plan updates
- Overbook a day with meetings → capacity warning appears in recommendations

---

### Phase 6 — Teams, Mobile, & Polish

**Goal:** Team features, mobile apps, and production-readiness.

**Deliverables:**
- [ ] Team account creation and seat management
- [ ] Team member invite flow
- [ ] Team calendar sharing (free/busy + full details modes)
- [ ] Team booking page types (round-robin, collective)
- [ ] iOS app (React Native or Flutter)
- [ ] Android app (React Native or Flutter)
- [ ] Desktop app packaging (Electron or Tauri): macOS, Windows, Linux
- [ ] Push notifications (mobile: FCM/APNs; desktop: native OS notifications)
- [ ] Daily digest email
- [ ] Apple Reminders integration (local, macOS/iOS)
- [ ] Obsidian integration (local, desktop)
- [ ] Zapier integration (API key, Zap triggers/actions)
- [ ] Onboarding wizard (4-step flow)
- [ ] Stripe billing (checkout, portal, webhooks)
- [ ] GDPR: data export + account deletion
- [ ] 99.9% uptime infrastructure (redundant backend, DB replication)

**Test checklist:**
- Invite a team member → they receive email, join team, see shared calendars
- Round-robin booking page → bookings alternate between team members
- Mobile app: create event, drag task to calendar, view AI recommendations
- Subscribe, cancel, re-subscribe via Stripe billing portal

---

*End of PRD*

---

**Document version:** 1.0  
**Source:** Reverse-engineered from morgen.so  
**Last updated:** 2026-04-28
