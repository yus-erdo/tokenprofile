#!/bin/bash
# Token Profile Claude Code Stop Hook
# Usage: Add to ~/.claude/settings.json under hooks.Stop
#
# Reads session data from stdin JSON (session_id, transcript_path, cwd)
# Parses transcript for token usage and sends to Token Profile API

TOKEN_PROFILE_API_KEY="${TOKEN_PROFILE_API_KEY:-}"
TOKEN_PROFILE_URL="${TOKEN_PROFILE_URL:-https://www.tokenprofile.app}"

if [ -z "$TOKEN_PROFILE_API_KEY" ]; then
  exit 0
fi

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT=$(basename "$CWD" 2>/dev/null || echo "unknown")

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

TOTAL_INPUT=0
TOTAL_OUTPUT=0
MODEL=""
NUM_TURNS=0

while IFS= read -r line; do
  m=$(echo "$line" | jq -r '.model // empty' 2>/dev/null)
  if [ -n "$m" ]; then MODEL="$m"; fi

  input=$(echo "$line" | jq -r '.usage.input_tokens // 0' 2>/dev/null)
  output=$(echo "$line" | jq -r '.usage.output_tokens // 0' 2>/dev/null)
  TOTAL_INPUT=$((TOTAL_INPUT + input))
  TOTAL_OUTPUT=$((TOTAL_OUTPUT + output))

  role=$(echo "$line" | jq -r '.role // empty' 2>/dev/null)
  if [ "$role" = "assistant" ]; then NUM_TURNS=$((NUM_TURNS + 1)); fi
done < "$TRANSCRIPT_PATH"

TOTAL_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT))

if [ "$TOTAL_TOKENS" -eq 0 ]; then exit 0; fi

curl -s -X POST "$TOKEN_PROFILE_URL/api/ingest" \
  -H "Authorization: Bearer $TOKEN_PROFILE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg provider "anthropic" \
    --arg model "$MODEL" \
    --argjson input_tokens "$TOTAL_INPUT" \
    --argjson output_tokens "$TOTAL_OUTPUT" \
    --argjson total_tokens "$TOTAL_TOKENS" \
    --arg project "$PROJECT" \
    --argjson num_turns "$NUM_TURNS" \
    --arg session_id "$SESSION_ID" \
    '{provider:$provider,model:$model,input_tokens:$input_tokens,output_tokens:$output_tokens,total_tokens:$total_tokens,project:$project,num_turns:$num_turns,session_id:$session_id}'
  )" > /dev/null 2>&1 &
