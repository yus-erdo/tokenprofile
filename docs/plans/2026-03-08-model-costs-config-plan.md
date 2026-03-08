# Model Costs Config Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Server-side token cost calculation using model pricing stored in Firestore, with cache token support.

**Architecture:** A `config/modelCosts` Firestore document holds per-model pricing with timestamps. The ingest endpoint reads this config (cached in-memory with 5-min TTL), calculates `costUsd` from token counts, and stores it on the event. The hook script sends cache tokens separately instead of summing them.

**Tech Stack:** Next.js API routes, Firebase Admin SDK, Firestore, bash (hook script)

---

### Task 1: Create model costs config helper

**Files:**
- Create: `lib/firebase/model-costs.ts`

**Step 1: Create the config helper with types and cached reader**

```typescript
import { adminDb } from "@/lib/firebase/admin";

interface ModelCostEntry {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheReadPerMillion: number;
  effectiveFrom: Date;
}

interface ModelConfig {
  displayName: string;
  provider: string;
  costs: ModelCostEntry[];
}

interface ModelCostsConfig {
  models: Record<string, ModelConfig>;
}

let cachedConfig: ModelCostsConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getModelCosts(): Promise<ModelCostsConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const doc = await adminDb.doc("config/modelCosts").get();
  if (!doc.exists) {
    cachedConfig = { models: {} };
    cacheTimestamp = now;
    return cachedConfig;
  }

  const data = doc.data() as ModelCostsConfig;

  // Convert Firestore Timestamps to Dates in costs arrays
  for (const model of Object.values(data.models)) {
    model.costs = model.costs.map((c) => ({
      ...c,
      effectiveFrom: c.effectiveFrom instanceof Date
        ? c.effectiveFrom
        : (c.effectiveFrom as unknown as { toDate: () => Date }).toDate(),
    }));
  }

  cachedConfig = data;
  cacheTimestamp = now;
  return cachedConfig;
}

export function calculateCost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  config: ModelCostsConfig;
}): number | null {
  const { model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, config } = params;

  const modelConfig = config.models[model];
  if (!modelConfig || modelConfig.costs.length === 0) {
    return null; // Model not found
  }

  // Get latest cost entry (first in array, sorted by effectiveFrom desc)
  const cost = modelConfig.costs[0];

  const baseInputTokens = inputTokens - cacheCreationTokens - cacheReadTokens;
  const inputCost = Math.max(0, baseInputTokens) * cost.inputPerMillion / 1_000_000;
  const cacheWriteCost = cacheCreationTokens * cost.cacheWritePerMillion / 1_000_000;
  const cacheReadCost = cacheReadTokens * cost.cacheReadPerMillion / 1_000_000;
  const outputCost = outputTokens * cost.outputPerMillion / 1_000_000;

  return inputCost + cacheWriteCost + cacheReadCost + outputCost;
}
```

**Step 2: Verify it compiles**

Run: `bunx tsc --noEmit lib/firebase/model-costs.ts`
If that fails due to path aliases, run: `bun run build` and check for type errors in model-costs.ts.

**Step 3: Commit**

```bash
git add lib/firebase/model-costs.ts
git commit -m "Add model costs config helper with in-memory caching"
```

---

### Task 2: Update ingest endpoint to calculate cost server-side

**Files:**
- Modify: `app/api/ingest/route.ts`

**Step 1: Update the ingest endpoint**

Replace the full content of `app/api/ingest/route.ts` with:

```typescript
import { adminDb } from "@/lib/firebase/admin";
import { getModelCosts, calculateCost } from "@/lib/firebase/model-costs";
import { rateLimiter } from "@/lib/rate-limit";
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

  const { success } = await rateLimiter.limit(userDoc.id);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = (body.model as string) || null;
  const inputTokens = Number(body.input_tokens) || 0;
  const outputTokens = Number(body.output_tokens) || 0;
  const cacheCreationTokens = Number(body.cache_creation_tokens) || 0;
  const cacheReadTokens = Number(body.cache_read_tokens) || 0;
  const totalTokens = Number(body.total_tokens) || 0;

  // Calculate cost server-side
  let costUsd = 0;
  if (model) {
    const config = await getModelCosts();
    const calculated = calculateCost({
      model,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      config,
    });
    costUsd = calculated ?? (Number(body.cost_usd) || 0);
  } else {
    costUsd = Number(body.cost_usd) || 0;
  }

  await adminDb.collection("events").add({
    userId: userDoc.id,
    event: body.event || "Stop",
    provider: body.provider || null,
    model,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens,
    costUsd,
    project: body.project || null,
    durationSeconds: body.duration_seconds || null,
    numTurns: body.num_turns || null,
    toolsUsed: body.tools_used || {},
    metadata: body.metadata || {},
    timestamp: body.timestamp ? new Date(body.timestamp as string) : new Date(),
    createdAt: new Date(),
  });

  return NextResponse.json({ success: true });
}
```

