# MonMon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a website that monitors LLM token consumption per user, with GitHub OAuth, public profiles with heatmaps, and data ingestion via Claude Code hooks.

**Architecture:** Next.js 15 App Router on Vercel, Supabase for auth (GitHub OAuth) and Postgres DB. Claude Code Stop hook runs a script that parses the session transcript JSONL, extracts token/model metadata, and POSTs it to a Next.js API route authenticated by per-user API key.

**Tech Stack:** Next.js 15, TypeScript, Supabase (Auth + Postgres), Tailwind CSS, bun, Vercel

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.local.example`, `.gitignore`
- Create: `app/layout.tsx`, `app/page.tsx`

**Step 1: Create Next.js project with bun**

```bash
cd /Users/yusuf.erdogan/work/monmon
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-bun
```

Accept defaults. This creates the full scaffolding.

**Step 2: Install Supabase dependencies**

```bash
bun add @supabase/supabase-js @supabase/ssr
```

**Step 3: Create `.env.local.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Step 4: Verify dev server starts**

```bash
bun run dev
```

Expected: App runs on http://localhost:3000

**Step 5: Commit**

```bash
git add -A
git commit -m "scaffold Next.js 15 project with Supabase deps"
```

---

### Task 2: Supabase Client Utilities

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

**Step 1: Create browser client utility**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create server client utility**

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — safe to ignore
          }
        },
      },
    }
  );
}
```

**Step 3: Commit**

```bash
git add lib/supabase/
git commit -m "add Supabase client utilities for browser and server"
```

---

### Task 3: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_create_tables.sql`

**Step 1: Write the migration SQL**

