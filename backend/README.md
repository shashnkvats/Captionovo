# Captionovo Backend

Hono API server backed by Supabase (Postgres, Auth, Storage).

## Setup

1. Copy env file:

```bash
cp .env.example .env
```

2. Fill in keys from [Supabase Dashboard → Project Settings → API](https://supabase.com/dashboard/project/zzxsxccapuwefkvqixad/settings/api):

| Variable | Where to find it |
|----------|------------------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (keep secret) |

3. Run the API:

```bash
npm run dev
```

API runs at `http://localhost:4000`.

## Supabase project

- **Project:** captionovo
- **Region:** ap-south-1 (Mumbai)
- **Ref:** `zzxsxccapuwefkvqixad`
- **URL:** `https://zzxsxccapuwefkvqixad.supabase.co`

Migrations are stored in `supabase/migrations/` and applied via Supabase MCP.

## API routes

All routes except `/health` require `Authorization: Bearer <supabase_access_token>`.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Health check |
| GET | `/profile` | Current user profile + usage |
| PATCH | `/profile` | Update account defaults |
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Project with transcript, speakers, subtitles, exports |
| PATCH | `/projects/:id` | Update project metadata |
| DELETE | `/projects/:id` | Soft-delete project |
| POST | `/projects/:id/upload-url` | Signed upload URL for source media |
| POST | `/projects/:id/process` | Queue processing (stub) |
| GET | `/billing/transactions` | Credit usage history |

## Database schema

- `profiles` — user settings, credits, defaults
- `projects` — upload jobs and metadata
- `speakers`, `transcript_segments`, `subtitle_segments`
- `repurpose_outputs`, `exports`
- `credit_transactions`

Storage buckets: `uploads`, `exports`

## Next steps

- Connect transcription worker to `/process`
- Deduct credits on completion
- Wire frontend auth to Supabase and call this API
