package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** A long-running plugin operation reported progress. */
@TsInterface(data = true)
public interface PluginProgressEvent {
    String name();

    /** Current phase of the operation. */
    String phase();

    /** Completion percentage, when known. */
    @TsOptional
    Double pct();
}
