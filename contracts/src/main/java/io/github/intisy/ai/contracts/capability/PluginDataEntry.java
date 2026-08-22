package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** One path a plugin left behind in a home. */
@TsInterface(data = true)
public interface PluginDataEntry {
    /**
     * Relative to the home.
     *
     * @implNote Relative rather than absolute because this is what a delete confirmation shows, and
     * the home is the thing being cleaned.
     */
    String path();

    long bytes();

    /** Set where the plugin asked for this path rather than naming conventions finding it. */
    @TsOptional
    Boolean declared();
}
