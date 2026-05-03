# TaskTime — Verification & Testing Specification

> **Purpose:** This document defines the complete test suite for all 6 phases. Run these tests in order. Phase N tests must fully pass before phase N+1 begins. Tests are organized into: Unit, Integration, E2E, and Manual Smoke Tests.

---

## How to Run Tests

```bash
# Unit + integration tests (Vitest)
pnpm test                          # run all packages
pnpm --filter api test             # API tests only
pnpm --filter web test             # Frontend tests only

# Watch mode
pnpm --filter api test --watch

# E2E tests (Playwright)
pnpm --filter web test:e2e         # requires app running locally
pnpm --filter web test:e2e --ui    # interactive Playwright UI

# With coverage
pnpm --filter api test --coverage

# Specific test file
pnpm --filter api test src/services/__tests__/calendar-sync.test.ts
```

---

## Phase 1 Verification

### Unit Tests

**`apps/api/src/lib/__tests__/encryption.test.ts`**
```typescript
describe('Encryption', () => {
  it('encrypts and decrypts a string correctly', () => {
    const plain = 'my-oauth-token-12345'
    const encrypted = encrypt(plain)
    expect(encrypted).not.toBe(plain)
    expect(decrypt(encrypted)).toBe(plain)
  })

  it('produces different ciphertext for the same input (random IV)', () => {
    const encrypted1 = encrypt('same')
    const encrypted2 = encrypt('same')
    expect(encrypted1).not.toBe(encrypted2)
    expect(decrypt(encrypted1)).toBe('same')
    expect(decrypt(encrypted2)).toBe('same')
  })
})
```

**`apps/api/src/services/__tests__/calendar-sync.test.ts`**
```typescript
describe('Google Calendar Sync', () => {
  let mockGoogleClient: vi.MockedFunction<any>

  beforeEach(() => {
    mockGoogleClient = vi.fn()
  })

  it('full sync: creates calendars from API response', async () => {
    mockGoogleClient.mockResolvedValueOnce({
      data: { items: [{ id: 'cal1', summary: 'Work', backgroundColor: '#4285F4', primary: true }] }
    })
    mockGoogleClient.mockResolvedValueOnce({ data: { items: [], nextSyncToken: 'token123' } })

    await runFullSync('account-id', mockGoogleClient)

    const calendars = await db.query.calendars.findMany({ where: eq(calendars.accountId, 'account-id') })
    expect(calendars).toHaveLength(1)
    expect(calendars[0].name).toBe('Work')
    expect(calendars[0].color).toBe('#4285F4')
  })

  it('incremental sync: soft-deletes cancelled events', async () => {
    const existingEvent = await createTestEvent({ status: 'confirmed' })
    mockGoogleClient.mockResolvedValueOnce({
      data: {
        items: [{ id: existingEvent.providerEventId, status: 'cancelled' }],
        nextSyncToken: 'new-token'
      }
    })

    await runIncrementalSync('calendar-id', mockGoogleClient)

    const event = await db.query.events.findFirst({ where: eq(events.id, existingEvent.id) })
    expect(event?.deletedAt).not.toBeNull()
  })

  it('emits socket event after sync', async () => {
    const emitSpy = vi.spyOn(socketIo, 'to')
    // ... setup mock API response
    await runIncrementalSync('calendar-id', mockGoogleClient)
    expect(emitSpy).toHaveBeenCalledWith(expect.stringContaining('user:'))
  })
})
```

