#!/bin/bash
# Token Profile Claude Code Hook
# Posts completion token usage to Token Profile API on Stop event
#
# Env vars:
#   TOKEN_PROFILE_API_KEY - required, get from tokenprofile.app/settings
#   TOKEN_PROFILE_URL     - optional, defaults to https://www.tokenprofile.app

# Try loading env var from shell config if not already set
if [ -z "$TOKEN_PROFILE_API_KEY" ]; then
  for f in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.zshrc" "$HOME/.profile"; do
    [ -f "$f" ] || continue
    TOKEN_PROFILE_API_KEY=$(sed -n 's/.*TOKEN_PROFILE_API_KEY="\([^"]*\)".*/\1/p' "$f" 2>/dev/null | tail -1)
    [ -n "$TOKEN_PROFILE_API_KEY" ] && break
  done
fi

if [ -z "$TOKEN_PROFILE_API_KEY" ]; then exit 0; fi

TOKEN_PROFILE_URL="${TOKEN_PROFILE_URL:-https://tokenprofile.app}"

INPUT=$(cat)
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

TOTAL_INPUT=$(echo "$STATS" | jq '.input_tokens + .cache_creation + .cache_read')
TOTAL_OUTPUT=$(echo "$STATS" | jq '.output_tokens')
TOTAL_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT))
[ "$TOTAL_TOKENS" -eq 0 ] && exit 0

MODEL=$(echo "$STATS" | jq -r '.model')
NUM_TURNS=$(echo "$STATS" | jq '.num_turns')

PAYLOAD=$(jq -n \
  --arg event "Stop" \
  --arg provider "anthropic" \
  --arg model "$MODEL" \
  --argjson input_tokens "$TOTAL_INPUT" \
  --argjson output_tokens "$TOTAL_OUTPUT" \
  --argjson total_tokens "$TOTAL_TOKENS" \
  --arg project "$PROJECT" \
  --argjson num_turns "$NUM_TURNS" \
  '{event:$event,provider:$provider,model:$model,input_tokens:$input_tokens,output_tokens:$output_tokens,total_tokens:$total_tokens,project:$project,num_turns:$num_turns}')

curl -s --max-time 10 -X POST "$TOKEN_PROFILE_URL/api/ingest" \
  -H "Authorization: Bearer $TOKEN_PROFILE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" > /dev/null 2>&1

exit 0
