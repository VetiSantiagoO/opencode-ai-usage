import { execSync, execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createCacheStore } from "./cache";
import {
  createDebugLog,
  debugLogDir,
  describeProcess,
  noopDebugLog,
  resolveDebugLogConfig,
} from "./debug-log";
import { createClaudeProvider } from "./providers/claude";
import { createOpenAIProvider } from "./providers/openai";
import { createOpenCodeGoProvider } from "./providers/opencode-go";
import { createRefreshLoop } from "./refresh";
import { createRegistry } from "./registry";
import type {
  CacheStore,
  PluginOptions,
  ProviderDefinition,
  ProviderDeps,
  RefreshDiagnostics,
  RefreshState,
} from "./types";

interface UsageProvider {
  provider: ProviderDefinition;
  detected: boolean;
  refreshIntervalMs: number;
  state: RefreshState;
  diagnostics: (() => RefreshDiagnostics) | null;
}

interface RuntimeDependencies {
  deps?: ProviderDeps;
  cache?: CacheStore;
  providers?: ProviderDefinition[];
  onChange?: (runtime: UsageProvider) => void;
}

export function startUsageRuntime(options: PluginOptions, injected: RuntimeDependencies = {}) {
  const deps = injected.deps ?? {
    exec: execSync,
    execFile: execFileSync,
    spawn,
    readFile: readFileSync,
    fetch: globalThis.fetch,
    now: Date.now,
    homedir,
  };
  const cache = injected.cache ?? createCacheStore();
  const enabled = createRegistry(
    injected.providers ?? [
      createClaudeProvider(),
      createOpenAIProvider(),
      createOpenCodeGoProvider(),
    ],
  ).getEnabled(options.disabledProviders);
  const debugConfig = resolveDebugLogConfig(options.debugLog);
  const log = debugConfig.enabled
    ? createDebugLog({
        retentionDays: debugConfig.retentionDays,
        maxFileBytes: debugConfig.maxFileBytes,
      })
    : noopDebugLog;
  if (debugConfig.enabled) {
    log("plugin.init", {
      cwd: process.cwd(),
      ...describeProcess(),
      logDir: debugLogDir(),
      debugLog: debugConfig,
      providers: enabled.map((provider) => provider.id),
      displayMode: options.displayMode ?? "mixed",
      showRemaining: options.showRemaining ?? false,
    });
  }

  const controller = new AbortController();
  const { signal } = controller;
  const providers: UsageProvider[] = [];
  const ready = (async () => {
    for (const provider of enabled) {
      let detected = false;
      try {
        const result = await provider.detect(deps, signal);
        detected = result.available;
        log("provider.detect", {
          provider: provider.id,
          available: result.available,
          reason: result.available ? null : result.reason,
        });
      } catch (error) {
        log("provider.detect", {
          provider: provider.id,
          available: false,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      if (signal.aborted) break;

      const refreshIntervalMs =
        (options.providers?.[provider.id]?.refreshInterval ?? provider.defaultRefreshIntervalS) *
        1000;
      const runtime: UsageProvider = {
        provider,
        detected,
        refreshIntervalMs,
        state: {
          windows: [],
          profile: null,
          extras: null,
          error: null,
          actionRequired: null,
          lastFetchedAt: null,
        },
        diagnostics: null,
      };
      providers.push(runtime);
      injected.onChange?.(runtime);

      if (detected) {
        runtime.diagnostics = createRefreshLoop({
          provider,
          deps,
          cache,
          signal,
          intervalMs: refreshIntervalMs,
          setState: (state) => {
            if (signal.aborted) return;
            runtime.state = state;
            injected.onChange?.(runtime);
          },
          log,
        }).diagnostics;
      }
    }
  })();

  const dispose = () => {
    if (signal.aborted) return;
    log("plugin.dispose");
    controller.abort();
  };
  return { ready, providers, dispose, log, debugEnabled: debugConfig.enabled };
}
