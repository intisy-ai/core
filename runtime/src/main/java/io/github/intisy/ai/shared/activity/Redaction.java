package io.github.intisy.ai.shared.activity;

import io.github.intisy.ai.seam.JsonUtil;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * What is safe to record. Activity captures before and after values so a reader can see what actually
 * changed, which makes one central denylist the only thing standing between that and a leaked
 * credential. Everything funnels through here.
 */
public final class Redaction {
    /** Caught anywhere in the lowercased key, including run together, as in apikeys or x_api_key_value. */
    private static final List<String> SECRET_SUBSTRINGS = Arrays.asList(
            "token", "secret", "password", "passwd", "passphrase", "credential", "cookie",
            "authorization", "apikey", "api_key", "private");

    /**
     * Only secret as a COMPLETE word, never as a substring: "auth" would otherwise redact the
     * ordinary "author" field, and "key" would redact "monkey" and "keybindings".
     */
    private static final List<String> SECRET_SEGMENTS = Arrays.asList(
            "key", "keys", "auth", "oauth", "bearer", "session");

    /**
     * Only secret as the FINAL dot, underscore or hyphen segment, as in accounts.0.refresh. Matching
     * these anywhere, or as a substring, would also redact refreshInterval, refreshModels,
     * refreshQuota and autoRefresh, which are ordinary settings. The same reasoning covers "access"
     * (the OAuth access token beside refresh), "id_token" and "jwt": accessible, accessCount,
     * lastAccessed and jwtEnabled stay visible because none of them ENDS in one of these.
     */
    private static final List<String> SECRET_FINAL_PATH_SEGMENTS = Arrays.asList(
            "refresh", "creds", "credentials", "access", "id_token", "jwt");

    private static final int MAX_VALUE_CHARS = 200;
    private static final int MAX_ARRAY_ITEMS = 10;
    private static final String ARRAY_MARKER = "[array]";
    private static final String OBJECT_MARKER = "[object]";
    private static final String REDACTED = "<redacted>";

    private static final Pattern CAMEL_BOUNDARY = Pattern.compile("([a-z0-9])([A-Z])");
    private static final Pattern PATH_SEPARATORS = Pattern.compile("[_\\-.]+");

    /**
     * A URL carrying inline userinfo credentials, password included in the string itself, so no
     * key-based rule can catch it. The username class excludes ":" because a username can never
     * contain one, which stops the two unbounded classes claiming the same colon: that ambiguity is
     * what caused quadratic backtracking on a long colon-heavy non-matching string.
     */
    private static final Pattern CREDENTIAL_URL = Pattern.compile("^[a-z][a-z0-9+.-]*://[^/@:]+:[^/@]+@",
            Pattern.CASE_INSENSITIVE);

    /**
     * Userinfo sits immediately after the scheme by definition, so scanning only this leading slice
     * loses no real detection while bounding the work regardless of how long the value is.
     */
    private static final int CREDENTIAL_URL_SCAN_CHARS = 2048;

    // Both bounded and whitespace-excluding, so scanning a long message stays linear.
    private static final Pattern MESSAGE_USERINFO =
            Pattern.compile("([a-z][a-z0-9+.-]{0,20}://)[^\\s/@:]{1,256}:[^\\s/@]{1,256}@", Pattern.CASE_INSENSITIVE);
    private static final Pattern MESSAGE_QUERY_PARAM =
            Pattern.compile("([?&])([\\w.-]{1,64})=([^\\s&#]{1,512})");

    private Redaction() {
    }

    /**
     * Whether a key's value must never be recorded.
     *
     * @param key the configuration key to judge.
     * @return true when the key names a secret, by substring, by segment or by final path segment.
     */
    public static boolean isSecretKey(String key) {
        String raw = key == null ? "" : key;
        String normalized = raw.toLowerCase(Locale.ROOT);
        for (String part : SECRET_SUBSTRINGS) {
            if (normalized.contains(part)) return true;
        }
        for (String segment : splitSegments(raw)) {
            if (SECRET_SEGMENTS.contains(segment)) return true;
        }
        return SECRET_FINAL_PATH_SEGMENTS.contains(finalPathSegment(raw));
    }

    /**
     * Redacts each change, keeping the key visible so a reader still sees WHAT changed. A malformed
     * entry degrades to a redacted one rather than throwing, because losing the whole activity record
     * to one bad entry hides more than it protects.
     *
     * @param changes the {@code {key, from, to}} entries, or null for none.
     * @return each entry either captured or reduced to {@code {key, redacted: true}}.
     */
    public static List<Map<String, Object>> redactChanges(List<Object> changes) {
        List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
        if (changes == null) return out;
        for (Object entry : changes) {
            Map<String, Object> change = JsonUtil.asMap(entry);
            String key = change == null ? null : JsonUtil.asString(change.get("key"));
            if (key == null) {
                out.add(redactedChange(change == null ? "undefined" : String.valueOf(change.get("key"))));
                continue;
            }
            if (isSecretKey(key) || hasCredentialUrl(change.get("from")) || hasCredentialUrl(change.get("to"))) {
                out.add(redactedChange(key));
                continue;
            }
            Map<String, Object> captured = new LinkedHashMap<String, Object>();
            captured.put("key", key);
            // An ABSENT side stays absent rather than becoming an explicit null. JSON cannot carry
            // JavaScript's undefined, so the only way a caller still sees "this side was not supplied"
            // is for the key not to be there at all.
            if (change.containsKey("from")) captured.put("from", captureValue(change.get("from")));
            if (change.containsKey("to")) captured.put("to", captureValue(change.get("to")));
            out.add(captured);
        }
        return out;
    }

