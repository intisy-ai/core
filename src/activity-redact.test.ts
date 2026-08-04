import { describe, it, expect } from "vitest";
import { isSecretKey, redactChanges, describeChange } from "./activity-redact.js";

describe("redaction", () => {
  it("treats credential-ish keys as secret", () => {
    for (const key of ["token", "refreshToken", "api_key", "apiKey", "password", "clientSecret", "authorization", "cookie", "key", "private_key"]) {
      expect(isSecretKey(key)).toBe(true);
    }
  });

  it("leaves ordinary keys alone", () => {
    for (const key of ["logConsole", "model", "enabled", "keybindings", "monkey"]) {
      expect(isSecretKey(key)).toBe(false);
    }
  });

  it("treats plural and shorthand credential keys as secret", () => {
    for (const key of ["auth", "oauth", "bearer", "passphrase", "session", "sessionId", "apikeys", "apiKeys", "accessKeys", "privateKeys", "x-api-key", "SECRET", "Password"]) {
      expect(isSecretKey(key)).toBe(true);
    }
  });

  it("does not treat words merely containing a credential segment as secret", () => {
    for (const key of ["author", "keyword", "keybindings", "monkey", "donkey", "model", "enabled", "logConsole"]) {
      expect(isSecretKey(key)).toBe(false);
    }
  });

  it("strips values from secret changes but keeps the key visible", () => {
    const [change] = redactChanges([describeChange("refreshToken", "old-secret", "new-secret")]);
    expect(change.key).toBe("refreshToken");
    expect(change.redacted).toBe(true);
    expect(change.from).toBeUndefined();
    expect(change.to).toBeUndefined();
  });

  it("keeps ordinary values and truncates long ones", () => {
    const [flag] = redactChanges([describeChange("logConsole", false, true)]);
    expect(flag.from).toBe(false);
    expect(flag.to).toBe(true);
    const [long] = redactChanges([describeChange("model", "x".repeat(500), "y")]);
    expect(String(long.from).length).toBeLessThanOrEqual(200);
  });

  it("degrades a malformed change entry safely instead of throwing", () => {
    const [bad] = redactChanges([{ from: "x" } as any]);
    expect(bad.redacted).toBe(true);
    expect(bad.from).toBeUndefined();
  });

  it("never captures a nested object, even under a non-secret key", () => {
    const [change] = redactChanges([describeChange("provider", { apiKey: "sk-LEAKED", nested: { token: "t-LEAKED" } }, {})]);
    expect(change.key).toBe("provider");
    expect(change.from).toBe("[object]");
    expect(change.to).toBe("[object]");
    expect(JSON.stringify(change)).not.toContain("sk-LEAKED");
    expect(JSON.stringify(change)).not.toContain("t-LEAKED");
  });

  it("captures a short array of scalars intact", () => {
    const [change] = redactChanges([describeChange("tags", undefined, ["a", 2, true])]);
    expect(change.to).toEqual(["a", 2, true]);
  });

  it("replaces an array over the size limit with a marker", () => {
    const big = Array.from({ length: 11 }, (_, i) => i);
    const [change] = redactChanges([describeChange("ids", undefined, big)]);
    expect(change.to).toBe("[array]");
  });

  it("replaces an array containing an object with a marker", () => {
    const [change] = redactChanges([describeChange("items", undefined, ["a", { x: 1 }])]);
    expect(change.to).toBe("[array]");
  });

  it("passes scalars through unchanged", () => {
    const [n] = redactChanges([describeChange("count", 1, 2)]);
    expect(n.from).toBe(1);
    expect(n.to).toBe(2);
    const [b] = redactChanges([describeChange("enabled", false, true)]);
    expect(b.from).toBe(false);
    expect(b.to).toBe(true);
    const [nullish] = redactChanges([describeChange("optional", null, undefined)]);
    expect(nullish.from).toBeNull();
    expect(nullish.to).toBeUndefined();
  });

  it("still truncates a long string to 200 chars", () => {
    const [long] = redactChanges([describeChange("model", "z".repeat(500), "ok")]);
    expect(String(long.from).length).toBe(200);
  });
});
