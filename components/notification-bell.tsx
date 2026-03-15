"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string | { toDate?: () => Date };
}

function formatTime(createdAt: string | { toDate?: () => Date }): string {
  const date =
    typeof createdAt === "string"
      ? new Date(createdAt)
      : createdAt?.toDate?.() ?? new Date();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function typeIcon(type: string): string {
  switch (type) {
    case "budget_warning":
      return "~";
    case "budget_exceeded":
      return "!";
    case "spike_alert":
      return "^";
    case "badge_unlocked":
      return "*";
    default:
      return ">";
  }
}

export function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const userId = session?.user?.firestoreId;

  // Real-time Firestore listener
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: NotificationItem[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          title: data.title,
          message: data.message,
          read: data.read,
          createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
        };
      });
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    }, (err) => {
      console.warn("Notifications listener failed:", err.code);
    });

    return () => unsubscribe();
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/users/me/notifications/${id}`, { method: "PUT" });
    } catch {
      // silently fail — Firestore listener will update state
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/users/me/notifications/read-all", { method: "PUT" });
    } catch {
      // silently fail
    }
  }, []);

  if (!session) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 press-effect p-1"
        aria-label="Notifications"
      >
        {/* Bell SVG */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1 font-mono-accent">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">
              ~ notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-mono-accent press-effect"
              >
                mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-600 font-mono-accent">
              no notifications yet
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markAsRead(n.id);
                  }}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    !n.read ? "bg-gray-50/50 dark:bg-gray-800/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono-accent text-gray-400 dark:text-gray-600 mt-0.5 shrink-0 w-3 text-center">
                      {typeIcon(n.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono-accent font-medium truncate ${!n.read ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"}`}>
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-500 font-mono-accent mt-0.5 truncate">
                        {n.message}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent mt-0.5">
                        {formatTime(n.createdAt)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
