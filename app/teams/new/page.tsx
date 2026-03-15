"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";

export default function NewTeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
          <p className="text-gray-500 font-mono-accent">sign in to create a team</p>
          <Link href="/sign-in" className="text-sm mt-4 inline-block underline text-gray-600 dark:text-gray-400">sign in</Link>
        </div>
      </>
    );
  }

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug from name
    const generated = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);
    setSlug(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create team");
        return;
      }

      router.push(`/teams/${data.slug}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Nav />
      <div className="max-w-xl mx-auto px-4 py-12">
        <h1 className="text-xl font-bold font-mono-accent mb-8">~ create team</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-2">
              ~ team name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="my team"
              required
              maxLength={100}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-mono-accent focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-2">
              ~ slug
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 dark:text-gray-600 font-mono-accent">/teams/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-team"
                required
                maxLength={50}
                pattern="[a-z0-9-]+"
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-mono-accent focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-2">
              ~ description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="what this team is about..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-mono-accent focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 font-mono-accent">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name || !slug}
            className="w-full px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-mono-accent hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed press-effect"
          >
            {loading ? "creating..." : "create team"}
          </button>
        </form>
      </div>
    </>
  );
}