**`apps/api/src/routes/__tests__/events.test.ts`**
```typescript
describe('Events API', () => {
  let authHeaders: Record<string, string>
  let testCalendar: Calendar

  beforeEach(async () => {
    const { headers, calendar } = await setupTestUser()
    authHeaders = headers
    testCalendar = calendar
  })

  it('GET /events returns only the authenticated user\'s events', async () => {
    await createTestEvent({ calendarId: testCalendar.id })
    await createTestEvent({ calendarId: 'other-users-calendar' })  // different user

    const res = await request(app).get('/api/v1/events?start=2025-01-01&end=2025-12-31')
      .set(authHeaders)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('POST /events creates event and queues write job', async () => {
    const enqueueSpy = vi.spyOn(eventWriteQueue, 'add')

    const res = await request(app).post('/api/v1/events')
      .set(authHeaders)
      .send({ calendar_id: testCalendar.id, title: 'Test', start_at: '2025-01-15T10:00:00Z', end_at: '2025-01-15T11:00:00Z' })

    expect(res.status).toBe(201)
    expect(res.body.data.title).toBe('Test')
    expect(enqueueSpy).toHaveBeenCalledWith('create', expect.objectContaining({ eventId: res.body.data.id }))
  })

  it('DELETE /events/:id with scope=all deletes all recurring instances', async () => {
    const recurring = await createTestRecurringEvent({ rrule: 'FREQ=WEEKLY;COUNT=5' })
    await createRecurringInstances(recurring, 5)

    await request(app).delete(`/api/v1/events/${recurring.id}?scope=all`)
      .set(authHeaders)
      .expect(204)

    const remaining = await db.query.events.findMany({
      where: and(eq(events.recurringEventId, recurring.id), isNull(events.deletedAt))
    })
    expect(remaining).toHaveLength(0)
  })

  it('returns 403 when editing another user\'s event', async () => {
    const otherEvent = await createTestEvent({ calendarId: 'other-user-calendar' })
    await request(app).patch(`/api/v1/events/${otherEvent.id}`)
      .set(authHeaders).send({ title: 'Hacked' })
      .expect(403)
  })
})
```

**`apps/api/src/routes/__tests__/tasks.test.ts`**
```typescript
describe('Tasks API', () => {
  it('POST /tasks/:id/schedule creates event and links task', async () => {
    const task = await createTestTask({ durationMinutes: 90 })

    const res = await request(app).post(`/api/v1/tasks/${task.id}/schedule`)
      .set(authHeaders)
      .send({ start_at: '2025-01-15T10:00:00Z', end_at: '2025-01-15T11:30:00Z', calendar_id: testCalendar.id })

    expect(res.status).toBe(201)
    expect(res.body.data.event.isTimeBlock).toBe(true)
    expect(res.body.data.event.taskId).toBe(task.id)

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.scheduledEventId).toBe(res.body.data.event.id)
  })

  it('completing the linked event marks the task done', async () => {
    const { task, event } = await createLinkedTaskAndEvent()

    await request(app).post(`/api/v1/tasks/${task.id}/complete`)
      .set(authHeaders).expect(200)

    const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.id, task.id) })
    expect(updatedTask?.status).toBe('done')
    expect(updatedTask?.completedAt).not.toBeNull()
  })

  it('soft-deletes subtasks when parent is deleted', async () => {
    const parent = await createTestTask()
    const child1 = await createTestTask({ parentTaskId: parent.id })
    const child2 = await createTestTask({ parentTaskId: parent.id })

    await request(app).delete(`/api/v1/tasks/${parent.id}`).set(authHeaders).expect(204)

    const children = await db.query.tasks.findMany({
      where: inArray(tasks.id, [child1.id, child2.id])
    })
    children.forEach(child => expect(child.deletedAt).not.toBeNull())
  })
})
```

### E2E Tests (Playwright)

