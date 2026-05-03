# TaskTime — Architecture & Tech Stack Decisions

> This document locks all technology choices so a coding agent never has to choose between options. Every decision here is final for the project. Do not deviate without updating this document.

---

## Project Structure (Monorepo)

```
tasktime/
├── apps/
│   ├── api/           # Fastify REST API + WebSocket server
│   ├── web/           # Next.js 14 App Router (desktop + web)
│   └── mobile/        # React Native + Expo (Phase 6 only)
├── packages/
│   ├── db/            # Drizzle ORM schema, migrations, client
│   ├── types/         # Shared TypeScript types (API contracts)
│   └── ui/            # Shared React components (shadcn/ui base)
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Technology Decisions

### Monorepo Tooling
| Tool | Choice | Why |
|---|---|---|
| Package manager | **pnpm** | Fast installs, workspace support |
| Monorepo orchestration | **Turborepo** | Incremental builds, task pipeline |
| Node version | **Node.js 20 LTS** | Current LTS |
| TypeScript version | **5.x** | Latest stable |

### Backend (`apps/api`)
| Concern | Choice | Package |
|---|---|---|
| HTTP framework | **Fastify** | `fastify` |
| TypeScript | ts-node-dev in dev, tsc in prod | `typescript`, `ts-node-dev` |
| Validation | **Zod** | `zod` |
| ORM | **Drizzle ORM** | `drizzle-orm`, `drizzle-kit` |
| Database driver | **postgres.js** | `postgres` |
| Database | **PostgreSQL 15** | — |
| Cache + sessions | **Redis 7** | `ioredis` |
| Job queue | **BullMQ** | `bullmq` |
| WebSocket | **Socket.io** | `socket.io` |
| Auth — JWT | **jose** library | `jose` |
| Auth — passwords | **bcrypt** | `bcryptjs` |
| OAuth client | **openid-client** | `openid-client` |
| Email | **Resend** | `resend` |
| Payments | **Stripe** | `stripe` |
| AI | **Anthropic Claude API** | `@anthropic-ai/sdk` |
| HTTP client (external APIs) | **ky** | `ky` |
| CalDAV | **tsdav** | `tsdav` |
| Logging | **Pino** (built into Fastify) | built-in |
| Testing | **Vitest** + **Supertest** | `vitest`, `supertest` |
| Env vars | **dotenv** | `dotenv` |

### Frontend (`apps/web`)
| Concern | Choice | Package |
|---|---|---|
| Framework | **Next.js 14** (App Router) | `next` |
| Language | TypeScript 5.x | `typescript` |
| Styling | **Tailwind CSS v3** | `tailwindcss` |
| Component library | **shadcn/ui** (Radix primitives) | `@radix-ui/*`, shadcn CLI |
| Icons | **Lucide React** | `lucide-react` |
| State management | **Zustand** | `zustand` |
| Server state / data fetching | **TanStack Query v5** | `@tanstack/react-query` |
| Drag and drop | **@dnd-kit** | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Calendar rendering | **Custom** (no FullCalendar) | — |
| Date/time library | **date-fns** | `date-fns` |
| Timezone handling | **date-fns-tz** | `date-fns-tz` |
| Forms | **React Hook Form** + **Zod** | `react-hook-form`, `@hookform/resolvers` |
| Rich text (task notes) | **TipTap** | `@tiptap/react` |
| Command palette | **cmdk** | `cmdk` |
| Animations | **Framer Motion** | `framer-motion` |
| WebSocket client | **Socket.io client** | `socket.io-client` |
| API client | Shared `fetch` wrapper with TanStack Query | — |
| E2E testing | **Playwright** | `@playwright/test` |
| Unit testing | **Vitest** + **Testing Library** | `@testing-library/react` |

### Mobile (`apps/mobile`) — Phase 6 only
| Concern | Choice |
|---|---|
| Framework | React Native + Expo SDK 51 |
| Navigation | Expo Router |
| Styling | NativeWind (Tailwind for RN) |
| State | Zustand (shared with web) |
| Data fetching | TanStack Query (shared with web) |

### Infrastructure
| Concern | Choice |
|---|---|
| Containerization | Docker + docker-compose (local dev) |
| Production hosting | Railway (API + workers) + Vercel (web) |
| Database hosting | Railway PostgreSQL or Supabase |
| Redis hosting | Railway Redis or Upstash |
| Object storage | Cloudflare R2 (S3-compatible) |
| CDN | Vercel Edge Network (web) |
| CI/CD | GitHub Actions |

---

## Environment Variables

### `apps/api/.env`
```
# Server
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://tasktime:password@localhost:5432/tasktime

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=<32+ char random string>
JWT_REFRESH_SECRET=<32+ char random string>
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

# Encryption (for OAuth tokens at rest)
ENCRYPTION_KEY=<32 bytes hex — generate with: openssl rand -hex 32>

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/google/callback

# Microsoft OAuth
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/v1/auth/microsoft/callback
MICROSOFT_TENANT_ID=common

# Apple OAuth
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=

# Notion
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
NOTION_REDIRECT_URI=http://localhost:3001/api/v1/task-integrations/notion/callback

# Todoist
TODOIST_CLIENT_ID=
TODOIST_CLIENT_SECRET=

# Linear
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=

# ClickUp
CLICKUP_CLIENT_ID=
CLICKUP_CLIENT_SECRET=

# Zoom
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=

# Email
RESEND_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID_MONTHLY=
STRIPE_PRO_PRICE_ID_YEARLY=
STRIPE_TEAM_PRICE_ID_MONTHLY=
STRIPE_TEAM_PRICE_ID_YEARLY=

# Anthropic (Phase 5)
ANTHROPIC_API_KEY=

# Google Maps (Phase 4 — travel time)
GOOGLE_MAPS_API_KEY=

# App
WEB_URL=http://localhost:3000
```

### `apps/web/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## API Conventions

- All API routes prefixed: `/api/v1/`
- Auth: `Authorization: Bearer <access_token>` header on all authenticated routes
- Content-Type: `application/json` for all requests/responses
- Errors: `{ error: { code: string, message: string, details?: any } }`
- Success: `{ data: <payload> }` wrapper OR direct object for single resources
- Pagination: `{ data: [], meta: { total, page, per_page, has_more } }`
- Timestamps: ISO 8601 strings in UTC (`2025-01-15T14:30:00.000Z`)
- IDs: UUIDs (v4)

### Standard Error Codes
```
AUTH_REQUIRED          401  No or invalid token
AUTH_EXPIRED           401  Token expired
FORBIDDEN              403  Authenticated but not authorized
NOT_FOUND              404  Resource doesn't exist
VALIDATION_ERROR       422  Request body/params failed validation
CONFLICT               409  Unique constraint violation
RATE_LIMITED           429  Too many requests
INTERNAL_ERROR         500  Unexpected server error
INTEGRATION_ERROR      502  External API failure
```

---

## Database Conventions (Drizzle ORM)

- Schema file: `packages/db/src/schema.ts`
- Migrations folder: `packages/db/migrations/`
- All tables use `snake_case`
- All IDs: `uuid` with `gen_random_uuid()` default
- All tables have `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Soft deletes: `deleted_at TIMESTAMPTZ` (null = not deleted)
- JSON columns: `jsonb` (not `json`)
- Encrypted fields: store as `TEXT`, encrypt/decrypt in application layer using AES-256-GCM

### Drizzle Client
```typescript
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const sql = postgres(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
export type DB = typeof db
```

---

## Auth Flow

```
1. POST /auth/signup → creates user, returns { access_token, refresh_token }
2. POST /auth/login  → validates password, returns { access_token, refresh_token }
3. Access token: JWT, expires 1h, signed with JWT_ACCESS_SECRET
4. Refresh token: JWT, expires 30d, signed with JWT_REFRESH_SECRET, stored in DB
5. POST /auth/refresh → validates refresh token, issues new pair (rotation)
6. DELETE /auth/session → invalidates refresh token in DB
7. OAuth flows (/auth/google, /auth/microsoft, /auth/apple):
   - Initiation: GET /auth/:provider → 302 redirect to provider
   - Callback: GET /auth/:provider/callback → creates/finds user, returns tokens
   - Response: redirect to WEB_URL/auth/callback?access_token=&refresh_token=
```

---

## Sync Architecture

### Calendar Sync
```
1. On account connect: full sync (fetch all events, store in DB)
2. Register push webhook (Google: watch channels; Microsoft: Graph subscriptions)
3. On webhook receive: trigger incremental sync for affected calendar
4. Incremental sync: use syncToken (Google) or deltaToken (Microsoft)
5. Fallback polling: every 60s for CalDAV and providers without webhooks
6. All sync runs as BullMQ jobs in apps/api/src/workers/
```

### Task Sync
```
1. On integration connect: full sync (fetch all tasks, store in DB)
2. Polling sync: every 60s per integration (BullMQ repeatable job)
3. On task change in TaskTime: push update to provider API immediately
4. Conflict resolution: last-write-wins using updatedAt timestamp
```

---

## Real-Time (Socket.io)

```
Namespace: /
Auth: socket.handshake.auth.token (JWT access token)

Server rooms: user:<user_id> (each user has their own room)

Events emitted by server:
  event:created   { event: Event }
  event:updated   { event: Event }
  event:deleted   { eventId: string }
  task:updated    { task: Task }
  plan:updated    { plan: DailyPlan }
  sync:complete   { accountId: string }
  recommendation:added { recommendation: Recommendation }
```

---

## Folder Structure (per app)

### `apps/api/src/`
```
├── plugins/           # Fastify plugins (auth, cors, rate-limit)
├── routes/            # Route handlers (one file per resource)
│   ├── auth.ts
│   ├── calendars.ts
│   ├── events.ts
│   ├── tasks.ts
│   ├── task-integrations.ts
│   ├── planner.ts
│   ├── booking-pages.ts
│   ├── automations.ts
│   └── billing.ts
├── services/          # Business logic (no HTTP concerns)
│   ├── calendar-sync/
│   ├── task-sync/
│   ├── availability/
│   ├── planner/
│   └── automations/
├── workers/           # BullMQ job processors
├── lib/               # Shared utilities (encryption, date, email)
├── middleware/        # Auth middleware, error handler
└── index.ts           # Server entry point
```

### `apps/web/src/`
```
├── app/               # Next.js App Router pages
│   ├── (auth)/        # Login, signup, OAuth callback
│   ├── (app)/         # Main app (protected)
│   │   ├── layout.tsx # App shell (sidebar + main)
│   │   └── page.tsx   # Calendar view
│   └── book/          # Public booking pages
│       └── [slug]/
├── components/
│   ├── calendar/      # CalendarGrid, EventBlock, DayView, WeekView, etc.
│   ├── tasks/         # TaskPanel, TaskRow, TaskForm
│   ├── planner/       # PlannerPanel, RecommendationCard
│   ├── booking/       # BookingPageForm, PublicBookingPage, SlotPicker
│   ├── automations/   # AutomationForm, AutomationList
│   └── ui/            # shadcn/ui components
├── hooks/             # Custom React hooks
├── stores/            # Zustand stores
├── lib/               # API client, utils, date helpers
└── types/             # Frontend-specific types (imports from @tasktime/types)
```

---

## Calendar Grid — Custom Implementation Notes

Do NOT use FullCalendar or react-big-calendar. Build a custom grid because:
- We need pixel-perfect drag-and-drop for time blocking
- We need to overlay Frames as background elements
- Full control over event rendering and interaction

### Day/Week View Algorithm
```
1. Render a time grid: 24 hours × column-per-day
2. Each hour = 60px height (configurable constant: HOUR_HEIGHT = 60)
3. Event position: top = (startMinutes / 60) * HOUR_HEIGHT
4. Event height: height = (durationMinutes / 60) * HOUR_HEIGHT, min 20px
5. For overlapping events: calculate "columns" layout, divide width
6. Current time line: positioned at (currentMinutes / 60) * HOUR_HEIGHT, updates every 60s
7. Drag-and-drop: @dnd-kit, snap to 15-min grid increments
8. Task drop zone: the entire time grid is a drop target
```
