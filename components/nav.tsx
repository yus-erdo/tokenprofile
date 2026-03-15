"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { CommandPaletteButton } from "./command-palette";
import { NotificationBell } from "./notification-bell";

export function Nav() {
  const { data: session } = useSession();
  const username = session?.user?.username;

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={username ? `/${username}` : "/"} className="text-lg font-bold press-effect">Toqqen</Link>
        <div className="flex items-center gap-4">
          <CommandPaletteButton />
          <ThemeToggle />
          {session ? (
            <>
              <NotificationBell />
              {username && (
                <Link href={`/${username}`} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 press-effect">Profile</Link>
              )}
              <Link href="/teams" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 press-effect">Teams</Link>
              <Link href="/reports" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 press-effect">Reports</Link>
              <Link href="/settings" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 press-effect">Settings</Link>
            </>
          ) : (
            <Link href="/sign-in" className="text-sm px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 press-effect">Sign in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
