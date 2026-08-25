package io.github.intisy.ai.js;

import io.github.intisy.ai.api.seam.JsonCodec;
import io.github.intisy.ai.seam.JsonUtil;
import io.github.intisy.ai.seam.SimpleJsonCodec;
import io.github.intisy.ai.shared.activity.Redaction;
import io.github.intisy.ai.shared.capability.Capabilities;

import org.teavm.jso.JSExport;

import java.util.List;

/**
 * TeaVM JS export surface over core's engines: the redaction denylist deciding what an activity record
 * may carry, and the capability registry a generic dashboard renders a plugin's controls from.
 */
public final class CoreJs {
    private CoreJs() {
    }

    /** {@code Redaction.isSecretKey} -- whether a key's value must never be recorded. */
    @JSExport
    public static boolean isSecretKey(String key) {
        return Redaction.isSecretKey(key);
    }

    /**
     * {@code Redaction.redactChanges} -- {@code changesJson} is the {@code {key, from, to}} array;
     * returns the redacted array as JSON, each entry either captured or reduced to
     * {@code {key, redacted: true}}.
     */
    @JSExport
    public static String redactChanges(String changesJson) {
        JsonCodec json = new SimpleJsonCodec();
        List<Object> changes = changesJson == null ? null : JsonUtil.asList(json.parse(changesJson));
        return json.stringify(Redaction.redactChanges(changes));
    }

    /**
     * {@code Capabilities.define} -- registers a plugin's schema, merged across calls. {@code
     * schemaJson} is the declaration; a malformed entry inside it is dropped rather than rejected.
     */
    @JSExport
    public static void defineCapabilities(String name, String schemaJson) {
        JsonCodec json = new SimpleJsonCodec();
        Capabilities.define(name, schemaJson == null ? null : JsonUtil.asMap(json.parse(schemaJson)));
    }

    /**
     * {@code Capabilities.get} -- what the plugin declared, as JSON, carrying only the non-empty
     * arrays so a plugin that declared nothing yields {@code {}}.
     */
    @JSExport
    public static String getCapabilities(String name) {
        return new SimpleJsonCodec().stringify(Capabilities.get(name));
    }

    /** {@code Redaction.redactMessage} -- returns the bare message, not a JSON string. */
    @JSExport
    public static String redactMessage(String message) {
        return Redaction.redactMessage(message);
    }
}
