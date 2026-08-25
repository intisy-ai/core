import { describe, it, expect } from "vitest";
import { byOrderThenLabel } from "../contribution-order.js";

const ACCENTED = "Über";

describe("byOrderThenLabel", () => {
  it("sorts by declared order and puts an undeclared one last", () => {
    const sorted = [{ label: "None" }, { label: "Late", order: 10 }, { label: "Early", order: 1 }].sort(byOrderThenLabel);
    expect(sorted.map((entry) => entry.label)).toEqual(["Early", "Late", "None"]);
  });

  it("breaks an equal order by label, case-insensitively and lowercase first", () => {
    const sorted = [{ label: "Beta", order: 5 }, { label: "alpha", order: 5 }, { label: "Alpha", order: 5 }].sort(byOrderThenLabel);
    expect(sorted.map((entry) => entry.label)).toEqual(["alpha", "Alpha", "Beta"]);
  });

  // The reason this comparator cannot move to the Java runtime beside the capability registry:
  // localeCompare collates an accented letter with its unaccented base, and TeaVM 0.15.0 ships no
  // java.text.Collator, so any port would sort this label after "Zeta" instead of before it.
  it("collates an accented label with its unaccented base, not by code point", () => {
    expect(byOrderThenLabel({ label: ACCENTED }, { label: "Zeta" })).toBeLessThan(0);
    expect(ACCENTED.codePointAt(0)).toBeGreaterThan("Zeta".codePointAt(0)!);
  });
});
