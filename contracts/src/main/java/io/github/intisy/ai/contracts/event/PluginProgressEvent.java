package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** A long-running plugin operation reported progress. */
@TsInterface(data = true)
public interface PluginProgressEvent {
    /**
     * Which plugin the operation is running against.
     *
     * @return the plugin's name.
     */
    String name();

    /**
     * Current phase of the operation.
     *
     * @return the phase.
     */
    String phase();

    /**
     * Completion percentage, when known.
     *
     * @return how far along the operation is, or null when it cannot say.
     */
    @TsOptional
    Double pct();
}
