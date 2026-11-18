# opencode-ai-usage Installation Guide

> This guide is designed for LLM agents to follow step-by-step. Each step includes expected outcomes for verification.

## What is opencode-ai-usage?

An OpenCode plugin that displays AI provider usage in the terminal sidebar or a Desktop side panel. Each detected provider gets its own section with usage windows and reset times.

## Prerequisites

- [OpenCode](https://opencode.ai) installed and working
- OpenCode v1 (`@opencode-ai/plugin` >= 1.4.3) or OpenCode v2 (>= 2.0.20)
- For Desktop, use the local build described below. Desktop operation was validated on Windows with OpenCode 2.3.2; the GUI API is experimental.

## OpenCode Desktop: local checkout

The published `opencode-ai-usage@1.1.0` is TUI-only. This checkout adds Desktop support without changing the version number, so use the local directory rather than the npm package to test these changes.

1. Run `bun install` and `bun run build:gui` in the checkout. If dependencies are already installed, `npm run build:gui` also works.
2. Append a local directory entry to `plugins` in your **global** `~/.config/opencode/opencode.json(c)`. Preserve all existing entries:

   ```jsonc
   {
     "plugins": ["file:///C:/path/to/opencode-ai-usage"],
   }
   ```

3. Replace the example with your actual checkout path.
4. In a Desktop conversation, choose **AI usage** from the side panel's **+** menu or **Open AI usage** from the command palette. The panel does not open automatically.

For the terminal to use the same checkout, replace its usage-plugin package entry in global `~/.config/opencode/cli.json`:

```jsonc
{
  "plugins": [{ "package": "file:///C:/path/to/opencode-ai-usage", "options": {} }],
}
```

Preserve other plugins and existing options. Do not add a second usage entry alongside the npm entry. Desktop and terminal use different configuration files.

See the [Desktop guide](desktop.md) for the Windows fix, diagnostic boundaries, and maintainer checks.

## Step 0: Detect the OpenCode major version

Run `opencode --version`.

- Output like `1.17.13` → follow **Step 1 (OpenCode v1)**.
- Output like `opencode v2.0.20` → follow **Step 1 (OpenCode v2)**.

## Step 1 (OpenCode v2): Configure the CLI plugin

Edit `~/.config/opencode/cli.json`. Create the file if it doesn't exist. Do not edit `tui.json` on OpenCode v2; it is no longer read.

Add `{ "package": "opencode-ai-usage", "options": {} }` to the `plugins` array, appending to any existing entries:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [{ "package": "opencode-ai-usage", "options": {} }]
}
```

Skip Step 1 (OpenCode v1) and continue at **Options** to customize the plugin, or at **Step 2** to keep the defaults.

## Step 1 (OpenCode v1): Configure the TUI plugin

Edit `~/.config/opencode/tui.json`. Create the file if it doesn't exist.

Add `["opencode-ai-usage", { "enabled": true }]` to the `plugin` array:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [["opencode-ai-usage", { "enabled": true }]]
}
```

**If the file already exists with other plugins**, append to the existing array. Do not replace existing entries:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    ["existing-plugin", { "enabled": true }],
    ["opencode-ai-usage", { "enabled": true }]
  ]
}
```

## Options

All options are optional, and the option names and values are the same on OpenCode v1 and v2. Only the surrounding entry differs. Defaults shown:

**OpenCode v2** — `~/.config/opencode/cli.json`, inside the entry's `options` object:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    {
      "package": "opencode-ai-usage",
      "options": {
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
    }
  ]
}
```

**OpenCode v1** — `~/.config/opencode/tui.json`, as the second element of the plugin tuple:

