# Phase 6 — Teams, Mobile & Production Polish

> **Agent brief:** Add team collaboration features, build iOS and Android mobile apps using React Native + Expo, package a desktop Electron app, implement push notifications, complete the onboarding wizard, add Stripe billing, and reach production readiness. This is the final phase.

**Read before starting:** `PRD.md` (Sections F7–F9), `ARCHITECTURE.md`, all prior phases

**Estimated output:** ~12,000 lines of code  
**Prerequisite:** Phase 5 acceptance criteria all passing

---

## Deliverables Checklist

### Team Features
- [ ] Team account creation + seat management
- [ ] Team member invite flow (email invite)
- [ ] Team roles: Owner, Admin, Member
- [ ] Team calendar sharing (free/busy, full details, none)
- [ ] Team calendar overlay in UI
- [ ] Team booking page types (round-robin, collective)

### Mobile App (React Native + Expo)
- [ ] Project scaffold: `apps/mobile` with Expo Router
- [ ] Auth (login/signup, OAuth via Expo AuthSession)
- [ ] Calendar view (day + week — adapted for mobile screen)
- [ ] Task panel (bottom sheet or tab)
- [ ] AI planner panel
- [ ] Push notifications (FCM + APNs via Expo Notifications)
- [ ] Offline support (cached events/tasks)

### Desktop App
- [ ] Electron or Tauri wrapper for `apps/web`
- [ ] System tray icon
- [ ] Native desktop notifications

### Missing Integrations
- [ ] Apple Reminders (local, macOS/iOS via EventKit)
- [ ] Obsidian (local vault, markdown file parsing)

### Billing
- [ ] Stripe checkout (Pro + Team plans)
- [ ] Stripe billing portal
- [ ] Stripe webhook handler
- [ ] Plan enforcement (feature gates)
- [ ] Seat management (add/remove team members, prorated billing)

### Onboarding Wizard
- [ ] 4-step flow: connect calendar → connect tasks → set hours → generate plan
- [ ] Shown to new users after signup

### Production Polish
- [ ] Daily digest email (morning summary)
- [ ] Data export (GDPR compliance)
- [ ] Account deletion
- [ ] Rate limiting hardening
- [ ] Error monitoring (Sentry integration)
- [ ] Health check endpoint
- [ ] Docker production build

---

## Step 1: Teams Schema

Add to `packages/db/src/schema.ts`:

```sql
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  owner_id    UUID NOT NULL REFERENCES users(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  seat_count  INT NOT NULL DEFAULT 1,
  plan        TEXT NOT NULL DEFAULT 'team',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_members (
  team_id          UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
  calendar_sharing TEXT NOT NULL DEFAULT 'none',    -- 'none' | 'free_busy' | 'full'
  invited_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at        TIMESTAMPTZ,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE team_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Step 2: Teams API

**File:** `apps/api/src/routes/teams.ts`

### POST /api/v1/teams
```
Auth required (creates a team, user becomes owner)
Body: { name: string }
- Create team record
- Add user as team_member with role='owner'
- If user has Pro plan: upgrade to Team (or create new Stripe subscription)
Response 201: { data: Team }
```

### GET /api/v1/teams/mine
```
Returns teams the user belongs to (with their role)
Response 200: { data: Array<Team & { role: string, member_count: number }> }
```

### GET /api/v1/teams/:id/members
```
Auth required, must be team member
Response 200: { data: TeamMember[] }
```

### POST /api/v1/teams/:id/invites
```
Auth required, must be owner or admin
Body: { email: string, role?: 'admin'|'member' }
- Generate random invite token (crypto.randomBytes(32).toString('hex'))
- Create team_invites record (expires in 7 days)
- Send invite email with link: WEB_URL/join-team?token=<token>
Response 201: { data: { invite_id: string, email: string } }
```

### GET /api/v1/teams/join/:token (public)
```
Validate token (exists, not expired, not accepted)
Return team name + inviter name
Response 200: { data: { team_name: string, invited_by: string } }
```

### POST /api/v1/teams/join/:token
```
Auth required (user must be logged in to accept)
Validate token
Add user to team as team_member with the invite's role
Set invite.accepted_at = NOW()
Trigger Stripe seat addition (prorated)
Response 200: { data: { team: Team, role: string } }
```

### PATCH /api/v1/teams/:id/members/:userId
```
Auth required, owner or admin
Body: { role?: string, calendar_sharing?: string }
Response 200: { data: TeamMember }
```

### DELETE /api/v1/teams/:id/members/:userId
```
Auth required, owner or admin (or user removing themselves)
Remove from team
Trigger Stripe seat removal (prorated refund)
Response 204
```

---

## Step 3: Team Calendar Sharing

When a team member sets `calendar_sharing = 'free_busy'` or `'full'`, their calendar data becomes readable to teammates.

**API route additions:**

### GET /api/v1/teams/:id/calendars
```
Auth required, must be team member
Returns calendars of all team members who have enabled sharing
Each calendar includes: user_name, user_avatar, sharing_level, calendars[]
```

### GET /api/v1/teams/:id/events
```
Auth required, must be team member
Query: { start, end }
Returns events from all sharing-enabled team members:
  - free_busy: returns events as { start_at, end_at, is_busy: true } (no title/details)
  - full: returns full event objects