**`apps/web/e2e/phase1.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Phase 1 — Auth', () => {
  test('user can sign up, see calendar, and log out', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('[name="name"]', 'Test User')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'Password123!')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/(app)?$/)
    await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible()

    // Logout
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-btn"]')
    await expect(page).toHaveURL('/login')
  })
})

test.describe('Phase 1 — Calendar', () => {
  test.beforeEach(async ({ page }) => { await loginAsTestUser(page) })

  test('click-drag on calendar creates an event', async ({ page }) => {
    await page.goto('/')
    const grid = page.locator('[data-testid="time-grid"]')

    // Drag from 10am to 11am slot
    await grid.locator('[data-hour="10"]').dragTo(grid.locator('[data-hour="11"]'))

    // Quick-create popover should appear
    await expect(page.locator('[data-testid="quick-create"]')).toBeVisible()
    await page.fill('[data-testid="event-title-input"]', 'My Test Event')
    await page.keyboard.press('Enter')

    // Event should appear on calendar
    await expect(page.locator('text=My Test Event')).toBeVisible()
  })

  test('clicking event opens popover with details', async ({ page }) => {
    await createTestEventViaAPI({ title: 'Team Standup', start: '10:00', end: '10:30' })
    await page.reload()
    await page.click('text=Team Standup')
    await expect(page.locator('[data-testid="event-popover"]')).toBeVisible()
    await expect(page.locator('[data-testid="event-popover"]')).toContainText('Team Standup')
  })

  test('drag event to reschedule it', async ({ page }) => {
    const event = await createTestEventViaAPI({ title: 'Draggable', start: '10:00', end: '11:00' })
    await page.reload()

    const eventBlock = page.locator(`[data-event-id="${event.id}"]`)
    const targetSlot = page.locator('[data-hour="14"]')
    await eventBlock.dragTo(targetSlot)

    // Wait for update
    await page.waitForTimeout(1000)
    const updatedEvent = await getEventViaAPI(event.id)
    expect(new Date(updatedEvent.start_at).getHours()).toBe(14)
  })
})

test.describe('Phase 1 — Time Blocking', () => {
  test.beforeEach(async ({ page }) => { await loginAsTestUser(page) })

  test('dragging task to calendar creates time block', async ({ page }) => {
    await createTaskViaAPI({ title: 'Write report', durationMinutes: 60 })
    await page.reload()

    const taskRow = page.locator('[data-testid="task-row"]', { hasText: 'Write report' })
    const calendarSlot = page.locator('[data-hour="9"]')
    await taskRow.dragTo(calendarSlot)

    await expect(page.locator('[data-testid="time-block"]', { hasText: 'Write report' })).toBeVisible()
    const taskBadge = taskRow.locator('[data-testid="scheduled-badge"]')
    await expect(taskBadge).toBeVisible()
  })

  test('completing time block event marks task done', async ({ page }) => {
    const { task } = await createLinkedTaskAndEventViaAPI({ title: 'Finish proposal' })
    await page.reload()

    await page.click(`[data-event-id="${task.scheduled_event_id}"]`)
    await page.click('[data-testid="mark-done-btn"]')

    const taskCheckbox = page.locator(`[data-task-id="${task.id}"] input[type="checkbox"]`)
    await expect(taskCheckbox).toBeChecked()
  })
})
```

---

## Phase 2 Verification

### Unit Tests

**`apps/api/src/services/__tests__/caldav-sync.test.ts`**
```typescript
it('full CalDAV sync creates calendars from server response', async () => {
  // Mock tsdav client
  const mockClient = {
    fetchCalendars: vi.fn().mockResolvedValue([
      { url: '/cal/work', displayName: 'Work', calendarColor: '#FF0000' }
    ]),
    fetchCalendarObjects: vi.fn().mockResolvedValue([])
  }
  await runCalDAVFullSync('account-id', mockClient as any)
  const cals = await db.query.calendars.findMany({ where: eq(calendars.accountId, 'account-id') })
  expect(cals).toHaveLength(1)
  expect(cals[0].name).toBe('Work')
})
```

