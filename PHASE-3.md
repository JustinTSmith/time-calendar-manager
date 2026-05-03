# Phase 3 — Scheduling Links

> **Agent brief:** Add a complete built-in meeting scheduler (replaces Calendly). Users create public booking pages at `/book/:slug`. Visitors select a time slot based on real-time availability pulled from the host's connected calendars. On booking: both parties get calendar invites, the booking event appears on the host's calendar, and confirmation emails are sent.

**Read before starting:** `PRD.md` (Section F6), `ARCHITECTURE.md`, `PHASE-1.md` and `PHASE-2.md` (understand what exists)

**Estimated output:** ~5,000 lines of code  
**Prerequisite:** Phase 2 acceptance criteria all passing

---

## Deliverables Checklist

- [ ] Booking pages CRUD API
- [ ] Availability calculation algorithm (accurate to 60s)
- [ ] Public booking page (unauthenticated `/book/:slug` route)
- [ ] Slot selection UI (calendar date picker + time slot grid)
- [ ] Booking form (name, email, custom questions)
- [ ] Booking confirmation (creates event, sends emails, ICS download)
- [ ] Video conferencing auto-attach (Zoom, Google Meet, Teams, Webex)
- [ ] Booking management dashboard (view, cancel bookings)
- [ ] Booking page builder UI (full configuration)
- [ ] Embed snippet generator
- [ ] Email templates (confirmation, cancellation, notification to host)
- [ ] Booking cancellation flow (via token link in email)

---

## Step 1: Database — New Tables

Add to `packages/db/src/schema.ts`:

```sql
-- booking_pages (already in PRD schema — implement it now)
-- bookings (already in PRD schema — implement it now)

-- Also add:
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,  -- bcrypt hash of the refresh token
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- (This should have been in Phase 1 — add if not already present)
```

Run `drizzle-kit generate && drizzle-kit migrate`.

---

## Step 2: Booking Pages API

**File:** `apps/api/src/routes/booking-pages.ts`

### GET /api/v1/booking-pages
```
Auth required
Returns all booking pages for the authenticated user
Response 200: { data: BookingPage[] }
```

### POST /api/v1/booking-pages
```
Auth required
Body (Zod schema):
{
  slug: string         // 3-50 chars, lowercase letters/numbers/hyphens only, regex: /^[a-z0-9-]{3,50}$/
  name: string         // 1-100 chars
  description?: string // max 500 chars
  duration_options: number[]  // e.g. [15, 30, 60], each must be 5-480
  calendar_ids: string[]      // must belong to user, min 1
  booking_target_calendar_id: string  // must belong to user
  buffer_before_minutes?: number  // 0-60, default 0
  buffer_after_minutes?: number   // 0-60, default 0
  advance_notice_hours?: number   // 0-72, default 1
  booking_window_days?: number    // 1-365, default 60
  max_per_day?: number | null
  working_hours_override?: WorkingHours | null
  questions?: Question[]
  conferencing_provider?: 'zoom' | 'google_meet' | 'teams' | 'webex' | null
  color?: string  // hex color
}
Validation: slug must not already exist for any user
Response 201: { data: BookingPage }
```

### PATCH /api/v1/booking-pages/:id
```
Auth required, must own the booking page
Body: any subset of POST body fields
slug changes: validate new slug uniqueness
Response 200: { data: BookingPage }
```

### DELETE /api/v1/booking-pages/:id
```
Auth required, must own booking page
Soft-delete or hard-delete (no bookings in the future → hard delete; future bookings → 409 error)
Response 204
```

### GET /api/v1/booking-pages/:id/bookings
```
Auth required
Query: { status?: 'confirmed'|'cancelled'|'no_show', from?: date, to?: date }
Returns bookings for this page
Response 200: { data: Booking[], meta: PaginationMeta }
```

### DELETE /api/v1/booking-pages/:id/bookings/:booking_id
```
Auth required (host cancelling a booking)
Sets booking.status = 'cancelled'
Deletes the linked calendar event
Sends cancellation email to booker
Response 204
```

---

## Step 3: Availability Algorithm

**File:** `apps/api/src/services/availability/availability.service.ts`

This is the most critical service. Get it right.

```typescript
interface AvailabilityOptions {
  bookingPage: BookingPage
  date: Date            // the specific day to check
  durationMinutes: number
}

interface TimeSlot {
  start_at: Date
  end_at: Date
  available: boolean
}

async function getAvailableSlots(options: AvailabilityOptions): Promise<TimeSlot[]>
```

**Algorithm (step by step):**

