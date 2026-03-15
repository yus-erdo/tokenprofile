"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";

export default function JoinTeamPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [teamSlug, setTeamSlug] = useState("");

  useEffect(() => {
    if (!session || !code || joining || joined) return;

    const join = async () => {
      setJoining(true);
      try {
        const res = await fetch(`/api/teams/join?code=${code}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          if (data.slug) {
            // Already a member
            router.push(`/teams/${data.slug}`);
            return;
          }
          setError(data.error || "Failed to join");
          return;
        }
        setTeamSlug(data.slug);
        setJoined(true);
      } catch {
        setError("Something went wrong");
      } finally {
        setJoining(false);
      }
    };

    join();
  }, [session, code, joining, joined, router]);

  if (status === "loading") {
    return (
      <>
        <Nav />
        <div className="max-w-xl mx-auto px-4 py-16 text-center text-gray-500 font-mono-accent">loading...</div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Nav />
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-500 font-mono-accent mb-4">sign in to join this team</p>
          <Link href="/sign-in" className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-mono-accent press-effect">
            sign in
          </Link>
        </div>
      </>
    );
  }

  if (!code) {
    return (
      <>
        <Nav />
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-500 font-mono-accent">no invite code provided</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        {joining && (
          <p className="text-gray-500 font-mono-accent">joining team...</p>
        )}
        {error && (
          <p className="text-red-600 dark:text-red-400 font-mono-accent">{error}</p>
        )}
        {joined && teamSlug && (
          <div>
            <p className="text-emerald-600 dark:text-emerald-400 font-mono-accent mb-4">you joined the team</p>
            <Link
              href={`/teams/${teamSlug}`}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-mono-accent press-effect"
            >
              go to team
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
