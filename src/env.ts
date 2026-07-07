// @ts-nocheck
// App detection + config-dir resolution, shared by every plugin. Claude is detected
// by "claude" in argv (matches the prior core-log/wakatime convention); the config
// dir is ~/.claude or ~/.config/opencode (XDG-style), overridable via env so tests
// and containers can point elsewhere.

import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export type AppName = "claude" | "opencode";

export function getApp(): AppName {
  const override = process.env.CORE_APP;
  if (override === "claude" || override === "opencode") return override;
  // Headless under the CC proxy, argv has no "claude" — but the loader exports
  // HUB_CONFIG_DIR = the active app's dir, so its shape is a reliable signal.
  const forced = process.env.HUB_CONFIG_DIR;
  if (forced && forced.trim()) return /(^|[\\/])\.?claude([\\/]|$)/i.test(forced) ? "claude" : "opencode";
  return process.argv.join(" ").includes("claude") ? "claude" : "opencode";
}

export function isClaude(): boolean {
  return getApp() === "claude";
}

// Resolution chain per app: explicit hub override (loader/tests) → the app's OWN
// native env var (CLAUDE_CONFIG_DIR / OPENCODE_CONFIG_DIR|XDG_CONFIG_HOME) → fs
// fallback. The hub override stays highest so the loader path and test isolation
// never regress; app-native support is added beneath it.
function resolveDir(app: AppName): string {
  const home = homedir();
  const trimmed = (v?: string) => (v && v.trim() ? v.trim() : "");
  if (app === "claude") {
    return trimmed(process.env.HUB_CLAUDE_DIR)
      || trimmed(process.env.CLAUDE_CONFIG_DIR)
      || (existsSync(join(home, ".claude")) ? join(home, ".claude") : join(home, ".config", "claude"));
  }
  const xdg = trimmed(process.env.XDG_CONFIG_HOME);
  return trimmed(process.env.HUB_OPENCODE_DIR)
    || trimmed(process.env.OPENCODE_CONFIG_DIR)
    || (xdg ? join(xdg, "opencode") : "")
    || (existsSync(join(home, ".config", "opencode")) ? join(home, ".config", "opencode") : join(home, ".opencode"));
}

// the config dir for the app we're running in. HUB_CONFIG_DIR is the loader's
// forced dir for the active app (survives the headless proxy hop, where argv-based
// detection fails); otherwise resolve from the active app + its native vars.
export function getAppConfigDir(): string {
  const forced = process.env.HUB_CONFIG_DIR;
  if (forced && forced.trim()) return forced.trim();
  return resolveDir(getApp());
}

// both apps' config dirs that exist on disk — used to deploy commands to each
export function existingConfigDirs(): string[] {
  return existingApps().map((a) => a.configDir);
}

// each installed app with its config dir and the slash-command directory it reads
// (opencode: command/ ; claude: commands/). Used to deploy commands cross-app.
export function existingApps(): { app: AppName; configDir: string; commandDir: string }[] {
  const out: { app: AppName; configDir: string; commandDir: string }[] = [];
  for (const app of ["claude", "opencode"] as AppName[]) {
    const dir = resolveDir(app);
    if (existsSync(dir) && !out.some((o) => o.configDir === dir)) {
      out.push({ app, configDir: dir, commandDir: app === "claude" ? "commands" : "command" });
    }
  }
  return out;
}
