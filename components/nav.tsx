"use client";

import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useEffect, useState } from "react";

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
    <nav className="border-b">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">Token Profile</Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {username && (
                <Link href={`/${username}`} className="text-sm text-gray-600 hover:text-gray-900">Profile</Link>
              )}
              <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</Link>
              <button
                onClick={() => signOut(auth)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/sign-in" className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800">Sign in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