```sql
-- supabase/migrations/001_create_tables.sql

-- Users table (public profile data, linked to auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  api_key text unique not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.users enable row level security;

-- Anyone can read user profiles (public profiles)
create policy "Public profiles are viewable by everyone"
  on public.users for select using (true);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

-- Sessions table (token consumption logs)
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text,
  model text,
  input_tokens int default 0,
  output_tokens int default 0,
  total_tokens int default 0,
  cost_usd numeric(10, 6) default 0,
  project text,
  duration_seconds int,
  num_turns int,
  tools_used jsonb default '{}',
  metadata jsonb default '{}',
  session_id text,
  session_at timestamptz default now(),
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.sessions enable row level security;

-- Anyone can read sessions (public profiles)
create policy "Sessions are viewable by everyone"
  on public.sessions for select using (true);

-- Only the API route inserts sessions (via service role key), no RLS insert policy needed for anon.
-- We'll use supabase service role in the ingest API route.

-- Index for heatmap queries (sessions by user and date)
create index idx_sessions_user_date on public.sessions (user_id, session_at);

-- Function to auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Step 2: Apply via Supabase Dashboard**

Go to Supabase Dashboard > SQL Editor > paste and run. Or if using Supabase CLI:

```bash
bunx supabase db push
```

**Step 3: Commit**

```bash
mkdir -p supabase/migrations
git add supabase/
git commit -m "add database schema migration for users and sessions"
```

---

### Task 4: Auth Middleware + Callback Route

**Files:**
- Create: `middleware.ts`
- Create: `app/auth/callback/route.ts`

**Step 1: Create middleware**

The middleware refreshes Supabase auth sessions on every request. It does NOT protect all routes — most routes are public (profiles). Only `/settings` needs protection.

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /settings — redirect to sign-in if not authenticated
  if (!user && request.nextUrl.pathname.startsWith("/settings")) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 2: Create auth callback route**

```typescript
// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/settings";

  if (!next.startsWith("/")) {
    next = "/";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
```

**Step 3: Commit**

```bash
git add middleware.ts app/auth/
git commit -m "add auth middleware and OAuth callback route"
```

---

### Task 5: Sign-In Page

**Files:**
- Create: `app/sign-in/page.tsx`

**Step 1: Create sign-in page**

```typescript
// app/sign-in/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const supabase = createClient();

  async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold">Sign in to MonMon</h1>
        <p className="text-gray-600">Track your LLM token usage</p>
        <button
          onClick={signInWithGitHub}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Sign in with GitHub
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Test manually**

Navigate to http://localhost:3000/sign-in — button should render. (OAuth won't work until Supabase is configured with GitHub app credentials.)

**Step 3: Commit**

```bash
git add app/sign-in/
git commit -m "add sign-in page with GitHub OAuth button"
```

---

### Task 6: Ingest API Route

**Files:**
- Create: `app/api/ingest/route.ts`

This is the endpoint the Claude Code hook will POST to. It validates the API key and stores session data.

**Step 1: Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local.example`**

Add to `.env.local.example`:
```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Step 2: Create the ingest route**

```typescript
// app/api/ingest/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Use service role to bypass RLS for inserts
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const supabase = createServiceClient();

  // Look up user by API key
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("api_key", apiKey)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("sessions").insert({
    user_id: user.id,
    provider: body.provider || null,
    model: body.model || null,
    input_tokens: body.input_tokens || 0,
    output_tokens: body.output_tokens || 0,
    total_tokens: body.total_tokens || 0,
    cost_usd: body.cost_usd || 0,
    project: body.project || null,
    duration_seconds: body.duration_seconds || null,
    num_turns: body.num_turns || null,
    tools_used: body.tools_used || {},
    metadata: body.metadata || {},
    session_id: body.session_id || null,
    session_at: body.session_at || new Date().toISOString(),
  });

  if (insertError) {
    console.error("Insert error:", insertError);
    return NextResponse.json({ error: "Failed to store session" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Commit**

```bash
git add app/api/ingest/ .env.local.example
git commit -m "add ingest API route for token data ingestion"
```

---

### Task 7: User API Routes (Profile + Key Regeneration)

**Files:**
- Create: `app/api/users/[username]/route.ts`
- Create: `app/api/users/[username]/sessions/route.ts`
- Create: `app/api/users/me/route.ts`
- Create: `app/api/users/me/regenerate-key/route.ts`

**Step 1: Public profile endpoint**

```typescript
// app/api/users/[username]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, username, display_name, bio, avatar_url, created_at")
    .eq("username", username)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Aggregate stats
  const { data: stats } = await supabase
    .from("sessions")
    .select("total_tokens, cost_usd, model")
    .eq("user_id", user.id);

  const totalTokens = stats?.reduce((sum, s) => sum + (s.total_tokens || 0), 0) ?? 0;
  const totalCost = stats?.reduce((sum, s) => sum + Number(s.cost_usd || 0), 0) ?? 0;
  const sessionCount = stats?.length ?? 0;

  // Find most used model
  const modelCounts: Record<string, number> = {};
  stats?.forEach((s) => {
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
  });
  const favoriteModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return NextResponse.json({
    ...user,
    stats: { totalTokens, totalCost, sessionCount, favoriteModel },
  });
}
```

**Step 2: Sessions list endpoint**

```typescript
// app/api/users/[username]/sessions/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: sessions, count } = await supabase
    .from("sessions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("session_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return NextResponse.json({
    sessions: sessions ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
```

**Step 3: Update own profile endpoint**

```typescript
// app/api/users/me/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const allowed = ["display_name", "bio"];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", authUser.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

**Step 4: Regenerate API key endpoint**

```typescript
// app/api/users/me/regenerate-key/route.ts
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role to update api_key (bypasses RLS for the crypto function)
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await serviceClient.rpc("regenerate_api_key", {
    user_id_input: authUser.id,
  });

  if (error) {
    // Fallback: generate key in JS and update
    const newKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error: updateError } = await serviceClient
      .from("users")
      .update({ api_key: newKey })
      .eq("id", authUser.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to regenerate key" }, { status: 500 });
    }

    return NextResponse.json({ api_key: newKey });
  }

  return NextResponse.json({ api_key: data });
}
```

**Step 5: Commit**

```bash
git add app/api/users/
git commit -m "add user API routes for profile, sessions, and key regeneration"
```

---

### Task 8: Heatmap Component

**Files:**
- Create: `components/heatmap.tsx`

A GitHub-style contribution heatmap showing daily token usage intensity.

**Step 1: Create the heatmap component**

```typescript
// components/heatmap.tsx
"use client";

import { useMemo } from "react";

interface HeatmapProps {
  data: Record<string, number>; // { "2026-01-15": 45000, ... } date -> total_tokens
  year: number;
}

const DAYS = ["Mon", "", "Wed", "", "Fri", "", ""];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getColor(value: number, max: number): string {
  if (value === 0) return "#ebedf0";
  const ratio = value / max;
  if (ratio < 0.25) return "#9be9a8";
  if (ratio < 0.5) return "#40c463";
  if (ratio < 0.75) return "#30a14e";
  return "#216e39";
}

export function Heatmap({ data, year }: HeatmapProps) {
  const { weeks, max, months } = useMemo(() => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // Adjust start to previous Sunday
    const start = new Date(startDate);
    start.setDate(start.getDate() - start.getDay());

    const weeksArr: { date: Date; value: number }[][] = [];
    let currentWeek: { date: Date; value: number }[] = [];
    let maxVal = 0;
    const monthPositions: { month: number; week: number }[] = [];

    const current = new Date(start);
    let weekIndex = 0;

    while (current <= endDate || currentWeek.length > 0) {
      const dateStr = current.toISOString().split("T")[0];
      const value = data[dateStr] || 0;
      if (value > maxVal) maxVal = value;

      // Track month positions
      if (current.getDate() === 1 && current >= startDate && current <= endDate) {
        monthPositions.push({ month: current.getMonth(), week: weekIndex });
      }

      currentWeek.push({ date: new Date(current), value });

      if (current.getDay() === 6) {
        weeksArr.push(currentWeek);
        currentWeek = [];
        weekIndex++;
      }

      current.setDate(current.getDate() + 1);
      if (current > endDate && current.getDay() === 0) break;
    }

    if (currentWeek.length > 0) {
      weeksArr.push(currentWeek);
    }

    return { weeks: weeksArr, max: maxVal || 1, months: monthPositions };
  }, [data, year]);

  const cellSize = 12;
  const gap = 2;
  const labelWidth = 30;
  const headerHeight = 20;

  return (
    <div className="overflow-x-auto">
      <svg
        width={labelWidth + weeks.length * (cellSize + gap)}
        height={headerHeight + 7 * (cellSize + gap) + 20}
      >
        {/* Month labels */}
        {months.map(({ month, week }) => (
          <text
            key={`month-${month}`}
            x={labelWidth + week * (cellSize + gap)}
            y={12}
            className="fill-gray-500"
            fontSize={10}
          >
            {MONTHS[month]}
          </text>
        ))}

        {/* Day labels */}
        {DAYS.map((day, i) => (
          <text
            key={`day-${i}`}
            x={0}
            y={headerHeight + i * (cellSize + gap) + cellSize - 2}
            className="fill-gray-500"
            fontSize={10}
          >
            {day}
          </text>
        ))}

        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => (
            <rect
              key={`${wi}-${di}`}
              x={labelWidth + wi * (cellSize + gap)}
              y={headerHeight + di * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={getColor(day.value, max)}
            >
              <title>
                {day.date.toISOString().split("T")[0]}: {day.value.toLocaleString()} tokens
              </title>
            </rect>
          ))
        )}

        {/* Legend */}
        <g transform={`translate(${labelWidth + (weeks.length - 8) * (cellSize + gap)}, ${headerHeight + 7 * (cellSize + gap) + 5})`}>
          <text x={0} y={10} className="fill-gray-500" fontSize={10}>Less</text>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <rect
              key={i}
              x={30 + i * (cellSize + gap)}
              y={0}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={getColor(ratio === 0 ? 0 : ratio * 100, 100)}
            />
          ))}
          <text x={30 + 5 * (cellSize + gap) + 4} y={10} className="fill-gray-500" fontSize={10}>More</text>
        </g>
      </svg>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/
git commit -m "add GitHub-style contribution heatmap component"
```

---

### Task 9: Public Profile Page

**Files:**
- Create: `app/[username]/page.tsx`

**Step 1: Create the profile page**

```typescript
// app/[username]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Heatmap } from "@/components/heatmap";

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ year?: string }>;
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { year: yearParam } = await searchParams;
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const supabase = await createClient();

  // Fetch user
  const { data: user } = await supabase
    .from("users")
    .select("id, username, display_name, bio, avatar_url, created_at")
    .eq("username", username)
    .single();

  if (!user) notFound();

  // Fetch sessions for the year
  const startOfYear = `${year}-01-01T00:00:00Z`;
  const endOfYear = `${year}-12-31T23:59:59Z`;

  const { data: sessions } = await supabase
    .from("sessions")
    .select("total_tokens, cost_usd, model, provider, session_at, project, input_tokens, output_tokens")
    .eq("user_id", user.id)
    .gte("session_at", startOfYear)
    .lte("session_at", endOfYear)
    .order("session_at", { ascending: false });

  // Build heatmap data
  const heatmapData: Record<string, number> = {};
  let totalTokens = 0;
  let totalCost = 0;
  const modelCounts: Record<string, number> = {};

  sessions?.forEach((s) => {
    const date = new Date(s.session_at).toISOString().split("T")[0];
    heatmapData[date] = (heatmapData[date] || 0) + (s.total_tokens || 0);
    totalTokens += s.total_tokens || 0;
    totalCost += Number(s.cost_usd || 0);
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
  });

  const favoriteModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const sessionCount = sessions?.length ?? 0;

  const currentYear = new Date().getFullYear();
  const memberSince = new Date(user.created_at).getFullYear();
  const years = Array.from({ length: currentYear - memberSince + 1 }, (_, i) => currentYear - i);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-72 flex-shrink-0">
          {user.avatar_url && (
            <img
              src={user.avatar_url}
              alt={user.display_name || user.username}
              className="w-full rounded-full border border-gray-200"
            />
          )}
          <h1 className="text-2xl font-bold mt-4">{user.display_name || user.username}</h1>
          <p className="text-gray-500 text-lg">{user.username}</p>
          {user.bio && <p className="mt-3 text-gray-700">{user.bio}</p>}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold">{sessionCount}</div>
              <div className="text-sm text-gray-500">Sessions</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold">{(totalTokens / 1_000_000).toFixed(1)}M</div>
              <div className="text-sm text-gray-500">Tokens</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
              <div className="text-sm text-gray-500">Estimated Cost</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold truncate text-sm">{favoriteModel}</div>
              <div className="text-sm text-gray-500">Top Model</div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-gray-700">
                {totalTokens.toLocaleString()} tokens in {year}
              </h2>
              <div className="flex gap-1">
                {years.map((y) => (
                  <a
                    key={y}
                    href={`/${username}?year=${y}`}
                    className={`px-2 py-1 text-xs rounded ${
                      y === year
                        ? "bg-blue-500 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {y}
                  </a>
                ))}
              </div>
            </div>
            <Heatmap data={heatmapData} year={year} />
          </div>

          {/* Recent sessions */}
          <h2 className="text-lg font-semibold mb-3">Recent Sessions</h2>
          <div className="space-y-2">
            {sessions?.slice(0, 20).map((s, i) => (
              <div key={i} className="flex items-center justify-between border rounded-lg px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{s.model || "unknown"}</span>
                  <span className="text-gray-400">{s.provider}</span>
                  {s.project && <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{s.project}</span>}
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                  <span>{(s.total_tokens || 0).toLocaleString()} tokens</span>
                  <span>${Number(s.cost_usd || 0).toFixed(4)}</span>
                  <span>{new Date(s.session_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {(!sessions || sessions.length === 0) && (
              <p className="text-gray-400 text-center py-8">No sessions recorded yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/\[username\]/
git commit -m "add public profile page with heatmap and stats"
```

---

### Task 10: Settings Page

**Files:**
- Create: `app/settings/page.tsx`

**Step 1: Create settings page**

```typescript
// app/settings/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface UserProfile {
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  api_key: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/users/me").then((r) => r.json()).then(setProfile);
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: profile.display_name,
        bio: profile.bio,
      }),
    });
    if (res.ok) {
      setMessage("Profile updated!");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleRegenerateKey() {
    if (!confirm("Regenerate API key? Your existing hooks will stop working.")) return;
    const res = await fetch("/api/users/me/regenerate-key", { method: "POST" });
    const data = await res.json();
    if (data.api_key && profile) {
      setProfile({ ...profile, api_key: data.api_key });
      setMessage("API key regenerated!");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  function copyHookCommand() {
    if (!profile) return;
    const command = `curl -s -X POST https://monmon.vercel.app/api/ingest -H "Authorization: Bearer ${profile.api_key}" -H "Content-Type: application/json" -d '{"provider":"anthropic","model":"claude","total_tokens":1000}'`;
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!profile) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {message && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg mb-4">
          {message}
        </div>
      )}

      {/* Profile */}
      <section className="border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={profile.display_name || ""}
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              value={profile.bio || ""}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </section>

      {/* API Key */}
      <section className="border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">API Key</h2>
        <p className="text-sm text-gray-600 mb-3">
          Use this key in your Claude Code hooks to push session data.
        </p>
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono truncate">
            {profile.api_key}
          </code>
          <button
            onClick={handleRegenerateKey}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 text-red-600"
          >
            Regenerate
          </button>
        </div>
      </section>

      {/* Hook Setup */}
      <section className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Hook Setup</h2>
        <p className="text-sm text-gray-600 mb-3">
          Add this to your Claude Code hooks to automatically track token usage.
        </p>
        <button
          onClick={copyHookCommand}
          className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
        >
          {copied ? "Copied!" : "Copy hook command"}
        </button>
      </section>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/settings/
git commit -m "add settings page with profile editing and API key management"
```

---

### Task 11: Landing Page + Navigation

**Files:**
- Modify: `app/page.tsx`
- Create: `components/nav.tsx`
- Modify: `app/layout.tsx`

**Step 1: Create navigation component**

```typescript
// components/nav.tsx
"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  return (
    <nav className="border-b">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          MonMon
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href={`/${user.user_metadata?.user_name || "me"}`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Profile
              </Link>
              <Link
                href="/settings"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Settings
              </Link>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Update layout to include nav**

Modify `app/layout.tsx` to add `<Nav />` inside the body, before `{children}`.

**Step 3: Create landing page**

Replace `app/page.tsx` with a simple hero page: title, description, and sign-in CTA.

**Step 4: Commit**

```bash
git add components/nav.tsx app/page.tsx app/layout.tsx
git commit -m "add navigation and landing page"
```

---

### Task 12: Claude Code Hook Script

**Files:**
- Create: `scripts/monmon-hook.sh`

This script parses the Claude Code Stop hook stdin JSON, reads the transcript JSONL to extract token data, and POSTs to the MonMon API.

**Step 1: Create the hook script**

```bash
#!/bin/bash
# MonMon Claude Code Stop Hook
# Add to ~/.claude/settings.json under hooks.Stop
#
# Reads session data from stdin (JSON with session_id, transcript_path, cwd)
# Parses transcript for token usage and sends to MonMon API

MONMON_API_KEY="${MONMON_API_KEY:-}"
MONMON_URL="${MONMON_URL:-https://monmon.vercel.app}"

if [ -z "$MONMON_API_KEY" ]; then
  exit 0
fi

# Read hook input from stdin
INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

# Parse transcript JSONL for token usage
# Each line is a JSON object; look for usage data
TOTAL_INPUT=0
TOTAL_OUTPUT=0
MODEL=""
NUM_TURNS=0
TOOLS_USED="{}"

while IFS= read -r line; do
  # Extract model
  m=$(echo "$line" | jq -r '.model // empty' 2>/dev/null)
  if [ -n "$m" ]; then
    MODEL="$m"
  fi

  # Extract usage tokens
  input=$(echo "$line" | jq -r '.usage.input_tokens // 0' 2>/dev/null)
  output=$(echo "$line" | jq -r '.usage.output_tokens // 0' 2>/dev/null)
  TOTAL_INPUT=$((TOTAL_INPUT + input))
  TOTAL_OUTPUT=$((TOTAL_OUTPUT + output))

  # Count assistant turns
  role=$(echo "$line" | jq -r '.role // empty' 2>/dev/null)
  if [ "$role" = "assistant" ]; then
    NUM_TURNS=$((NUM_TURNS + 1))
  fi
done < "$TRANSCRIPT_PATH"

TOTAL_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT))

# Skip if no tokens recorded
if [ "$TOTAL_TOKENS" -eq 0 ]; then
  exit 0
fi

# Send to MonMon
curl -s -X POST "$MONMON_URL/api/ingest" \
  -H "Authorization: Bearer $MONMON_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg provider "anthropic" \
    --arg model "$MODEL" \
    --argjson input_tokens "$TOTAL_INPUT" \
    --argjson output_tokens "$TOTAL_OUTPUT" \
    --argjson total_tokens "$TOTAL_TOKENS" \
    --arg project "$PROJECT" \
    --argjson num_turns "$NUM_TURNS" \
    --arg session_id "$SESSION_ID" \
    '{
      provider: $provider,
      model: $model,
      input_tokens: $input_tokens,
      output_tokens: $output_tokens,
      total_tokens: $total_tokens,
      project: $project,
      num_turns: $num_turns,
      session_id: $session_id
    }'
  )" > /dev/null 2>&1 &
```

**Step 2: Make executable**

```bash
chmod +x scripts/monmon-hook.sh
```

**Step 3: Commit**

```bash
git add scripts/
git commit -m "add Claude Code Stop hook script for token ingestion"
```

---

### Task 13: Vercel Deployment

**Step 1: Create Vercel project**

```bash
bunx vercel link
```

Follow prompts to create a new Vercel project named "monmon".

**Step 2: Set environment variables on Vercel**

```bash
bunx vercel env add NEXT_PUBLIC_SUPABASE_URL
bunx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
bunx vercel env add SUPABASE_SERVICE_ROLE_KEY
```

**Step 3: Deploy**

```bash
bunx vercel --prod
```

**Step 4: Update Supabase redirect URLs**

In Supabase Dashboard > Authentication > URL Configuration:
- Add `https://monmon.vercel.app/auth/callback` to redirect URLs
- Set site URL to `https://monmon.vercel.app`

**Step 5: Commit any vercel config**

```bash
git add -A
git commit -m "add Vercel deployment configuration"
```

---

### Task 14: End-to-End Smoke Test

**Step 1: Test sign-in flow**
- Navigate to deployed URL
- Click "Sign in with GitHub"
- Verify redirect to profile page
- Verify user profile shows in DB

**Step 2: Test ingest API**
```bash
curl -X POST https://monmon.vercel.app/api/ingest \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"anthropic","model":"claude-opus-4-6","input_tokens":5000,"output_tokens":2000,"total_tokens":7000,"project":"monmon"}'
```

Expected: `{"success":true}`

**Step 3: Verify heatmap**
- Refresh profile page
- Verify green square appears for today
- Verify stats update

**Step 4: Test settings page**
- Edit display name and bio
- Verify changes persist
- Test API key copy/regenerate