Response 200: { data: TeamEvent[] }  // TeamEvent adds team_member_id + calendar_sharing_level
```

**Frontend — Team section in sidebar:**
```tsx
// In CalendarSidebar.tsx, add a "Team" section below "My Calendars"
<section>
  <h3>Team</h3>
  {teamMembers.map(member => (
    <div key={member.id} className="flex items-center gap-2">
      <Avatar user={member} size="xs" />
      <label>{member.name}</label>
      <Toggle
        checked={visibleTeamMemberIds.includes(member.id)}
        onChange={() => toggleTeamMember(member.id)}
      />
    </div>
  ))}
</section>
```

When a team member is toggled on: fetch their events and render on the calendar in a muted version of their profile color. Free/busy events render as grey blocks with no title.

---

## Step 4: Team Booking Pages

Extend the booking page model for team types.

**Round Robin:**
```typescript
// In the availability service, for booking_type='round_robin':
// 1. Load all team members assigned to this booking page
// 2. For each slot: check if at least one team member is available
// 3. On booking: assign to the team member with the fewest bookings this week
//    (or rotate through in order — simpler to implement first)
// 4. Create the calendar event on the assigned member's calendar

// booking_pages table needs a team_members column:
// team_member_booking_ids UUID[] — user IDs of team members assigned to this page
```

**Collective:**
```typescript
// For booking_type='collective':
// A slot is only available if ALL assigned team members are free
// On booking: create events on ALL members' calendars
```

---

## Step 5: Stripe Billing

**File:** `apps/api/src/routes/billing.ts`

### GET /api/v1/billing/subscription
```
Returns current plan info: plan, seats (if team), next_billing_date, amount
```

### POST /api/v1/billing/checkout
```
Body: { plan: 'pro_monthly'|'pro_yearly'|'team_monthly'|'team_yearly', seats?: number }
- Create or retrieve Stripe customer (stripe.customers.create / retrieve)
- Create Stripe checkout session
- Return { checkout_url }
```

```typescript
const session = await stripe.checkout.sessions.create({
  customer: user.stripe_customer_id,
  mode: 'subscription',
  line_items: [{
    price: getPriceId(plan),
    quantity: seats ?? 1
  }],
  success_url: `${process.env.WEB_URL}/settings/billing?success=true`,
  cancel_url: `${process.env.WEB_URL}/settings/billing?cancelled=true`,
  subscription_data: {
    metadata: { user_id: user.id }
  }
})
Response 200: { data: { checkout_url: session.url } }
```

### POST /api/v1/billing/portal
```
Creates Stripe billing portal session (manage, cancel, update payment method)
Return { portal_url }
```

### POST /api/v1/webhooks/stripe (public, no auth)
```
Validate Stripe signature: stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
Handle events:
  - checkout.session.completed: update user.plan = 'pro', store stripe_subscription_id
  - invoice.payment_failed: send warning email, set plan to 'trial_expired'
  - customer.subscription.deleted: downgrade to 'expired'
  - customer.subscription.updated: update seat_count for teams
