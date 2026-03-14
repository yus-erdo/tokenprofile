# Toqqen Implementation Plan (Firebase)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a website that monitors LLM token consumption per user, with GitHub OAuth via Firebase Auth, Firestore for data, public profiles with heatmaps, and data ingestion via Claude Code hooks.

**Architecture:** Next.js 15 App Router on Vercel. Firebase Auth handles GitHub OAuth sign-in. Firestore stores user profiles and session data. Claude Code Stop hook parses transcript JSONL and POSTs token metadata to a Next.js API route (secured by per-user API key), which writes to Firestore via Firebase Admin SDK.

**Tech Stack:** Next.js 15, TypeScript, Firebase Auth, Cloud Firestore, Firebase Admin SDK, Tailwind CSS, bun, Vercel

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.local.example`, `.gitignore`
- Create: `app/layout.tsx`, `app/page.tsx`

**Step 1: Create Next.js project with bun**

```bash
cd /Users/yusuf.erdogan/work/toqqen
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-bun
```

Accept defaults. This creates the full scaffolding.

**Step 2: Install Firebase dependencies**

```bash
bun add firebase firebase-admin
```

**Step 3: Create `.env.local.example`**

```env
# Firebase Client SDK (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server only)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

**Step 4: Verify dev server starts**

```bash
bun run dev
```

Expected: App runs on http://localhost:3000

**Step 5: Commit**

```bash
git add -A
git commit -m "scaffold Next.js 15 project with Firebase deps"
```

---

### Task 2: Firebase Client & Admin SDK Setup

**Files:**
- Create: `lib/firebase/client.ts`
- Create: `lib/firebase/admin.ts`
- Create: `lib/firebase/auth-context.tsx`

**Step 1: Create client-side Firebase init**

```typescript
// lib/firebase/client.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
```

**Step 2: Create server-side Firebase Admin init**

```typescript
// lib/firebase/admin.ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
```

**Step 3: Create auth context provider**

```typescript
// lib/firebase/auth-context.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

**Step 4: Commit**

```bash
git add lib/firebase/
git commit -m "add Firebase client, admin, and auth context setup"
```

---

### Task 3: Firebase Project Configuration

This is a manual step done in the Firebase Console + GitHub.

**Step 1: Create Firebase project**

- Go to https://console.firebase.google.com
- Create new project "toqqen"
- Enable Firestore (start in test mode, we'll add rules later)
- Enable Authentication > Sign-in method > GitHub

**Step 2: Configure GitHub OAuth App**

- Go to https://github.com/settings/developers
- Create new OAuth App:
  - Name: Toqqen
  - Homepage URL: `http://localhost:3000` (update to prod URL later)
  - Authorization callback URL: copy from Firebase Console (looks like `https://toqqen-XXXXX.firebaseapp.com/__/auth/handler`)
- Copy Client ID and Client Secret into Firebase Console GitHub provider settings

**Step 3: Get Firebase config**

- In Firebase Console > Project Settings > General > Your apps > Web app
- Copy the config object values into `.env.local`

**Step 4: Get service account key**

- Firebase Console > Project Settings > Service Accounts > Generate new private key
- Stringify the JSON and put it in `.env.local` as `FIREBASE_SERVICE_ACCOUNT_KEY`

**Step 5: Deploy Firestore security rules**

Create `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow update: if request.auth != null && request.auth.uid == userId;
    }
    match /sessions/{sessionId} {
      allow read: if true;
    }
  }
}
```

Deploy via Firebase CLI or paste into Firebase Console > Firestore > Rules.

**Step 6: Commit rules**

```bash
git add firestore.rules
git commit -m "add Firestore security rules"
```

---

### Task 4: Sign-In Page + Auth Flow

**Files:**
- Create: `app/sign-in/page.tsx`

**Step 1: Create sign-in page**

