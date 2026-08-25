package io.github.intisy.ai.shared.activity;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RedactionTest {

    private static Map<String, Object> change(String key, Object from, Object to) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("key", key);
        entry.put("from", from);
        entry.put("to", to);
        return entry;
    }

    private static Map<String, Object> redactOne(String key, Object from, Object to) {
        return Redaction.redactChanges(new ArrayList<Object>(Arrays.asList((Object) change(key, from, to)))).get(0);
    }

    @Test
    void treatsCredentialishKeysAsSecret() {
        for (String key : Arrays.asList("token", "refreshToken", "api_key", "apiKey", "password",
                "clientSecret", "authorization", "cookie", "key", "private_key")) {
            assertTrue(Redaction.isSecretKey(key), key);
        }
    }

    @Test
    void leavesOrdinaryKeysAlone() {
        for (String key : Arrays.asList("logConsole", "model", "enabled", "keybindings", "monkey")) {
            assertFalse(Redaction.isSecretKey(key), key);
        }
    }

    @Test
    void treatsPluralAndShorthandCredentialKeysAsSecret() {
        for (String key : Arrays.asList("auth", "oauth", "bearer", "passphrase", "session", "sessionId",
                "apikeys", "apiKeys", "accessKeys", "privateKeys", "x-api-key", "SECRET", "Password")) {
            assertTrue(Redaction.isSecretKey(key), key);
        }
    }

    /** A whole-word segment, so a word merely CONTAINING one stays visible. */
    @Test
    void doesNotTreatWordsMerelyContainingASegmentAsSecret() {
        for (String key : Arrays.asList("author", "keyword", "keybindings", "monkey", "donkey",
                "model", "enabled", "logConsole")) {
            assertFalse(Redaction.isSecretKey(key), key);
        }
    }

    @Test
    void treatsAKeyEndingInACredentialPathSegmentAsSecret() {
        for (String key : Arrays.asList("refresh", "accounts.0.refresh", "providers.x.accounts.2.refresh",
                "creds", "credentials", "Refresh", "refresh_token")) {
            assertTrue(Redaction.isSecretKey(key), key);
        }
    }

    /** The final-segment rule exists precisely so these ordinary settings stay readable. */
    @Test
    void leavesKeysThatMerelyContainRefreshAlone() {
        for (String key : Arrays.asList("refreshInterval", "refresh_interval_seconds", "refreshModels",
                "refreshQuota", "autoRefresh", "refreshed_at")) {
            assertFalse(Redaction.isSecretKey(key), key);
        }
    }

    @Test
    void stripsValuesFromSecretChangesButKeepsTheKeyVisible() {
        Map<String, Object> redacted = redactOne("refreshToken", "old", "new");

        assertEquals("refreshToken", redacted.get("key"));
        assertEquals(Boolean.TRUE, redacted.get("redacted"));
        assertFalse(redacted.containsKey("from"));
        assertFalse(redacted.containsKey("to"));
    }

    @Test
    void keepsOrdinaryScalarsAndTruncatesLongStrings() {
        Map<String, Object> flag = redactOne("enabled", Boolean.FALSE, Boolean.TRUE);
        assertEquals(Boolean.FALSE, flag.get("from"));
        assertEquals(Boolean.TRUE, flag.get("to"));

        StringBuilder long1 = new StringBuilder();
        for (int i = 0; i < 500; i++) long1.append("x");
        Map<String, Object> truncated = redactOne("note", long1.toString(), "short");
        assertEquals(200, ((String) truncated.get("from")).length());
    }

    /**
     * JSON cannot carry JavaScript's undefined, so a side that was never supplied has to stay ABSENT
     * rather than arrive back as an explicit null, which would read as "it was set to nothing".
     */
    @Test
    void leavesAnUnsuppliedSideAbsentRatherThanNull() {
        Map<String, Object> onlyFrom = new LinkedHashMap<>();
        onlyFrom.put("key", "optional");
        onlyFrom.put("from", null);

        Map<String, Object> redacted =
                Redaction.redactChanges(new ArrayList<Object>(Arrays.asList((Object) onlyFrom))).get(0);

        assertTrue(redacted.containsKey("from"));
        assertEquals(null, redacted.get("from"));
        assertFalse(redacted.containsKey("to"));
    }

    @Test
    void degradesAMalformedChangeEntrySafely() {
        List<Object> changes = new ArrayList<>();
        changes.add(change(null, "a", "b"));
        Map<String, Object> bad = Redaction.redactChanges(changes).get(0);

        assertEquals(Boolean.TRUE, bad.get("redacted"));
        assertFalse(bad.containsKey("from"));
    }

    /**
     * The guarantee that makes the whole denylist trustworthy: a credential nested under an innocuous
     * key can never reach the log, because no object is ever recorded or recursed into.
     */
    @Test
    void neverCapturesANestedObjectEvenUnderANonSecretKey() {
        Map<String, Object> nested = new LinkedHashMap<>();
        nested.put("apiKey", "sk-LEAKED");
        Map<String, Object> other = new LinkedHashMap<>();
        other.put("token", "t-LEAKED");

        Map<String, Object> redacted = redactOne("provider", nested, other);

        assertEquals("[object]", redacted.get("from"));
        assertEquals("[object]", redacted.get("to"));
        assertFalse(redacted.toString().contains("LEAKED"));
    }

    @Test
    void capturesAShortArrayOfScalarsIntact() {
        List<Object> items = new ArrayList<>(Arrays.asList((Object) "a", 2L, Boolean.TRUE));
        assertEquals(items, redactOne("tiers", null, items).get("to"));
    }

    @Test
    void replacesAnOversizedArrayWithAMarker() {
        List<Object> items = new ArrayList<>();
        for (int i = 0; i < 11; i++) items.add(Long.valueOf(i));

        assertEquals("[array]", redactOne("tiers", null, items).get("to"));
    }

    @Test
    void replacesAnArrayContainingAnObjectWithAMarker() {
        List<Object> items = new ArrayList<>(Arrays.asList((Object) "a", new LinkedHashMap<String, Object>()));

        assertEquals("[array]", redactOne("tiers", null, items).get("to"));
    }

    /** No key-based rule can catch this, so the VALUE is inspected on both sides of the change. */
    @Test
    void redactsAUrlCarryingUserinfoCredentialsOnEitherSide() {
        assertEquals(Boolean.TRUE, redactOne("proxy", "http://user:pass@host:8080", null).get("redacted"));
        assertEquals(Boolean.TRUE, redactOne("proxy", null, "https://u:p@example.com/path").get("redacted"));
        assertEquals(Boolean.TRUE,
                redactOne("proxies", new ArrayList<Object>(Arrays.asList((Object) "http://u:p@h")), null).get("redacted"));
    }

    @Test
    void leavesAnOrdinaryUrlVisible() {
        assertEquals("https://example.com/path", redactOne("endpoint", null, "https://example.com/path").get("to"));
    }

    @Test
    void redactsAUrlCarryingACredentialQueryParameter() {
        assertEquals(Boolean.TRUE, redactOne("endpoint", null, "https://example.com/x?api_key=sk-LEAKED").get("redacted"));
    }

    @Test
    void redactsUserinfoAndSecretQueryParametersInAMessage() {
        assertEquals("connected to http://<redacted>@proxy:8080",
                Redaction.redactMessage("connected to http://user:pass@proxy:8080"));
        assertEquals("GET /models?api_key=<redacted>",
                Redaction.redactMessage("GET /models?api_key=sk-LEAKED"));
    }

    @Test
    void leavesAnOrdinaryQueryParameterInAMessageAlone() {
        assertEquals("GET /models?limit=10", Redaction.redactMessage("GET /models?limit=10"));
    }

    @Test
    void passesAnEmptyOrAbsentMessageThrough() {
        assertEquals("", Redaction.redactMessage(""));
        assertEquals(null, Redaction.redactMessage(null));
    }
}