**`apps/api/src/services/__tests__/task-sync-notion.test.ts`**
```typescript
it('maps Notion page properties to Task fields', () => {
  const notionPage = {
    id: 'notion-page-id',
    properties: {
      Name: { title: [{ plain_text: 'Write blog post' }] },
      Due: { date: { start: '2025-03-15' } },
      Status: { select: { name: 'In Progress' } },
      Priority: { select: { name: 'High' } }
    },
    last_edited_time: '2025-01-01T00:00:00Z'
  }

  const task = mapNotionPageToTask(notionPage, 'user-id', 'integration-id', {
    title: 'Name', due_date: 'Due', status: 'Status', priority: 'Priority', done_value: 'Done'
  })

  expect(task.title).toBe('Write blog post')
  expect(task.due_date).toBe('2025-03-15')
  expect(task.status).toBe('in_progress')
  expect(task.priority).toBe(2)
})

it('pushes completion back to Notion', async () => {
  const notionUpdate = vi.fn()
  const task = await createTestTask({ source: 'notion', sourceId: 'notion-page-id', status: 'open' })
  await notionSyncService.pushCompletion({ task, integration: mockIntegration }, notionUpdate)
  expect(notionUpdate).toHaveBeenCalledWith({
    page_id: 'notion-page-id',
    properties: expect.objectContaining({ Status: expect.any(Object) })
  })
})
```

### E2E Tests

**`apps/web/e2e/phase2.spec.ts`**
```typescript
test('Calendar Sets filter the calendar view', async ({ page }) => {
  await loginAsTestUser(page)
  await createCalendarSetViaAPI({ name: 'Work Only', calendarIds: [workCalendarId] })
  await page.reload()

  await page.click('text=Work Only')  // click the calendar set chip

  // Personal calendar events should be hidden
  await expect(page.locator('[data-calendar-id="personal-calendar"]')).not.toBeVisible()
  // Work calendar events should be visible
  await expect(page.locator('[data-calendar-id="work-calendar"]')).toBeVisible()
})

test('Command palette opens with Cmd+K', async ({ page }) => {
  await loginAsTestUser(page)
  await page.goto('/')
  await page.keyboard.press('Meta+k')
  await expect(page.locator('[data-testid="command-palette"]')).toBeVisible()

  await page.keyboard.type('New Event')
  await expect(page.locator('[role="option"]', { hasText: 'New Event' })).toBeVisible()
})

test('Month view renders events as chips', async ({ page }) => {
  await loginAsTestUser(page)
  await createTestEventViaAPI({ title: 'Monthly Event', date: firstDayOfMonth() })
  await page.keyboard.press('m')  // switch to month view

  await expect(page.locator('[data-testid="month-event-chip"]', { hasText: 'Monthly Event' })).toBeVisible()
})
```

---

## Phase 3 Verification

### Unit Tests

