# Captionovo Frontend

Next.js web app connected to Supabase Auth and the Captionovo API.

## Setup

```bash
cp .env.example .env.local
```

Ensure the backend is running at `http://localhost:4000` with a valid `SUPABASE_SERVICE_ROLE_KEY`.

## Development

From repo root:

```bash
npm run dev
```

Or from this folder:

```bash
npm run dev
```

## Auth flow

- Email/password signup and login via Supabase Auth
- Google OAuth via `signInWithGoogle()` on login/signup pages
- Protected routes via middleware (`/dashboard`, `/upload`, `/projects`, etc.)
- Session token forwarded to backend API as `Authorization: Bearer <token>`

## Google OAuth setup

The app code is ready. Enable Google in Supabase with one of these options:

### Option A — Script (recommended)

1. [Create Google OAuth credentials](https://console.cloud.google.com/auth/clients) (Web application):
   - **Authorized JavaScript origins:** `http://localhost:3000`
   - **Authorized redirect URIs:** `https://zzxsxccapuwefkvqixad.supabase.co/auth/v1/callback`
2. Create a [Supabase access token](https://supabase.com/dashboard/account/tokens)
3. From repo root:

```bash
cp scripts/.env.example scripts/.env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_ACCESS_TOKEN
set -a && source scripts/.env && set +a
npm run configure:google-oauth
```

### Option B — Dashboard (manual)

1. [Enable Google provider](https://supabase.com/dashboard/project/zzxsxccapuwefkvqixad/auth/providers?provider=Google)
2. [URL Configuration](https://supabase.com/dashboard/project/zzxsxccapuwefkvqixad/auth/url-configuration): Site URL `http://localhost:3000`, redirect `http://localhost:3000/auth/callback`

## Stack

- Next.js 16 (App Router)
- Supabase Auth (`@supabase/ssr`)
- Tailwind CSS 4