Response 200: { received: true }
```

**Plan enforcement middleware:**
```typescript
// apps/api/src/middleware/plan-gate.ts
function requirePlan(minimumPlan: 'trial'|'pro'|'team') {
  return async (request, reply) => {
    const user = request.user
    if (isPlanExpired(user)) {
      return reply.code(402).send({ error: { code: 'PLAN_REQUIRED', message: 'Upgrade required' } })
    }
    if (minimumPlan === 'team' && user.plan !== 'team') {
      return reply.code(403).send({ error: { code: 'TEAM_PLAN_REQUIRED' } })
    }
  }
}

// Apply in routes:
app.post('/api/v1/booking-pages', { preHandler: [authMiddleware, requirePlan('pro')] }, handler)
app.post('/api/v1/teams', { preHandler: [authMiddleware, requirePlan('pro')] }, handler)
```

---

## Step 6: Onboarding Wizard

**File:** `src/components/onboarding/OnboardingWizard.tsx`

Shown after signup if user has no connected calendars. Renders as a full-screen overlay modal.

```typescript
type OnboardingStep = 'calendar' | 'tasks' | 'hours' | 'plan'

// Track completion in user.preferences.onboarding_completed (boolean)
// Once all 4 steps done: set preferences.onboarding_completed = true, close wizard
```

**Step 1 — Connect Calendar:**
```tsx
<div className="text-center space-y-6">
  <h2>Let's connect your calendar</h2>
  <p>TaskTime works best with your calendars connected</p>
  <Button onClick={() => window.location.href = `${API_URL}/auth/google`}>
    <GoogleIcon /> Continue with Google
  </Button>
  <Button variant="outline" onClick={() => window.location.href = `${API_URL}/auth/microsoft`}>
    <MicrosoftIcon /> Continue with Microsoft
  </Button>
  <button className="text-sm text-muted-foreground" onClick={skipStep}>
    Skip for now
  </button>
</div>
```

**Step 2 — Connect Tasks (optional):**
```tsx
<div>
  <h2>Connect your task tool</h2>
  <p>Pull tasks from the tools you already use</p>
  <IntegrationGrid integrations={['notion', 'todoist', 'linear', 'clickup']} />
  <Button onClick={nextStep}>Skip</Button>
</div>
```

**Step 3 — Set Working Hours:**
```tsx
<div>
  <h2>When do you work?</h2>
  <WorkingHoursForm defaultValue={defaultWorkingHours} onSave={async (hours) => {
    await apiClient('/users/me', { method: 'PATCH', body: { working_hours: hours } })
    nextStep()
  }} />
</div>
```

**Step 4 — First Plan:**
```tsx
<div>
  <h2>Your plan for today</h2>
  <p>TaskTime will suggest how to spend your time</p>
  <Button onClick={async () => {
    await apiClient('/planner/generate', { method: 'POST' })
    await router.push('/')  // goes to calendar view with planner panel open
    completeOnboarding()
  }}>
    Generate my plan →
  </Button>
</div>
```

---

## Step 7: Mobile App (`apps/mobile`)

### Scaffold
```bash
cd apps/mobile
npx create-expo-app . --template blank-typescript
# Install: expo-router, nativewind, @tanstack/react-query, zustand, socket.io-client, expo-notifications, expo-secure-store
```

**Directory structure:**
```
apps/mobile/
├── app/
│   ├── _layout.tsx        # Root layout, providers
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── (tabs)/
│       ├── _layout.tsx    # Tab bar: Calendar | Tasks | Plan | Settings
│       ├── index.tsx      # Calendar tab
│       ├── tasks.tsx      # Task list tab
│       ├── plan.tsx       # AI planner tab
│       └── settings.tsx
├── components/
│   ├── calendar/
│   │   ├── MobileCalendarView.tsx
│   │   └── MobileEventBlock.tsx
│   ├── tasks/
│   │   └── MobileTaskList.tsx
│   └── planner/
│       └── MobilePlannerView.tsx
├── hooks/              # Same hooks as web (reuse logic)
├── stores/             # Zustand stores (shared logic, different persistence)
└── lib/
    ├── api.ts          # Same API client (adapated for RN)
    └── auth.ts         # Auth using expo-secure-store
