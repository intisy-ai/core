import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync, readFileSync, renameSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { publish, publishNotification, subscribe, drain, subscribeHomes, drainHomes, busLogPath, TOPICS } from "./bus.js";

let home: string;
let prevEnv: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "core-bus-"));
  prevEnv = process.env.HUB_CONFIG_DIR;
  process.env.HUB_CONFIG_DIR = home;
});

afterEach(() => {
  if (prevEnv === undefined) delete process.env.HUB_CONFIG_DIR;
  else process.env.HUB_CONFIG_DIR = prevEnv;
  rmSync(home, { recursive: true, force: true });
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("event bus", () => {
  it("publishes a well-formed envelope and drains it from the start", () => {
    publish(TOPICS.notification, { message: "hi", level: "info" }, "test");
    const got: any[] = [];
    const count = drain("c1", (e: any) => got.push(e));
    expect(count).toBe(1);
    expect(got[0]).toMatchObject({ v: 1, topic: "notification", source: "test", payload: { message: "hi", level: "info" } });
    expect(typeof got[0].id).toBe("string");
    expect(typeof got[0].ts).toBe("number");
  });

  it("publishNotification publishes on the notification topic with the message payload", () => {
    publishNotification("switched provider", "warning", "core-proxy");
    const got: any[] = [];
    drain("c1", (e: any) => got.push(e));
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ topic: TOPICS.notification, source: "core-proxy", payload: { message: "switched provider", level: "warning" } });
  });

  it("drain advances its cursor so each event is delivered once", () => {
    publish("a", { n: 1 }, "test");
    publish("a", { n: 2 }, "test");
    const first: any[] = [];
    drain("c1", (e: any) => first.push(e));
    expect(first.map((e: any) => e.payload.n)).toEqual([1, 2]);

    publish("a", { n: 3 }, "test");
    const second: any[] = [];
    drain("c1", (e: any) => second.push(e));
    expect(second.map((e: any) => e.payload.n)).toEqual([3]);

    const third: any[] = [];
    drain("c1", (e: any) => third.push(e));
    expect(third).toEqual([]);
  });

  it("gives each consumer its own independent cursor", () => {
    publish("a", { n: 1 }, "test");
    publish("a", { n: 2 }, "test");
    const c1: any[] = [];
    const c2: any[] = [];
    drain("c1", (e: any) => c1.push(e));
    drain("c2", (e: any) => c2.push(e));
    expect(c1.map((e: any) => e.payload.n)).toEqual([1, 2]);
    expect(c2.map((e: any) => e.payload.n)).toEqual([1, 2]);
  });

  it("never delivers a half-written trailing line, then delivers it once complete", () => {
    publish("a", { n: 1 }, "test");
    appendFileSync(busLogPath(home), JSON.stringify({ v: 1, id: "x", ts: 1, topic: "a", source: "test", payload: { n: 2 } }));
    const first: any[] = [];
    drain("c1", (e: any) => first.push(e));
    expect(first.map((e: any) => e.payload.n)).toEqual([1]);

    appendFileSync(busLogPath(home), "\n");
    const second: any[] = [];
    drain("c1", (e: any) => second.push(e));
    expect(second.map((e: any) => e.payload.n)).toEqual([2]);
  });

  it("skips corrupt lines but delivers the valid ones", () => {
    publish("a", { n: 1 }, "test");
    appendFileSync(busLogPath(home), "not json at all\n");
    appendFileSync(busLogPath(home), JSON.stringify({ garbage: true }) + "\n");
    publish("a", { n: 2 }, "test");
    const got: any[] = [];
    drain("c1", (e: any) => got.push(e));
    expect(got.map((e: any) => e.payload.n)).toEqual([1, 2]);
  });

  it("drains across a rotation without losing or duplicating events", () => {
    publish("a", { n: 1 }, "test");
    publish("a", { n: 2 }, "test");

    // A consumer that already saw 1 and 2.
    drain("seen", () => {});

    // Simulate rotation: current log becomes the prior segment, a fresh log starts.
    renameSync(busLogPath(home), join(home, "events", "bus.1.jsonl"));
    writeFileSync(join(home, "events", ".rotation"), JSON.stringify({ n: 1 }));

    publish("a", { n: 3 }, "test");
    publish("a", { n: 4 }, "test");

    const fresh: any[] = [];
    drain("fresh", (e: any) => fresh.push(e));
    expect(fresh.map((e: any) => e.payload.n)).toEqual([1, 2, 3, 4]);

    const seen: any[] = [];
    drain("seen", (e: any) => seen.push(e));
    expect(seen.map((e: any) => e.payload.n)).toEqual([3, 4]);
  });

  it("subscribe delivers only new matching events, then stops after unsubscribe", async () => {
    publish("a", { n: 0 }, "test");
    const got: any[] = [];
    const off = subscribe("a", (e: any) => got.push(e), { pollMs: 20 });
    await sleep(40);
    publish("a", { n: 1 }, "test");
    publish("b", { n: 99 }, "test");
    await sleep(80);
    off();
    publish("a", { n: 2 }, "test");
    await sleep(60);
    expect(got.map((e: any) => e.payload.n)).toEqual([1]);
  });

  it("subscribe with fromStart replays the backlog and follows new events", async () => {
    publish("a", { n: 1 }, "test");
    const got: any[] = [];
    const off = subscribe("*", (e: any) => got.push(e), { pollMs: 20, fromStart: true });
    await sleep(40);
    publish("a", { n: 2 }, "test");
    await sleep(60);
    off();
    expect(got.map((e: any) => e.payload.n)).toEqual([1, 2]);
  });
});

