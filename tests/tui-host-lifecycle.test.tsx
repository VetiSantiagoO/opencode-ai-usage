import plugin from "../src/tui";
import { createClaudeProvider } from "../src/providers/claude";
import { createOpenAIProvider } from "../src/providers/openai";
import { createOpenCodeGoProvider } from "../src/providers/opencode-go";
import {
  toPercent,
  type FetchResult,
  type PluginOptions,
  type ProviderDefinition,
} from "../src/types";

vi.mock("../src/providers/claude", () => ({ createClaudeProvider: vi.fn() }));
vi.mock("../src/providers/openai", () => ({ createOpenAIProvider: vi.fn() }));
vi.mock("../src/providers/opencode-go", () => ({ createOpenCodeGoProvider: vi.fn() }));
vi.mock("../src/cache", () => ({
  createCacheStore: () => ({
    readLatest: () => null,
    getBackoff: () => ({ nextAttemptAt: null, failureStreak: 0, actionRequired: null }),
    tryAcquireFetchLock: () => () => {},
    discardUnknown: async () => {},
    write: async () => {},
    setBackoff: async () => {},
  }),
}));
vi.mock("@opentui/solid/jsx-runtime", () => {
  const jsx = (tag: unknown, props: unknown) => ({ tag, props });
  return { jsx, jsxs: jsx };
});
vi.mock("@opentui/solid/jsx-dev-runtime", () => ({
  jsxDEV: (tag: unknown, props: unknown) => ({ tag, props }),
}));

const result: FetchResult = {
  accountKey: "account",
  windows: [{ label: "Weekly", percent: toPercent(25), resetsAt: null, isActive: true }],
  profile: { email: "account@example.test" },
  extras: null,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
const provider = (id: string) => ({
  id,
  displayName: id,
  defaultHeaderColor: "#111111",
  expectedLoadTimeS: 2,
  defaultRefreshIntervalS: 60,
  detect: vi.fn<ProviderDefinition["detect"]>().mockResolvedValue({ available: true }),
  fetch: vi.fn<ProviderDefinition["fetch"]>().mockResolvedValue(result),
});
let first: ReturnType<typeof provider>,
  second: ReturnType<typeof provider>,
  third: ReturnType<typeof provider>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T00:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0);
  first = provider("first");
  second = provider("second");
  third = provider("third");
  vi.mocked(createClaudeProvider).mockReturnValue(first as ReturnType<typeof createClaudeProvider>);
  vi.mocked(createOpenAIProvider).mockReturnValue(
    second as ReturnType<typeof createOpenAIProvider>,
  );
  vi.mocked(createOpenCodeGoProvider).mockReturnValue(
    third as ReturnType<typeof createOpenCodeGoProvider>,
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function host(version: "V1" | "V2", options: PluginOptions) {
  const controller = new AbortController();
  let render: () => unknown = () => null;
  let cleanup: (() => unknown) | undefined;
  let registration: number | string | undefined;
  const theme = { text: "#eeeeee", textMuted: "#aaaaaa" };
  const ready =
    version === "V1"
      ? plugin.tui(
          {
            lifecycle: {
              signal: controller.signal,
              onDispose: (fn: () => unknown) => {
                cleanup = fn;
              },
            },
            slots: {
              register: (s: {
                order: number;
                slots: { sidebar_content: (ctx: unknown) => unknown };
              }) => {
                registration = s.order;
                render = () => s.slots.sidebar_content({ theme: { current: theme } });
              },
            },
          } as unknown as Parameters<typeof plugin.tui>[0],
          { ...options },
          {} as Parameters<typeof plugin.tui>[2],
        )
      : Promise.resolve(
          plugin.setup({
            options,
            theme: { text: { base: theme.text, muted: theme.textMuted } },
            ui: {
              slot: (s: { append: string; render: () => unknown }) => {
                registration = s.append;
                render = s.render;
              },
            },
          } as unknown as Parameters<typeof plugin.setup>[0]),
        ).then((fn) => {
          cleanup = fn || undefined;
        });
  return {
    ready,
    snapshot: () => JSON.stringify(render()),
    dispose: () => cleanup?.(),
    registration: () => registration,
  };
}

describe.each(["V1", "V2"] as const)("%s usage sidebar", (version) => {
  it("keeps provider options, detection failure, exact visible strings and refresh/disposal semantics", async () => {
    const pending = deferred<FetchResult>();
    first.fetch.mockReturnValueOnce(pending.promise);
    second.detect.mockRejectedValueOnce(Error("detection unavailable"));
    const app = host(version, {
      disabledProviders: ["third"],
      displayMode: "text",
      showRemaining: true,
      providers: { first: { headerColor: "#abcdef", refreshInterval: 3 } },
    });
    await app.ready;
    try {
      expect(app.registration()).toBe(version === "V1" ? 60 : "sidebar.content");
      expect(app.snapshot()).toContain(" Loading in 2s...");
      expect(app.snapshot()).toContain("#abcdef");
      expect(app.snapshot()).not.toContain("second");
      expect(second.fetch).not.toHaveBeenCalled();
      expect(third.detect).not.toHaveBeenCalled();
      pending.resolve(result);
      await vi.advanceTimersByTimeAsync(0);
      expect(app.snapshot()).toContain(" account@example.test");
      expect(app.snapshot()).toContain(" Weekly");
      expect(app.snapshot()).toContain("75%");
      expect(app.snapshot()).not.toContain("Loading");
      await vi.advanceTimersByTimeAsync(2999);
      expect(first.fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(first.fetch).toHaveBeenCalledTimes(2);
      await app.dispose();
      expect(first.fetch.mock.calls[0]?.[1].aborted).toBe(true);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(first.fetch).toHaveBeenCalledTimes(2);
    } finally {
      await app.dispose();
    }
  });

  it("ticks each pending provider from its detection time, not host registration", async () => {
    const detecting = deferred<{ available: true }>();
    second.detect.mockReturnValueOnce(detecting.promise);
    first.fetch.mockImplementation(() => deferred<FetchResult>().promise);
    second.fetch.mockImplementation(() => deferred<FetchResult>().promise);
    const app = host(version, { disabledProviders: ["third"] });
    await vi.advanceTimersByTimeAsync(750);
    expect(first.fetch).toHaveBeenCalledTimes(1);
    detecting.resolve({ available: true });
    await app.ready;
    try {
      expect(app.snapshot().match(/Loading in 2s/g)).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(250);
      expect(app.snapshot().match(/Loading in (?:1|2)s/g)).toEqual([
        "Loading in 1s",
        "Loading in 2s",
      ]);
      await vi.advanceTimersByTimeAsync(1000);
      expect(app.snapshot()).toContain(" Loading shortly...");
    } finally {
      await app.dispose();
    }
  });
});
