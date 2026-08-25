package io.github.intisy.ai.js;

import io.github.intisy.ai.api.seam.JsonCodec;
import io.github.intisy.ai.seam.JsonUtil;
import io.github.intisy.ai.seam.SimpleJsonCodec;
import io.github.intisy.ai.shared.activity.Redaction;

import org.teavm.jso.JSExport;

import java.util.List;

/**
 * TeaVM JS export surface over core's engines. Redaction only for now: the denylist deciding what an
 * activity record may carry is the one piece of core whose drift between two implementations would be
 * a leaked credential rather than a cosmetic difference.
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

    /** {@code Redaction.redactMessage} -- returns the bare message, not a JSON string. */
    @JSExport
    public static String redactMessage(String message) {
        return Redaction.redactMessage(message);
    }
}
