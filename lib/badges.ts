// Badge definitions and evaluation engine for toqqen gamification

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "tokens" | "streak" | "time" | "models" | "misc";
  evaluate: (stats: BadgeEvalStats) => BadgeProgress;
}

export interface BadgeProgress {
  earned: boolean;
  current: number;
  target: number;
}

export interface EarnedBadge {
  id: string;
  unlockedAt: string;
}

export interface BadgeWithStatus {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
  unlockedAt: string | null;
  current: number;
  target: number;
}

export interface BadgeEvalStats {
  totalTokens: number;
  completionCount: number;
  heatmap: Record<string, { tokens: number; completions: number }>;
  models: Record<string, number>;
  hours: Record<string, number>;
  /** Max consecutive days with at least one completion */
  currentStreak: number;
  longestStreak: number;
  weekendCompletions: number;
  nightOwlCompletions: number;
  earlyBirdCompletions: number;
  maxCompletionsInADay: number;
}

/**
 * Compute derived stats from raw event-level data.
 * heatmap, models, hours come from the profile page data.
 * This function computes streaks, weekend/time-of-day counts, and max daily completions.
 */
export function computeBadgeStats(params: {
  totalTokens: number;
  completionCount: number;
  heatmap: Record<string, { tokens: number; completions: number }>;
  models: Record<string, number>;
  /** Array of ISO timestamps from completions */
  timestamps: string[];
}): BadgeEvalStats {
  const { totalTokens, completionCount, heatmap, models, timestamps } = params;

  // Compute hours distribution, weekend count, night owl, early bird from timestamps
  const hours: Record<string, number> = {};
  let weekendCompletions = 0;
  let nightOwlCompletions = 0;
  let earlyBirdCompletions = 0;

  for (const ts of timestamps) {
    const d = new Date(ts);
    const h = d.getUTCHours();
    hours[String(h)] = (hours[String(h)] || 0) + 1;

    const dayOfWeek = d.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) weekendCompletions++;
    if (h >= 22 || h < 4) nightOwlCompletions++;
    if (h >= 4 && h < 7) earlyBirdCompletions++;
  }

  // Compute streaks from heatmap dates
  const dates = Object.keys(heatmap).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      );
      streak = diffDays === 1 ? streak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, streak);
  }

  // Current streak: count backwards from today
  const today = new Date().toISOString().split("T")[0];
  const sortedDatesDesc = [...dates].reverse();
  currentStreak = 0;
  let checkDate = today;
  for (const date of sortedDatesDesc) {
    if (date === checkDate) {
      currentStreak++;
      // Move to previous day
      const d = new Date(checkDate);
      d.setDate(d.getDate() - 1);
      checkDate = d.toISOString().split("T")[0];
    } else if (date < checkDate) {
      // gap found
      break;
    }
  }

  // Max completions in a single day
  let maxCompletionsInADay = 0;
  for (const entry of Object.values(heatmap)) {
    maxCompletionsInADay = Math.max(maxCompletionsInADay, entry.completions);
  }

  return {
    totalTokens,
    completionCount,
    heatmap,
    models,
    hours,
    currentStreak,
    longestStreak,
    weekendCompletions,
    nightOwlCompletions,
    earlyBirdCompletions,
    maxCompletionsInADay,
  };
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  // Token milestones
  {
    id: "tokens-10k",
    name: "First 10K",
    description: "Generate 10,000 tokens",
    icon: "◇",
    category: "tokens",
    evaluate: (s) => ({ earned: s.totalTokens >= 10_000, current: s.totalTokens, target: 10_000 }),
  },
  {
    id: "tokens-100k",
    name: "First 100K",
    description: "Generate 100,000 tokens",
    icon: "◆",
    category: "tokens",
    evaluate: (s) => ({ earned: s.totalTokens >= 100_000, current: s.totalTokens, target: 100_000 }),
  },
  {
    id: "tokens-1m",
    name: "First 1M",
    description: "Generate 1,000,000 tokens",
    icon: "◆",
    category: "tokens",
    evaluate: (s) => ({ earned: s.totalTokens >= 1_000_000, current: s.totalTokens, target: 1_000_000 }),
  },
  {
    id: "tokens-10m",
    name: "First 10M",
    description: "Generate 10,000,000 tokens",
    icon: "★",
    category: "tokens",
    evaluate: (s) => ({ earned: s.totalTokens >= 10_000_000, current: s.totalTokens, target: 10_000_000 }),
  },
  {
    id: "tokens-100m",
    name: "Token Whale",
    description: "Generate 100,000,000 tokens",
    icon: "★",
    category: "tokens",
    evaluate: (s) => ({ earned: s.totalTokens >= 100_000_000, current: s.totalTokens, target: 100_000_000 }),
  },

  // Streak badges
  {
    id: "streak-7",
    name: "Week Warrior",
    description: "7-day completion streak",
    icon: "▶",
    category: "streak",
    evaluate: (s) => ({ earned: s.longestStreak >= 7, current: s.longestStreak, target: 7 }),
  },
  {
    id: "streak-30",
    name: "Monthly Grind",
    description: "30-day completion streak",
    icon: "▶▶",
    category: "streak",
    evaluate: (s) => ({ earned: s.longestStreak >= 30, current: s.longestStreak, target: 30 }),
  },
  {
    id: "streak-100",
    name: "Centurion",
    description: "100-day completion streak",
    icon: "⚡",
    category: "streak",
    evaluate: (s) => ({ earned: s.longestStreak >= 100, current: s.longestStreak, target: 100 }),
  },
  {
    id: "streak-365",
    name: "Year Round",
    description: "365-day completion streak",
    icon: "⚡",
    category: "streak",
    evaluate: (s) => ({ earned: s.longestStreak >= 365, current: s.longestStreak, target: 365 }),
  },

  // Time-based
  {
    id: "weekend-warrior",
    name: "Weekend Warrior",
    description: "10+ completions on weekends",
    icon: "☆",
    category: "time",
    evaluate: (s) => ({ earned: s.weekendCompletions >= 10, current: s.weekendCompletions, target: 10 }),
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "50+ completions after 10pm",
    icon: "●",
    category: "time",
    evaluate: (s) => ({ earned: s.nightOwlCompletions >= 50, current: s.nightOwlCompletions, target: 50 }),
  },
  {
    id: "early-bird",
    name: "Early Bird",
    description: "50+ completions before 7am",
    icon: "○",
    category: "time",
    evaluate: (s) => ({ earned: s.earlyBirdCompletions >= 50, current: s.earlyBirdCompletions, target: 50 }),
  },

  // Model variety
  {
    id: "polyglot",
    name: "Polyglot",
    description: "Use 3+ different models",
    icon: "◈",
    category: "models",
    evaluate: (s) => ({
      earned: Object.keys(s.models).length >= 3,
      current: Object.keys(s.models).length,
      target: 3,
    }),
  },
  {
    id: "model-master",
    name: "Model Master",
    description: "Use 5+ different models",
    icon: "◈",
    category: "models",
    evaluate: (s) => ({
      earned: Object.keys(s.models).length >= 5,
      current: Object.keys(s.models).length,
      target: 5,
    }),
  },

  // Misc
  {
    id: "first-completion",
    name: "Hello World",
    description: "Record your first completion",
    icon: "▸",
    category: "misc",
    evaluate: (s) => ({ earned: s.completionCount >= 1, current: s.completionCount, target: 1 }),
  },
  {
    id: "speed-demon",
    name: "Speed Demon",
    description: "100+ completions in a single day",
    icon: "⚡",
    category: "misc",
    evaluate: (s) => ({
      earned: s.maxCompletionsInADay >= 100,
      current: s.maxCompletionsInADay,
      target: 100,
    }),
  },
];

/**
 * Evaluate all badges against the given stats.
 * Returns badges with their earned status and progress.
 */
export function evaluateBadges(
  stats: BadgeEvalStats,
  existingBadges: EarnedBadge[] = []
): BadgeWithStatus[] {
  const existingMap = new Map(existingBadges.map((b) => [b.id, b.unlockedAt]));

  return BADGE_CATALOG.map((badge) => {
    const progress = badge.evaluate(stats);
    const existingUnlock = existingMap.get(badge.id);

    return {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      earned: progress.earned,
      unlockedAt: existingUnlock || null,
      current: Math.min(progress.current, progress.target),
      target: progress.target,
    };
  });
}

/**
 * Determine newly earned badges (earned now but not previously stored).
 * Returns the badge IDs that should be persisted.
 */
export function getNewlyEarnedBadges(
  badges: BadgeWithStatus[],
  existingBadges: EarnedBadge[]
): string[] {
  const existingIds = new Set(existingBadges.map((b) => b.id));
  return badges
    .filter((b) => b.earned && !existingIds.has(b.id))
    .map((b) => b.id);
}
