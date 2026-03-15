"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Nav } from "@/components/nav";
import { BentoCard } from "@/components/ui/bento-card";

interface Member {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  visibility: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

interface TeamInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  myRole: string;
}

const roleBadgeClass: Record<string, string> = {
  owner: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50",
  admin: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50",
  member: "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

export default function TeamSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviting, setInviting] = useState(false);

  const loadTeam = useCallback(async () => {
    const res = await fetch(`/api/teams/${slug}`);
    if (!res.ok) return;
    const data = await res.json();
    setTeam(data);
    setName(data.name);
    setDescription(data.description);
  }, [slug]);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/teams/${slug}/members`);
    if (!res.ok) return;
    setMembers(await res.json());
  }, [slug]);

  const loadInvites = useCallback(async () => {
    const res = await fetch(`/api/teams/${slug}/invites`);
    if (!res.ok) return;
    setInvites(await res.json());
  }, [slug]);

  useEffect(() => {
    if (session) {
      loadTeam();
      loadMembers();
      loadInvites();
    }
  }, [session, loadTeam, loadMembers, loadInvites]);

  if (status === "loading" || !team) {
    return (
      <>
        <Nav />
        <div className="max-w-xl mx-auto px-4 py-16 text-center text-gray-500 font-mono-accent">loading...</div>
      </>
    );
  }

  const isOwner = team.myRole === "owner";
  const isAdmin = team.myRole === "owner" || team.myRole === "admin";

  if (!isAdmin) {
    router.push(`/teams/${slug}`);
    return null;
  }

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/teams/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }
      setSuccess("saved");
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure? This will permanently delete the team and all its data.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete");
        setDeleting(false);
        return;
      }
      router.push("/");
    } catch {
      setError("Something went wrong");
      setDeleting(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    try {
      const res = await fetch(`/api/teams/${slug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send invite");
        return;
      }
      setInviteEmail("");
      setSuccess("invite sent");
      setTimeout(() => setSuccess(""), 2000);
      loadInvites();
    } catch {
      setError("Something went wrong");
    } finally {
      setInviting(false);
    }
  };

  const handleGenerateLink = async () => {
    try {
      const res = await fetch(`/api/teams/${slug}/invite-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUses: 25, expiryDays: 7 }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const url = `${window.location.origin}/teams/join?code=${data.code}`;
      setInviteLink(url);
    } catch {
      setError("Failed to generate link");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member from the team?")) return;
    try {
      const res = await fetch(`/api/teams/${slug}/members/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to remove member");
        return;
      }
      loadMembers();
    } catch {
      setError("Something went wrong");
    }
  };

  return (
    <>
      <Nav />
      <div className="max-w-xl mx-auto px-4 py-12">
        <h1 className="text-xl font-bold font-mono-accent mb-8">~ team settings</h1>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 font-mono-accent mb-4">{error}</p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-mono-accent mb-4">{success}</p>
        )}

        {/* General settings */}
        <BentoCard className="mb-6">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-4">~ general</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 font-mono-accent mb-1">name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-mono-accent focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 font-mono-accent mb-1">description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-mono-accent focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600 resize-none"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-mono-accent hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 press-effect"
            >
              {saving ? "saving..." : "save changes"}
            </button>
          </div>
        </BentoCard>

        {/* Members */}
        <BentoCard className="mb-6">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-4">~ members</h2>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 min-w-0">
                  {m.avatarUrl && (
                    <img src={m.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                  )}
                  <span className="text-sm font-mono-accent text-gray-900 dark:text-gray-100 truncate">
                    {m.displayName || m.username}
                  </span>
                  <span className={`text-[10px] font-mono-accent px-1.5 py-0.5 rounded border ${roleBadgeClass[m.role] || roleBadgeClass.member}`}>
                    {m.role}
                  </span>
                </div>
                {m.role !== "owner" && isAdmin && (
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="text-xs text-red-500 hover:text-red-700 font-mono-accent press-effect"
                  >
                    remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </BentoCard>

        {/* Invite by email */}
        <BentoCard className="mb-6">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-4">~ invite member</h2>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-mono-accent focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-2 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-mono-accent"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-mono-accent hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 press-effect"
            >
              {inviting ? "..." : "invite"}
            </button>
          </form>

          {invites.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent uppercase tracking-wider">pending invites</p>
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-xs font-mono-accent py-1">
                  <span className="text-gray-700 dark:text-gray-300">{inv.email}</span>
                  <span className="text-gray-400 dark:text-gray-600">{inv.role}</span>
                </div>
              ))}
            </div>
          )}
        </BentoCard>

        {/* Invite link */}
        <BentoCard className="mb-6">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-4">~ invite link</h2>
          <button
            onClick={handleGenerateLink}
            className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-mono-accent hover:bg-gray-50 dark:hover:bg-gray-900 press-effect"
          >
            generate invite link
          </button>
          {inviteLink && (
            <div className="mt-3">
              <input
                type="text"
                readOnly
                value={inviteLink}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-mono-accent"
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent mt-1">expires in 7 days, max 25 uses</p>
            </div>
          )}
        </BentoCard>

        {/* Danger zone */}
        {isOwner && (
          <BentoCard className="border-red-200 dark:border-red-800/50">
            <h2 className="text-xs uppercase tracking-wider text-red-400 dark:text-red-600 font-mono-accent mb-4">~ danger zone</h2>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-mono-accent hover:bg-red-700 disabled:opacity-50 press-effect"
            >
              {deleting ? "deleting..." : "delete team"}
            </button>
          </BentoCard>
        )}
      </div>
    </>
  );
}
