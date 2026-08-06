import { ECOSYSTEM_ORG } from "./env.js";

// The plugins core knows by CAPABILITY, so a consumer can ask what manages plugins or what
// serves custom endpoints without naming one. That lookup is the whole reason this table
// exists; everything else about a plugin comes from the plugin itself.
export interface PluginRegistration {
  id: string;
  url: string;
  capability: string;
  /** Where a dashboard offers to install it. */
  target: "everywhere" | "all-apps" | "cairn";
  /**
   * Installable and configurable while the plugin manager is absent. True only for the
   * manager itself, which nothing else can install: exempting anything else would hide a
   * genuinely missing manager behind a plugin that quietly half-installed.
   */
  bootstrap?: boolean;
  meta?: Record<string, string>;
}

export const KNOWN_PLUGINS: PluginRegistration[] = [
  { id: "plugin-updater", url: `https://github.com/${ECOSYSTEM_ORG}/plugin-updater`, capability: "plugin-management", target: "everywhere", bootstrap: true },
  { id: "sync-bridge", url: `https://github.com/${ECOSYSTEM_ORG}/sync-bridge`, capability: "cross-app-sync", target: "cairn" },
  { id: "custom-auth", url: `https://github.com/${ECOSYSTEM_ORG}/custom-auth`, capability: "custom-endpoints", target: "cairn", meta: { providerId: "custom", configName: "custom-auth" } },
];

export function knownPlugins(): PluginRegistration[] {
  return KNOWN_PLUGINS;
}

export function pluginByCapability(capability: string): PluginRegistration | undefined {
  return KNOWN_PLUGINS.find((p) => p.capability === capability);
}

export function isBootstrapPlugin(id: string): boolean {
  return KNOWN_PLUGINS.some((p) => p.id === id && p.bootstrap === true);
}
