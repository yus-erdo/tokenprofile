"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface InitialUser {
  displayName: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string;
}

interface ProfileSidebarProps {
  username: string;
  initialUser: InitialUser;
  totalTokens?: number;
}

function getTier(tokens: number): { name: string; gradient: string } {
  if (tokens >= 10_000_000) return { name: "diamond", gradient: "conic-gradient(from 0deg, #b9f2ff, #e0f7ff, #7dd3fc, #38bdf8, #b9f2ff)" };
  if (tokens >= 1_000_000) return { name: "gold", gradient: "conic-gradient(from 0deg, #fbbf24, #fde68a, #f59e0b, #fbbf24)" };
  if (tokens >= 100_000) return { name: "silver", gradient: "conic-gradient(from 0deg, #d1d5db, #f3f4f6, #9ca3af, #d1d5db)" };
  return { name: "bronze", gradient: "conic-gradient(from 0deg, #d97706, #fbbf24, #b45309, #d97706)" };
}

function renderMarkdownBio(text: string): React.ReactNode {
  // Sanitize: strip HTML tags
  const sanitized = text.replace(/<[^>]*>/g, "");

  // Split into segments and process inline markdown
  const parts: React.ReactNode[] = [];
  // Process line by line for line breaks
  const lines = sanitized.split("\n");

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) parts.push(<br key={`br-${lineIdx}`} />);

    // Regex-based inline markdown: bold, italic, code, links
    const inlineRegex = /(\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match;
    let segIdx = 0;

    while ((match = inlineRegex.exec(line)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }

      const key = `${lineIdx}-${segIdx++}`;

      if (match[2] || match[3]) {
        // Bold: **text** or __text__
        parts.push(<strong key={key}>{match[2] || match[3]}</strong>);
      } else if (match[4] || match[5]) {
        // Italic: _text_ or *text*
        parts.push(<em key={key}>{match[4] || match[5]}</em>);
      } else if (match[6]) {
        // Code: `text`
        parts.push(
          <code key={key} className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-xs font-mono-accent">
            {match[6]}
          </code>
        );
      } else if (match[7] && match[8]) {
        // Link: [text](url)
        const href = match[8].startsWith("http") ? match[8] : `https://${match[8]}`;
        parts.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            {match[7]}
          </a>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
  });

  return <>{parts}</>;
}

export function ProfileSidebar({ username, initialUser, totalTokens = 0 }: ProfileSidebarProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const isOwner = session?.user?.username === username;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(initialUser);
  const [editForm, setEditForm] = useState(initialUser);

  function handleEdit() {
    setEditForm(profile);
    setEditing(true);
  }

  function handleCancel() {
    setEditForm(profile);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: editForm.displayName,
        bio: editForm.bio,
        location: editForm.location,
        website: editForm.website,
      }),
    });
    if (res.ok) {
      setProfile(editForm);
      setEditing(false);
    }
    setSaving(false);
  }

  const tier = getTier(totalTokens);

  const displayName = editing ? editForm.displayName : profile.displayName;
  const bio = editing ? editForm.bio : profile.bio;
  const location = editing ? editForm.location : profile.location;
  const website = editing ? editForm.website : profile.website;

  return (
    <div className="w-full md:w-56 flex-shrink-0">
      {/* Mobile avatar + name row */}
      <div className="flex flex-row items-center gap-4 md:hidden">
        {profile.avatarUrl && (
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="rounded-full p-[3px]" style={{ background: tier.gradient }}>
              <img
                src={profile.avatarUrl}
                alt={displayName || username}
                className="w-20 h-20 rounded-full border-2 border-white dark:border-gray-950"
              />
            </div>
            <span className="text-[10px] font-mono-accent text-gray-400 dark:text-gray-600 mt-1 uppercase tracking-wider">{tier.name}</span>
          </div>
        )}
        <div className="min-w-0">
          {editing ? (
            <input
              type="text"
              value={editForm.displayName || ""}
              onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
              className="text-xl font-bold w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900"
            />
          ) : (
            <h1 className="text-xl font-bold">{displayName || username}</h1>
          )}
          <p className="text-gray-500 dark:text-gray-400 text-base">{username}</p>
        </div>
      </div>

      {/* Desktop name — below avatar overlap area */}
      <div className="hidden md:block md:mt-[152px]">
        {editing ? (
          <input
            type="text"
            value={editForm.displayName || ""}
            onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
            className="text-2xl font-bold w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900"
          />
        ) : (
          <h1 className="text-2xl font-bold">{displayName || username}</h1>
        )}
        <p className="text-gray-500 dark:text-gray-400 text-xl font-light">{username}</p>
      </div>

      {editing ? (
        <textarea
          value={editForm.bio || ""}
          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
          rows={3}
          placeholder="Add a bio"
          className="mt-3 w-full text-sm md:text-base border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-900"
        />
      ) : (
        bio && <p className="mt-3 text-gray-700 dark:text-gray-300 text-sm md:text-base">{renderMarkdownBio(bio)}</p>
      )}

      {isOwner && !editing && (
        <button
          onClick={handleEdit}
          className="mt-3 block w-full text-center px-4 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Edit profile
        </button>
      )}

      {editing && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-1.5 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <input
              type="text"
              value={editForm.location || ""}
              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              placeholder="Location"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-sm bg-white dark:bg-gray-900"
            />
          </div>
        ) : (
          location && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span>{location}</span>
            </div>
          )
        )}
        {editing ? (
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
            <input
              type="text"
              value={editForm.website || ""}
              onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
              placeholder="Website"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-sm bg-white dark:bg-gray-900"
            />
          </div>
        ) : (
          website && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
              <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 hover:underline truncate">{website.replace(/^https?:\/\//, "")}</a>
            </div>
          )
        )}
      </div>

      {isOwner && (
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-4 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:underline transition-colors cursor-pointer"
        >
          Sign out
        </button>
      )}
    </div>
  );
}
