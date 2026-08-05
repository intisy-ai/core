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

  it("treats a key ending in refresh/creds/credentials as secret", () => {
    for (const key of ["refresh", "accounts.0.refresh", "providers.x.accounts.2.refresh", "creds", "credentials", "Refresh", "refresh_token"]) {
      expect(isSecretKey(key)).toBe(true);
    }
  });

  it("leaves keys that merely contain refresh as a substring or non-final segment alone", () => {
    for (const key of ["refreshInterval", "refresh_interval_seconds", "refreshModels", "refreshQuota", "autoRefresh", "refreshed_at"]) {
      expect(isSecretKey(key)).toBe(false);
    }
  });

  it("redacts a value that is a URL carrying userinfo credentials, on either side of the change", () => {
    for (const url of ["http://user:pa55w0rd@proxy.example:8080", "socks5://u:p@host:1080", "https://admin:s3cret@internal.example/path"]) {
      const [change] = redactChanges([describeChange("proxy.url", url, "http://proxy.example:8080")]);
      expect(change).toEqual({ key: "proxy.url", redacted: true });
    }
    const [fromOnly] = redactChanges([describeChange("proxy.url", "http://user:pa55w0rd@proxy.example:8080", "enabled")]);
    expect(fromOnly).toEqual({ key: "proxy.url", redacted: true });
  });

  it("redacts a colon inside the password, and leaves a bare username with no colon visible", () => {
    const [withExtraColon] = redactChanges([describeChange("proxy.url", "http://u:p:extra@host/x", "http://host/x")]);
    expect(withExtraColon).toEqual({ key: "proxy.url", redacted: true });

    const [noColon] = redactChanges([describeChange("proxy.url", "http://user@host/x", "http://user@host/x")]);
    expect(noColon.redacted).toBeUndefined();
    expect(noColon.from).toBe("http://user@host/x");
  });

  it("leaves ordinary URLs and non-credential values alone", () => {
    const values = [
      "https://api.wakatime.com/api/v1",
      "http://127.0.0.1:34567",
      "user:pw",
      "mailto:someone@example.com",
      "https://example.com/path@v2",
      "ssh://git@github.com/x.git",
    ];
    for (const value of values) {
      const [change] = redactChanges([describeChange("endpoint", value, value)]);
      expect(change.redacted).toBeUndefined();
      expect(change.from).toBe(value);
    }
    const [boolChange] = redactChanges([describeChange("enabled", true, false)]);
    expect(boolChange.redacted).toBeUndefined();
    const [numChange] = redactChanges([describeChange("count", 42, 43)]);
    expect(numChange.redacted).toBeUndefined();
  });

  it("does not hang or blow up on a pathological colon-heavy value", () => {
    const pathological = "http://" + ":".repeat(200_000);
    const started = Date.now();
    const [change] = redactChanges([describeChange("proxy.url", pathological, "ok")]);
    const elapsedMs = Date.now() - started;
    expect(change.redacted).toBeUndefined();
    expect(elapsedMs).toBeLessThan(1000);
  });

  it("redacts an array containing a credential-bearing URL, even though the array itself is not the top-level string", () => {
    const [change] = redactChanges([describeChange("proxies", undefined, ["http://u:p@h1:1", "http://h2:2"])]);
    expect(change).toEqual({ key: "proxies", redacted: true });
  });

  it("leaves an array of ordinary URLs, with no credentials, fully visible", () => {
    const [change] = redactChanges([describeChange("proxies", undefined, ["http://h1:1", "http://h2:2"])]);
    expect(change.redacted).toBeUndefined();
    expect(change.to).toEqual(["http://h1:1", "http://h2:2"]);
  });

  it("redacts an array carrying a credential URL only on the `from` side", () => {
    const [change] = redactChanges([describeChange("proxies", ["http://u:p@h1:1"], ["http://h1:1"])]);
    expect(change).toEqual({ key: "proxies", redacted: true });
  });

  it("never leaks a credential URL nested inside an array-of-arrays or an array-of-objects: the marker hides it, not the credential rule", () => {
    const [nestedArray] = redactChanges([describeChange("proxies", undefined, [["http://u:p@h1:1"]])]);
    expect(nestedArray.to).toBe("[array]");
    expect(JSON.stringify(nestedArray)).not.toContain("u:p@h1");

    const [arrayOfObjects] = redactChanges([describeChange("proxies", undefined, [{ url: "http://u:p@h1:1" }])]);
    expect(arrayOfObjects.to).toBe("[array]");
    expect(JSON.stringify(arrayOfObjects)).not.toContain("u:p@h1");
  });

  it("treats accounts.0.access, id_token, and jwt final segments as secret, matching the already-hardened refresh field", () => {
    for (const key of ["accounts.0.access", "access", "id_token", "accounts.0.id_token", "jwt", "providers.x.jwt"]) {
      expect(isSecretKey(key)).toBe(true);
    }
    const [change] = redactChanges([describeChange("accounts.0.access", "ya29.SECRETACCESS", "ya29.NEW")]);
    expect(change).toEqual({ key: "accounts.0.access", redacted: true });
    expect(JSON.stringify(change)).not.toContain("SECRETACCESS");
  });

  it("leaves keys that merely contain access/jwt as a non-final segment or substring alone", () => {
    for (const key of ["accessible", "access_interval", "accessCount", "lastAccessed", "jwtEnabled"]) {
      expect(isSecretKey(key)).toBe(false);
    }
  });

  // id_token_hint_url is redacted too, but not by the new final-segment rule (its
  // final segment is "url"): it already contains "token" as a substring, which the
  // pre-existing SECRET_SUBSTRINGS rule catches regardless of position. That is
  // correct behavior to keep, so this is pinned rather than treated as a bug.
  it("redacts id_token_hint_url via the pre-existing token substring rule, not the new final-segment rule", () => {
    expect(isSecretKey("id_token_hint_url")).toBe(true);
  });

  it("redacts a credential-looking parameter inside a URL's query string", () => {
    const [change] = redactChanges([describeChange("api_url", "https://api.example/v1?api_key=SECRET", "https://api.example/v1")]);
    expect(change).toEqual({ key: "api_url", redacted: true });
  });

  it("leaves an ordinary query string, with no credential-looking parameter names, visible", () => {
    const [change] = redactChanges([describeChange("api_url", "https://api.example/v1?page=2&sort=name", "https://api.example/v1?page=2&sort=name")]);
    expect(change.redacted).toBeUndefined();
    expect(change.from).toBe("https://api.example/v1?page=2&sort=name");
  });
});
