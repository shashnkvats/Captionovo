# Captionovo

Monorepo for the Captionovo transcription and creator repurposing platform.

```
Captionovo/
├── frontend/   # Next.js web app
└── backend/    # API + processing (coming soon)
```

## Quick start

From the repo root:

```bash
npm install
npm run dev
```

This starts the frontend at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run dev:fe` | Same as above |
| `npm run dev:be` | Start backend API (port 4000) |
| `npm run build` | Build frontend for production |
| `npm run lint` | Lint frontend |

You can also run commands inside a workspace directly:

```bash
cd frontend && npm run dev
```

## Frontend routes

| Screen | Route |
|--------|-------|
| Login / Signup | `/login`, `/signup` |
| Dashboard | `/dashboard` |
| New Upload | `/upload` |
| Processing Status | `/projects/[id]/processing` |
| Project Editor | `/projects/[id]` |
| Subtitles | `/projects/[id]/subtitles` |
| Repurpose | `/projects/[id]/repurpose` |
| Export | `/projects/[id]/export` |
| Project Settings | `/projects/[id]/settings` |
| Billing / Credits | `/billing` |
| Account Settings | `/settings` |

See [frontend/README.md](./frontend/README.md) for frontend-specific details.
