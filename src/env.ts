// App detection + config-dir resolution, shared by every plugin. Delegates to
// the app registry (apps.ts) so built-in and custom apps resolve the same way.

import { existsSync } from "fs";
import { getApps, getApp as getAppById, resolveHome, currentAppId } from "./apps.js";

export type AppName = string;

export const ECOSYSTEM_ORG = "intisy-ai";

export function getApp(): AppName {
  return currentAppId();
}

// the config dir for the app we're running in. HUB_CONFIG_DIR is the loader's
// forced dir for the active app (survives the headless proxy hop, where argv-based
// detection fails); otherwise resolve from the active app's registry descriptor.
export function getAppConfigDir(): string {
  const forced = process.env.HUB_CONFIG_DIR;
  if (forced && forced.trim()) return forced.trim();
  const desc = getAppById(currentAppId());
  return desc ? resolveHome(desc) : "";
}

// every app's config dir that exists on disk, used to deploy commands to each
export function existingConfigDirs(): string[] {
  return existingApps().map((a) => a.configDir);
}

// each installed app with its config dir and the slash-command directory it reads
// (opencode: command/ ; claude: commands/). Used to deploy commands cross-app.
export function existingApps(): { app: string; configDir: string; commandDir: string }[] {
  const out: { app: string; configDir: string; commandDir: string }[] = [];
  for (const desc of getApps()) {
    const dir = resolveHome(desc);
    if (existsSync(dir) && !out.some((o) => o.configDir === dir)) {
      out.push({ app: desc.id, configDir: dir, commandDir: desc.commandsSubdir });
    }
  }
  return out;
}
