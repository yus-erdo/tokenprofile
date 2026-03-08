"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useEffect, useState } from "react";

interface ProfileTabsProps {
  username: string;
}

export function ProfileTabs({ username }: ProfileTabsProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const year = searchParams.get("year");
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().username === username) {
        setIsOwner(true);
      }
    });
  }, [user, username]);

  const overviewHref = year ? `/${username}?year=${year}` : `/${username}`;
  const developerHref = year ? `/${username}?tab=developer&year=${year}` : `/${username}?tab=developer`;

  const tabs = [
    { label: "Overview", href: overviewHref, active: activeTab === "overview" },
    ...(isOwner
      ? [{ label: "Developer", href: developerHref, active: activeTab === "developer" }]
      : []),
  ];

  return (
    <div className="flex gap-0">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab.active
              ? "border-orange-500 text-gray-900 dark:text-white"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
