# Testing Infrastructure

## Running Tests

```bash
bun run test                           # all tests (uses vitest)
bun run test test/hook-script.test.ts  # just hook script
bun run test test/installer.test.ts    # just installer
bun run test test/ingest-route.test.ts # just API route
```

**Important**: Use `bun run test` (vitest), NOT `bun test` (bun's built-in runner). The `vi.mock` API in ingest-route tests requires vitest.

## File Structure

```
test/
  fixtures/
    envelopes/          # JSON stdin payloads for hook script
      claude-code.json, claude-code-no-transcript.json, cursor.json, cursor-with-transcript.json
    transcripts/        # JSONL transcript files
      claude-code.jsonl (2 turns), claude-code-zero.jsonl (all zeros), claude-code-single.jsonl, cursor.jsonl
    expected/           # Expected POST bodies for assertions
      claude-code-payload.json, cursor-payload.json
  helpers/
    mock-server.ts      # http.createServer on port 0, captures POSTs, serves hook script for installer
    run-hook.ts         # Spawns scripts/tokenprofile-hook.sh with env/stdin/temp files
    run-installer.ts    # Runs installer in sandboxed $HOME (temp dir)
  hook-script.test.ts   # 8 tests — validates bash hook script pipeline
  installer.test.ts     # 8 tests — validates installer script from hook-script route
  ingest-route.test.ts  # 7 tests — validates /api/ingest POST handler
```

## How Each Test Suite Works

### hook-script.test.ts
- Requires `jq` on PATH (skips if missing)
- Starts a mock HTTP server in `beforeAll`, stops in `afterAll`
- Uses `run-hook.ts` helper which:
  1. Copies transcript fixture to a temp file
  2. Replaces `PLACEHOLDER` in envelope with real temp path
  3. Spawns `bash scripts/tokenprofile-hook.sh` with controlled env vars
  4. Pipes modified envelope to stdin
  5. Returns exit code, stdout, stderr
- Asserts against captured POST body on mock server

### installer.test.ts
- Extracts the installer bash script from `app/api/hook-script/route.ts` (the SCRIPT constant)
- Uses `run-installer.ts` helper which:
  1. Creates a temp dir as sandboxed `$HOME`
  2. Pre-populates dirs/files (e.g., `.claude/`, `.cursor/`, `.zshrc`)
  3. `sed`-replaces the download URL to point at the mock server
  4. Runs the installer bash with `HOME` overridden
  5. Returns helpers to read files and check existence in the sandboxed HOME
- Each test cleans up its temp HOME in a `finally` block
- For idempotent test: uses `existingHomeDir` option to run installer twice in same HOME

### ingest-route.test.ts
- Pure TypeScript unit tests — no HTTP server needed
- Calls `POST(new Request(...))` directly from the route module
- Mocks with `vi.mock`:
  - `@/lib/firebase/admin` → in-memory collection/add/where stubs
  - `@/lib/firebase/model-costs` → returns empty config
  - `@/lib/rate-limit` → returns `{ success: true }` by default
- Tests auth, validation, rate limiting, and source defaulting

## Adding Tests for a New AI Tool

1. Add envelope fixture in `test/fixtures/envelopes/<tool>.json`
2. Add transcript fixture in `test/fixtures/transcripts/<tool>.jsonl` (if applicable)
3. Add expected payload in `test/fixtures/expected/<tool>-payload.json`
4. Add test cases in `hook-script.test.ts` following the Cursor pattern
5. Add installer test in `installer.test.ts` if the tool has its own config format

## Fixture Format Notes

- Envelope `transcript_path` uses literal string `"PLACEHOLDER"` — replaced at runtime with temp file path
- Claude Code transcripts: JSONL with `.type == "assistant"` and `.message.usage.*`
- Cursor transcripts: JSONL with `.role` and `.content` fields
- Token math for Claude Code: `input_tokens` in the payload = base input + cache_creation + cache_read (the hook script adds them)