```
1. Determine the working hours window for this day:
   - Use booking_page.working_hours_override if set, else load user.working_hours
   - If the day of week is disabled (e.g., Saturday), return [] immediately
   - Window start = day + working hours start time (user timezone)
   - Window end = day + working hours end time (user timezone)

2. Generate all possible slots at 15-minute increments:
   - Start: window start
   - End: window end - duration_minutes
   - Slots: [window_start, window_start+15min, window_start+30min, ...]
   - Each slot: { start: slotStart, end: slotStart + duration_minutes }

3. Fetch all events from booking_page.calendar_ids for this day:
   - Include buffer: fetch from (window_start - buffer_before_minutes) to (window_end + buffer_after_minutes)
   - Include only events with status != 'cancelled' and deleted_at IS NULL

4. Also fetch same-day bookings for this booking page (to enforce max_per_day):
   - Count confirmed bookings for this date
   - If count >= max_per_day: return all slots as unavailable

5. Mark each slot unavailable if:
   a. (slot.start - buffer_before_minutes) conflicts with any calendar event
      Conflict: event.start_at < (slot.end + buffer_after_minutes) AND event.end_at > (slot.start - buffer_before_minutes)
   b. slot.start < now + advance_notice_hours
   c. slot.start > now + booking_window_days
   d. Slot is outside the working hours window (should never happen given step 2, but check anyway)

6. Return all slots with available flag set

7. Cache result in Redis: key = booking:{slug}:{date}:{duration}, TTL = 60 seconds
```

**Timezone handling:**
```typescript
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
// All slot calculations done in user's timezone
// All returned dates converted to UTC ISO strings for API response
// The booking page stores timezone implicitly via user.timezone
```

---

## Step 4: Public Booking Endpoints (No Auth Required)

**File:** `apps/api/src/routes/public-booking.ts`

### GET /api/v1/book/:slug
```
No auth required
Lookup booking_page by slug where is_active = true
Return a public-safe subset (no calendar_ids, no conferencing credentials):
{
  slug, name, description, duration_options,
  booking_window_days, advance_notice_hours,
  questions, color, timezone (from owner user)
}
Response 200: { data: PublicBookingPage }
Response 404 if not found or is_active=false
```

### GET /api/v1/book/:slug/slots
```
No auth required
Query: { date: string (YYYY-MM-DD), duration: number (minutes) }
Validate duration is in booking_page.duration_options
Call availability service
Response 200: {
  data: {
    date: string,
    slots: Array<{ start_at: string, end_at: string, available: boolean }>
  }
}
Rate limit: 20 req/min per IP
```

### POST /api/v1/book/:slug
```
No auth required
Body: {
  duration: number,
  start_at: string (ISO8601),
  booker_name: string (1-100 chars),
  booker_email: string (valid email),
  answers: Record<string, string>  // keyed by question.id
}
Rate limit: 5 req/min per IP (anti-spam)

Process:
1. Validate body with Zod
2. Re-check slot availability (race condition protection)
   - If slot no longer available: 409 { error: { code: 'SLOT_UNAVAILABLE' } }
3. Generate conferencing link if conferencing_provider set (see Step 5)
4. Create Event on booking_target_calendar_id:
   - title: "{booker_name}" or booking_page.name if you want generic
   - description: answers formatted as text
   - attendees: [{ email: booker_email, name: booker_name }]
   - conferencing_url: generated URL
   - start_at, end_at
5. Create Booking record linking to the event
6. Send confirmation email to booker (with ICS attachment)
7. Send notification email to page owner
8. Push event to provider calendar (same queue as normal events)
9. Emit socket.io event to owner's room: booking:created { booking }

Response 201: {
  data: {
    booking: { id, start_at, end_at, duration_minutes, booker_name },
    ics_url: "/api/v1/book/{slug}/bookings/{id}/ics",
    cancellation_url: "/cancel/{cancellation_token}"
  }
}
```

### GET /api/v1/book/:slug/bookings/:id/ics
```
No auth required
Generate and return an .ics file for the booking
Content-Type: text/calendar
Content-Disposition: attachment; filename="booking.ics"
```

### DELETE /api/v1/book/cancel/:token
```
No auth required
Find booking by cancellation_token
Set status='cancelled'
Delete linked calendar event
Send cancellation emails to both parties
Response 200: { data: { message: "Booking cancelled" } }
```

---

## Step 5: Conferencing Link Generation

**File:** `apps/api/src/services/conferencing/conferencing.service.ts`