**`apps/api/src/services/__tests__/availability.test.ts`**
```typescript
describe('Availability Service', () => {
  const baseWorkingHours = {
    monday: { start: '09:00', end: '18:00', enabled: true },
    // ... other days
  }

  it('returns no slots for a disabled day (Saturday)', async () => {
    const slots = await getAvailableSlots({
      bookingPage: mockBookingPage,
      date: nextSaturday(),
      durationMinutes: 30
    })
    expect(slots.every(s => !s.available)).toBe(true)
  })

  it('marks slot unavailable when calendar event overlaps', async () => {
    await createTestEvent({ start: '10:00', end: '11:00' })

    const slots = await getAvailableSlots({ bookingPage, date: today(), durationMinutes: 30 })
    const tenAmSlot = slots.find(s => format(s.start_at, 'HH:mm') === '10:00')
    const tenThirtySlot = slots.find(s => format(s.start_at, 'HH:mm') === '10:30')

    expect(tenAmSlot?.available).toBe(false)
    expect(tenThirtySlot?.available).toBe(false)
  })

  it('respects buffer_after_minutes', async () => {
    const bookingPageWithBuffer = { ...bookingPage, buffer_after_minutes: 15 }
    await createTestEvent({ start: '10:00', end: '11:00' })

    const slots = await getAvailableSlots({ bookingPage: bookingPageWithBuffer, date: today(), durationMinutes: 30 })
    // 11:00–11:30 should be unavailable (within 15-min buffer)
    const elevenAmSlot = slots.find(s => format(s.start_at, 'HH:mm') === '11:00')
    expect(elevenAmSlot?.available).toBe(false)
    // 11:15 should be unavailable
    const elevenFifteenSlot = slots.find(s => format(s.start_at, 'HH:mm') === '11:15')
    expect(elevenFifteenSlot?.available).toBe(false)
    // 11:30 should be available
    const elevenThirtySlot = slots.find(s => format(s.start_at, 'HH:mm') === '11:30')
    expect(elevenThirtySlot?.available).toBe(true)
  })

  it('race condition: concurrent bookings for same slot — only one succeeds', async () => {
    const results = await Promise.allSettled([
      bookSlot({ slug: 'test-page', start_at: '2025-01-15T10:00:00Z', duration: 30 }),
      bookSlot({ slug: 'test-page', start_at: '2025-01-15T10:00:00Z', duration: 30 })
    ])

    const successes = results.filter(r => r.status === 'fulfilled')
    const failures = results.filter(r => r.status === 'rejected')
    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)
    expect((failures[0] as PromiseRejectedResult).reason.code).toBe('SLOT_UNAVAILABLE')
  })

  it('enforces max_per_day limit', async () => {
    const limitedPage = { ...bookingPage, max_per_day: 2 }
    await createBooking({ bookingPageId: limitedPage.id, date: today() })
    await createBooking({ bookingPageId: limitedPage.id, date: today() })

    const slots = await getAvailableSlots({ bookingPage: limitedPage, date: today(), durationMinutes: 30 })
    expect(slots.every(s => !s.available)).toBe(true)
  })
})
```

### E2E Tests

**`apps/web/e2e/phase3.spec.ts`**
```typescript
test('full booking flow end-to-end', async ({ page, context }) => {
  // Host creates booking page
  await loginAsTestUser(page)
  await page.goto('/settings/scheduling')
  await page.click('text=New Booking Page')
  await page.fill('[name="name"]', '30-Minute Chat')
  await page.fill('[name="slug"]', 'my-30-min-chat')
  await page.click('[data-duration="30"]')
  await page.click('button:text("Create")')
  await expect(page.locator('text=my-30-min-chat')).toBeVisible()

  // Visitor books a slot
  const guestPage = await context.newPage()
  await guestPage.goto('/book/my-30-min-chat')
  await expect(guestPage.locator('h1')).toContainText('30-Minute Chat')

  // Select a date
  await guestPage.click('[data-testid="calendar-day"]:not([disabled]):first-child')

  // Select first available slot
  await guestPage.click('[data-testid="time-slot"][data-available="true"]:first-child')

  // Fill booking form
  await guestPage.fill('[name="booker_name"]', 'Jane Visitor')
  await guestPage.fill('[name="booker_email"]', 'jane@example.com')
  await guestPage.click('button:text("Schedule Event")')

  // Confirmation appears
  await expect(guestPage.locator('text=You\'re scheduled!')).toBeVisible()
  await expect(guestPage.locator('[data-testid="download-ics"]')).toBeVisible()

  // Check host calendar
  await page.reload()
  await expect(page.locator('[data-testid="event-block"]', { hasText: 'Jane Visitor' })).toBeVisible()
})
```

---

## Phase 4 Verification

### Unit Tests

