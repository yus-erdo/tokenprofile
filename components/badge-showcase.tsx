"use client";

import { useEffect, useState } from "react";
import type { BadgeWithStatus } from "@/lib/badges";

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function BadgeCard({ badge, isNew }: { badge: BadgeWithStatus; isNew: boolean }) {
  const progress = badge.target > 0 ? Math.min(badge.current / badge.target, 1) : 0;

  return (
    <div
      className={`
        relative rounded-lg border p-3 transition-all duration-300 font-mono-accent
        ${
          badge.earned
            ? "bg-gray-50 dark:bg-gray-900 border-green-400/50 dark:border-green-600/50"
            : "bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-60"
        }
        ${isNew ? "badge-unlock-anim" : ""}
      `}
    >
      {/* Icon */}
      <div
        className={`text-xl mb-1 ${
          badge.earned
            ? "text-green-600 dark:text-green-400"
            : "text-gray-300 dark:text-gray-700"
        }`}
      >
        {badge.icon}
      </div>

      {/* Name */}
      <div
        className={`text-xs font-bold truncate ${
          badge.earned
            ? "text-gray-900 dark:text-gray-100"
            : "text-gray-400 dark:text-gray-600"
        }`}
      >
        {badge.name}
      </div>

      {/* Description */}
      <div className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5 leading-tight">
        {badge.description}
      </div>

      {/* Progress or unlock date */}
      {badge.earned ? (
        <div className="text-[10px] text-green-600 dark:text-green-400 mt-1.5">
          {badge.unlockedAt
            ? new Date(badge.unlockedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "unlocked"}
        </div>
      ) : (
        <div className="mt-1.5">
          <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-600 mb-0.5">
            <span>{formatNumber(badge.current)}</span>
            <span>{formatNumber(badge.target)}</span>
          </div>
          <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-400 dark:bg-gray-600 rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* New badge indicator */}
      {isNew && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
      )}
    </div>
  );
}

function NewBadgeBanner({ badges, onDismiss }: { badges: BadgeWithStatus[]; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="mb-4 border border-green-400/50 dark:border-green-600/50 bg-green-50 dark:bg-green-950/30 rounded-lg p-3 font-mono-accent badge-banner-anim">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-green-700 dark:text-green-400 font-bold">
            new badge{badges.length > 1 ? "s" : ""} unlocked!
          </span>
          <span className="text-xs text-green-600 dark:text-green-500 ml-2">
            {badges.map((b) => `${b.icon} ${b.name}`).join(", ")}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-green-400 dark:text-green-600 hover:text-green-600 dark:hover:text-green-400 text-xs"
        >
          x
        </button>
      </div>
    </div>
  );
}

interface BadgeShowcaseProps {
  initialBadges: BadgeWithStatus[];
  initialNewlyEarned: string[];
  isOwner: boolean;
}

export function BadgeShowcase({ initialBadges, initialNewlyEarned, isOwner }: BadgeShowcaseProps) {
  const [badges] = useState(initialBadges);
  const [newlyEarned, setNewlyEarned] = useState<Set<string>>(new Set(initialNewlyEarned));
  const [showBanner, setShowBanner] = useState(initialNewlyEarned.length > 0 && isOwner);

  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);

  const newBadges = badges.filter((b) => newlyEarned.has(b.id));

  return (
    <div className="mb-6">
      {showBanner && newBadges.length > 0 && (
        <NewBadgeBanner badges={newBadges} onDismiss={() => setShowBanner(false)} />
      )}

      <h2 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-3">
        ~ badges ({earnedBadges.length}/{badges.length})
      </h2>

      {/* Earned badges */}
      {earnedBadges.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
          {earnedBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              isNew={newlyEarned.has(badge.id)}
            />
          ))}
        </div>
      )}

      {/* Locked badges */}
      {lockedBadges.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {lockedBadges.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} isNew={false} />
          ))}
        </div>
      )}

      {badges.length === 0 && (
        <p className="text-gray-400 dark:text-gray-600 text-xs font-mono-accent">
          no badges yet
        </p>
      )}

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes badge-unlock {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes badge-banner-in {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .badge-unlock-anim {
          animation: badge-unlock 0.4s ease-out;
        }
        .badge-banner-anim {
          animation: badge-banner-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