```typescript
async function generateConferencingLink(
  provider: 'zoom' | 'google_meet' | 'teams' | 'webex',
  userId: string,
  eventDetails: { title: string; startAt: Date; endAt: Date }
): Promise<string | null>
```

**Google Meet:**
- No separate link generation needed
- When creating the event via Google Calendar API, set `conferenceData.createRequest`:
  ```json
  { "requestId": "<uuid>", "conferenceSolutionKey": { "type": "hangoutsMeet" } }
  ```
- The Meet link is returned in the event response

**Zoom:**
```typescript
// POST https://api.zoom.us/v2/users/me/meetings
// Headers: Authorization: Bearer <zoom_access_token>
// Body: { topic, type: 2, start_time: ISO8601, duration: minutes, timezone }
// Returns: { join_url, id }
```

**Microsoft Teams:**
```typescript
// POST https://graph.microsoft.com/v1.0/me/onlineMeetings
// Headers: Authorization: Bearer <ms_access_token>
// Body: { startDateTime, endDateTime, subject }
// Returns: { joinWebUrl }
```

**Webex:**
```typescript
// POST https://webexapis.com/v1/meetings
// Headers: Authorization: Bearer <webex_access_token>
// Body: { title, start, end, timezone }
// Returns: { webLink }
```

---

## Step 6: ICS File Generation

**File:** `apps/api/src/lib/ics.ts`

```typescript
import { createEvent, EventAttributes } from 'ics'  // package: ics

function generateBookingICS(booking: Booking, event: Event, bookingPage: BookingPage): string {
  const eventAttrs: EventAttributes = {
    uid: booking.id,
    title: bookingPage.name,
    description: `Booked via ${bookingPage.name}\n\n${formatAnswers(booking.answers)}`,
    start: dateToArray(booking.start_at),   // [year, month, day, hour, minute]
    end: dateToArray(booking.end_at),
    location: event.conferencing_url ?? undefined,
    url: event.conferencing_url ?? undefined,
    organizer: { name: 'TaskTime', email: 'noreply@tasktime.app' },
    attendees: [{ name: booking.booker_name, email: booking.booker_email }]
  }
  const { error, value } = createEvent(eventAttrs)
  if (error || !value) throw new Error('Failed to generate ICS')
  return value
}
```

---

## Step 7: Email Templates

**File:** `apps/api/src/lib/email/templates/`

Use Resend with React Email templates (package: `@react-email/components`).

### `booking-confirmation.tsx` (to booker)
```
Subject: "Your meeting is confirmed — {booking_page.name}"
Content:
- Large green checkmark
- "{booking_page.name}" heading
- Date + time (in booker's timezone)
- Duration
- "Add to calendar" button (links to ICS download)
- Video conferencing join link (if applicable)
- Cancellation link: "Need to cancel? Click here"
- Host name + profile
```

### `booking-notification.tsx` (to host)
```
Subject: "New booking: {booker_name} — {formatted_time}"
Content:
- Booker name + email
- Date + time
- Answers to custom questions (formatted list)
- "View in TaskTime" button
```

### `booking-cancellation.tsx` (to both parties)
```
Subject: "Meeting cancelled — {booking_page.name}"
Content:
- Event details
- Who cancelled (host or guest)
- "Book again" link (back to booking page)
```

---

## Step 8: Frontend — Booking Page Builder

**Route:** `(app)/settings/scheduling/page.tsx`

Layout:
- Left: List of booking pages with status indicators
- Right: Booking page detail / create form (sheet/modal)

**`BookingPageForm.tsx`:**

Sections (use tabs or accordion):
1. **Basics:** Name, URL slug (shows live preview: `tasktime.app/book/{slug}`), description
2. **Availability:** Duration options (checkboxes: 15, 30, 45, 60, 90 min + custom), calendars to check (multi-select from connected calendars), target calendar (where bookings land)
3. **Scheduling Rules:** Advance notice, booking window, max per day, buffer before/after
4. **Appearance:** Color picker, description
5. **Questions:** Drag-to-reorder list of questions; "Add question" button opens a mini form
6. **Conferencing:** Dropdown (None, Zoom, Google Meet, Teams, Webex) — only shows options where integration is connected

**Live URL preview chip:**
```tsx
<div className="flex items-center gap-2 p-2 bg-muted rounded-md">
  <Globe className="w-4 h-4 text-muted-foreground" />
  <span className="text-sm">tasktime.app/book/<strong>{slug}</strong></span>
  <CopyButton value={`https://tasktime.app/book/${slug}`} />
