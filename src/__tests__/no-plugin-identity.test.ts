import { readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as core from "../index.js";

const SOURCE_DIR = join(import.meta.dirname, "..");

// Test files are excluded because they legitimately use real plugin names as fixture data,
// the same rule the activity surface guard applies to itself.
//
// readme.ts and configcli-all.ts are known exceptions: the generated Installation section
// names the installer that CLAUDE.md's README standard requires, so removing it means
// changing that standard. Tracked for the ecosystem sweep, not for this library alone.
const ALLOWED = new Set(["readme.ts", "configcli-all.ts"]);

// Reads every file under src/ regardless of extension: a plugin table is the same
// violation in JSON (or any other data format) as it is in a TypeScript constant.
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== "__tests__") out.push(...sourceFiles(path));
      continue;
    }
    if (!entry.endsWith(".test.ts") && !ALLOWED.has(entry)) out.push(path);
  }
  return out;
}

describe("core holds no plugin identity", () => {
  it("exports no plugin registry", () => {
    for (const name of ["KNOWN_PLUGINS", "knownPlugins", "pluginByCapability", "isBootstrapPlugin"]) {
      expect(core).not.toHaveProperty(name);
    }
  });

  it("names no specific plugin anywhere in its source", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SOURCE_DIR)) {
      const text = readFileSync(file, "utf-8");
      for (const id of ["plugin-updater", "sync-bridge", "custom-auth", "config-ledger", "wakatime-sync"]) {
        if (text.includes(id)) offenders.push(`${file} names ${id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("catches a plugin id in a non-TypeScript data file, not just .ts", () => {
    const probePath = join(SOURCE_DIR, "__guard-probe.json");
    writeFileSync(probePath, JSON.stringify([{ id: "plugin-updater" }]));
    try {
      const offenders: string[] = [];
      for (const file of sourceFiles(SOURCE_DIR)) {
        const text = readFileSync(file, "utf-8");
        for (const id of ["plugin-updater", "sync-bridge", "custom-auth", "config-ledger", "wakatime-sync"]) {
          if (text.includes(id)) offenders.push(`${file} names ${id}`);
        }
      }
      expect(offenders).toContain(`${probePath} names plugin-updater`);
    } finally {
      unlinkSync(probePath);
    }
  });
});
