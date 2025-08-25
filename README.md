# Scheduler App (Next.js + Google Calendar + Supabase)

A lightweight scheduling app that lets users sign in with Google, view their real-time availability, and book meetings. Bookings are created in Google Calendar (with a Google Meet link), stored in Supabase, and confirmation emails are sent via Resend.

## Features

- **Google Sign-in** with `@react-oauth/google` and Calendar scope
- **Availability fetching** from Google Calendar FreeBusy API (next 7 days)
- **Configurable event types** (duration and buffer) from Supabase `event_types`
- **Working hours/availability** per weekday from Supabase `availabilities`
- **Slot selection** with timezone awareness using `date-fns` and `date-fns-tz`
- **Booking creation** in Google Calendar with Meet link
- **Confirmation emails** via Resend using a custom React email template
- **Database persistence** of bookings in Supabase with cancellation tokens

## Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Auth & Calendar**: Google OAuth, Google Calendar API (`googleapis`)
- **Database**: Supabase (Postgres)
- **Email**: Resend (`resend`)
- **Dates**: `date-fns`, `date-fns-tz`
- **HTTP**: `axios`

## App Flow

1. User clicks “Iniciar Sesión con Google”.
2. App retrieves the user profile and access token with `calendar` scope.
3. App calls `/api/availability` to:
   - Read `event_types` and `availabilities` from Supabase
   - Query Google FreeBusy over the next 7 days
   - Return merged data for the UI to compute open slots
4. User selects a slot; fills `BookingForm` (name, email, notes).
5. App calls `/api/book` to:
   - Create a Google Calendar event with Meet link
   - Store the booking in Supabase
   - Send a confirmation email via Resend (includes a cancellation/manage link)

## Prerequisites

- Node.js 18+ and npm
- A Google Cloud project with:
  - OAuth 2.0 Client ID (Web)
  - Google Calendar API enabled
- A Supabase project (URL and keys)
- A Resend account and API key

## Environment Variables

Create `.env.local` in the project root:

```bash
# Google OAuth (client-side)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Supabase (client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase (server-side; service role key is sensitive—keep server-only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Resend
RESEND_API_KEY=your_resend_api_key

# App URL (used for cancellation link generation)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Notes:
- The Service Role key must never be exposed to the browser; it’s used server-side only in API routes.
- Add production values in your hosting provider’s dashboard (e.g., Vercel Project Settings).

## Database Schema (Supabase)

The app expects three tables: `event_types`, `availabilities`, and `bookings`.

```sql
-- Extensions (often pre-enabled on Supabase)
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- Event type: controls meeting duration (min) and buffer (min)
create table if not exists public.event_types (
  id uuid primary key default gen_random_uuid(),
  duration integer not null,
  buffer_time integer not null,
  created_at timestamptz not null default now()
);

-- Availability: working hours per weekday (0=Sunday ... 6=Saturday)
create table if not exists public.availabilities (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

-- Bookings: persisted after Google Calendar event creation
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  guest_email text not null,
  start_time timestamptz not null,
  google_calendar_event_id text not null,
  cancellation_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index if not exists bookings_cancellation_id_idx on public.bookings (cancellation_id);
```

Seed example:

```sql
-- Single event type: 30-min meeting, 10-min buffer
insert into public.event_types (duration, buffer_time)
values (30, 10);

-- Monday–Friday 09:00–17:00 (day_of_week: 1=Mon ... 5=Fri)
insert into public.availabilities (day_of_week, start_time, end_time) values
  (1, '09:00', '17:00'),
  (2, '09:00', '17:00'),
  (3, '09:00', '17:00'),
  (4, '09:00', '17:00'),
  (5, '09:00', '17:00');
```

RLS:
- The server uses the Service Role key in API routes and can bypass RLS. If you enable RLS, ensure policies are compatible with service role usage.

## Google OAuth & Calendar Setup

1. In Google Cloud Console, create an OAuth 2.0 Client ID (type: Web application).
2. Add Authorized JavaScript origins:
   - `http://localhost:3000`
   - Your production domain
3. Enable the Google Calendar API for your project.
4. The app requests the `https://www.googleapis.com/auth/calendar` scope.

## Getting Started

```bash
npm install
npm run dev
# open http://localhost:3000
```

Build and run:

```bash
npm run build
npm start
```

Lint:

```bash
npm run lint
```

## API Reference

### POST `/api/availability`

- **Body**:
```json
{
  "accessToken": "google_oauth_access_token"
}
```

- **Response**:
```json
{
  "busy": [{ "start": "ISO", "end": "ISO" }],
  "eventType": { "duration": 30, "buffer_time": 10, "...": "..." },
  "availability": [
    { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" }
  ]
}
```

- **Errors**:
  - `400` if `accessToken` is missing
  - `500` on upstream or DB errors

### POST `/api/book`

- **Body**:
```json
{
  "accessToken": "google_oauth_access_token",
  "selectedSlot": "2025-01-01T10:00:00.000Z",
  "details": { "name": "Ada Lovelace", "email": "ada@example.com", "notes": "Optional" },
  "profile": { "email": "host@example.com", "name": "Host Name" },
  "duration": 30
}
```

- **Behavior**:
  - Creates Google Calendar event (primary calendar) with conference data (Meet)
  - Stores booking in Supabase
  - Sends confirmation email via Resend using `src/components/EmailTemplate.tsx`
  - Returns created event data

- **Response**:
```json
{ "message": "Evento creado y guardado", "data": { "...google_event_fields" : "..." } }
```

- **Errors**:
  - `400` if any required field is missing
  - `500` on Google API, DB, or email errors (best-effort email send)

## UI Components

- `src/app/page.tsx`: Orchestrates login, availability fetch, and booking; wraps with `GoogleOAuthProvider`. Uses:
  - `CalendarView`: 7-day grid; computes slots from `busy`, `eventType.duration`, `eventType.buffer_time`, and `availabilities`.
  - `BookingForm`: Confirms selected slot, collects name/email/notes, shows duration, then submits.
- `src/components/EmailTemplate.tsx`: Polished confirmation email with Meet and cancellation/manage link.

## Timezone Handling

- Availability and busy times are normalized to the user’s timezone using `Intl.DateTimeFormat().resolvedOptions().timeZone` and `date-fns-tz`.
- Slots are computed locally for the selected day; buffer time is applied after busy blocks.

## Deployment

- Deploy to your platform (e.g., Vercel). Set all env vars in the project settings.
- Ensure your production domain is added to Google OAuth Authorized JS origins.
- Set `NEXT_PUBLIC_APP_URL` to your production URL (used in email links).

## Troubleshooting

- **Google login works but availability fails**: Check Calendar API is enabled; verify `accessToken` scope is `calendar`.
- **Missing Meet link or event ID**: Verify `conferenceDataVersion: 1` and Calendar API permissions.
- **DB insert fails**: Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; check table schemas match above.
- **Emails not sending**: Verify `RESEND_API_KEY`, domain settings, and sender format.
- **No slots visible**: Ensure you have `event_types` configured and `availabilities` cover the selected weekday; confirm your calendar isn’t fully busy.

## Scripts

- `npm run dev` — Start dev server with Turbopack
- `npm run build` — Build with Turbopack
- `npm start` — Start production server
- `npm run lint` — Run ESLint