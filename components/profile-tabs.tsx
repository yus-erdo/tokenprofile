"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface ProfileTabsProps {
  username: string;
}

export function ProfileTabs({ username }: ProfileTabsProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const year = searchParams.get("year");

  function buildHref(tab?: string) {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (tab) params.set("tab", tab);
    const qs = params.toString();
    return `/${username}${qs ? `?${qs}` : ""}`;
  }

  const tabs = [
    { key: "overview", label: "Overview", href: buildHref() },
    { key: "charts", label: "Charts", href: buildHref("charts") },
    { key: "insights", label: "Insights", href: buildHref("insights") },
  ];

  return (
    <div className="flex gap-0">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          data-active={activeTab === tab.key}
          className={`tab-underline px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.key
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