```typescript
// app/sign-in/page.tsx
"use client";

import { GithubAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { useEffect } from "react";

export default function SignInPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push("/settings");
    }
  }, [user, loading, router]);

  async function signInWithGitHub() {
    const provider = new GithubAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Check if user doc exists, create if not
      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Get GitHub username from provider data
        const githubUsername =
          firebaseUser.providerData[0]?.displayName ||
          firebaseUser.displayName ||
          firebaseUser.email?.split("@")[0] ||
          firebaseUser.uid;

        await setDoc(userRef, {
          username: githubUsername.toLowerCase().replace(/\s+/g, "-"),
          displayName: firebaseUser.displayName || "",
          bio: "",
          avatarUrl: firebaseUser.photoURL || "",
          apiKey: crypto.randomUUID() + crypto.randomUUID().replace(/-/g, ""),
          createdAt: new Date(),
        });
      }

      router.push("/settings");
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold">Sign in to Toqqen</h1>
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

**Step 2: Update `app/layout.tsx` to include AuthProvider**

Wrap `{children}` with `<AuthProvider>` in the root layout.

**Step 3: Test manually**

Navigate to http://localhost:3000/sign-in — button should render.

**Step 4: Commit**

```bash
git add app/sign-in/ app/layout.tsx
git commit -m "add sign-in page with GitHub OAuth via Firebase"
```

---

### Task 5: Ingest API Route

**Files:**
- Create: `app/api/ingest/route.ts`

**Step 1: Create the ingest route**

```typescript
// app/api/ingest/route.ts
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);

  // Look up user by API key
  const usersSnapshot = await adminDb
    .collection("users")
    .where("apiKey", "==", apiKey)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const userDoc = usersSnapshot.docs[0];

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await adminDb.collection("sessions").add({
    userId: userDoc.id,
    provider: body.provider || null,
    model: body.model || null,
    inputTokens: body.input_tokens || 0,
    outputTokens: body.output_tokens || 0,
    totalTokens: body.total_tokens || 0,
    costUsd: body.cost_usd || 0,
    project: body.project || null,
    durationSeconds: body.duration_seconds || null,
    numTurns: body.num_turns || null,
    toolsUsed: body.tools_used || {},
    metadata: body.metadata || {},
    sessionId: body.session_id || null,
    sessionAt: body.session_at ? new Date(body.session_at as string) : new Date(),
    createdAt: new Date(),
  });

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add app/api/ingest/
git commit -m "add ingest API route for token data ingestion via Firebase Admin"
```

---

### Task 6: User API Routes

**Files:**
- Create: `app/api/users/[username]/route.ts`
- Create: `app/api/users/[username]/sessions/route.ts`
- Create: `app/api/users/me/route.ts`
- Create: `app/api/users/me/regenerate-key/route.ts`

**Step 1: Helper to verify Firebase ID token from cookie/header**

```typescript
// lib/firebase/verify-auth.ts
import { adminAuth } from "./admin";

export async function verifyAuth(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
```

**Step 2: Public profile endpoint**

```typescript
// app/api/users/[username]/route.ts
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const usersSnapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();

  // Aggregate stats from sessions
  const sessionsSnapshot = await adminDb
    .collection("sessions")
    .where("userId", "==", userDoc.id)
    .get();

  let totalTokens = 0;
  let totalCost = 0;
  const modelCounts: Record<string, number> = {};

  sessionsSnapshot.docs.forEach((doc) => {
    const s = doc.data();
    totalTokens += s.totalTokens || 0;
    totalCost += Number(s.costUsd || 0);
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
  });

  const favoriteModel =
    Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return NextResponse.json({
    username: userData.username,
    displayName: userData.displayName,
    bio: userData.bio,
    avatarUrl: userData.avatarUrl,
    createdAt: userData.createdAt?.toDate?.() || userData.createdAt,
    stats: {
      totalTokens,
      totalCost,
      sessionCount: sessionsSnapshot.size,
      favoriteModel,
    },
  });
}
```

**Step 3: Sessions list endpoint**

```typescript
// app/api/users/[username]/sessions/route.ts
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const limit = 20;

  const usersSnapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = usersSnapshot.docs[0].id;

  let query = adminDb
    .collection("sessions")
    .where("userId", "==", userId)
    .orderBy("sessionAt", "desc")
    .limit(limit);

  // Cursor-based pagination
  const after = searchParams.get("after");
  if (after) {
    const afterDoc = await adminDb.collection("sessions").doc(after).get();
    if (afterDoc.exists) {
      query = query.startAfter(afterDoc);
    }
  }

  const sessionsSnapshot = await query.get();

  const sessions = sessionsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    sessionAt: doc.data().sessionAt?.toDate?.() || doc.data().sessionAt,
    createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
  }));

  return NextResponse.json({ sessions });
}
```

**Step 4: Update own profile endpoint**

```typescript
// app/api/users/me/route.ts
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/firebase/verify-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const uid = await verifyAuth(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data = userDoc.data()!;
  return NextResponse.json({
    ...data,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
  });
}

