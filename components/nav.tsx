"use client";

import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

export function Nav() {
  const { user } = useAuth();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        if (snap.exists()) setUsername(snap.data().username);
      });
    }
  }, [user]);

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">Token Profile</Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {user ? (
            <>
              {username && (
                <Link href={`/${username}`} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">Profile</Link>
              )}
              <Link href="/settings" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">Settings</Link>
              <button
                onClick={() => signOut(auth)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/sign-in" className="text-sm px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200">Sign in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