```

### Auth on Mobile
Use `expo-secure-store` for token storage (not localStorage).
Use `expo-auth-session` for Google/Microsoft OAuth (deep link callback).

```typescript
// apps/mobile/lib/auth.ts
import * as SecureStore from 'expo-secure-store'

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  await SecureStore.setItemAsync('access_token', accessToken)
  await SecureStore.setItemAsync('refresh_token', refreshToken)
}

export const getAccessToken = () => SecureStore.getItemAsync('access_token')
```

### Mobile Calendar View
The mobile calendar view is a simplified day view:
- Swipe left/right to navigate days (use `FlatList` with horizontal scroll)
- Events rendered in a `ScrollView` time grid (same pixel math as web, scaled for phone)
- Tap event → bottom sheet with event details + actions
- "+" FAB button → create event bottom sheet

### Push Notifications
```typescript
// apps/mobile/lib/notifications.ts
import * as Notifications from 'expo-notifications'

export async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return null

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID
  })

  // Register token with API:
  await apiClient('/users/me/push-token', {
    method: 'POST',
    body: { token: token.data, platform: Platform.OS }
  })
  return token.data
}
```

**Backend push notification sender:**
```typescript
// apps/api/src/lib/push-notifications.ts
// Store push tokens in a push_tokens table: { user_id, token, platform, created_at }
// Use Expo Push API to send notifications:
// POST https://exp.host/--/api/v2/push/send
// Body: { to: token, title, body, data }
```

---

## Step 8: Desktop App (Electron)

**Directory:** `apps/desktop/`

```bash
# Minimal Electron wrapper that loads the web app
# apps/desktop/main.ts
import { app, BrowserWindow, Tray, nativeImage } from 'electron'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  win.loadURL(process.env.WEB_URL ?? 'https://app.tasktime.app')
}

app.whenReady().then(() => {
  createWindow()
  // System tray icon
  const tray = new Tray(nativeImage.createFromPath('assets/tray-icon.png'))
  tray.setToolTip('TaskTime')
  tray.on('click', () => win.show())
})
```

For production, load the Next.js app from the built output (not a URL) using `next-electron-server` or similar approach.

**Packaging:** Use `electron-builder` to produce `.dmg`, `.exe`, `.AppImage` installers.

```json
// apps/desktop/package.json build config:
{
  "build": {
    "appId": "app.tasktime",
    "mac": { "target": "dmg" },
    "win": { "target": "nsis" },
    "linux": { "target": "AppImage" }
  }
}
```

---

## Step 9: Apple Reminders & Obsidian (Desktop Only)

### Apple Reminders
This integration is macOS/iOS local — uses native EventKit.
In the Electron app, use a native Node.js module or swift helper process:

```typescript
// Use the `node-eventkit` npm package (wraps EventKit via Swift bridge)
// Or spawn a Swift subprocess that reads/writes reminders

// Simpler approach for MVP: use AppleScript via Electron's shell.exec
const script = `tell application "Reminders" to return properties of every reminder`
const result = await exec(`osascript -e '${script}'`)
// Parse the result into Task objects
```

### Obsidian
Parse markdown files from a user-selected vault folder:
```typescript
// apps/api/src/services/task-sync/obsidian-sync.ts
// (runs as a local file watcher, not an HTTP service)

// The Electron app watches a folder for .md file changes
// Parses tasks using the regex: /^- \[( |x)\] (.+)$/m
// Extracts metadata: due:: YYYY-MM-DD, priority:: high|medium|low
// Creates/updates/completes tasks via the TaskTime API

import chokidar from 'chokidar'

const watcher = chokidar.watch(vaultPath, { persistent: true })
watcher.on('change', (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8')
  const tasks = parseObsidianTasks(content, filePath)
  await syncTasksToAPI(tasks)
})
```

---

## Step 10: Daily Digest Email

**BullMQ cron job:** Daily at 7:00 AM (user's local time) — or one digest job per timezone bucket.

**Email content:**
```
Subject: "Your TaskTime summary for {Day, Month Date}"

