import { existsSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { atomicWrite, readJson } from "./files.js";
import { ECOSYSTEM_ORG } from "./env.js";

export interface AppDescriptor {
  id: string;
  label: string;
  /** Self-contained SVG mark for the app, rendered by dashboards. Data, not code. */
  icon?: string;
  home: {
    envOverride?: string;
    nativeEnv?: string;
    xdgSubdir?: string;
    candidates: string[];
  };
  detect: { binary: string; pkg: string };
  /** The loader plugin that connects this app to the local API. Data, not code:
   * a dashboard reads this to install and track the app's loader. Absent means
   * the app has no loader. */
  loader?: { id: string; url: string };
  commandsSubdir: string;
  proxyPort: number;
  integration: "env-baseurl" | "native";
  wireFormat: string;
  builtin: boolean;
  /** Session-storage formats this app writes, for usage readers. Data, not code:
   * a dashboard maps each format id to a parser. Absent means no usage data. */
  usage?: { formats: string[] };
}

export const BUILTIN_APPS: AppDescriptor[] = [
  {
    id: "claude",
    label: "Claude Code",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 248 248"><rect width="248" height="248" rx="44" fill="#D97757"/><path fill="#fff" d="M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z"/></svg>',
    home: {
      envOverride: "HUB_CLAUDE_DIR",
      nativeEnv: "CLAUDE_CONFIG_DIR",
      candidates: ["~/.claude", "~/.config/claude"],
    },
    detect: { binary: "claude", pkg: "@anthropic-ai/claude-code" },
    loader: { id: "claude-code-loader", url: `${ECOSYSTEM_ORG}/claude-code-loader` },
    commandsSubdir: "commands",
    proxyPort: 34567,
    integration: "env-baseurl",
    wireFormat: "anthropic",
    builtin: true,
    usage: { formats: ["claude-jsonl"] },
  },
  {
    id: "opencode",
    label: "OpenCode",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 0 300 300"><rect x="-30" width="300" height="300" rx="42" fill="#fff"/><path d="M180 240H60V120H180V240Z" fill="#CFCECD"/><path d="M180 60H60V240H180V60ZM240 300H0V0H240V300Z" fill="#211E1E"/></svg>',
    home: {
      envOverride: "HUB_OPENCODE_DIR",
      nativeEnv: "OPENCODE_CONFIG_DIR",
      xdgSubdir: "opencode",
      candidates: ["~/.config/opencode", "~/.opencode"],
    },
    detect: { binary: "opencode", pkg: "opencode-ai" },
    loader: { id: "opencode-loader", url: `${ECOSYSTEM_ORG}/opencode-loader` },
    commandsSubdir: "command",
    proxyPort: 34568,
    integration: "native",
    wireFormat: "anthropic",
    builtin: true,
    usage: { formats: ["opencode-sqlite", "opencode-legacy-files"] },
  },
];

let CACHE: AppDescriptor[] | null = null;
let CACHE_KEY = "";

function trimmed(v?: string): string {
  return v && v.trim() ? v.trim() : "";
}

function expandHome(p: string, home: string): string {
  if (p === "~") return home;
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(home, p.slice(2));
  return p;
}

export function resolveAppsFile(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const override = trimmed(env.HUB_APPS_FILE);
  if (override) return override;
  return join(home, ".config", "cairn", "apps.json");
}

function mergeDescriptor(base: AppDescriptor, over: Partial<AppDescriptor>): AppDescriptor {
  return {
    ...base,
    ...over,
    home: { ...base.home, ...(over.home ?? {}) },
    detect: { ...base.detect, ...(over.detect ?? {}) },
  };
}

function isValid(desc: Partial<AppDescriptor>): desc is AppDescriptor {
  return typeof desc.id === "string" && desc.id.length > 0
    && typeof desc.label === "string"
    && !!desc.home && Array.isArray(desc.home.candidates) && desc.home.candidates.length > 0;
}

function readRaw(env: NodeJS.ProcessEnv, home: string): Record<string, Partial<AppDescriptor>> {
  const file = resolveAppsFile(env, home);
  if (!existsSync(file)) return {};
  const data = readJson(file, null) as Record<string, Partial<AppDescriptor>> | null;
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

function build(env: NodeJS.ProcessEnv, home: string): AppDescriptor[] {
  const raw = readRaw(env, home);
  const byId = new Map<string, AppDescriptor>();
  for (const b of BUILTIN_APPS) byId.set(b.id, b);
  for (const [id, entry] of Object.entries(raw)) {
    const withId = { ...entry, id: entry.id ?? id };
    const existing = byId.get(id);
    if (existing) {
      byId.set(id, mergeDescriptor(existing, withId));
    } else if (isValid(withId)) {
      const w = withId;
      byId.set(id, {
        id: w.id,
        label: w.label,
        icon: w.icon,
        home: w.home,
        detect: { binary: w.detect?.binary ?? id, pkg: w.detect?.pkg ?? "" },
        loader: w.loader,
        commandsSubdir: w.commandsSubdir ?? "commands",
        proxyPort: w.proxyPort ?? 0,
        integration: w.integration ?? "env-baseurl",
        wireFormat: w.wireFormat ?? "anthropic",
        builtin: w.builtin ?? false,
        usage: w.usage,
      });
    }
  }
  return [...byId.values()];
}

export function getApps(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): AppDescriptor[] {
  const file = resolveAppsFile(env, home);
  let mtime = 0;
  try { mtime = existsSync(file) ? statSync(file).mtimeMs : 0; } catch { mtime = 0; }
  const key = file + "::" + mtime;
  if (CACHE && CACHE_KEY === key) return CACHE;
  CACHE = build(env, home);
  CACHE_KEY = key;
  return CACHE;
}

export function getApp(id: string, env: NodeJS.ProcessEnv = process.env, home: string = homedir()): AppDescriptor | undefined {
  return getApps(env, home).find((a) => a.id === id);
}

export function resolveHome(desc: AppDescriptor, env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const over = desc.home.envOverride ? trimmed(env[desc.home.envOverride]) : "";
  if (over) return over;
  const native = desc.home.nativeEnv ? trimmed(env[desc.home.nativeEnv]) : "";
  if (native) return native;
  if (desc.home.xdgSubdir) {
    const xdg = trimmed(env.XDG_CONFIG_HOME);
    if (xdg) return join(xdg, desc.home.xdgSubdir);
  }
  const cands = desc.home.candidates.map((c) => expandHome(c, home));
  for (const c of cands) if (existsSync(c)) return c;
  return cands[cands.length - 1] ?? "";
}

export function currentAppId(env: NodeJS.ProcessEnv = process.env): string {
  const override = trimmed(env.CORE_APP);
  if (override) return override;
  const forced = trimmed(env.HUB_CONFIG_DIR);
  if (forced) return /(^|[\\/])\.?claude([\\/]|$)/i.test(forced) ? "claude" : "opencode";
  return process.argv.join(" ").includes("claude") ? "claude" : "opencode";
}

export function registerApp(desc: AppDescriptor, env: NodeJS.ProcessEnv = process.env, home: string = homedir()): void {
  const id = desc.id;
  if (!isValid(desc)) throw new Error(`invalid app descriptor: ${id}`);
  const raw = readRaw(env, home);
  raw[desc.id] = desc;
  atomicWrite(resolveAppsFile(env, home), JSON.stringify(raw, null, 2));
  CACHE = null;
  CACHE_KEY = "";
}
