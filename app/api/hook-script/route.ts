import { NextResponse } from "next/server";

const SCRIPT = `#!/bin/bash
set -e

API_KEY="\${1:?Usage: curl ... | bash -s -- YOUR_API_KEY}"

HOOK_DIR="$HOME/.tokenprofile"
HOOK_SCRIPT="$HOOK_DIR/hook.sh"

echo "Installing Token Profile hook..."

# 1. Create hook directory
mkdir -p "$HOOK_DIR"

# 2. Download hook script
curl -fsSL "https://tokenprofile.app/scripts/tokenprofile-hook.sh" -o "$HOOK_SCRIPT"
chmod +x "$HOOK_SCRIPT"

# 3. Add API key to shell config
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
  SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
  SHELL_CONFIG="$HOME/.bash_profile"
else
  SHELL_CONFIG="$HOME/.profile"
fi

if ! grep -q "TOKEN_PROFILE_API_KEY" "$SHELL_CONFIG" 2>/dev/null; then
  printf '\\nexport TOKEN_PROFILE_API_KEY="%s"\\n' "$API_KEY" >> "$SHELL_CONFIG"
  echo "Added API key to $SHELL_CONFIG"
else
  echo "TOKEN_PROFILE_API_KEY already set in $SHELL_CONFIG"
fi

CONFIGURED=""

# 4. Configure Claude Code (if installed)
if [ -d "$HOME/.claude" ]; then
  SETTINGS_FILE="$HOME/.claude/settings.json"

  # Clean up old hook location if present
  OLD_HOOK="$HOME/.claude/hooks/tokenprofile-hook.sh"
  if [ -f "$OLD_HOOK" ]; then
    rm -f "$OLD_HOOK"
    echo "Cleaned up old hook at $OLD_HOOK"
  fi

  if [ -f "$SETTINGS_FILE" ]; then
    if command -v jq &>/dev/null; then
      HOOK_ENTRY='{"matcher":"","hooks":[{"type":"command","command":"bash '"$HOOK_SCRIPT"'","async":true}]}'
      UPDATED=$(jq --argjson hook "[$HOOK_ENTRY]" '
        .hooks.Stop = ((.hooks.Stop // []) + $hook | unique_by(.hooks[0].command))
      ' "$SETTINGS_FILE")
      echo "$UPDATED" > "$SETTINGS_FILE"
      echo "Updated $SETTINGS_FILE"
    else
      echo "Warning: jq not found. Please manually add the hook to $SETTINGS_FILE"
    fi
  else
    mkdir -p "$(dirname "$SETTINGS_FILE")"
    cat > "$SETTINGS_FILE" << SETTINGS_EOF
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash $HOOK_SCRIPT",
            "async": true
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF
    echo "Created $SETTINGS_FILE"
  fi
  CONFIGURED="\${CONFIGURED}Claude Code, "
fi

# 5. Configure Cursor (if installed)
if [ -d "$HOME/.cursor" ]; then
  CURSOR_HOOKS="$HOME/.cursor/hooks.json"
  NEW_HOOK='{"command":"/bin/bash","args":["'"$HOOK_SCRIPT"'"]}'

  if [ -f "$CURSOR_HOOKS" ] && command -v jq &>/dev/null; then
    # Merge into existing hooks.json
    UPDATED=$(jq --argjson hook "[$NEW_HOOK]" '
      .hooks.stop = ((.hooks.stop // []) + $hook | unique_by(.args[0]))
    ' "$CURSOR_HOOKS")
    echo "$UPDATED" > "$CURSOR_HOOKS"
    echo "Updated $CURSOR_HOOKS"
  else
    cat > "$CURSOR_HOOKS" << CURSOR_EOF
{
  "version": 1,
  "hooks": {
    "stop": [
      {
        "command": "/bin/bash",
        "args": ["$HOOK_SCRIPT"]
      }
    ]
  }
}
CURSOR_EOF
    echo "Created $CURSOR_HOOKS"
  fi
  CONFIGURED="\${CONFIGURED}Cursor, "
fi

echo ""
if [ -n "$CONFIGURED" ]; then
  # Trim trailing comma and space
  CONFIGURED=\$(echo "$CONFIGURED" | sed 's/, $//')
  echo "Done! Token Profile hook installed for: $CONFIGURED"
else
  echo "Done! Hook script installed at $HOOK_SCRIPT"
  echo "Note: Neither ~/.claude nor ~/.cursor directories found."
  echo "The hook will be configured automatically when you install Claude Code or Cursor."
fi
echo "Run a completion in your AI tool to verify it's working."
`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache",
    },
  });
}
