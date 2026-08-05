// @ts-nocheck
// What retention is acting on, cheaply: total size, how many segments, and the
// oldest event still on disk. Deliberately no record count: that would mean reading
// every byte of an unbounded history to render a settings screen.

import { statSync, readFileSync } from "fs";
import { segmentPathsNewestFirst, parseEnvelopeText } from "./bus.js";

function firstTimestamp(path) {
  try {
    const text = readFileSync(path, "utf8");
    const newline = text.indexOf("\n");
    const [envelope] = parseEnvelopeText(newline === -1 ? text : text.slice(0, newline));
    return envelope && typeof envelope.ts === "number" ? envelope.ts : undefined;
  } catch {
    return undefined;
  }
}

// segmentPathsNewestFirst leads with the live log whether or not it exists, so a
// path that cannot be stat'd is simply not a segment.
function statsForHome(home) {
  const result = { home, bytes: 0, segments: 0 };
  let paths = [];
  try { paths = segmentPathsNewestFirst(home) || []; } catch { return result; }
  const present = [];
  for (const path of paths) {
    let size;
    try { size = statSync(path).size; } catch { continue; }
    result.bytes += size;
    result.segments += 1;
    present.push(path);
  }
  const oldest = present.length ? firstTimestamp(present[present.length - 1]) : undefined;
  if (typeof oldest === "number") result.oldestTs = oldest;
  return result;
}

export function activityStats(homes) {
  const list = Array.isArray(homes) ? homes : [];
  const perHome = list.map(statsForHome);
  const total = { homes: perHome, bytes: 0, segments: 0 };
  for (const entry of perHome) {
    total.bytes += entry.bytes;
    total.segments += entry.segments;
    if (typeof entry.oldestTs === "number" && (total.oldestTs === undefined || entry.oldestTs < total.oldestTs)) {
      total.oldestTs = entry.oldestTs;
    }
  }
  return total;
}
