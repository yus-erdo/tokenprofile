/**
 * One-time script: delete all docs in the "sessions" collection.
 * Run with: bun scripts/delete-sessions-collection.ts
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

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

async function deleteSessions() {
  const snap = await db.collection("sessions").get();
  console.log(`Found ${snap.size} documents in "sessions"`);

  if (snap.empty) {
    console.log("Nothing to delete.");
    return;
  }

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;

    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      console.log(`  Deleted ${count}/${snap.size}`);
      batch = db.batch();
    }
  }

  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
  }

  console.log(`Deleted ${count} documents from "sessions" collection`);
}

deleteSessions().catch((err) => {
  console.error("Delete failed:", err);
  process.exit(1);
});
