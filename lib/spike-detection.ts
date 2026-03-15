interface SpikeResult {
  isSpike: boolean;
  multiplier: number;
  average: number;
}

/**
 * Detect if today's usage is a spike relative to the 7-day rolling average.
 *
 * @param heatmapData - Record of date strings to token counts
 * @param today - Date string (YYYY-MM-DD) to evaluate
 * @returns Spike detection result
 */
export function detectSpike(
  heatmapData: Record<string, { tokens: number; completions: number }>,
  today: string
): SpikeResult {
  const todayTokens = heatmapData[today]?.tokens ?? 0;

  if (todayTokens === 0) {
    return { isSpike: false, multiplier: 0, average: 0 };
  }

  // Get the 7 days before today
  const todayDate = new Date(today + "T00:00:00Z");
  const pastDays: number[] = [];

  for (let i = 1; i <= 7; i++) {
    const d = new Date(todayDate);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    pastDays.push(heatmapData[dateStr]?.tokens ?? 0);
  }

  const sum = pastDays.reduce((a, b) => a + b, 0);
  const average = sum / 7;

  // If average is 0, any usage would be "infinite" spike — use absolute threshold
  if (average === 0) {
    return { isSpike: false, multiplier: 0, average: 0 };
  }

  const multiplier = todayTokens / average;

  return {
    isSpike: multiplier >= 2,
    multiplier: Math.round(multiplier * 10) / 10,
    average: Math.round(average),
  };
}
