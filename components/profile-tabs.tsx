"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

interface ProfileTabsProps {
  username: string;
}

export function ProfileTabs({ username }: ProfileTabsProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const year = searchParams.get("year");
  const isOwner = session?.user?.username === username;

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
          data-active={tab.active}
          className={`tab-underline px-4 py-2 text-sm font-medium transition-colors ${
            tab.active
              ? "text-orange-500 dark:text-orange-400"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
