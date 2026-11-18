import { describe, expect, it, vi } from "vitest";
import type { Plugin } from "@opencode/plugin/gui";
import gui from "../src/gui";
import { toPercent, toUnixMs, type RefreshState } from "../src/types";

const host = vi.hoisted(() => ({
  Command: Symbol("Command"),
  MenuItem: Symbol("MenuItem"),
  Panel: Symbol("Panel"),
  startUsageRuntime: vi.fn(),
}));

vi.mock("@opencode/plugin/gui", () => ({
  ...host,
  Ipc: { define: (spec: unknown) => spec },
  Plugin: { define: (definition: unknown) => definition },
}));

vi.mock("../src/usage-runtime", () => ({
  startUsageRuntime: host.startUsageRuntime,
}));

describe("Desktop usage plugin", () => {
  it.each(["opencode-ai-usage", "C:\\proyectos\\opencode-ai-usage"])(
    "opens the session panel using host identity %s",
    (id) => {
      const add = vi.fn();
      const open = vi.fn();
      const current = vi.fn();
      const main = vi.fn((contract: { id: string }) => {
        expect(contract.id).toBe(`${id}.usage`);
      });
      gui.setup?.({
        id,
        add,
        main,
        layout: { open, state: () => "closed" },
        sessions: { current },
      } as unknown as Parameters<NonNullable<Plugin.Definition["setup"]>>[0]);

      const command = add.mock.calls.find(([token]) => token === host.Command)?.[1];
      const menu = add.mock.calls.find(([token]) => token === host.MenuItem)?.[1];
      const panel = add.mock.calls.find(([token]) => token === host.Panel)?.[1];
      expect(command().enabled).toBe(false);
      command().run();
      expect(open).not.toHaveBeenCalled();
      const session = { id: "ses_test" };
      current.mockReturnValue(session);
      expect(command().enabled).toBe(true);
      command().run();
      menu().run();
      expect(open.mock.calls).toEqual([
        [`${id}:usage`, session],
        [`${id}:usage`, session],
      ]);
      expect(panel.list({ open: [] })).toEqual([]);
      expect(panel.list({ open: ["usage"] })).toMatchObject([{ id: "usage", title: "AI usage" }]);
    },
  );

  it("streams only display data and disposes the shared runtime", async () => {
    const options = { showRemaining: true, disabledProviders: ["claude"] };
    const changed = vi.fn();
    const dispose = vi.fn();
    const provide = vi.fn(() => ({ changed }));
    const state: RefreshState = {
      windows: [
        { label: "Session", percent: toPercent(30), resetsAt: toUnixMs(5000), isActive: true },
      ],
      profile: { email: "private@example.test", plan: "Pro" },
      extras: { private: true },
      error: "raw error",
      actionRequired: null,
      lastFetchedAt: toUnixMs(2000),
    };
    let finish!: () => void;
    const ready = new Promise<void>((resolve) => {
      finish = resolve;
    });
    host.startUsageRuntime.mockReturnValue({
      providers: [
        { detected: false, provider: { id: "missing" }, state },
        { detected: true, provider: { id: "openai", displayName: "OpenAI Usage" }, state },
      ],
      ready,
      dispose,
    });

    const cleanup = await gui.main?.({
      id: "C:\\proyectos\\opencode-ai-usage",
      options,
      provide,
    } as unknown as Parameters<NonNullable<Plugin.Definition["main"]>>[0]);
    const [contract, bridge] = provide.mock.calls[0] as unknown as [
      { id: string },
      { state: () => unknown },
    ];
    expect(contract.id).toBe("C:\\proyectos\\opencode-ai-usage.usage");
    expect(bridge.state()).toMatchObject({ ready: false });
    const [passedOptions, hooks] = host.startUsageRuntime.mock.calls[0]!;
    expect(passedOptions).toBe(options);
    hooks.onChange();
    finish();
    await ready;
    expect(changed).toHaveBeenCalledTimes(2);
    expect(bridge.state()).toEqual({
      ready: true,
      showRemaining: true,
      providers: [
        {
          id: "openai",
          name: "OpenAI Usage",
          windows: state.windows,
          actionRequired: false,
          lastFetchedAt: 2000,
        },
      ],
    });
    state.actionRequired = "Reconnect private@example.test with synthetic-credential";
    state.windows[0]!.label = "private@example.test";
    expect(bridge.state()).toMatchObject({
      providers: [{ actionRequired: true, windows: [{ label: "Usage window" }] }],
    });
    await cleanup?.();
    expect(dispose).toHaveBeenCalledOnce();
    hooks.onChange();
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
