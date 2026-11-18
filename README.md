# opencode-ai-usage

An [OpenCode](https://opencode.ai) plugin that displays AI provider usage in the terminal sidebar or a Desktop side panel.

**Mixed mode** (default):

```
▼ Claude Usage
 admin@example.com
 Session       resets in 3h 16m
 ━━━━━━━━─────────────────  31%
 Weekly         resets in 4d 5h
 ━━━──────────────────────  11%

▼ OpenAI Usage
 user@example.com
 Session        resets in 1h 42m
 ━━━━━━━━━━━━━━────────────  46%
 Weekly          resets in 2d 9h
 ━━━━━━────────────────────  22%
```

## Supported subscriptions

- Claude
- OpenAI (Codex)
- OpenCode Go

## Install

Paste below into your OpenCode.

```
Install and configure opencode-ai-usage by following the instructions here:
https://raw.githubusercontent.com/stevejkang/opencode-ai-usage/refs/heads/main/docs/installation.md
```

### OpenCode Desktop: try the local build

Validated on Windows with OpenCode Desktop 2.3.2 and Codex CLI 0.167.2. The GUI uses an experimental SDK; see the [Desktop guide](docs/desktop.md) for architecture, troubleshooting, and verification.

From this checkout, run `bun install` and `bun run build:gui`. In your **global** `~/.config/opencode/opencode.json(c)`, add the repository directory to `plugins` without removing existing entries:

```jsonc
{
  "plugins": ["file:///C:/path/to/opencode-ai-usage"],
}
```

Use your checkout's actual path (for example, `/path/to/opencode-ai-usage` on macOS or Linux). Open a Desktop session and select **AI usage** from the side panel's **+** menu, or **Open AI usage** from the command palette. If the panel is missing, check **Settings > Extensions > Plugins** and make sure `dist/gui-experimental.cjs` was built. The Desktop entry uses an experimental API; it is separate from the terminal entry in `cli.json`.

Desktop uses the same supported providers and respects `disabledProviders`, `showRemaining`, provider refresh intervals, and debug logging. `displayMode` and header colors apply only to the terminal.

On Windows, Codex detection uses `where.exe` and starts the native executable, including when Codex was installed through npm. An OpenCode model connection alone does not provide usage data: the Codex CLI must be installed and signed in for OpenAI usage.

### Manual setup

The same package works on OpenCode v1 and OpenCode v2. Only the config file differs.

**OpenCode v1** — `~/.config/opencode/tui.json`

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [["opencode-ai-usage", { "enabled": true }]]
}
```

**OpenCode v2** — `~/.config/opencode/cli.json`

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [{ "package": "opencode-ai-usage", "options": {} }]
}
```

### Local path

OpenCode v1:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [["./path/to/opencode-ai-usage/src/tui.tsx", { "enabled": true }]]
}
```

OpenCode v2 (points at the repository directory, which exposes a root `tui.ts`):

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [{ "package": "/path/to/opencode-ai-usage", "options": {} }]
}
```

## Options

Shown in OpenCode v1 form. On OpenCode v2, put the same object under `options` of the `cli.json` entry.

```json
{
  "plugin": [
    [
      "opencode-ai-usage",
      {
        "enabled": true,
        "disabledProviders": [],
        "displayMode": "mixed",
        "showRemaining": false,
        "debugLog": { "enabled": false, "retentionDays": 7, "maxFileSizeMB": 10 },
        "providers": {
          "claude": { "refreshInterval": 60, "headerColor": "#E07A3A" },
          "openai": { "refreshInterval": 30, "headerColor": "#10A37F" },
          "opencode-go": { "refreshInterval": 60, "headerColor": "#FDFCFC" }
        }
      }
    ]
  ]
}
```

| Option                           | Default   | Description                                                                         |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| `disabledProviders`              | `[]`      | Provider IDs to skip entirely, e.g. `["openai"]`                                    |
| `displayMode`                    | `"mixed"` | `"mixed"`, `"text"`, or `"bar"` (see below)                                         |
| `showRemaining`                  | `false`   | Show remaining capacity instead of used (see below)                                 |
| `debugLog.enabled`               | `false`   | Write diagnostic JSONL logs to `~/.cache/opencode-ai-usage/debug-YYYY-MM-DD.log`    |
| `debugLog.retentionDays`         | `7`       | Delete debug log files not written to for this many days                            |
| `debugLog.maxFileSizeMB`         | `10`      | Move a day's log file aside once it reaches this size                               |
| `providers.<id>.refreshInterval` |           | Seconds between data refreshes (claude: `60`, openai: `30`, opencode-go: `60`)      |
| `providers.<id>.headerColor`     |           | Section header color (claude: `#E07A3A`, openai: `#10A37F`, opencode-go: `#FDFCFC`) |

Provider IDs currently available: `claude`, `openai`, `opencode-go`. Use these in `disabledProviders` and as keys under `providers`.

### `displayMode`

**Text mode** (`"displayMode": "text"`):

```
▼ Claude Usage
 admin@example.com
 Session      31%  resets in 3h 16m
 Weekly       11%  resets in 4d 5h
```

**Bar mode** (`"displayMode": "bar"`):

```
▼ Claude Usage
 admin@example.com
 Session  █████░░░░░░░░░  31% (3h 16m)
 Weekly   ██░░░░░░░░░░░░  11% (4d 5h)
```

### `showRemaining`

By default, bars and percentages track how much of a window you've _used_. Setting `showRemaining: true` flips the math: bars fill with what's left, and the percentage shown is `100 - used%`. Color grading flips with it, going from a calm default toward warning and danger colors as the remaining amount shrinks, rather than as usage grows.

## Providers

| Provider       | ID            | Detection                                                                         | Requirements                                                                                 |
| -------------- | ------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Claude         | `claude`      | OAuth token from any of: env var, credentials file, OpenCode auth, macOS Keychain | Logged in via Claude CLI, OpenCode auth, or `CLAUDE_CODE_OAUTH_TOKEN` env var                |
| OpenAI (Codex) | `openai`      | Codex CLI binary in PATH                                                          | [Codex CLI](https://openai.com/codex) installed and logged in (`codex login`)                |
| OpenCode Go    | `opencode-go` | API key from `~/.local/share/opencode/auth.json` or `OPENCODE_API_KEY` env var    | [OpenCode Go](https://opencode.ai) subscription active, connected via `/connect` in OpenCode |

Providers are detected automatically on startup. If a provider's requirements are not met, its section is hidden entirely.

## Requirements

- [OpenCode](https://opencode.ai) v1 with plugin support (`@opencode-ai/plugin` >= 1.4.3), or OpenCode v2 (`@opencode/plugin` >= 2.0.20)

## Development

```bash
git clone https://github.com/stevejkang/opencode-ai-usage.git
cd opencode-ai-usage
bun install
```

```bash
bun run test
bun run typecheck
bun run lint
bun run format
```

## License

MIT
