import { describe, test, expect } from "vitest";
import { calculateCost } from "../model-costs";

const sonnetConfig = {
  models: {
    "claude-sonnet-4-6": {
      displayName: "Claude Sonnet 4.6",
      provider: "anthropic",
      costs: [
        {
          inputPerMillion: 3,
          outputPerMillion: 15,
          cacheWritePerMillion: 3.75,
          cacheReadPerMillion: 0.3,
          effectiveFrom: new Date("2025-06-01"),
        },
      ],
    },
  },
};

describe("calculateCost", () => {
  test("calculates cost with all token types", () => {
    const result = calculateCost({
      model: "claude-sonnet-4-6",
      inputTokens: 10000, // includes 3000 cache write + 5000 cache read = 2000 base
      outputTokens: 2000,
      cacheCreationTokens: 3000,
      cacheReadTokens: 5000,
      config: sonnetConfig,
    });

    // base input: 2000 * 3 / 1M = 0.006
    // cache write: 3000 * 3.75 / 1M = 0.01125
    // cache read: 5000 * 0.3 / 1M = 0.0015
    // output: 2000 * 15 / 1M = 0.03
    // total = 0.04875
    expect(result).toBeCloseTo(0.04875, 6);
  });

  test("calculates cost without cache tokens (backward compat)", () => {
    const result = calculateCost({
      model: "claude-sonnet-4-6",
      inputTokens: 10000,
      outputTokens: 2000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      config: sonnetConfig,
    });

    // input: 10000 * 3 / 1M = 0.03
    // output: 2000 * 15 / 1M = 0.03
    // total = 0.06
    expect(result).toBeCloseTo(0.06, 6);
  });

  test("returns null for unknown model", () => {
    const result = calculateCost({
      model: "gpt-4o",
      inputTokens: 10000,
      outputTokens: 2000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      config: sonnetConfig,
    });

    expect(result).toBeNull();
  });

  test("returns null for model with empty costs array", () => {
    const config = {
      models: {
        "claude-sonnet-4-6": {
          displayName: "Claude Sonnet 4.6",
          provider: "anthropic",
          costs: [],
        },
      },
    };

    const result = calculateCost({
      model: "claude-sonnet-4-6",
      inputTokens: 10000,
      outputTokens: 2000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      config,
    });

    expect(result).toBeNull();
  });

  test("returns 0 for zero tokens", () => {
    const result = calculateCost({
      model: "claude-sonnet-4-6",
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      config: sonnetConfig,
    });

    expect(result).toBe(0);
  });

  test("clamps base input to 0 when cache tokens exceed input tokens", () => {
    const result = calculateCost({
      model: "claude-sonnet-4-6",
      inputTokens: 5000,
      outputTokens: 1000,
      cacheCreationTokens: 3000,
      cacheReadTokens: 4000, // 3000 + 4000 = 7000 > 5000
      config: sonnetConfig,
    });

    // base input: max(0, 5000 - 3000 - 4000) = 0
    // cache write: 3000 * 3.75 / 1M = 0.01125
    // cache read: 4000 * 0.3 / 1M = 0.0012
    // output: 1000 * 15 / 1M = 0.015
    // total = 0.02745
    expect(result).toBeCloseTo(0.02745, 6);
  });

  test("uses first cost entry (latest) from costs array", () => {
    const config = {
      models: {
        "claude-sonnet-4-6": {
          displayName: "Claude Sonnet 4.6",
          provider: "anthropic",
          costs: [
            {
              inputPerMillion: 5, // newer, higher price
              outputPerMillion: 20,
              cacheWritePerMillion: 6.25,
              cacheReadPerMillion: 0.5,
              effectiveFrom: new Date("2026-01-01"),
            },
            {
              inputPerMillion: 3, // older price
              outputPerMillion: 15,
              cacheWritePerMillion: 3.75,
              cacheReadPerMillion: 0.3,
              effectiveFrom: new Date("2025-06-01"),
            },
          ],
        },
      },
    };

    const result = calculateCost({
      model: "claude-sonnet-4-6",
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      config,
    });

    // Should use first entry: 1M * 5 / 1M = $5
    expect(result).toBe(5);
  });
});
