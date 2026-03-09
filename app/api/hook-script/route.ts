import { NextResponse } from "next/server";

const SCRIPT = `#!/bin/bash
set -e

API_KEY="\${1:?Usage: curl ... | bash -s -- YOUR_API_KEY}"

HOOK_DIR="$HOME/.claude/hooks"
SETTINGS_FILE="$HOME/.claude/settings.json"
HOOK_SCRIPT="$HOOK_DIR/tokenprofile-hook.sh"

echo "Installing Token Profile hook..."

# 1. Create hooks directory
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

# 4. Configure Claude Code settings
if [ -f "$SETTINGS_FILE" ]; then
  # Merge hook into existing settings using jq if available, otherwise warn
  if command -v jq &>/dev/null; then
    HOOK_ENTRY='{"matcher":"","hooks":[{"type":"command","command":"bash '"$HOOK_SCRIPT"'","async":true}]}'
    UPDATED=$(jq --argjson hook "[$HOOK_ENTRY]" '
      .hooks.Stop = ((.hooks.Stop // []) + $hook | unique_by(.hooks[0].command))
    ' "$SETTINGS_FILE")
    echo "$UPDATED" > "$SETTINGS_FILE"
    echo "Updated $SETTINGS_FILE"
  else
    echo "Warning: jq not found. Please manually add the hook to $SETTINGS_FILE"
    echo "See: https://tokenprofile.app -> Developer tab for manual setup instructions"
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

echo ""
echo "Done! Token Profile hook installed."
echo "Run a Claude Code completion to verify it's working."
`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache",
    },
  });
}