**`apps/api/src/services/automations/__tests__/travel-time.test.ts`**
```typescript
it('creates travel blocks when event has location', async () => {
  vi.mocked(estimateTravelTime).mockResolvedValue(25)

  const event = await createTestEvent({ location: '123 Main St', start: '10:00', end: '11:00' })
  await executeTravelTimeAutomation(automation, event)

  const travelBlocks = await db.query.events.findMany({
    where: and(eq(events.linkedEventId, event.id), eq(events.automationId, automation.id))
  })

  expect(travelBlocks).toHaveLength(2)
  expect(travelBlocks[0].title).toBe('Travel to Test Event')
  // Travel start = 10:00 - 25min - 5min buffer = 09:30
  expect(format(travelBlocks[0].startAt, 'HH:mm')).toBe('09:30')
})

it('does NOT create travel block for automation-created events (no infinite loop)', async () => {
  const automationEvent = await createTestEvent({ location: '123 Main St', automationId: automation.id })
  const spy = vi.spyOn(eventService, 'createEvent')
  await executeTravelTimeAutomation(automation, automationEvent)
  expect(spy).not.toHaveBeenCalled()
})
```

**`apps/api/src/services/automations/__tests__/calendar-sync.test.ts`**
```typescript
it('mirror event has no details when hide_details=true', async () => {
  const sourceEvent = await createTestEvent({
    title: 'Secret meeting', description: 'Confidential content', location: 'HQ'
  })
  const automation = createSyncAutomation({ hide_details: true, title_override: 'Busy' })
  await executeCalendarSyncAutomation(automation, sourceEvent)

  const mirror = await findMirrorEvent(sourceEvent.id, automation.id)
  expect(mirror?.title).toBe('Busy')
  expect(mirror?.description).toBeNull()
  expect(mirror?.location).toBeNull()
  expect(mirror?.isMirror).toBe(true)
})

it('mirror does not trigger another sync (infinite loop prevention)', async () => {
  const spy = vi.spyOn(automationEngine, 'onEventSaved')
  const mirrorEvent = await createTestEvent({ isMirror: true })
  // Engine should exit early for mirror events
  await automationEngine.onEventSaved(mirrorEvent, 'created')
  // Verify no automations were executed
  const runs = await db.query.automationRuns.findMany({ where: eq(automationRuns.automationId, automation.id) })
  expect(runs).toHaveLength(0)
})
```

---

## Phase 5 Verification

### Unit Tests

**`apps/api/src/services/planner/__tests__/plan-generator.test.ts`**
```typescript
describe('Daily Plan Generator', () => {
  it('places tasks in free slots, not overlapping events', async () => {
    await createTestEvent({ start: '10:00', end: '11:00' })
    const task = await createTestTask({ durationMinutes: 60, dueDate: today() })

    const plan = await generateDailyPlan(userId, new Date())

    const suggestion = plan.items.find(i => i.task_id === task.id)
    expect(suggestion).toBeDefined()
    // Should NOT be at 10:00 (overlaps meeting)
    const suggestedHour = new Date(suggestion!.suggested_start).getHours()
    expect(suggestedHour).not.toBe(10)
  })

  it('falls back to rule-based when Claude API fails', async () => {
    vi.mocked(anthropic.messages.create).mockRejectedValue(new Error('API unavailable'))
    const task = await createTestTask({ durationMinutes: 60, priority: 1 })

    // Should not throw
    const plan = await expect(generateDailyPlan(userId, new Date())).resolves.toBeDefined()
    expect(plan.items.some(i => i.task_id === task.id)).toBe(true)
  })

  it('places focus tasks inside matching frames', async () => {
    await createTestFrame({ name: 'Deep Work', startTime: '09:00', endTime: '11:00', preferredTags: ['writing'] })
    const focusTask = await createTestTask({ tags: ['writing'], durationMinutes: 90 })
    const normalTask = await createTestTask({ tags: [], durationMinutes: 30 })

    const plan = await generateDailyPlan(userId, new Date())

    const focusSuggestion = plan.items.find(i => i.task_id === focusTask.id)
    const startHour = new Date(focusSuggestion!.suggested_start).getHours()
    expect(startHour).toBeGreaterThanOrEqual(9)
    expect(startHour).toBeLessThan(11)
  })
})
```