```json
{
  "$schema": "https://opencode.ai/tui.json",
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

`enabled` is an OpenCode v1 plugin toggle, not a plugin option; do not add it on OpenCode v2.

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

Provider IDs currently available: `claude`, `openai`, `opencode-go`.

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

## Step 2: Apply the configuration

On OpenCode v2, configuration changes reload automatically; use `/reload` to request a full reload when needed. A local Desktop GUI also reloads when its bundle is rebuilt.

On OpenCode v1, restart OpenCode to activate.

## Verification

For the terminal, send a chat message in a session with the sidebar open. You should see detected provider sections:

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
 Monthly      resets in 29d 23h
 ━━━──────────────────────  11%
```

Only detected providers appear. If a provider's requirements are not met, its section is hidden entirely.

During initial load:

```
▼ Claude Usage
 Loading in 8s...
```

## Supported Providers

| Provider       | ID            | Requirements                                                                                 |
| -------------- | ------------- | -------------------------------------------------------------------------------------------- |
| Claude         | `claude`      | Logged in via Claude CLI, OpenCode auth, or `CLAUDE_CODE_OAUTH_TOKEN` env var                |
| OpenAI (Codex) | `openai`      | [Codex CLI](https://openai.com/codex) installed and logged in (`codex login`)                |
| OpenCode Go    | `opencode-go` | [OpenCode Go](https://opencode.ai) subscription active, connected via `/connect` in OpenCode |

## Troubleshooting

- **Plugin not showing in the terminal**: Verify the plugin entry exists in `~/.config/opencode/tui.json` (OpenCode v1) or `~/.config/opencode/cli.json` (OpenCode v2). Open a conversation with the sidebar visible. If no providers are detected, the entire usage section is hidden.
- **Desktop panel missing**: Confirm the global `opencode.json(c)` points to this checkout, `dist/gui-experimental.cjs` exists, and the GUI is enabled in **Settings > Extensions > Plugins**. Open **AI usage** from a conversation's side-panel menu. A TUI badge identifies another plugin part, not a GUI failure.
- **"No supported providers detected."**: The Desktop panel loaded, but provider detection failed. Check the requirements below before changing plugin configuration.
- **Codex missing on Windows**: Run `where.exe codex` and `codex --version`. This checkout supports the npm `.cmd` launcher by locating its native executable; the older implementation used Unix-only `which` and could hide OpenAI usage entirely.
- **Provider section missing**: That provider was not detected. Check its requirements in the table above.
- **"Loading in Ns..."**: Initial load in progress. Data appears once the provider responds.
- **"Failed to fetch usage"**: The provider's API returned an error. After a failure, all OpenCode windows wait before retrying, doubling the wait up to 15 minutes. A rate limit (HTTP 429) can pause refreshes for up to an hour.
- **Data not updating**: Default refresh intervals are 60s (Claude), 30s (OpenAI), and 60s (OpenCode Go). OpenCode windows share one cache, so only one window calls each provider per interval and the others show its result.
- **Stale data badge ("updated Xm ago")**: The provider hasn't refreshed in over twice the refresh interval, usually because of the failure backoff above or after the computer wakes from sleep. Clears on the next successful fetch.
- **Diagnosing refresh problems**: Set `"debugLog": { "enabled": true }` in the relevant plugin entry's options and apply the configuration as above. Logs are written to `~/.cache/opencode-ai-usage/debug-YYYY-MM-DD.log`. Remove private account information before sharing diagnostics.

## Uninstall

1. Remove the `opencode-ai-usage` entry from `~/.config/opencode/tui.json` (OpenCode v1) or `~/.config/opencode/cli.json` (OpenCode v2)
2. Restart OpenCode
3. Optionally delete the plugin's cache and debug logs (same path on v1 and v2): `rm -rf ~/.cache/opencode-ai-usage/`
4. Optionally delete OpenCode's downloaded copy of the package:
   - OpenCode v1: `rm -rf ~/.cache/opencode/packages/opencode-ai-usage@*`
   - OpenCode v2: `rm -rf ~/.cache/opencode/npm/opencode-ai-usage@*`

   Do not delete `~/.cache/opencode/` itself; it also holds other plugins and model data.