</div>
```

---

## Step 9: Frontend — Public Booking Page

**Route:** `app/book/[slug]/page.tsx` (Next.js — this is in the PUBLIC app directory, no auth guard)

This page is server-rendered for SEO and initial load speed.

```typescript
// app/book/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const page = await fetchBookingPage(params.slug)
  return { title: `Book time with ${page.owner_name} — ${page.name}` }
}

export default async function PublicBookingPage({ params }) {
  const page = await fetchBookingPage(params.slug)
  if (!page) return <NotFoundPage />
  return <BookingPageClient page={page} />
}
```

**`BookingPageClient.tsx` (client component):**

State machine: `selecting-date` → `selecting-time` → `filling-form` → `confirmed`

**Step 1: Date selection**
- Display a month calendar (shadcn/ui Calendar component)
- Disable dates before `now + advance_notice_hours` and after `now + booking_window_days`
- Disable dates where all slots are unavailable (fetch /slots for each visible date to determine)
- Actually: don't prefetch all dates — just disable past/future bounds; let users pick and show slots

**Step 2: Time slot selection**
- After date selected: `GET /book/:slug/slots?date=&duration=`
- Show available slots as clickable cards in a scrollable column
- Duration selector if multiple duration_options: "15 min | 30 min | 60 min" tabs
- Show slots in user's detected timezone (use `Intl.DateTimeFormat().resolvedOptions().timeZone`)
- Timezone selector dropdown at bottom (for users in different timezone)

**Step 3: Booking form**
- Name (required)
- Email (required)
- Custom questions (rendered based on question type: text, textarea, select, checkbox)
- "Schedule Event" submit button
- Show spinner + disable button on submit

**Step 4: Confirmation**
- Large green checkmark
- "You're scheduled!" heading
- Date/time/duration
- "Add to Google Calendar" | "Download .ics" buttons
- "Return to home" link

---

## Step 10: Booking Management Dashboard

**Route:** `(app)/settings/scheduling/[pageId]/bookings/page.tsx`

Table with columns: Date/Time | Booker Name | Email | Duration | Status | Answers | Actions

Actions per row:
- View details (expands row or opens sheet)
- Cancel booking (confirmation dialog → DELETE /booking-pages/:id/bookings/:id)

Filter bar: date range picker + status filter.

---

## Step 11: Embed Snippet

**In booking page settings — "Share" tab:**

```tsx
const embedCode = `<iframe
  src="https://tasktime.app/book/${slug}?embed=1"
  width="100%"
  height="700"
  frameborder="0"
></iframe>`
```

Also provide a JS snippet option:
```tsx
const jsSnippet = `<div id="tasktime-booking"></div>
<script src="https://tasktime.app/embed.js" data-slug="${slug}"></script>`
```

Copy-to-clipboard button for both.

When the booking page is loaded with `?embed=1` query parameter:
- Hide the page header/navigation
- Use a compact layout
- Post a `window.parent.postMessage` on booking confirmation (for iframe height adjustments)

---

## Phase 3 Acceptance Criteria

### Booking Page Creation
- [ ] User creates a booking page with slug "my-30-min-chat", duration 30 min, 2 connected calendars
- [ ] Visiting `tasktime.app/book/my-30-min-chat` shows the public booking page
- [ ] Changing the booking page name updates the public page immediately

### Availability
- [ ] Block a 2-hour event on the host's calendar
- [ ] Visit the booking page on the same day → the overlapping slots are unavailable
- [ ] Set buffer_after_minutes = 15 → no bookings can start within 15 min after an existing event
- [ ] Set advance_notice_hours = 2 → slots in the next 2 hours are unavailable
- [ ] Book to max_per_day limit → all remaining slots on that day become unavailable

### Booking Flow
- [ ] Select a date → available time slots appear within 1s
- [ ] Select a slot, fill form, submit → confirmation page appears
- [ ] Check the host's calendar → booking event appears within 10s
- [ ] Booker receives confirmation email with ICS attachment
- [ ] Host receives notification email with booker name and answers

### Race Condition
- [ ] Two visitors simultaneously attempt to book the same slot → one succeeds, other gets "slot unavailable" error

### Cancellation
- [ ] Click cancellation link in confirmation email → booking cancelled
- [ ] Cancelled event removed from host's calendar
- [ ] Both parties receive cancellation email

### Conferencing
- [ ] Set conferencing to Google Meet
- [ ] Book a slot → confirmation shows Google Meet link
- [ ] Calendar event contains the Google Meet join URL

### Embed
- [ ] Copy embed code → paste in an HTML file → booking widget renders correctly
- [ ] Booking within the iframe works end-to-end
