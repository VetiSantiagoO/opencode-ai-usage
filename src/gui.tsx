/** @jsxImportSource solid-js */
import { Command, Ipc, MenuItem, Panel, Plugin, type PanelTab } from "@opencode/plugin/gui";
import { Schema } from "effect";
import { For, Show } from "solid-js";
import { formatPercentage, formatRelativeTime } from "./format";
import { computeDisplayPercent } from "./tui-logic";
import { toPercent, toUnixMs, type PluginOptions } from "./types";
import { startUsageRuntime } from "./usage-runtime";

const WINDOW_LABELS = new Set([
  "Session",
  "Hourly",
  "Daily",
  "Weekly",
  "Monthly",
  "Sonnet",
  "Opus",
  "Apps",
  "Cowork",
]);

const usageContract = (id: string) =>
  Ipc.define({
    id: `${id}.usage`,
    state: Schema.Struct({
      ready: Schema.Boolean,
      showRemaining: Schema.Boolean,
      providers: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          name: Schema.String,
          windows: Schema.Array(
            Schema.Struct({
              label: Schema.String,
              percent: Schema.NullOr(Schema.Number),
              resetsAt: Schema.NullOr(Schema.Number),
              isActive: Schema.Boolean,
            }),
          ),
          actionRequired: Schema.Boolean,
          lastFetchedAt: Schema.NullOr(Schema.Number),
        }),
      ),
    }),
    methods: {},
  });

export default Plugin.define({
  main(ctx) {
    const options: PluginOptions = ctx.options;
    let ready = false;
    let disposed = false;
    const runtime = startUsageRuntime(options, {
      onChange: () => {
        if (!disposed) bridge.changed();
      },
    });
    const bridge = ctx.provide(usageContract(ctx.id), {
      state: () => ({
        ready,
        showRemaining: options.showRemaining ?? false,
        providers: runtime.providers
          .filter(({ detected }) => detected)
          .map(({ provider, state }) => ({
            id: provider.id,
            name: provider.displayName,
            windows: state.windows.map(({ label, percent, resetsAt, isActive }) => ({
              label: WINDOW_LABELS.has(label) ? label : "Usage window",
              percent,
              resetsAt,
              isActive,
            })),
            actionRequired: !!state.actionRequired,
            lastFetchedAt: state.lastFetchedAt,
          })),
      }),
    });
    void runtime.ready.then(() => {
      if (disposed) return;
      ready = true;
      bridge.changed();
    });
    return () => {
      disposed = true;
      runtime.dispose();
    };
  },
  setup(ctx) {
    const tab: PanelTab = { id: "usage", title: "AI usage", closable: "compact" };
    const key = `${ctx.id}:${tab.id}`;
    const usage = ctx.main(usageContract(ctx.id));
    const open = () => {
      const session = ctx.sessions.current();
      if (session) ctx.layout.open(key, session);
    };

    ctx.add(Command, () => ({
      id: "open",
      title: "Open AI usage",
      enabled: !!ctx.sessions.current(),
      run: open,
    }));
    ctx.add(MenuItem, (): MenuItem | undefined => {
      const session = ctx.sessions.current();
      if (!session) return undefined;
      return {
        id: "open",
        menu: "session.panel",
        title: tab.title,
        opened: ctx.layout.state(key, session) !== "closed",
        run: open,
      };
    });
    ctx.add(Panel, {
      id: tab.id,
      region: "side",
      width: "narrow",
      list: ({ open }) => (open.includes(tab.id) ? [tab] : []),
      render: () => (
        <div style={{ padding: "12px", height: "100%", overflow: "auto" }}>
          <Show when={usage.state()?.ready} fallback={<p role="status">Detecting providers…</p>}>
            <For each={usage.state()?.providers} fallback={<p>No supported providers detected.</p>}>
              {(provider) => (
                <section style={{ "margin-bottom": "16px" }}>
                  <h2>{provider.name}</h2>
                  <Show when={provider.actionRequired}>
                    <p role="status">Reconnect this provider to resume usage updates.</p>
                  </Show>
                  <For
                    each={provider.windows}
                    fallback={
                      <Show when={!provider.actionRequired}>
                        <p role="status">
                          {provider.lastFetchedAt === null
                            ? "Waiting for usage…"
                            : "No usage windows."}
                        </p>
                      </Show>
                    }
                  >
                    {(window) => {
                      const remaining = () => usage.state()?.showRemaining ?? false;
                      const reset = window.resetsAt === null ? null : toUnixMs(window.resetsAt);
                      const percent = () =>
                        computeDisplayPercent(
                          window.percent === null ? null : toPercent(window.percent),
                          remaining(),
                        );
                      return (
                        <p>
                          {window.label}:{" "}
                          {!window.isActive
                            ? "Inactive"
                            : percent() === null
                              ? "Unavailable"
                              : `${formatPercentage(percent())} ${remaining() ? "remaining" : "used"}`}
                          <Show when={window.isActive && reset !== null}>
                            {" · resets in "}
                            {formatRelativeTime(reset)}
                          </Show>
                        </p>
                      );
                    }}
                  </For>
                </section>
              )}
            </For>
          </Show>
        </div>
      ),
    });
  },
});
