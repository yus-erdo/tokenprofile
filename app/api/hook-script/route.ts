import { NextResponse } from "next/server";

const SCRIPT = `#!/bin/bash
set -e

API_KEY="\${1:-}"

if [ -z "$API_KEY" ]; then
  if [ -t 0 ] || [ -t 2 ]; then
    echo ""
    echo "  Welcome to toqqen!"
    echo "  Get your API key at: https://toqqen.dev/settings"
    echo ""
    printf "  Enter your API key: " >&2
    read -r API_KEY < /dev/tty
    echo ""
  fi
  if [ -z "$API_KEY" ]; then
    echo "Error: API key is required." >&2
    echo "Usage: curl -fsSL toqqen.dev/install | bash -s -- YOUR_API_KEY" >&2
    exit 1
  fi
fi

HOOK_DIR="$HOME/.toqqen"
HOOK_SCRIPT="$HOOK_DIR/hook.sh"

echo "Installing Toqqen hook..."

# 1. Create hook directory
mkdir -p "$HOOK_DIR"

# 2. Download hook script
curl -fsSL "https://toqqen.dev/scripts/toqqen-hook.sh" -o "$HOOK_SCRIPT"
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

if ! grep -q "TOQQEN_API_KEY" "$SHELL_CONFIG" 2>/dev/null; then
  printf '\\nexport TOQQEN_API_KEY="%s"\\n' "$API_KEY" >> "$SHELL_CONFIG"
  echo "Added API key to $SHELL_CONFIG"
else
  sed -i.bak 's|export TOQQEN_API_KEY="[^"]*"|export TOQQEN_API_KEY="'"$API_KEY"'"|' "$SHELL_CONFIG"
  rm -f "\${SHELL_CONFIG}.bak"
  echo "Updated API key in $SHELL_CONFIG"
fi

CONFIGURED=""

# 4. Configure Claude Code (if installed)
if [ -d "$HOME/.claude" ]; then
  SETTINGS_FILE="$HOME/.claude/settings.json"

  # Clean up old hook location if present
  OLD_HOOK="$HOME/.claude/hooks/toqqen-hook.sh"
  if [ -f "$OLD_HOOK" ]; then
    rm -f "$OLD_HOOK"
    echo "Cleaned up old hook at $OLD_HOOK"
  fi

  if [ -f "$SETTINGS_FILE" ]; then
    if grep -q "bash $HOOK_SCRIPT" "$SETTINGS_FILE" 2>/dev/null; then
      echo "Hook already configured in $SETTINGS_FILE"
    elif command -v jq &>/dev/null; then
      HOOK_ENTRY='{"matcher":"","hooks":[{"type":"command","command":"bash '"$HOOK_SCRIPT"'","async":true}]}'
      UPDATED=$(jq --argjson hook "[$HOOK_ENTRY]" '
        .hooks.Stop = ((.hooks.Stop // []) + $hook | unique_by(.hooks[0].command))
      ' "$SETTINGS_FILE")
      TMP_FILE=$(mktemp "$SETTINGS_FILE.XXXXXX")
      echo "$UPDATED" > "$TMP_FILE" && mv "$TMP_FILE" "$SETTINGS_FILE"
      echo "Updated $SETTINGS_FILE"
    elif command -v python3 &>/dev/null; then
      python3 -c "
import json, sys
with open(sys.argv[1]) as f: data = json.load(f)
hook = {'matcher':'','hooks':[{'type':'command','command':'bash '+sys.argv[2],'async':True}]}
stops = data.setdefault('hooks',{}).setdefault('Stop',[])
if not any(h.get('hooks',[{}])[0].get('command','').endswith('hook.sh') for h in stops):
    stops.append(hook)
with open(sys.argv[1],'w') as f: json.dump(data, f, indent=2)
" "$SETTINGS_FILE" "$HOOK_SCRIPT"
      echo "Updated $SETTINGS_FILE"
    else
      echo "Warning: Neither jq nor python3 found. Please manually add the hook to $SETTINGS_FILE"
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

  if [ -f "$CURSOR_HOOKS" ] && grep -q "$HOOK_SCRIPT" "$CURSOR_HOOKS" 2>/dev/null; then
    echo "Hook already configured in $CURSOR_HOOKS"
  elif [ -f "$CURSOR_HOOKS" ]; then
    if command -v jq &>/dev/null; then
      UPDATED=$(jq --argjson hook "[$NEW_HOOK]" '
        .hooks.stop = ((.hooks.stop // []) + $hook | unique_by(.args[0]))
      ' "$CURSOR_HOOKS")
      TMP_FILE=$(mktemp "$CURSOR_HOOKS.XXXXXX")
      echo "$UPDATED" > "$TMP_FILE" && mv "$TMP_FILE" "$CURSOR_HOOKS"
      echo "Updated $CURSOR_HOOKS"
    elif command -v python3 &>/dev/null; then
      python3 -c "
import json, sys
with open(sys.argv[1]) as f: data = json.load(f)
hook = {'command':'/bin/bash','args':[sys.argv[2]]}
stops = data.setdefault('hooks',{}).setdefault('stop',[])
if not any(sys.argv[2] in h.get('args',[]) for h in stops):
    stops.append(hook)
with open(sys.argv[1],'w') as f: json.dump(data, f, indent=2)
" "$CURSOR_HOOKS" "$HOOK_SCRIPT"
      echo "Updated $CURSOR_HOOKS"
    else
      echo "Warning: Neither jq nor python3 found. Please manually add the hook to $CURSOR_HOOKS"
    fi
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
  echo "Done! Toqqen hook installed for: $CONFIGURED"
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
