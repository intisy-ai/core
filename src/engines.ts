import { ECOSYSTEM_ORG } from "./env.js";

// An engine is a plugin Cairn can install directly (a plain download, no update
// tracking) to bootstrap a home. Everything else is managed by plugin-updater
// once it is present. Engines are never auto-installed and never locked.
export interface EngineDescriptor {
  id: string;
  url: string;
  capability: string;
  target: "everywhere" | "all-apps" | "cairn";
  meta?: Record<string, string>;
}

export const BUILTIN_ENGINES: EngineDescriptor[] = [
  { id: "plugin-updater", url: `https://github.com/${ECOSYSTEM_ORG}/plugin-updater`, capability: "plugin-management", target: "everywhere" },
  { id: "sync-bridge", url: `https://github.com/${ECOSYSTEM_ORG}/sync-bridge`, capability: "cross-app-sync", target: "cairn" },
];

// Plugins that PROVIDE a capability without being engines. An engine bypasses update
// tracking and is never a browsable catalog entry; these are ordinary managed plugins that
// something else needs to locate by capability rather than by name. Keeping them out of
// BUILTIN_ENGINES is deliberate: isEngine() decides how a plugin is managed, and a provider
// like this is managed like any other plugin.
export const CAPABILITY_PLUGINS: EngineDescriptor[] = [
  { id: "custom-auth", url: `https://github.com/${ECOSYSTEM_ORG}/custom-auth`, capability: "custom-endpoints", target: "cairn", meta: { providerId: "custom", configName: "custom-auth" } },
];

export function getEngines(): EngineDescriptor[] {
  return BUILTIN_ENGINES;
}

export function getCapabilityPlugins(): EngineDescriptor[] {
  return CAPABILITY_PLUGINS;
}

// Resolves either kind: a consumer asking for a capability wants whatever provides it, and
// should not have to know whether that is an engine or an ordinary plugin.
export function engineByCapability(capability: string): EngineDescriptor | undefined {
  return [...BUILTIN_ENGINES, ...CAPABILITY_PLUGINS].find((e) => e.capability === capability);
}

export function engineById(id: string): EngineDescriptor | undefined {
  return BUILTIN_ENGINES.find((e) => e.id === id);
}

export function isEngine(id: string): boolean {
  return BUILTIN_ENGINES.some((e) => e.id === id);
}
