import { ECOSYSTEM_ORG } from "./env.js";

// An engine is a plugin Cairn can install directly (a plain download, no update
// tracking) to bootstrap a home. Everything else is managed by plugin-updater
// once it is present. Engines are never auto-installed and never locked.
export interface EngineDescriptor {
  id: string;
  url: string;
  capability: string;
  target: "all-apps" | "cairn";
  meta?: Record<string, string>;
}

export const BUILTIN_ENGINES: EngineDescriptor[] = [
  { id: "plugin-updater", url: `https://github.com/${ECOSYSTEM_ORG}/plugin-updater`, capability: "plugin-management", target: "all-apps" },
  { id: "sync-bridge", url: `https://github.com/${ECOSYSTEM_ORG}/sync-bridge`, capability: "cross-app-sync", target: "cairn" },
];

export function getEngines(): EngineDescriptor[] {
  return BUILTIN_ENGINES;
}

export function engineByCapability(capability: string): EngineDescriptor | undefined {
  return BUILTIN_ENGINES.find((e) => e.capability === capability);
}

export function engineById(id: string): EngineDescriptor | undefined {
  return BUILTIN_ENGINES.find((e) => e.id === id);
}

export function isEngine(id: string): boolean {
  return BUILTIN_ENGINES.some((e) => e.id === id);
}