Good morning, {name}!

Your plan for today:
• [Meeting] 10:00–11:00: Design review
• [Task]    11:00–12:00: Write Q2 plan (scheduled)
• [Meeting] 14:00–15:00: 1:1 with Sarah

Outstanding items:
• 2 overdue tasks need rescheduling
• 1 task due tomorrow is unscheduled

[Open TaskTime →]
```

Use the Resend `@react-email/components` template system.

---

## Step 11: GDPR — Data Export & Account Deletion

### GET /api/v1/users/me/export
```
Auth required
Queue a background job that:
1. Collects all user data: profile, calendars, events, tasks, bookings, automations
2. Serializes to JSON (or ZIP with CSV files per entity)
3. Uploads to temporary S3 URL (expires in 24 hours)
4. Sends email with download link
Response 202: { message: "Export will be emailed to you within 15 minutes" }
```

### DELETE /api/v1/users/me
```
Auth required
Body: { password: string }  // confirm with password
Queue a background job:
1. Cancel Stripe subscription
2. Revoke OAuth tokens with all providers
3. Delete all user data from DB (cascade from users table)
4. Mark user record as deleted (or hard delete)
Response 204
```

---

## Step 12: Health Check & Monitoring

### GET /health (public)
```typescript
// Check: DB connection, Redis connection
const [dbOk, redisOk] = await Promise.all([
  db.execute(sql`SELECT 1`).then(() => true).catch(() => false),
  redis.ping().then(r => r === 'PONG').catch(() => false)
])
Response 200: {
  status: dbOk && redisOk ? 'ok' : 'degraded',
  db: dbOk ? 'ok' : 'error',
  redis: redisOk ? 'ok' : 'error',
  uptime: process.uptime()
}
```

### Sentry Integration
```typescript
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
})

// In error handler:
Sentry.captureException(err)
```

---

## Step 13: Production Docker Build

**`apps/api/Dockerfile`**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml .
COPY package.json .
RUN npm i -g pnpm && pnpm fetch
COPY . .
RUN pnpm install --offline && pnpm --filter api build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**`apps/web/Dockerfile`**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm i -g pnpm && pnpm install && pnpm --filter web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json ./package.json
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
```

---

## Phase 6 Acceptance Criteria

### Teams
- [ ] User creates a team "Acme Design" → becomes owner with Owner badge
- [ ] Invite a teammate by email → they receive invite email with join link
- [ ] Teammate accepts invite → appears in team members list
- [ ] Teammate sets calendar_sharing = 'free_busy' → host sees grey blocks on their calendar
- [ ] Remove a team member → their calendar overlay disappears

### Mobile
- [ ] App runs on iOS simulator and Android emulator
- [ ] Login + Google OAuth works (redirect back to app)
- [ ] Day view shows today's events correctly
- [ ] Tap event → event details sheet appears
- [ ] Create event from mobile → appears on web calendar within 30s
- [ ] Push notification received when plan is generated at 6 AM

### Desktop
- [ ] App launches from `.dmg` / `.exe` installer
- [ ] System tray icon shows; clicking it brings window to front
- [ ] Calendar and all features work identically to web version

### Billing
- [ ] Click "Upgrade to Pro" → Stripe checkout opens in browser
- [ ] Complete payment → plan updates to 'pro' within 10s (webhook)
- [ ] Click "Manage billing" → Stripe portal opens
- [ ] Cancel subscription via portal → plan downgrades at period end (webhook)

### Onboarding
- [ ] New user signs up → onboarding wizard appears
- [ ] Complete step 1 (connect Google) → step 2 appears
- [ ] Click Skip on step 2 → step 3 appears
- [ ] Complete all 4 steps → wizard disappears, calendar view shown with planner panel open

### GDPR
- [ ] Request data export → email arrives within 15 min with downloadable ZIP
- [ ] Delete account → all data removed from DB within 30 days; confirmation email sent

### Health
- [ ] GET /health returns 200 with status: 'ok' when DB + Redis are running
- [ ] GET /health returns status: 'degraded' when Redis is down
