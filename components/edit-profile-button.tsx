"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useEffect, useState } from "react";
import Link from "next/link";

export function EditProfileButton({ username }: { username: string }) {
  const { user } = useAuth();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().username === username) {
        setIsOwner(true);
      }
    });
  }, [user, username]);

  if (!isOwner) return null;

  return (
    <Link
      href="/settings"
      className="mt-3 block w-full text-center px-4 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      Edit profile
    </Link>
  );
}
