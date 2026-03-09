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
}

export function ProfileSidebar({ username, initialUser }: ProfileSidebarProps) {
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

  const displayName = editing ? editForm.displayName : profile.displayName;
  const bio = editing ? editForm.bio : profile.bio;
  const location = editing ? editForm.location : profile.location;
  const website = editing ? editForm.website : profile.website;

  return (
    <div className="w-full md:w-56 flex-shrink-0">
      {/* Mobile avatar + name row */}
      <div className="flex flex-row items-center gap-4 md:hidden">
        {profile.avatarUrl && (
          <img
            src={profile.avatarUrl}
            alt={displayName || username}
            className="w-20 h-20 rounded-full border border-gray-200 dark:border-gray-700 flex-shrink-0"
          />
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
        bio && <p className="mt-3 text-gray-700 dark:text-gray-300 text-sm md:text-base">{bio}</p>
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