**`apps/api/src/services/planner/__tests__/recommendations.test.ts`**
```typescript
it('generates overdue recommendation for past-due tasks', async () => {
  const overdueTask = await createTestTask({
    status: 'open',
    dueDate: subDays(new Date(), 2)  // 2 days ago
  })
  const context = await gatherPlanContext(userId, new Date())
  const recs = await buildRecommendations(context, [])

  const overdueRec = recs.find(r => r.type === 'overdue' && r.task_id === overdueTask.id)
  expect(overdueRec).toBeDefined()
  expect(overdueRec?.action_label).toBe('Reschedule')
})

it('generates capacity warning when >80% of day is booked', async () => {
  // Create 7 hours of meetings in an 8-hour work day
  for (let h = 9; h < 16; h++) {
    await createTestEvent({ start: `${h}:00`, end: `${h + 1}:00` })
  }
  const context = await gatherPlanContext(userId, new Date())
  const recs = await buildRecommendations(context, [])

  const capacityRec = recs.find(r => r.type === 'capacity')
  expect(capacityRec).toBeDefined()
})
```

---

## Phase 6 Verification

### Integration Tests

**`apps/api/src/__tests__/billing.test.ts`**
```typescript
it('stripe webhook checkout.session.completed upgrades user plan', async () => {
  const webhookPayload = {
    type: 'checkout.session.completed',
    data: {
      object: {
        subscription: 'sub_test123',
        metadata: { user_id: testUser.id },
        customer: 'cus_test123'
      }
    }
  }
  const signature = stripe.webhooks.generateTestHeaderString({ payload: JSON.stringify(webhookPayload), secret: WEBHOOK_SECRET })

  await request(app).post('/api/v1/webhooks/stripe')
    .set('stripe-signature', signature)
    .send(webhookPayload)
    .expect(200)

  const updatedUser = await db.query.users.findFirst({ where: eq(users.id, testUser.id) })
  expect(updatedUser?.plan).toBe('pro')
  expect(updatedUser?.stripeSubscriptionId).toBe('sub_test123')
})
```

**`apps/api/src/__tests__/teams.test.ts`**
```typescript
it('team invite flow: invite → accept → member added', async () => {
  const owner = await createTestUser()
  const team = await createTestTeam({ ownerId: owner.id })
  const invitee = await createTestUser()

  // Send invite
  const inviteRes = await request(app).post(`/api/v1/teams/${team.id}/invites`)
    .set(authHeader(owner))
    .send({ email: invitee.email })
    .expect(201)

  const token = await getInviteToken(inviteRes.body.data.invite_id)

  // Accept invite
  await request(app).post(`/api/v1/teams/join/${token}`)
    .set(authHeader(invitee))
    .expect(200)

  const members = await db.query.teamMembers.findMany({ where: eq(teamMembers.teamId, team.id) })
  expect(members).toHaveLength(2)
  expect(members.find(m => m.userId === invitee.id)?.role).toBe('member')
})
```

### E2E Tests

**`apps/web/e2e/phase6.spec.ts`**
```typescript
test('onboarding wizard shown to new user', async ({ page }) => {
  await signUpAsNewUser(page, { email: 'new@example.com' })

  // Should see onboarding wizard
  await expect(page.locator('[data-testid="onboarding-wizard"]')).toBeVisible()
  await expect(page.locator('text=Let\'s connect your calendar')).toBeVisible()

  // Skip all steps
  await page.click('button:text("Skip for now")')
  await page.click('button:text("Skip")')
  await page.click('button:text("Continue")')
  await page.click('button:text("Generate my plan")')

  // Wizard gone, calendar visible
  await expect(page.locator('[data-testid="onboarding-wizard"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible()
})
```

---

## Manual Smoke Tests (run before each phase sign-off)

These tests cannot be fully automated and must be manually verified.

