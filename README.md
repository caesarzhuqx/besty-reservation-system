# Besty Reservation System

This project focused on:
- webhook ingestion with signature validation
- PostgreSQL upsert into fixed `reservations` schema
- real-time reservation dashboard updates
- filtered guest broadcast with concurrency control and 429 retry handling

## Tech Stack

- TypeScript + Node.js + Express
- PostgreSQL (`reservations` table from provided `init.sql`)
- SSE (Server-Sent Events) for real-time UI refresh

## Prerequisites

1. Start the provided challenge services (in the challenge folder):

```bash
docker compose up
```

2. In this repo:

```bash
npm install
```

## Environment

Create `.env` (optional; defaults are already set):

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=interview
DB_PASSWORD=interview_password
DB_NAME=interview
WEBHOOK_SECRET=super_secret_key_123
GUEST_API_BASE_URL=http://localhost:3001
PUBLIC_WEBHOOK_URL=http://host.docker.internal:3000/webhooks
BROADCAST_CONCURRENCY=10
BROADCAST_MAX_ATTEMPTS=5
```

## Run

```bash
npm run dev
```

Open: `http://localhost:3000`

## Register Webhook

Option A:

```bash
curl -X POST http://localhost:3000/api/webhooks/register
```

Option B (directly against mock API):

```bash
curl -X POST http://localhost:3001/webhooks/register \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"http://host.docker.internal:3000/webhooks\"}"
```

## Main Endpoints

- `POST /webhooks` webhook receiver (validates `X-Webhook-Secret`)
- `GET /api/reservations` list/filter reservations
- `GET /api/events` SSE stream for real-time updates
- `POST /api/broadcast` broadcast message to filtered guests
- `POST /api/webhooks/register` helper to register callback URL

## Scaling Notes

- DB pool configured (`DB_POOL_MAX`) for concurrent ingest/query.
- Webhook writes use `INSERT ... ON CONFLICT(reservation_id) DO UPDATE`.
- `event_timestamp` guard avoids older events overwriting newer data.
- Broadcast uses bounded concurrency (`p-limit`) to avoid API overload.
- Handles rate limits (`429`) with `Retry-After` aware retry logic.
