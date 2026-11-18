import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "@opentui/solid" } },
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
  },
});