### Phase 1 Manual Smoke Test
```
1. Start fresh (empty DB)
2. Sign up with a real Google account
3. Connect Google Calendar
4. Verify all your real Google events appear correctly
5. Create an event in the app → verify it appears in Google Calendar
6. Create an event in Google Calendar → verify it appears in the app within 30s
7. Create a task, drag it to the calendar → verify the time block appears
8. Switch between Day view, Week view
9. Resize an event by dragging its bottom edge
10. Delete an event → verify it's removed from Google Calendar
```

### Phase 2 Manual Smoke Test
```
1. Connect a Notion database with tasks
2. Verify Notion tasks appear in the task panel
3. Complete a Notion task in the app → verify it's marked done in Notion
4. Connect Todoist → verify projects appear as task lists
5. Create a Calendar Set with only your work calendar
6. Toggle the set → verify personal calendar events are hidden
7. Switch to Month view → verify events appear as chips
8. Open command palette (Cmd+K) → search for an event by name
```

### Phase 3 Manual Smoke Test
```
1. Create a booking page "Test Booking" with 30-min slots
2. Open the booking URL in incognito
3. Select a date, pick a time slot, fill the form, submit
4. Verify: booking confirmation appears
5. Verify: email received by "booker" (use a real email for this test)
6. Verify: calendar event created on host's calendar
7. Block the host's calendar for an hour
8. Refresh the booking page → verify those slots are unavailable
9. Book to the max_per_day limit → verify all remaining slots show as unavailable
```

### Phase 4 Manual Smoke Test
```
1. Enable Travel Time automation (origin: your home address, driving)
2. Create an event with a real address in the location field
3. Verify a travel block appears within 30s
4. Move the event 2 hours later → verify travel block moves
5. Enable Calendar Sync (Work → Personal, hide details)
6. Create an event on work calendar → verify "Busy" block appears on personal
7. Delete the work event → verify mirror disappears
```

### Phase 5 Manual Smoke Test
```
1. Create 2-3 tasks with today's due date and duration estimates
2. Click "Regenerate plan"
3. Verify tasks appear as suggestions in the AI planner panel
4. Accept a suggestion → verify event created on calendar
5. Reject a suggestion → verify it grays out
6. Create a Frame "Focus" 9-11am
7. Add tags to a task matching the frame
8. Regenerate plan → verify tagged task is suggested for 9-11am window
9. Create a meeting that overlaps an accepted suggestion → verify conflict recommendation appears
```

### Phase 6 Manual Smoke Test
```
1. Create a team, invite a real email address
2. Accept invite via email
3. Enable calendar sharing for the teammate
4. Toggle teammate's calendar in sidebar → verify their events appear (muted)
5. Test the mobile app: log in, create an event, verify it syncs to web
6. Test the desktop app: launch the Electron app, use it for 5 min
7. Go through the Stripe checkout (use test card: 4242 4242 4242 4242)
8. Verify plan upgrades to Pro
9. Cancel subscription via portal → verify no immediate downgrade (period end)
10. Request data export → verify email received with ZIP
```

---

## Performance Benchmarks

Run after each phase on a populated database (10k events, 1k tasks):

```bash
# API response time benchmarks using autocannon
npx autocannon -c 10 -d 30 http://localhost:3001/api/v1/events?start=2025-01-01&end=2025-01-31 \
  -H "Authorization: Bearer <token>"

# Target: p95 < 200ms, p99 < 500ms

# Availability calculation benchmark
npx autocannon -c 5 -d 10 http://localhost:3001/api/v1/book/test-page/slots?date=2025-01-15&duration=30
# Target: p95 < 1000ms
```

---

## Coverage Targets

| Layer | Target |
|---|---|
| `apps/api/src/services/` | ≥ 80% line coverage |
| `apps/api/src/routes/` | ≥ 70% line coverage |
| `apps/api/src/lib/` | ≥ 90% line coverage |
| E2E critical paths | 100% (all paths in this doc) |

```bash
# Generate coverage report
pnpm --filter api test --coverage
# View report
open apps/api/coverage/index.html
```
