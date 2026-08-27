// App detection + config-dir resolution, shared by every plugin. Delegates to
// the app registry (apps.ts) so built-in and custom apps resolve the same way.

import { existsSync } from "fs";
import { getApps, getApp as getAppById, resolveHome, currentAppId } from "./apps.js";

/** An app id, as the registry spells it. */
export type AppName = string;

/** The GitHub organisation this ecosystem publishes under. */
export const ECOSYSTEM_ORG = "intisy-ai";

/**
 * Which app this process is running under.
 *
 * @returns the app id.
 */
export function getApp(): AppName {
  return currentAppId();
}

// the config dir for the app we're running in. HUB_CONFIG_DIR is the loader's
// forced dir for the active app (survives the headless proxy hop, where argv-based
// detection fails); otherwise resolve from the active app's registry descriptor.
/**
 * The home of the app this process is running under.
 *
 * @returns the absolute path of the home directory.
 */
export function getAppConfigDir(): string {
  const forced = process.env.HUB_CONFIG_DIR;
  if (forced && forced.trim()) return forced.trim();
  const desc = getAppById(currentAppId());
  return desc ? resolveHome(desc) : "";
}

// every app's config dir that exists on disk, used to deploy commands to each
/**
 * Every app home that exists on this machine.
 *
 * @returns the absolute paths, empty when no app is installed.
 */
export function existingConfigDirs(): string[] {
  return existingApps().map((a) => a.configDir);
}

// each installed app with its config dir and the slash-command directory it reads
// (opencode: command/ ; claude: commands/). Used to deploy commands cross-app.
/**
 * Every installed app, with the directories it keeps its state in.
 *
 * @returns one entry per app that exists on this machine.
 */
export function existingApps(): InstalledApp[] {
  return existingAppsImpl();
}

/** One installed app, with the directories it keeps its state in. */
export interface InstalledApp {
  /** The app id. */
  app: string;
  /** Absolute path of its home. */
  configDir: string;
  /** Absolute path of the directory its slash commands are deployed into. */
  commandDir: string;
}

function existingAppsImpl(): { app: string; configDir: string; commandDir: string }[] {
  const out: { app: string; configDir: string; commandDir: string }[] = [];
  for (const desc of getApps()) {
    const dir = resolveHome(desc);
    if (existsSync(dir) && !out.some((o) => o.configDir === dir)) {
      out.push({ app: desc.id, configDir: dir, commandDir: desc.commandsSubdir });
    }
  }
  return out;
}