**Step 2: Verify it compiles**

Run: `bun run build`
Expected: No errors related to ingest route.

**Step 3: Commit**

```bash
git add app/api/ingest/route.ts
git commit -m "Calculate token cost server-side using model costs config"
```

---

### Task 3: Update hook script to send cache tokens separately

**Files:**
- Modify: `scripts/tokenprofile-hook.sh`

**Step 1: Update the hook script**

Changes needed:
1. `input_tokens` should be base input only (from `STATS`, not `TOTAL_INPUT`)
2. Add `cache_creation_tokens` and `cache_read_tokens` as separate payload fields
3. `total_tokens` remains the sum of all tokens (unchanged behavior)

In the payload section (around line 69), replace the PAYLOAD construction:

```bash
INPUT_TOKENS=$(echo "$STATS" | jq '.input_tokens')
CACHE_CREATION=$(echo "$STATS" | jq '.cache_creation')
CACHE_READ=$(echo "$STATS" | jq '.cache_read')
TOTAL_INPUT=$((INPUT_TOKENS + CACHE_CREATION + CACHE_READ))
TOTAL_OUTPUT=$(echo "$STATS" | jq '.output_tokens')
TOTAL_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT))
[ "$TOTAL_TOKENS" -eq 0 ] && exit 0

MODEL=$(echo "$STATS" | jq -r '.model')
NUM_TURNS=$(echo "$STATS" | jq '.num_turns')

PAYLOAD=$(jq -n \
  --arg event "Stop" \
  --arg provider "anthropic" \
  --arg model "$MODEL" \
  --argjson input_tokens "$TOTAL_INPUT" \
  --argjson output_tokens "$TOTAL_OUTPUT" \
  --argjson total_tokens "$TOTAL_TOKENS" \
  --argjson cache_creation_tokens "$CACHE_CREATION" \
  --argjson cache_read_tokens "$CACHE_READ" \
  --arg project "$PROJECT" \
  --argjson num_turns "$NUM_TURNS" \
  '{event:$event,provider:$provider,model:$model,input_tokens:$input_tokens,output_tokens:$output_tokens,total_tokens:$total_tokens,cache_creation_tokens:$cache_creation_tokens,cache_read_tokens:$cache_read_tokens,project:$project,num_turns:$num_turns}')
```

Note: `input_tokens` sent to the server is still the total input (including cache) for backward compatibility with `totalTokens` calculation. The server uses `cache_creation_tokens` and `cache_read_tokens` to split pricing correctly.

**Step 2: Commit**

```bash
git add scripts/tokenprofile-hook.sh
git commit -m "Send cache tokens as separate fields in hook payload"
```

---

### Task 4: Create seed script for initial model costs

**Files:**
- Create: `scripts/seed-model-costs.ts`

**Step 1: Create the seed script**

