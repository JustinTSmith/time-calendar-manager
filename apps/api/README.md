# TaskTime Calendar API

Google Calendar OAuth + bidirectional sync engine implementation.

## Features

- **OAuth Flow**: Complete Google OAuth 2.0 flow with state validation
- **Full Sync**: Imports all calendars and events (past 30 days, next 6 months) on connect
- **Incremental Sync**: Real-time updates via Google push notifications (webhooks)
- **Event Write-Back**: Creates/updates/deletes events in Google Calendar from TaskTime
- **Real-time Events**: Socket.io emits events for live UI updates
- **Channel Renewal**: Automatic webhook channel renewal every 6 days

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/time_calendar_manager

# Redis
REDIS_URL=redis://localhost:6379

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/google/callback

# JWT
JWT_SECRET=your_jwt_secret_at_least_32_characters

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_32_byte_hex_encryption_key

# Web
WEB_URL=http://localhost:3000
API_URL=http://localhost:3001

# Google Webhook
GOOGLE_WEBHOOK_SECRET=your_webhook_secret
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/auth/google?userId={id}` | Initiate OAuth flow |
| GET | `/api/v1/auth/google/callback` | OAuth callback (redirects to web) |
| POST | `/api/v1/auth/dev-login` | Development login (creates test user) |

### Calendars

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/calendars` | List user's calendars |
| PATCH | `/api/v1/calendars/:id` | Update calendar (visibility, color) |
| POST | `/api/v1/calendars/:id/sync` | Trigger manual sync |
| GET | `/api/v1/calendar-accounts` | List connected accounts |
| DELETE | `/api/v1/calendar-accounts/:id` | Disconnect account |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/events?start=&end=&calendarId=` | List events |
| POST | `/api/v1/events` | Create event (writes to Google) |
| PATCH | `/api/v1/events/:id` | Update event (writes to Google) |
| DELETE | `/api/v1/events/:id` | Delete event (writes to Google) |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/webhooks/google` | Google push notifications |
| POST | `/api/v1/webhooks/sync` | Manual sync trigger (dev) |

## WebSocket Events

Connect to Socket.io and join your user room:

```javascript
socket.emit('join', userId);
```

Events emitted:
- `event:created` - New event from sync
- `event:updated` - Event updated from sync
- `event:deleted` - Event deleted from sync

## Running

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker-compose up -d

# Run migrations
pnpm db:migrate

# Start API (development with hot reload)
pnpm --filter @time-calendar-manager/api dev

# Start worker (in another terminal)
pnpm --filter @time-calendar-manager/api worker

# Build for production
pnpm --filter @time-calendar-manager/api build
pnpm --filter @time-calendar-manager/api start
```

## Architecture

### Sync Flow

1. **Full Sync** (on OAuth connect):
   - Fetches `calendarList` from Google
   - Creates/updates Calendar rows in DB
   - Fetches events (timeMin=now-30d, timeMax=now+180d)
   - Upserts events by `provider_event_id`
   - Stores `nextSyncToken` for incremental sync
   - Registers push notification channel

2. **Incremental Sync** (on webhook):
   - Receives push notification from Google
   - Uses stored `syncToken` to get only changes
   - Processes `cancelled` status as soft-delete
   - Emits real-time events via Socket.io
   - Updates sync token for next time

3. **Write-Back** (user actions):
   - User creates/updates/deletes event
   - Local DB updated immediately
   - Job queued to BullMQ
   - Worker pushes to Google Calendar API
   - Retries 5x with exponential backoff

### Security

- OAuth state stored in Redis (10min TTL)
- Tokens encrypted with AES-256-GCM
- JWT authentication for API
- Webhook token validation

## Testing

1. Get a dev token:
```bash
curl -X POST http://localhost:3001/api/v1/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User"}'
```

2. Start OAuth flow (visit in browser):
```
http://localhost:3001/api/v1/auth/google?userId={USER_ID}
```

3. After OAuth, check calendars:
```bash
curl http://localhost:3001/api/v1/calendars \
  -H "Authorization: Bearer {TOKEN}"
```

4. Create an event:
```bash
curl -X POST http://localhost:3001/api/v1/events \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "calendarId": "{CALENDAR_ID}",
    "title": "Test Event",
    "startAt": "2026-05-01T10:00:00Z",
    "endAt": "2026-05-01T11:00:00Z"
  }'
```