export async function PATCH(request: Request) {
  const uid = await verifyAuth(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = ["displayName", "bio"];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  await adminDb.collection("users").doc(uid).update(updates);

  const updated = await adminDb.collection("users").doc(uid).get();
  return NextResponse.json(updated.data());
}
```

**Step 5: Regenerate API key endpoint**

```typescript
// app/api/users/me/regenerate-key/route.ts
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/firebase/verify-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const uid = await verifyAuth(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const newKey = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  await adminDb.collection("users").doc(uid).update({ apiKey: newKey });

  return NextResponse.json({ apiKey: newKey });
}
```

**Step 6: Commit**

```bash
git add lib/firebase/verify-auth.ts app/api/users/
git commit -m "add user API routes with Firebase Admin SDK"
```

---

### Task 7: Heatmap Component

**Files:**
- Create: `components/heatmap.tsx`

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

    if (currentWeek.length > 0) weeksArr.push(currentWeek);

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
        {months.map(({ month, week }) => (
          <text key={`month-${month}`} x={labelWidth + week * (cellSize + gap)} y={12} className="fill-gray-500" fontSize={10}>
            {MONTHS[month]}
          </text>
        ))}
        {DAYS.map((day, i) => (
          <text key={`day-${i}`} x={0} y={headerHeight + i * (cellSize + gap) + cellSize - 2} className="fill-gray-500" fontSize={10}>
            {day}
          </text>
        ))}
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
              <title>{day.date.toISOString().split("T")[0]}: {day.value.toLocaleString()} tokens</title>
            </rect>
          ))
        )}
        <g transform={`translate(${labelWidth + (weeks.length - 8) * (cellSize + gap)}, ${headerHeight + 7 * (cellSize + gap) + 5})`}>
          <text x={0} y={10} className="fill-gray-500" fontSize={10}>Less</text>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <rect key={i} x={30 + i * (cellSize + gap)} y={0} width={cellSize} height={cellSize} rx={2} fill={getColor(ratio === 0 ? 0 : ratio * 100, 100)} />
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

### Task 8: Public Profile Page

**Files:**
- Create: `app/[username]/page.tsx`

**Step 1: Create the profile page**

This is a server component that fetches data via Firebase Admin SDK.

```typescript
// app/[username]/page.tsx
import { adminDb } from "@/lib/firebase/admin";
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

  // Fetch user by username
  const usersSnapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (usersSnapshot.empty) notFound();

  const userDoc = usersSnapshot.docs[0];
  const user = userDoc.data();

  // Fetch sessions for the year
  const startOfYear = new Date(`${year}-01-01T00:00:00Z`);
  const endOfYear = new Date(`${year}-12-31T23:59:59Z`);

  const sessionsSnapshot = await adminDb
    .collection("sessions")
    .where("userId", "==", userDoc.id)
    .where("sessionAt", ">=", startOfYear)
    .where("sessionAt", "<=", endOfYear)
    .orderBy("sessionAt", "desc")
    .get();

  // Build heatmap data and stats
  const heatmapData: Record<string, number> = {};
  let totalTokens = 0;
  let totalCost = 0;
  const modelCounts: Record<string, number> = {};

  const sessions = sessionsSnapshot.docs.map((doc) => {
    const s = doc.data();
    const date = s.sessionAt?.toDate?.().toISOString().split("T")[0] || "";
    heatmapData[date] = (heatmapData[date] || 0) + (s.totalTokens || 0);
    totalTokens += s.totalTokens || 0;
    totalCost += Number(s.costUsd || 0);
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
    return {
      model: s.model,
      provider: s.provider,
      totalTokens: s.totalTokens,
      costUsd: s.costUsd,
      project: s.project,
      sessionAt: s.sessionAt?.toDate?.().toISOString() || "",
    };
  });

  const favoriteModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const sessionCount = sessions.length;

  const currentYear = new Date().getFullYear();
  const memberSince = user.createdAt?.toDate?.()?.getFullYear() || currentYear;
  const years = Array.from({ length: currentYear - memberSince + 1 }, (_, i) => currentYear - i);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-72 flex-shrink-0">
          {user.avatarUrl && (
            <img src={user.avatarUrl} alt={user.displayName || user.username} className="w-full rounded-full border border-gray-200" />
          )}
          <h1 className="text-2xl font-bold mt-4">{user.displayName || user.username}</h1>
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
                  <a key={y} href={`/${username}?year=${y}`} className={`px-2 py-1 text-xs rounded ${y === year ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
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
            {sessions.slice(0, 20).map((s, i) => (
              <div key={i} className="flex items-center justify-between border rounded-lg px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{s.model || "unknown"}</span>
                  <span className="text-gray-400">{s.provider}</span>
                  {s.project && <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{s.project}</span>}
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                  <span>{(s.totalTokens || 0).toLocaleString()} tokens</span>
                  <span>${Number(s.costUsd || 0).toFixed(4)}</span>
                  <span>{new Date(s.sessionAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
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

### Task 9: Settings Page

**Files:**
- Create: `app/settings/page.tsx`

**Step 1: Create settings page**

```typescript
// app/settings/page.tsx
"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  apiKey: string;
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in");
      return;
    }
    if (user) {
      user.getIdToken().then((token) => {
        fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then(setProfile);
      });
    }
  }, [user, loading, router]);

  async function handleSave() {
    if (!profile || !user) return;
    setSaving(true);
    const token = await user.getIdToken();
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        displayName: profile.displayName,
        bio: profile.bio,
      }),
    });
    if (res.ok) setMessage("Profile updated!");
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleRegenerateKey() {
    if (!user || !confirm("Regenerate API key? Your existing hooks will stop working.")) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/users/me/regenerate-key", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.apiKey && profile) {
      setProfile({ ...profile, apiKey: data.apiKey });
      setMessage("API key regenerated!");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  function copyApiKey() {
    if (!profile) return;
    navigator.clipboard.writeText(profile.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !profile) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {message && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg mb-4">{message}</div>
      )}

      <section className="border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={profile.displayName || ""}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
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
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </section>

      <section className="border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">API Key</h2>
        <p className="text-sm text-gray-600 mb-3">Use this key in your Claude Code hooks to push session data.</p>
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono truncate">{profile.apiKey}</code>
          <button onClick={copyApiKey} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
            {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={handleRegenerateKey} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 text-red-600">
            Regenerate
          </button>
        </div>
      </section>

      <section className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Hook Setup</h2>
        <p className="text-sm text-gray-600 mb-3">
          Add a Stop hook to your Claude Code settings to automatically track token usage.
          See the README for the full hook script.
        </p>
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

### Task 10: Landing Page + Navigation

**Files:**
- Modify: `app/page.tsx`
- Create: `components/nav.tsx`
- Modify: `app/layout.tsx`

**Step 1: Create navigation component**

```typescript
// components/nav.tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useEffect, useState } from "react";

export function Nav() {
  const { user } = useAuth();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        if (snap.exists()) setUsername(snap.data().username);
      });
    }
  }, [user]);

  return (
    <nav className="border-b">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">Toqqen</Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {username && (
                <Link href={`/${username}`} className="text-sm text-gray-600 hover:text-gray-900">Profile</Link>
              )}
              <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</Link>
            </>
          ) : (
            <Link href="/sign-in" className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800">Sign in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Update layout to include Nav**

Add `<Nav />` inside the body in `app/layout.tsx`, before `{children}`.

**Step 3: Create landing page**

Replace `app/page.tsx` with a simple hero: title "Toqqen", subtitle "Track your LLM token usage", and sign-in CTA.

**Step 4: Commit**

```bash
git add components/nav.tsx app/page.tsx app/layout.tsx
git commit -m "add navigation and landing page"
```

---

### Task 11: Claude Code Hook Script

**Files:**
- Create: `scripts/toqqen-hook.sh`

**Step 1: Create the hook script**

```bash
#!/bin/bash
# Toqqen Claude Code Stop Hook
# Usage: Add to ~/.claude/settings.json under hooks.Stop
#
# Reads session data from stdin JSON (session_id, transcript_path, cwd)
# Parses transcript for token usage and sends to Toqqen API

TOQQEN_API_KEY="${TOQQEN_API_KEY:-}"
TOQQEN_URL="${TOQQEN_URL:-https://www.toqqen.app}"

if [ -z "$TOQQEN_API_KEY" ]; then
  exit 0
fi

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

TOTAL_INPUT=0
TOTAL_OUTPUT=0
MODEL=""
NUM_TURNS=0

while IFS= read -r line; do
  m=$(echo "$line" | jq -r '.model // empty' 2>/dev/null)
  if [ -n "$m" ]; then MODEL="$m"; fi

  input=$(echo "$line" | jq -r '.usage.input_tokens // 0' 2>/dev/null)
  output=$(echo "$line" | jq -r '.usage.output_tokens // 0' 2>/dev/null)
  TOTAL_INPUT=$((TOTAL_INPUT + input))
  TOTAL_OUTPUT=$((TOTAL_OUTPUT + output))

  role=$(echo "$line" | jq -r '.role // empty' 2>/dev/null)
  if [ "$role" = "assistant" ]; then NUM_TURNS=$((NUM_TURNS + 1)); fi
done < "$TRANSCRIPT_PATH"

TOTAL_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT))

