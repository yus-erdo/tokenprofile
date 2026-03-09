"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
    if (session.user.username) {
      router.replace(`/${session.user.username}?tab=developer`);
    }
  }, [session, status, router]);

  return <div className="p-8 text-center">Redirecting...</div>;
}
