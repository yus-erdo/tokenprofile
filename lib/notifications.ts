import { adminDb } from "@/lib/firebase/admin";

// --- Types ---

export type NotificationType =
  | "budget_warning"
  | "budget_exceeded"
  | "spike_alert"
  | "badge_unlocked";

export interface Notification {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface NotificationChannel {
  send(userId: string, notification: Omit<Notification, "userId" | "read" | "createdAt">): Promise<boolean>;
}

export interface UserNotificationPreferences {
  channels: {
    [K in NotificationType]?: ("in_app" | "email")[];
  };
}

// --- Channels ---

const inAppChannel: NotificationChannel = {
  async send(userId, notification) {
    await adminDb.collection("notifications").add({
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: false,
      createdAt: new Date(),
      metadata: notification.metadata ?? {},
    });
    return true;
  },
};

const emailChannel: NotificationChannel = {
  async send(_userId, notification) {
    // Stub: log and return success — implement later with Resend/SendGrid
    console.log(`[email-stub] Would send email for ${notification.type}: ${notification.title}`);
    return true;
  },
};

const channels: Record<string, NotificationChannel> = {
  in_app: inAppChannel,
  email: emailChannel,
};

// --- Public API ---

export async function notify(
  userId: string,
  notification: Omit<Notification, "userId" | "read" | "createdAt">
): Promise<void> {
  // Always send in-app for now
  await channels.in_app.send(userId, notification);

  // Check user preferences for additional channels
  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const prefs = userDoc.data()?.notificationPreferences as UserNotificationPreferences | undefined;
    if (prefs?.channels?.[notification.type]) {
      const userChannels = prefs.channels[notification.type]!;
      for (const ch of userChannels) {
        if (ch !== "in_app" && channels[ch]) {
          await channels[ch].send(userId, notification);
        }
      }
    }
  } catch {
    // If preference lookup fails, in-app was already sent
  }
}