describe("multi-home fan", () => {
  let homes: string[];
  let prevEnv: string | undefined;

  beforeEach(() => {
    homes = [mkdtempSync(join(tmpdir(), "core-bus-a-")), mkdtempSync(join(tmpdir(), "core-bus-b-"))];
    prevEnv = process.env.HUB_CONFIG_DIR;
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.HUB_CONFIG_DIR;
    else process.env.HUB_CONFIG_DIR = prevEnv;
    for (const h of homes) rmSync(h, { recursive: true, force: true });
  });

  // Publish into a specific home by pointing the bus at it for the one call.
  const publishInto = (h: string, topic: string, payload: any, source = "test") => {
    process.env.HUB_CONFIG_DIR = h;
    try { publish(topic, payload, source); } finally { delete process.env.HUB_CONFIG_DIR; }
  };

  it("drainHomes collects events from every home and returns the summed count", () => {
    publishInto(homes[0], "a", { n: 1 });
    publishInto(homes[0], "a", { n: 2 });
    publishInto(homes[1], "a", { n: 3 });
    const got: any[] = [];
    const count = drainHomes(homes, "c1", (e: any) => got.push(e));
    expect(count).toBe(3);
    expect(got.map((e: any) => e.payload.n).sort()).toEqual([1, 2, 3]);
  });

  it("drainHomes advances each home's cursor independently", () => {
    publishInto(homes[0], "a", { n: 1 });
    publishInto(homes[1], "a", { n: 2 });
    expect(drainHomes(homes, "c1", () => {})).toBe(2);

    publishInto(homes[1], "a", { n: 3 });
    const second: any[] = [];
    expect(drainHomes(homes, "c1", (e: any) => second.push(e))).toBe(1);
    expect(second.map((e: any) => e.payload.n)).toEqual([3]);
  });

  it("drainHomes de-duplicates a repeated home so an event is delivered once", () => {
    publishInto(homes[0], "a", { n: 1 });
    const got: any[] = [];
    const count = drainHomes([homes[0], homes[0]], "c1", (e: any) => got.push(e));
    expect(count).toBe(1);
    expect(got.map((e: any) => e.payload.n)).toEqual([1]);
  });

  it("subscribeHomes delivers new matching events from every home, then stops after unsubscribe", async () => {
    const got: any[] = [];
    const off = subscribeHomes(homes, "a", (e: any) => got.push(e), { pollMs: 20 });
    await sleep(40);
    publishInto(homes[0], "a", { n: 1 });
    publishInto(homes[1], "a", { n: 2 });
    publishInto(homes[0], "b", { n: 99 });
    await sleep(80);
    off();
    publishInto(homes[1], "a", { n: 3 });
    await sleep(60);
    expect(got.map((e: any) => e.payload.n).sort()).toEqual([1, 2]);
  });
});

describe("topics", () => {
  it("exposes the sync.completed topic", () => {
    expect(TOPICS.syncCompleted).toBe("sync.completed");
  });
});
