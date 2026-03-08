/**
 * One-time migration: copy docs from "sessions" to "events" collection,
 * adding `event: "Stop"` field and renaming `sessionAt` to `timestamp`.
 * Also backfills existing "events" docs that are missing these changes.
 *
 * Run with: bun scripts/migrate-sessions-to-events.ts
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

const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!key) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(key)) });
const db = getFirestore();

async function migrate() {
  const eventsSnap = await db.collection("events").get();
  console.log(`Found ${eventsSnap.size} documents in "events"`);

  if (eventsSnap.empty) {
    console.log("Nothing to migrate.");
    return;
  }

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let count = 0;

  for (const doc of eventsSnap.docs) {
    const data = doc.data();
    const updates: Record<string, unknown> = {};

    // Add event type if missing
    if (!data.event) {
      updates.event = "Stop";
    }

    // Rename sessionAt → timestamp
    if (data.sessionAt && !data.timestamp) {
      updates.timestamp = data.sessionAt;
      updates.sessionAt = require("firebase-admin/firestore").FieldValue.delete();
    }

    // Remove sessionId
    if ("sessionId" in data) {
      updates.sessionId = require("firebase-admin/firestore").FieldValue.delete();
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      count++;
    }

    if (count > 0 && count % BATCH_SIZE === 0) {
      await batch.commit();
      console.log(`  Updated ${count} docs...`);
      batch = db.batch();
    }
  }

  if (count > 0 && count % BATCH_SIZE !== 0) {
    await batch.commit();
  }

  console.log(`Updated ${count} documents (added event field, renamed sessionAt → timestamp, removed sessionId)`);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
