# ScoutAI

AI-powered FRC/FTC scouting and strategy platform. Teams input scouting observations during matches, combined with TBA/Statbotics data, and Claude AI generates strategic recommendations: alliance pick lists, match game plans, and post-match analysis.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (PostgreSQL, Auth, Realtime)
- **AI/LLM:** Claude API (Sonnet) for strategy generation
- **ML:** Python (scikit-learn / XGBoost) for match prediction
- **External APIs:** TBA API v3 + Statbotics API
- **Hosting:** Vercel (frontend) + Railway (Python backend)
- **Offline:** PWA with Service Worker + IndexedDB

## Project Structure

```
src/
  app/            # Next.js App Router pages and layouts
    api/          # API routes
  components/     # React components
    ui/           # shadcn/ui components
  lib/            # Utility functions, Supabase client, API helpers
    supabase/     # Supabase client (server.ts, client.ts, middleware.ts)
  types/          # TypeScript type definitions (generated from Supabase)
scripts/          # Python ML scripts (training, data pipeline)
```

## Conventions

- Use TypeScript strict mode; no `any` types
- Use named exports, not default exports (except Next.js pages/layouts)
- Components use PascalCase filenames; utilities use camelCase
- Use server components by default, client components only when needed (`"use client"`)
- API routes go in `src/app/api/`
- Use `createClient` from `@supabase/ssr` for server-side Supabase access
- Use `createBrowserClient` from `@supabase/ssr` for client-side Supabase access
- Tailwind CSS for all styling; no CSS modules
- shadcn/ui components via `npx shadcn-ui@latest add <component>`
- Use Zod for API input validation
- Mobile-first design (most users scout from phones at events)
- Commit after each working feature

## Database

- Supabase PostgreSQL with Row Level Security (RLS) on all public tables
- UUIDs for all primary keys (`gen_random_uuid()`)
- All tables have `created_at` timestamps
- RLS helper function `get_user_org_id()` returns current user's org_id
- Scouting data is org-scoped; team/event/match data is readable by all authenticated users
- All database changes go through Supabase MCP (migrations)

## Auth

- Supabase Auth with email/password
- User profiles linked to `auth.users` via `profiles.id = auth.users.id`
- Organization-based access control via `org_id` on profiles
- Roles: `scout`, `strategist`, `admin`
- Join orgs via 6-character join code

## Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — ESLint

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `TBA_API_KEY`

## Key External APIs

- **TBA:** https://www.thebluealliance.com/apidocs/v3
  - Auth header: `X-TBA-Auth-Key: {TBA_API_KEY}`
- **Statbotics:** https://api.statbotics.io/v3/
  - No auth needed, rate limit ~60 req/min
