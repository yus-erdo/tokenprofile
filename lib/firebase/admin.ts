import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length > 0) return;

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    // During build time, credentials aren't available — init with project ID only
    initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy" });
    return;
  }

  const serviceAccount = JSON.parse(key);
  initializeApp({ credential: cert(serviceAccount) });
}

initAdmin();

export const adminDb = getFirestore();
