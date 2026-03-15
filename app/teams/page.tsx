"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Nav } from "@/components/nav";

interface TeamItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatarUrl: string;
}

export default function TeamsPage() {
  const { data: session, status } = useSession();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => {
        setTeams(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

  if (status === "loading") {
    return (
      <>
        <Nav />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500 font-mono-accent">loading...</div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Nav />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-500 font-mono-accent mb-4">sign in to view your teams</p>
          <Link href="/sign-in" className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-mono-accent press-effect">
            sign in
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold font-mono-accent">~ teams</h1>
          <Link
            href="/teams/new"
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-mono-accent hover:bg-gray-800 dark:hover:bg-gray-200 press-effect"
          >
            create team
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 font-mono-accent py-8">loading...</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 dark:text-gray-600 font-mono-accent mb-2">no teams yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 font-mono-accent">create a team to start tracking usage together</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            {teams.map((team, i) => (
              <Link
                key={team.id}
                href={`/teams/${team.slug}`}
                className={`block px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 press-effect ${i !== 0 ? "border-t border-gray-100 dark:border-gray-800/50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs font-mono-accent text-gray-500 dark:text-gray-400">
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium font-mono-accent text-gray-900 dark:text-gray-100 truncate">{team.name}</p>
                    {team.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-600 font-mono-accent truncate">{team.description}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
