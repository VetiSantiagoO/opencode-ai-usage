import { createCacheStore } from "../src/cache";
import type { ProviderDefinition, ProviderDeps } from "../src/types";
import { startUsageRuntime } from "../src/usage-runtime";

describe("shared usage runtime", () => {
  it("detects enabled providers, publishes usage and errors, and stops refreshing on disposal", async () => {
    vi.useFakeTimers();
    const scratch = await import("node:fs/promises");
    const directory = await scratch.mkdtemp(`${(await import("node:os")).tmpdir()}/usage-runtime-`);
    const deps: ProviderDeps = {
      exec: vi.fn(),
      execFile: vi.fn(),
      spawn: vi.fn(),
      readFile: vi.fn(),
      fetch: vi.fn(),
      now: Date.now,
      homedir: () => directory,
    };
    const provider = (id: string): ProviderDefinition => ({
      id,
      displayName: id,
      defaultHeaderColor: "#ffffff",
      expectedLoadTimeS: 1,
      defaultRefreshIntervalS: 60,
      detect: vi.fn(async () => ({ available: true as const })),
      fetch: vi.fn(async () => ({
        accountKey: id,
        windows: [],
        profile: { email: `${id}@example.test` },
        extras: null,
      })),
    });
    const enabled = provider("enabled");
    const disabled = provider("disabled");
    const unavailable = {
      ...provider("unavailable"),
      detect: vi.fn().mockRejectedValue(Error("offline")),
    };
    const failure = {
      ...provider("failure"),
      fetch: vi.fn().mockRejectedValue(Error("fetch failed")),
    };
    const onChange = vi.fn();
    const runtime = startUsageRuntime(
      { disabledProviders: ["disabled"], providers: { enabled: { refreshInterval: 15 } } },
      {
        providers: [enabled, disabled, unavailable, failure],
        deps,
        cache: createCacheStore({ cacheDir: directory }),
        onChange,
      },
    );
    try {
      await runtime.ready;
      await vi.waitFor(() => {
        expect(
          runtime.providers.map(({ provider, detected, refreshIntervalMs, state }) => ({
            id: provider.id,
            detected,
            refreshIntervalMs,
            email: state.profile?.email,
            error: state.error,
          })),
        ).toEqual([
          {
            id: "enabled",
            detected: true,
            refreshIntervalMs: 15_000,
            email: "enabled@example.test",
            error: null,
          },
          {
            id: "unavailable",
            detected: false,
            refreshIntervalMs: 60_000,
            email: undefined,
            error: null,
          },
          {
            id: "failure",
            detected: true,
            refreshIntervalMs: 60_000,
            email: undefined,
            error: "fetch failed",
          },
        ]);
      });
      expect(onChange).toHaveBeenCalled();
      expect(disabled.detect).not.toHaveBeenCalled();
      expect(unavailable.fetch).not.toHaveBeenCalled();
      const calls = vi.mocked(enabled.fetch).mock.calls.length;
      runtime.dispose();
      await vi.advanceTimersByTimeAsync(180_000);
      expect(enabled.fetch).toHaveBeenCalledTimes(calls);
    } finally {
      runtime.dispose();
      vi.useRealTimers();
      await scratch.rm(directory, { recursive: true, force: true });
    }
  });
});
