package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsEnum;

/**
 * The release channel a plugin tracks.
 *
 * @implNote {@code inherit} is a real answer, not the absence of one: it says the plugin follows
 * whatever the home is set to, which is a different state from pinning the channel the home happens
 * to be on today. A surface that could not express it could never put a plugin back.
 */
@TsEnum
public enum PluginChannel {
    inherit,
    stable,
    experimental
}
