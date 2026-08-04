// Typed surface for the Activity convention. The runtime (activity.ts) is
// @ts-nocheck; these types are advisory, mirroring the bus.ts/bus.types.ts split.

export type Actor = "user" | "system" | "app";

export type Impact = "debug" | "info" | "notice" | "warning" | "error";

export interface Subject {
  kind: string;
  id?: string;
  label?: string;
}

export interface ActivitySpec {
  topic: string;
  action: string;
  actor?: Actor;
  impact?: Impact;
  subject?: Subject;
  details?: Record<string, unknown>;
}

export interface ActivityRecord {
  id: string;
  ts: number;
  home: string;
  topic: string;
  action: string;
  actor: Actor;
  impact: Impact;
  source: string;
  subject?: Subject;
  details: Record<string, unknown>;
  text: string;
}
