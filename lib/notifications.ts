import { adminDb } from "@/lib/firebase/admin";

interface Notification {
  type: string;
  title: string;
  message: string;
  link?: string;
}

export async function notify(userId: string, notification: Notification) {
  await adminDb.collection("notifications").add({
    userId,
    ...notification,
    read: false,
    createdAt: new Date(),
  });
}
