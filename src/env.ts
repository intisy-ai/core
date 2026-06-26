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
  return process.argv.join(" ").includes("claude") ? "claude" : "opencode";
}

export function isClaude(): boolean {
  return getApp() === "claude";
}

function resolveDir(app: AppName): string {
  const home = homedir();
  if (app === "claude") {
    const override = process.env.HUB_CLAUDE_DIR;
    if (override && override.trim()) return override.trim();
    const direct = join(home, ".claude");
    return existsSync(direct) ? direct : join(home, ".config", "claude");
  }
  const override = process.env.HUB_OPENCODE_DIR;
  if (override && override.trim()) return override.trim();
  const xdg = join(home, ".config", "opencode");
  return existsSync(xdg) ? xdg : join(home, ".opencode");
}

// the config dir for the app we're running in
export function getAppConfigDir(): string {
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
