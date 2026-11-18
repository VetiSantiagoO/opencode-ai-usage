import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, platform } from "node:os";
import { win32 } from "node:path";
import type { ProviderDeps } from "../../types";

export function resolveCodexPath(deps: Pick<ProviderDeps, "exec">): string {
  if (platform() !== "win32") {
    return String(deps.exec("which codex", { encoding: "utf8" })).trim();
  }

  const paths = String(deps.exec("where.exe codex", { encoding: "utf8", stdio: "pipe" }))
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean);
  const executable = paths.find((path) => path.toLowerCase().endsWith(".exe"));
  if (executable) return executable;

  const shim = paths.find((path) => path.toLowerCase().endsWith(".cmd"));
  if (!shim) throw new Error("Codex CLI not found in PATH");
  const requireFromShim = createRequire(shim);
  const packagePath = requireFromShim.resolve("@openai/codex/package.json");
  const requireFromPackage = createRequire(packagePath);
  const architecture = arch();
  if (architecture !== "x64" && architecture !== "arm64") {
    throw new Error("Unsupported Codex Windows architecture");
  }
  const target = architecture === "x64" ? "x86_64" : "aarch64";
  let vendor = win32.join(win32.dirname(packagePath), "vendor");
  try {
    vendor = win32.join(
      win32.dirname(requireFromPackage.resolve(`@openai/codex-win32-${architecture}/package.json`)),
      "vendor",
    );
  } catch {
    // Las versiones antiguas incluyen el binario en el paquete principal.
  }
  const binary = win32.join(vendor, `${target}-pc-windows-msvc`, "bin", "codex.exe");
  if (!existsSync(binary)) throw new Error("Codex Windows executable not found");
  return binary;
}
