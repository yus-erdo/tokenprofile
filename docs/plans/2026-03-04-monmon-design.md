# MonMon — LLM Token Usage Monitor

## Overview

A website that monitors LLM token consumption for individuals. Users sign in with GitHub, get an API key, and configure Claude Code hooks to push session data. Each user has a public profile page with a GitHub-style contribution heatmap showing their LLM usage.

## Architecture

```
Claude Code Hook (Stop event)
    │
    ▼  curl POST with API key
┌─────────────────────────┐
│  Next.js on Vercel       │
│  ├─ /api/ingest          │  validates API key, stores session data
│  ├─ /api/auth/*          │  Supabase Auth (GitHub OAuth)
│  ├─ /                    │  landing page
│  ├─ /sign-in             │  sign in
│  ├─ /[username]          │  public profile + heatmap
│  └─ /settings            │  edit profile, manage API key
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Supabase                │
│  ├─ Auth (GitHub OAuth)  │
│  ├─ users table          │
│  └─ sessions table       │
└─────────────────────────┘
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Auth | Supabase Auth (GitHub OAuth) |
| Database | Supabase Postgres |
| DB Client | Supabase JS |
| Styling | Tailwind CSS |
| Heatmap | Custom SVG component |
| Deployment | Vercel |
| Package manager | bun |

## Database Schema

### `users` (extends Supabase auth.users)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | matches auth.users.id |
| username | text (unique) | from GitHub username |
| display_name | text | editable |
| bio | text | editable |
| avatar_url | text | from GitHub, editable |
| api_key | text (unique) | generated on signup, used by hooks |
| created_at | timestamptz | auto |

### `sessions` (token consumption logs)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | auto-generated |
| user_id | uuid (FK → users) | |
| provider | text | "anthropic", "openai", etc. |
| model | text | "claude-opus-4-6", "gpt-4", etc. |
| input_tokens | int | |
| output_tokens | int | |
| total_tokens | int | |
| cost_usd | numeric | estimated cost |
| project | text | repo/project name |
| duration_seconds | int | session duration |
| num_turns | int | conversation turns |
| tools_used | jsonb | `{"Read": 5, "Edit": 3}` |
| metadata | jsonb | extensible for future fields |
| session_at | timestamptz | when session happened |
| created_at | timestamptz | auto |

## Pages

### `/` — Landing page
Simple hero with sign-in CTA and demo heatmap.

### `/sign-in` — Auth
"Sign in with GitHub" button via Supabase Auth.

### `/[username]` — Public profile
- Left sidebar: avatar, display name, username, bio
- Right: heatmap (daily token usage), year selector
- Stats: total tokens, total cost, favorite model, session count
- Recent sessions list

### `/settings` — Edit profile (authenticated)
- Edit display name, bio
- View/regenerate API key
- Copy hook setup command

## API Routes

- `POST /api/ingest` — receive session data, validate API key, store
- `GET /api/users/[username]` — public profile + aggregated stats
- `GET /api/users/[username]/sessions` — paginated session list
- `PATCH /api/users/me` — update profile
- `POST /api/users/me/regenerate-key` — regenerate API key

## Claude Code Hook

Fires on `Stop` event, sends session data via curl:

```bash
curl -s -X POST https://monmon.vercel.app/api/ingest \
  -H "Authorization: Bearer $MONMON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"anthropic","model":"...","input_tokens":...,"output_tokens":...}'
```

## Design Direction

- Clean, minimal, GitHub-inspired layout
- Light theme (dark theme later)
- Green heatmap squares
- Card-based stats and session list
- Public profiles by default
