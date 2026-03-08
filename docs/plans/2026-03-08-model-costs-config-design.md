# System Config: Model Token Costs

## Problem

Cost calculation is currently client-side (hook script), but the hook doesn't actually calculate cost — it sends token counts only. We need server-side cost calculation using configurable model pricing stored in Firestore.

## Design

### Firestore Structure

Single document at `config/modelCosts`:

```typescript
{
  models: {
    "claude-opus-4-6": {
      displayName: "Claude Opus 4.6",
      provider: "anthropic",
      costs: [
        {
          inputPerMillion: 5,
          outputPerMillion: 25,
          cacheWritePerMillion: 6.25,
          cacheReadPerMillion: 0.50,
          effectiveFrom: Timestamp("2025-06-01")
        }
      ]
    },
    // ... more models
  }
}
```

The `costs` array is sorted by `effectiveFrom` descending. Ingest picks the latest entry. Historical entries remain for potential re-calculation.

### Ingest Endpoint Changes

New optional request fields:
- `cache_creation_tokens` (default 0)
- `cache_read_tokens` (default 0)

Cost calculation:
```
baseInputTokens = input_tokens - cache_creation_tokens - cache_read_tokens
inputCost = baseInputTokens * inputPerMillion / 1_000_000
cacheWriteCost = cache_creation_tokens * cacheWritePerMillion / 1_000_000
cacheReadCost = cache_read_tokens * cacheReadPerMillion / 1_000_000
outputCost = output_tokens * outputPerMillion / 1_000_000
costUsd = inputCost + cacheWriteCost + cacheReadCost + outputCost
```

Backward compatibility:
- Missing cache fields → all input_tokens priced at base rate
- Unknown model → fall back to client-provided `cost_usd` (or 0)
- Client `cost_usd` ignored when server can calculate

### Config Caching

In-memory cache with 5-minute TTL. Module-level variable in the config helper. Avoids Firestore read on every ingest request.

### Hook Script Changes

- Send `cache_creation_tokens` and `cache_read_tokens` as separate fields
- `input_tokens` = base input only (not including cache tokens)
- Remove `cost_usd` from payload

### Seed Script

One-time script to populate `config/modelCosts` with current Anthropic pricing (7 models).

## Models to Seed

| Model ID | Input/MTok | Output/MTok | Cache Write/MTok | Cache Read/MTok |
|----------|-----------|-------------|-----------------|-----------------|
| claude-opus-4-6 | $5 | $25 | $6.25 | $0.50 |
| claude-opus-4-5 | $5 | $25 | $6.25 | $0.50 |
| claude-sonnet-4-6 | $3 | $15 | $3.75 | $0.30 |
| claude-sonnet-4-5 | $3 | $15 | $3.75 | $0.30 |
| claude-sonnet-4 | $3 | $15 | $3.75 | $0.30 |
| claude-haiku-4-5 | $1 | $5 | $1.25 | $0.10 |
| claude-haiku-3-5 | $0.80 | $4 | $1.00 | $0.08 |
