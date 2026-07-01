// @ts-nocheck
// Shared test-kit for the ecosystem. NOT part of the runtime barrel (index.ts) —
// it is imported only by test files (`import { runPluginContract } from "../core/src/testing.js"`),
// so it never bloats a plugin's shipped bundle. It encodes the universal contract
// every plugin gets from core: a `/<plugin>-config` CLI that round-trips, command
// deployment, and clean action invocations — all in fully isolated temp homes so a
// test can never touch the real ~/.claude or ~/.config/opencode.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PROBE = "__contract_probe__";

export interface IsolatedHomes {
  opencode: string;
  claude: string;
  cleanup: () => void;
}

// Two throwaway config homes + the env that points every core path resolver at
// them. Mutates process.env (so in-process deploy fns see it too) and restores on
// cleanup. Each test FILE runs in its own vitest worker, so this never races.
export function withIsolatedHomes(): IsolatedHomes {
  const opencode = mkdtempSync(join(tmpdir(), "agentbox-oc-"));
  const claude = mkdtempSync(join(tmpdir(), "agentbox-cc-"));
  const saved = {
    CORE_APP: process.env.CORE_APP,
    HUB_OPENCODE_DIR: process.env.HUB_OPENCODE_DIR,
    HUB_CLAUDE_DIR: process.env.HUB_CLAUDE_DIR,
  };
  process.env.CORE_APP = "opencode";
  process.env.HUB_OPENCODE_DIR = opencode;
  process.env.HUB_CLAUDE_DIR = claude;
  return {
    opencode,
    claude,
    cleanup() {
      for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
      try { rmSync(opencode, { recursive: true, force: true }); } catch { /* ignore */ }
      try { rmSync(claude, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

function runNode(args: string[]): string {
  return execFileSync("node", args, { env: process.env, encoding: "utf8" });
}

export interface PluginContractSpec {
  name: string;                 // describe() label
  entry: string;                // bundle run as `node <entry> config …` (the config CLI + load)
  configName: string;           // config/<configName>.json the CLI writes
  app?: "opencode" | "claude" | "both";  // which command dir(s) to expect (default "both")
  commands?: string[];          // slash-command names (no .md) that must deploy
  deploy?: "load" | { module: string; fn: string; arg?: "opencode" | "claude" | "none" };
  actions?: string[][];         // extra argv arrays run against entry; each must exit 0
  readme?: boolean;             // when true, asserts `node <entry> readme --check` exits 0
}

function commandDirs(app: string, homes: IsolatedHomes): Array<[string, string]> {
  if (app === "opencode") return [[homes.opencode, "command"]];
  if (app === "claude") return [[homes.claude, "commands"]];
  return [[homes.opencode, "command"], [homes.claude, "commands"]];
}

// Register the universal contract for one plugin. The config round-trip is the
// rock-solid common denominator (every plugin has it via core); command
// deployment + actions are asserted when the spec declares them.
export function runPluginContract(spec: PluginContractSpec): void {
  const app = spec.app ?? "both";
  describe(`${spec.name}: core contract`, () => {
    let homes: IsolatedHomes;
    beforeAll(() => { homes = withIsolatedHomes(); });
    afterAll(() => homes?.cleanup());

    it("config set/get/list round-trips to config/" + spec.configName + ".json", () => {
      runNode([spec.entry, "config", "set", PROBE, "hello world"]);
      expect(runNode([spec.entry, "config", "get", PROBE])).toContain('"hello world"');
      expect(runNode([spec.entry, "config", "list"])).toContain(PROBE);
      const file = join(homes.opencode, "config", `${spec.configName}.json`);
      expect(existsSync(file)).toBe(true);
      expect(JSON.parse(readFileSync(file, "utf8"))[PROBE]).toBe("hello world");
    });

    if (spec.commands?.length) {
      it("deploys its slash-commands", async () => {
        const deploy = spec.deploy ?? "load";
        if (deploy === "load") {
          runNode([spec.entry]); // normal load triggers deployCommands
        } else {
          const mod = await import(pathToFileURL(resolve(deploy.module)).href);
          const arg = deploy.arg === "claude" ? homes.claude : deploy.arg === "opencode" ? homes.opencode : undefined;
          await mod[deploy.fn](arg);
        }
        for (const [dir, sub] of commandDirs(app, homes)) {
          const present = existsSync(join(dir, sub)) ? readdirSync(join(dir, sub)) : [];
          for (const c of spec.commands!) expect(present).toContain(`${c}.md`);
        }
      });
    }

    for (const argv of spec.actions ?? []) {
      it(`runs \`${argv.join(" ")}\` cleanly`, () => {
        expect(() => runNode([spec.entry, ...argv])).not.toThrow();
      });
    }

    if (spec.readme) {
      it("README.md is up to date (readme --check)", () => {
        // runNode throws on non-zero exit; a fresh generated README must match the committed one
        expect(() => runNode([spec.entry, "readme", "--check"])).not.toThrow();
      });
    }
  });
}
