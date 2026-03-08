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
