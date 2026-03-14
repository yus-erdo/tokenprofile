# toqqen

The Fitbit for your AI usage. Track your LLM token consumption with GitHub-style heatmaps, cost tracking, and shareable public profiles.

## Features

- **Usage heatmaps** — GitHub-style contribution graphs for your AI activity
- **Cost tracking** — Per model, per day, per month spending breakdown
- **Public profiles** — Shareable profile pages at `toqqen.dev/username`
- **Streak tracking** — See your longest and current usage streaks
- **One command setup** — Works with Claude Code and Cursor

## Quick start

```bash
curl -fsSL toqqen.dev/install | bash
```

Sign in with GitHub at [toqqen.dev](https://toqqen.dev) to view your dashboard.

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [Tailwind CSS](https://tailwindcss.com)
- [NextAuth.js](https://next-auth.js.org) (GitHub OAuth)
- [Firebase / Firestore](https://firebase.google.com)
- [Upstash Redis](https://upstash.com) (rate limiting)
- [Sentry](https://sentry.io) (error tracking)

## Development

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
bun test
```

## License

MIT
