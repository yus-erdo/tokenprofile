# Toqqen — LLM Token Usage Monitor

**URL:** https://www.toqqen.app/

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
│  ├─ /                    │  landing page
│  ├─ /sign-in             │  sign in
│  ├─ /[username]          │  public profile + heatmap
│  └─ /settings            │  edit profile, manage API key
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Firebase                │
│  ├─ Auth (GitHub OAuth)  │
│  └─ Firestore            │
│     ├─ users collection  │
│     └─ sessions collection│
└─────────────────────────┘
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Auth | Firebase Auth (GitHub OAuth) |
| Database | Cloud Firestore |
| DB Client | Firebase Admin SDK (server), Firebase JS SDK (client) |
| Styling | Tailwind CSS |
| Heatmap | Custom SVG component |
| Deployment | Vercel |
| Package manager | bun |

## Firestore Schema

### `users` collection

Document ID = Firebase Auth UID

```
{
  username: string        // from GitHub username, unique
  displayName: string     // editable
  bio: string             // editable
  avatarUrl: string       // from GitHub, editable
  apiKey: string          // generated on signup, used by hooks
  createdAt: Timestamp
}
```

### `sessions` collection

Document ID = auto-generated

```
{
  userId: string          // references users doc ID
  provider: string        // "anthropic", "openai", etc.
  model: string           // "claude-opus-4-6", "gpt-4", etc.
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number         // estimated cost
  project: string         // repo/project name
  durationSeconds: number
  numTurns: number
  toolsUsed: map          // { "Read": 5, "Edit": 3 }
  metadata: map           // extensible for future fields
  sessionId: string       // Claude Code session ID
  sessionAt: Timestamp    // when session happened
  createdAt: Timestamp
}
```

### Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users: anyone can read, only owner can update
    match /users/{userId} {
      allow read: if true;
      allow update: if request.auth != null && request.auth.uid == userId;
    }
    // Sessions: anyone can read, inserts handled server-side via Admin SDK
    match /sessions/{sessionId} {
      allow read: if true;
    }
  }
}
```

## Pages

### `/` — Landing page
Simple hero with sign-in CTA and demo heatmap.

### `/sign-in` — Auth
"Sign in with GitHub" button via Firebase Auth.

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

- `POST /api/ingest` — receive session data, validate API key, store in Firestore
- `GET /api/users/[username]` — public profile + aggregated stats
- `GET /api/users/[username]/sessions` — paginated session list
- `PATCH /api/users/me` — update profile
- `POST /api/users/me/regenerate-key` — regenerate API key

## Claude Code Hook

Fires on `Stop` event, sends session data via curl:

```bash
curl -s -X POST https://www.toqqen.app/api/ingest \
  -H "Authorization: Bearer $TOQQEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"anthropic","model":"...","input_tokens":...,"output_tokens":...}'
```

## Design Direction

- Clean, minimal, GitHub-inspired layout
- Light theme (dark theme later)
- Green heatmap squares
- Card-based stats and session list
- Public profiles by default