if [ "$TOTAL_TOKENS" -eq 0 ]; then exit 0; fi

curl -s -X POST "$TOQQEN_URL/api/ingest" \
  -H "Authorization: Bearer $TOQQEN_API_KEY" \
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
    '{provider:$provider,model:$model,input_tokens:$input_tokens,output_tokens:$output_tokens,total_tokens:$total_tokens,project:$project,num_turns:$num_turns,session_id:$session_id}'
  )" > /dev/null 2>&1 &
```

**Step 2: Make executable and commit**

```bash
chmod +x scripts/toqqen-hook.sh
git add scripts/
git commit -m "add Claude Code Stop hook script for token ingestion"
```

---

### Task 12: Vercel Deployment

**Step 1: Create Vercel project**

```bash
bunx vercel link
```

**Step 2: Set environment variables on Vercel**

```bash
bunx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
bunx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
bunx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID
bunx vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
bunx vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
bunx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID
bunx vercel env add FIREBASE_SERVICE_ACCOUNT_KEY
```

**Step 3: Deploy**

```bash
bunx vercel --prod
```

**Step 4: Update GitHub OAuth callback URL**

In GitHub OAuth App settings, update the callback URL to use the production Firebase auth domain.

**Step 5: Create Firestore composite index**

The profile page query (`userId` + `sessionAt` range + orderBy) needs a composite index. Firestore will show an error link in the console — click it to create the index automatically.

**Step 6: Commit**

```bash
git add -A
git commit -m "add Vercel deployment configuration"
```

---

### Task 13: End-to-End Smoke Test

**Step 1: Test sign-in flow**
- Navigate to deployed URL
- Click "Sign in with GitHub"
- Verify popup completes and redirects to settings
- Verify user doc exists in Firestore

**Step 2: Test ingest API**
```bash
curl -X POST https://www.toqqen.app/api/ingest \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"anthropic","model":"claude-opus-4-6","input_tokens":5000,"output_tokens":2000,"total_tokens":7000,"project":"toqqen"}'
```

Expected: `{"success":true}`

**Step 3: Verify profile page**
- Navigate to `/{username}`
- Verify heatmap shows green square for today
- Verify stats update

**Step 4: Test settings page**
- Edit display name and bio, save
- Copy API key
- Test regenerate
