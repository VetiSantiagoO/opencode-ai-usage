# Desktop usage panel and Windows Codex support

The local plugin provides an **AI usage** Desktop panel alongside the existing terminal sidebar. Visible operation was confirmed on Windows with OpenCode 2.3.2 and Codex CLI 0.167.2.

## Install and open

Follow the [local installation steps](installation.md#opencode-desktop-local-checkout). Build with `bun run build:gui` or, with dependencies already installed, `npm run build:gui`.

Desktop loads `./gui-experimental` from the package exports. It must point to the prebuilt `dist/gui-experimental.cjs`, not a TypeScript source file. Configure the checkout in global `opencode.json(c)`; configure the same checkout separately in `cli.json` for the terminal.

In a conversation, open **AI usage** from the side-panel **+** menu or **Open AI usage** from the command palette. The command is unavailable without an active session.

## Implementation boundaries

| Component                         | Responsibility                                                       |
| --------------------------------- | -------------------------------------------------------------------- |
| `src/usage-runtime.ts`            | Existing shared provider detection, refresh, cache, and cancellation |
| `src/gui.tsx` main setup          | One Desktop runtime and a schema-validated, read-only IPC snapshot   |
| `src/gui.tsx` window setup        | Solid panel, palette command, and side-panel launcher                |
| `src/providers/openai/command.ts` | Shared native Codex executable resolution for detection and fetch    |
| `vite.config.ts`                  | SDK preset producing one CommonJS GUI bundle                         |
| `package.json`                    | Separate TUI/GUI exports and a prepack GUI build                     |

The GUI derives its IPC namespace from `ctx.id` in both processes. A local checkout can have a path-based identity, so hardcoding the npm name is not safe.

The Desktop snapshot excludes account email, credentials, raw provider errors, and provider extras. Window labels use a fixed allowlist; unknown labels become `Usage window`. Reconnection state crosses IPC as a boolean and renders fixed text. Disposing the plugin stops its runtime.

`disabledProviders`, `showRemaining`, refresh intervals, and debug logging apply to Desktop. Terminal display modes and header colors do not.

## Why Windows showed no providers

The old OpenAI provider ran `which codex` in both detection and fetch. Windows could have a working Codex installation while lacking `which`. Detection then returned unavailable, the Desktop panel showed `No supported providers detected.`, and the terminal rendered no usage section if no other providers were detected.

The resolver now:

1. Keeps the existing `which` path on Linux and macOS.
2. Uses `where.exe codex` on Windows and prefers a native `.exe`.
3. Resolves an npm `.cmd` installation through Codex's package and architecture-specific vendor directory.
4. Passes the native executable directly to `execFile` and `spawn`, without a shell.

Windows x64 and arm64 resolution are covered. A missing native binary fails without starting a subprocess. Codex still needs to be signed in; connecting an OpenCode model does not itself supply Codex subscription usage.

## Verification

Run from the checkout:

```sh
npm run typecheck
npm run lint
npm run build:gui
npm run test -- tests/gui.test.ts tests/tui-host-lifecycle.test.tsx tests/providers/openai/fetcher.test.ts
npm run test
```

Observed during implementation:

- GUI activation, host-relative IPC identity, snapshot privacy, and disposal tests passed.
- Windows executable/shim detection, direct native spawn, and missing-binary rejection tests passed.
- Independent Linux/macOS comparisons preserved detection results and RPC messages.
- The installed Windows Codex was detected, reported its version, and completed a real stdio initialization.
- The running plugin subsequently cached two OpenAI usage windows; the user confirmed visible operation.
- The full Windows suite retained three failures reproduced before this change: Unix permission bits and `ps` assumptions in `tests/debug-log.test.ts`, and a POSIX path assertion in `tests/providers/claude/keychain.test.ts`.
- Formatting passed for changed files; the repository-wide formatting check already failed on unchanged baseline files.

The SDK build preset emits a non-blocking `inlineDynamicImports` deprecation warning. Successful build or package discovery alone is not proof of provider detection or visible data.

## Commit preparation

Keep behavior, tests, and related documentation together. Exclude local `.atl/` tooling state, ignored `dist/` output, and user-global configuration files. The prepack script builds the GUI artifact for package distribution.

These changes were not published. The existing npm release and this checkout can both report `1.1.0`, so verify the configured source rather than relying on the version alone.
