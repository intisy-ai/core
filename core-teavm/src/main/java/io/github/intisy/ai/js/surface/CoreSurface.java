package io.github.intisy.ai.js.surface;

import io.github.intisy.ai.tsemit.TsModule;

/**
 * The JavaScript module surface {@link io.github.intisy.ai.js.CoreJs} exports, typed for a
 * TypeScript consumer.
 *
 * @implNote Never implemented, only emitted: {@link TsModule} renders its members as free functions,
 * which is the shape a TeaVM ES2015 module actually exports. Two engines are wrapped here, redaction
 * and the capability registry, and both carry their compound values as JSON because neither has a
 * structural type a JS caller reads field by field.
 */
@TsModule
public interface CoreSurface {

    /** Whether a key's value must never be recorded. */
    boolean isSecretKey(String key);

    /**
     * Redacts a change list, given the {@code {key, from, to}} array as JSON.
     *
     * @implNote Each entry comes back either captured or reduced to {@code {key, redacted: true}},
     * so a caller cannot tell a redacted value from a missing one, which is the point.
     */
    String redactChanges(String changesJson);

    /** Redacts one message, returning the bare message rather than a JSON string. */
    String redactMessage(String message);

    /**
     * Registers a plugin's capability schema, merged across calls.
     *
     * @implNote A malformed entry inside the schema is dropped rather than rejected, so one bad
     * declaration never crashes app launch.
     */
    void defineCapabilities(String name, String schemaJson);

    /**
     * What the plugin declared, as JSON.
     *
     * @implNote Only the non-empty arrays are carried, so a plugin that declared nothing yields an
     * empty object rather than a shape full of empty lists.
     */
    String getCapabilities(String name);
}
