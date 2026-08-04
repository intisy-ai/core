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
});