```typescript
/**
 * Seed the config/modelCosts Firestore document with current Anthropic pricing.
 *
 * Run with: bun scripts/seed-model-costs.ts
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";

// Parse .env.local manually to avoid dotenv dependency
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const effectiveFrom = Timestamp.fromDate(new Date("2025-06-01"));

const models: Record<string, {
  displayName: string;
  provider: string;
  costs: Array<{
    inputPerMillion: number;
    outputPerMillion: number;
    cacheWritePerMillion: number;
    cacheReadPerMillion: number;
    effectiveFrom: Timestamp;
  }>;
}> = {
  "claude-opus-4-6": {
    displayName: "Claude Opus 4.6",
    provider: "anthropic",
    costs: [{ inputPerMillion: 5, outputPerMillion: 25, cacheWritePerMillion: 6.25, cacheReadPerMillion: 0.50, effectiveFrom }],
  },
  "claude-opus-4-5": {
    displayName: "Claude Opus 4.5",
    provider: "anthropic",
    costs: [{ inputPerMillion: 5, outputPerMillion: 25, cacheWritePerMillion: 6.25, cacheReadPerMillion: 0.50, effectiveFrom }],
  },
  "claude-sonnet-4-6": {
    displayName: "Claude Sonnet 4.6",
    provider: "anthropic",
    costs: [{ inputPerMillion: 3, outputPerMillion: 15, cacheWritePerMillion: 3.75, cacheReadPerMillion: 0.30, effectiveFrom }],
  },
  "claude-sonnet-4-5": {
    displayName: "Claude Sonnet 4.5",
    provider: "anthropic",
    costs: [{ inputPerMillion: 3, outputPerMillion: 15, cacheWritePerMillion: 3.75, cacheReadPerMillion: 0.30, effectiveFrom }],
  },
  "claude-sonnet-4": {
    displayName: "Claude Sonnet 4",
    provider: "anthropic",
    costs: [{ inputPerMillion: 3, outputPerMillion: 15, cacheWritePerMillion: 3.75, cacheReadPerMillion: 0.30, effectiveFrom }],
  },
  "claude-haiku-4-5": {
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    costs: [{ inputPerMillion: 1, outputPerMillion: 5, cacheWritePerMillion: 1.25, cacheReadPerMillion: 0.10, effectiveFrom }],
  },
  "claude-haiku-3-5": {
    displayName: "Claude Haiku 3.5",
    provider: "anthropic",
    costs: [{ inputPerMillion: 0.80, outputPerMillion: 4, cacheWritePerMillion: 1.00, cacheReadPerMillion: 0.08, effectiveFrom }],
  },
};

async function seed() {
  await db.doc("config/modelCosts").set({ models });
  console.log(`Seeded config/modelCosts with ${Object.keys(models).length} models`);
}

seed().catch(console.error);
```

**Step 2: Run the seed script**

Run: `bun scripts/seed-model-costs.ts`
Expected: `Seeded config/modelCosts with 7 models`

**Step 3: Commit**

```bash
git add scripts/seed-model-costs.ts
git commit -m "Add seed script for model costs config"
```

---

### Task 5: Update Firestore rules for config collection

**Files:**
- Modify: `firestore.rules`

**Step 1: Add config collection rules**

Add a rule for the `config` collection — public read (needed for potential future admin page), write only via Admin SDK (no client writes).

```
match /config/{docId} {
  allow read: if true;
}
```

**Step 2: Deploy rules**

Run: `firebase deploy --only firestore:rules`

**Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Add Firestore rules for config collection"
```

---

### Task 6: Verify end-to-end

**Step 1: Run the dev server**

Run: `bun run dev`

**Step 2: Test ingest with cache tokens**

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer <test-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Stop",
    "provider": "anthropic",
    "model": "claude-sonnet-4-6",
    "input_tokens": 10000,
    "output_tokens": 2000,
    "total_tokens": 12000,
    "cache_creation_tokens": 3000,
    "cache_read_tokens": 5000,
    "project": "test",
    "num_turns": 5
  }'
```

Expected: `{"success":true}`

**Step 3: Verify cost in Firestore**

Check the created event in Firestore console. Expected cost:
- Base input: (10000 - 3000 - 5000) * 3 / 1_000_000 = $0.006
- Cache write: 3000 * 3.75 / 1_000_000 = $0.01125
- Cache read: 5000 * 0.30 / 1_000_000 = $0.0015
- Output: 2000 * 15 / 1_000_000 = $0.03
- Total: $0.04875

**Step 4: Test without cache tokens (backward compat)**

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer <test-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Stop",
    "provider": "anthropic",
    "model": "claude-sonnet-4-6",
    "input_tokens": 10000,
    "output_tokens": 2000,
    "total_tokens": 12000,
    "project": "test",
    "num_turns": 5
  }'
```

Expected cost: (10000 * 3 + 2000 * 15) / 1_000_000 = $0.06

**Step 5: Test with unknown model (fallback)**

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer <test-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Stop",
    "provider": "openai",
    "model": "gpt-4o",
    "input_tokens": 10000,
    "output_tokens": 2000,
    "total_tokens": 12000,
    "cost_usd": 0.05,
    "project": "test",
    "num_turns": 5
  }'
```

Expected: costUsd = 0.05 (client fallback used)
