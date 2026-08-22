package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** Which slice of the configuration history a caller wants. */
@TsInterface(data = true)
public interface HistoryQuery {
    /** Absolute path of the app home to read. */
    @TsOptional
    String home();

    @TsOptional
    Double limit();

    /** Opaque cursor from a previous page. */
    @TsOptional
    String cursor();
}
