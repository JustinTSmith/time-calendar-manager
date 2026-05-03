# time-calendar-manager

## Local PostgreSQL

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `corepack pnpm db:start`.
3. Confirm it is healthy with `corepack pnpm db:status`.
4. Run migrations with `corepack pnpm db:migrate`.

The default local connection string is:

```text
postgresql://postgres:postgres@localhost:5432/time_calendar_manager
```

Helpful commands:

- `corepack pnpm db:logs` to inspect PostgreSQL logs.
- `corepack pnpm db:stop` to stop the container without removing data.
- `corepack pnpm db:down` to remove the container.
- `corepack pnpm db:reset` to remove the container and local volume, then start fresh.

If you change the PostgreSQL credentials or port in `.env`, update `DATABASE_URL` to match.
