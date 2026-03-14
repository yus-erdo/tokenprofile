"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.username) {
      router.replace(`/${session.user.username}`);
    } else if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [session, status, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#0a0a0a", colorScheme: "dark" }}
    >
      <div className="text-center space-y-4">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin mx-auto"
          style={{ borderColor: "#333", borderTopColor: "#00ff88" }}
        />
        <p className="font-mono text-sm" style={{ color: "#555" }}>
          Signing in...
        </p>
      </div>
    </div>
  );
}
