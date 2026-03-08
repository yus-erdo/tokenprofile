/**
 * Backfill costUsd for existing events using model costs config.
 * Events without cacheCreationTokens/cacheReadTokens are priced at base input rate.
 *
 * Run with: bun scripts/backfill-event-costs.ts
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

async function backfill() {
  // Load model costs config
  const configDoc = await db.doc("config/modelCosts").get();
  if (!configDoc.exists) {
    console.error("config/modelCosts document not found. Run seed-model-costs.ts first.");
    process.exit(1);
  }
  const config = configDoc.data()!;
  const models = config.models as Record<string, { costs: Array<{ inputPerMillion: number; outputPerMillion: number; cacheWritePerMillion: number; cacheReadPerMillion: number }> }>;

  // Read all events
  const snapshot = await db.collection("events").get();
  console.log(`Found ${snapshot.size} events`);

  let updated = 0;
  let skipped = 0;
  const batch = db.batch();
  const BATCH_LIMIT = 500;
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const model = data.model as string | null;

    if (!model || !models[model]) {
      skipped++;
      continue;
    }

    const cost = models[model].costs[0];
    if (!cost) {
      skipped++;
      continue;
    }

    const inputTokens = Number(data.inputTokens || 0);
    const outputTokens = Number(data.outputTokens || 0);
    const cacheCreationTokens = Number(data.cacheCreationTokens || 0);
    const cacheReadTokens = Number(data.cacheReadTokens || 0);

    const baseInputTokens = Math.max(0, inputTokens - cacheCreationTokens - cacheReadTokens);
    const costUsd =
      (baseInputTokens * cost.inputPerMillion) / 1_000_000 +
      (cacheCreationTokens * cost.cacheWritePerMillion) / 1_000_000 +
      (cacheReadTokens * cost.cacheReadPerMillion) / 1_000_000 +
      (outputTokens * cost.outputPerMillion) / 1_000_000;

    batch.update(doc.ref, { costUsd });
    updated++;
    batchCount++;

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      console.log(`Committed batch of ${batchCount}`);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Updated ${updated} events, skipped ${skipped} (unknown model)`);
}

backfill().catch(console.error);
