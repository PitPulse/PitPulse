# PitPilot

PitPilot is an FRC scouting and strategy platform built with Next.js + Supabase.

## Core Features

- Team/event management and role-based access
- Match scouting forms and reports
- Draft room + alliance planning tools
- AI-generated team briefs and pick list suggestions
- TBA + Statbotics integrations

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres/Auth/Realtime)
- OpenAI API
- The Blue Alliance API

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment variables:

```bash
cp .env.example .env.local
```

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Scripts

- `npm run dev` - Run local dev server
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
