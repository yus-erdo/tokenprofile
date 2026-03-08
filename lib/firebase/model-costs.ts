import { adminDb } from "@/lib/firebase/admin";

interface ModelCostEntry {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheReadPerMillion: number;
  effectiveFrom: Date;
}

interface ModelConfig {
  displayName: string;
  provider: string;
  costs: ModelCostEntry[];
}

interface ModelCostsConfig {
  models: Record<string, ModelConfig>;
}

let cachedConfig: ModelCostsConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getModelCosts(): Promise<ModelCostsConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const doc = await adminDb.doc("config/modelCosts").get();
  if (!doc.exists) {
    cachedConfig = { models: {} };
    cacheTimestamp = now;
    return cachedConfig;
  }

  const data = doc.data() as ModelCostsConfig;

  for (const model of Object.values(data.models)) {
    model.costs = model.costs.map((c) => ({
      ...c,
      effectiveFrom:
        c.effectiveFrom instanceof Date
          ? c.effectiveFrom
          : (c.effectiveFrom as unknown as { toDate: () => Date }).toDate(),
    }));
  }

  cachedConfig = data;
  cacheTimestamp = now;
  return cachedConfig;
}

// inputTokens includes cache tokens — this function subtracts them to get base input
export function calculateCost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  config: ModelCostsConfig;
}): number | null {
  const {
    model,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    config,
  } = params;

  const modelConfig = config.models[model];
  if (!modelConfig || modelConfig.costs.length === 0) {
    return null;
  }

  const cost = modelConfig.costs[0];

  const baseInputTokens = Math.max(
    0,
    inputTokens - cacheCreationTokens - cacheReadTokens
  );
  const inputCost = (baseInputTokens * cost.inputPerMillion) / 1_000_000;
  const cacheWriteCost =
    (cacheCreationTokens * cost.cacheWritePerMillion) / 1_000_000;
  const cacheReadCost =
    (cacheReadTokens * cost.cacheReadPerMillion) / 1_000_000;
  const outputCost = (outputTokens * cost.outputPerMillion) / 1_000_000;

  return inputCost + cacheWriteCost + cacheReadCost + outputCost;
}
