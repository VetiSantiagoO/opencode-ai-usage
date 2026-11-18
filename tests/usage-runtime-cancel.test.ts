import { startUsageRuntime } from "../src/usage-runtime";
import type { CacheStore, DetectionResult, FetchResult, ProviderDefinition } from "../src/types";

afterEach(() => vi.useRealTimers());
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
function provider(id: string) {
  return {
    id,
    displayName: id,
    expectedLoadTimeS: 2,
    defaultRefreshIntervalS: 60,
    defaultHeaderColor: "#fff",
    detect: vi.fn<ProviderDefinition["detect"]>().mockResolvedValue({ available: true }),
    fetch: vi.fn<ProviderDefinition["fetch"]>(),
  };
}

it.each(["first", "second"] as const)(
  "disposes while %s detection ignores abort",
  async (which) => {
    vi.useFakeTimers();
    const detection = deferred<DetectionResult>();
    const fetch = deferred<FetchResult>();
    const first = provider("first"),
      second = provider("second"),
      third = provider("third");
    const pending = which === "first" ? first : second;
    pending.detect.mockReturnValue(detection.promise);
    first.fetch.mockReturnValue(fetch.promise);
    const cache: CacheStore = {
      read: () => null,
      readLatest: () => null,
      getAge: () => null,
      getBackoff: () => ({ nextAttemptAt: null, failureStreak: 0 }),
      tryAcquireFetchLock: () => () => {},
      write: vi.fn(),
      discardUnknown: vi.fn(),
      setBackoff: vi.fn(),
    };
    const onChange = vi.fn();
    const runtime = startUsageRuntime({}, { providers: [first, second, third], cache, onChange });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(first.fetch).toHaveBeenCalledTimes(which === "first" ? 0 : 1);
      const signal = pending.detect.mock.calls[0]?.[1];
      expect(signal?.aborted).toBe(false);
      const initial = onChange.mock.calls.length;
      runtime.dispose();
      runtime.dispose();
      expect(signal?.aborted).toBe(true);
      detection.resolve({ available: true });
      fetch.resolve({ accountKey: "late", windows: [], profile: null, extras: null });
      await runtime.ready;
      await vi.advanceTimersByTimeAsync(180_000);
      expect(runtime.providers.map(({ provider }) => provider.id)).toEqual(
        which === "first" ? [] : ["first"],
      );
      expect(second.fetch).not.toHaveBeenCalled();
      expect(third.detect).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledTimes(initial);
      expect(cache.write).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      runtime.dispose();
    }
  },
);