    /**
     * A message is promoted into the record's searchable text and kept for as long as retention
     * allows, so a credential interpolated into a log line must not survive it.
     *
     * @param message the message to redact, which may be null or empty.
     * @return the message with any credential in it replaced.
     */
    public static String redactMessage(String message) {
        if (message == null || message.isEmpty()) return message;

        Matcher userinfo = MESSAGE_USERINFO.matcher(message);
        StringBuffer withoutUserinfo = new StringBuffer();
        while (userinfo.find()) {
            userinfo.appendReplacement(withoutUserinfo, Matcher.quoteReplacement(userinfo.group(1) + REDACTED + "@"));
        }
        userinfo.appendTail(withoutUserinfo);

        Matcher param = MESSAGE_QUERY_PARAM.matcher(withoutUserinfo.toString());
        StringBuffer out = new StringBuffer();
        while (param.find()) {
            String replacement = isSecretKey(param.group(2))
                    ? param.group(1) + param.group(2) + "=" + REDACTED
                    : param.group(0);
            param.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        param.appendTail(out);
        return out.toString();
    }

    private static Map<String, Object> redactedChange(String key) {
        Map<String, Object> redacted = new LinkedHashMap<String, Object>();
        redacted.put("key", key);
        redacted.put("redacted", Boolean.TRUE);
        return redacted;
    }

    /** Splits on separators AND camelCase, so a segment matches a whole word: apiKey, x-api-key. */
    private static List<String> splitSegments(String key) {
        String spaced = CAMEL_BOUNDARY.matcher(key).replaceAll("$1_$2");
        List<String> segments = new ArrayList<String>();
        for (String part : PATH_SEPARATORS.split(spaced)) {
            if (!part.isEmpty()) segments.add(part.toLowerCase(Locale.ROOT));
        }
        return segments;
    }

    /** Path segments only, WITHOUT the camelCase split, so autoRefresh stays one segment. */
    private static String finalPathSegment(String key) {
        String[] parts = PATH_SEPARATORS.split(key);
        String last = key;
        for (String part : parts) {
            if (!part.isEmpty()) last = part;
        }
        return last.toLowerCase(Locale.ROOT);
    }

    /**
     * A credential can also ride in a query string as a named parameter. Reusing {@link #isSecretKey}
     * on each parameter name keeps one definition of "credential-looking key" rather than inventing a
     * second notion just for query strings.
     */
    private static boolean hasCredentialQueryParam(String scan) {
        int at = scan.indexOf('?');
        if (at < 0) return false;
        String query = scan.substring(at + 1).split("#")[0];
        for (String pair : query.split("&")) {
            if (isSecretKey(pair.split("=")[0])) return true;
        }
        return false;
    }

    private static boolean isCredentialString(String value) {
        String scan = value.length() > CREDENTIAL_URL_SCAN_CHARS
                ? value.substring(0, CREDENTIAL_URL_SCAN_CHARS)
                : value;
        return CREDENTIAL_URL.matcher(scan).find() || hasCredentialQueryParam(scan);
    }

    /** Also checks every string in a list, since a credential can arrive inside a proxies array. */
    private static boolean hasCredentialUrl(Object value) {
        if (value instanceof String) return isCredentialString((String) value);
        List<Object> items = JsonUtil.asList(value);
        if (items == null) return false;
        for (Object item : items) {
            if (item instanceof String && isCredentialString((String) item)) return true;
        }
        return false;
    }

    /**
     * Only scalars, and short lists of scalars, are ever captured. A whole object is never recorded or
     * recursed into, however innocuous it looks at a given key: that is the only way to guarantee a
     * credential nested under an unrelated key can never reach the log.
     */
    private static Object captureValue(Object value) {
        if (value instanceof String) return truncate((String) value);
        if (isScalar(value)) return value;
        List<Object> items = JsonUtil.asList(value);
        if (items == null) return OBJECT_MARKER;
        if (items.size() > MAX_ARRAY_ITEMS) return ARRAY_MARKER;

        List<Object> captured = new ArrayList<Object>();
        for (Object item : items) {
            if (!isScalar(item)) return ARRAY_MARKER;
            captured.add(item instanceof String ? truncate((String) item) : item);
        }
        return captured;
    }

    private static boolean isScalar(Object value) {
        return value == null || value instanceof String || value instanceof Number || value instanceof Boolean;
    }

    private static String truncate(String value) {
        return value.length() > MAX_VALUE_CHARS ? value.substring(0, MAX_VALUE_CHARS) : value;
    }
}
