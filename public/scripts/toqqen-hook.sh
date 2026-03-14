#!/bin/bash
# Toqqen Hook (Claude Code + Cursor)
# Posts completion token usage to Toqqen API on Stop event
#
# Supported tools:
#   - Claude Code: reads transcript for token usage data
#   - Cursor: captures model and session info (no token data available)
#
# Env vars:
#   TOQQEN_API_KEY   - required, get from toqqen.app/settings
#   TOQQEN_URL       - optional, defaults to https://www.toqqen.app
#   TOQQEN_DEBUG     - set to 1 to log raw input, parsed stats, payload, and server response to /tmp/toqqen-debug/

# Try loading env var from shell config if not already set
if [ -z "$TOQQEN_API_KEY" ]; then
  for f in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.zshrc" "$HOME/.profile"; do
    [ -f "$f" ] || continue
    TOQQEN_API_KEY=$(sed -n 's/.*TOQQEN_API_KEY="\([^"]*\)".*/\1/p' "$f" 2>/dev/null | tail -1)
    [ -n "$TOQQEN_API_KEY" ] && break
  done
fi

if [ -z "$TOQQEN_API_KEY" ]; then exit 0; fi

TOQQEN_URL="${TOQQEN_URL:-https://toqqen.app}"

DEBUG="${TOQQEN_DEBUG:-0}"
DEBUG_DIR="/tmp/toqqen-debug"

if [ "$DEBUG" = "1" ]; then
  mkdir -p "$DEBUG_DIR"
  LOG="$DEBUG_DIR/$(date +%Y%m%d-%H%M%S).log"
  debug_log() { echo "[$(date +%H:%M:%S)] $*" >> "$LOG"; }
  debug_json() { echo "[$(date +%H:%M:%S)] $1:" >> "$LOG"; echo "$2" >> "$LOG"; }
else
  debug_log() { :; }
  debug_json() { :; }
fi

INPUT=$(cat)
debug_json "stdin" "$INPUT"

# Detect source: Cursor sends hook_event_name, Claude Code does not
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')

if [ -n "$HOOK_EVENT" ]; then
  # ---- CURSOR PATH ----
  SOURCE="cursor"
  MODEL=$(echo "$INPUT" | jq -r '.model // "unknown"')
  CWD=$(echo "$INPUT" | jq -r '.workspace_roots[0] // empty')
  PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")
  CONVERSATION_ID=$(echo "$INPUT" | jq -r '.conversation_id // empty')

  # Cursor transcript doesn't have token usage data
  # Count turns from transcript if available
  TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
  if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    NUM_TURNS=$(jq -s '[.[] | select(.role == "assistant")] | length' "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)
  else
    NUM_TURNS=0
  fi

  TOTAL_INPUT=0; TOTAL_OUTPUT=0; TOTAL_TOKENS=0
  CACHE_CREATION=0; CACHE_READ=0

  debug_log "source=cursor model=$MODEL project=$PROJECT turns=$NUM_TURNS conversation=$CONVERSATION_ID"
else
  # ---- CLAUDE CODE PATH ----
  SOURCE="claude-code"
  TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
  PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then exit 0; fi

  # Parse transcript — nested under .message.model and .message.usage
  STATS=$(jq -s '
    [.[] | select(.type == "assistant")] |
    {
      model: (map(.message.model // empty) | last // "unknown"),
      input_tokens: (map(.message.usage.input_tokens // 0) | add // 0),
      output_tokens: (map(.message.usage.output_tokens // 0) | add // 0),
      cache_creation: (map(.message.usage.cache_creation_input_tokens // 0) | add // 0),
      cache_read: (map(.message.usage.cache_read_input_tokens // 0) | add // 0),
      num_turns: length
    }
  ' "$TRANSCRIPT_PATH" 2>/dev/null)

  [ -z "$STATS" ] && exit 0
  debug_json "Parsed stats" "$STATS"

  INPUT_TOKENS=$(echo "$STATS" | jq '.input_tokens')
  CACHE_CREATION=$(echo "$STATS" | jq '.cache_creation')
  CACHE_READ=$(echo "$STATS" | jq '.cache_read')
  TOTAL_INPUT=$((INPUT_TOKENS + CACHE_CREATION + CACHE_READ))
  TOTAL_OUTPUT=$(echo "$STATS" | jq '.output_tokens')
  TOTAL_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT))
  [ "$TOTAL_TOKENS" -eq 0 ] && exit 0

  MODEL=$(echo "$STATS" | jq -r '.model')
  NUM_TURNS=$(echo "$STATS" | jq '.num_turns')
  debug_log "source=claude-code input=$TOTAL_INPUT output=$TOTAL_OUTPUT total=$TOTAL_TOKENS model=$MODEL turns=$NUM_TURNS"
fi

PAYLOAD=$(jq -n \
  --arg event "Stop" \
  --arg source "$SOURCE" \
  --arg provider "anthropic" \
  --arg model "$MODEL" \
  --argjson input_tokens "$TOTAL_INPUT" \
  --argjson output_tokens "$TOTAL_OUTPUT" \
  --argjson total_tokens "$TOTAL_TOKENS" \
  --argjson cache_creation_tokens "$CACHE_CREATION" \
  --argjson cache_read_tokens "$CACHE_READ" \
  --arg project "$PROJECT" \
  --argjson num_turns "$NUM_TURNS" \
  '{event:$event,source:$source,provider:$provider,model:$model,input_tokens:$input_tokens,output_tokens:$output_tokens,total_tokens:$total_tokens,cache_creation_tokens:$cache_creation_tokens,cache_read_tokens:$cache_read_tokens,project:$project,num_turns:$num_turns}')
debug_json "Payload" "$PAYLOAD"

if [ "$DEBUG" = "1" ]; then
  RESPONSE=$(curl -s --max-time 10 -w "\n%{http_code}" -X POST "$TOQQEN_URL/api/ingest" \
    -H "Authorization: Bearer $TOQQEN_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  debug_log "HTTP status: $HTTP_CODE"
  debug_json "Server response" "$BODY"
  debug_log "Debug log: $LOG"
  echo "toqqen: debug log at $LOG" >&2
else
  curl -s --max-time 10 -X POST "$TOQQEN_URL/api/ingest" \
    -H "Authorization: Bearer $TOQQEN_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /dev/null 2>&1
fi

exit 0
