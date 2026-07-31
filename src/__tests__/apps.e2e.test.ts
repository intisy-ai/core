import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getApps, getApp, resolveHome } from "../apps.js";

describe("synthetic third app flows end-to-end", () => {
  let home: string; let env: NodeJS.ProcessEnv;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "core-e2e-"));
    env = { HUB_APPS_FILE: join(home, "apps.json") };
    const acmeHome = join(home, ".acme"); mkdirSync(acmeHome);
    writeFileSync(join(home, "apps.json"), JSON.stringify({
      acme: { id: "acme", label: "Acme CLI", home: { candidates: [acmeHome] },
        detect: { binary: "acme", pkg: "acme-cli" }, commandsSubdir: "commands",
        proxyPort: 34570, integration: "env-baseurl", wireFormat: "anthropic" },
    }));
  });

  it("enumerates, resolves, detects, and keys exposure entirely from apps.json", () => {
    const ids = getApps(env, home).map((a) => a.id).sort();
    expect(ids).toEqual(["acme"]);
    const acme = getApp("acme", env, home)!;
    expect(resolveHome(acme, env, home)).toBe(join(home, ".acme"));
    expect(acme.detect.pkg).toBe("acme-cli");
    const exposureDefault: Record<string, boolean> = {};
    for (const a of getApps(env, home)) exposureDefault[a.id] = true;
    expect(exposureDefault).toEqual({ acme: true });
  });
});
