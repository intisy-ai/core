package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** Which slice of the configuration history a caller wants. */
@TsInterface(data = true)
public interface HistoryQuery {
    /**
     * Absolute path of the app home to read.
     *
     * @return the home path, or null to read the home the capability was resolved against.
     */
    @TsOptional
    String home();

    /**
     * How many snapshots one page may hold.
     *
     * @return the page size, or null to let the implementation choose.
     */
    @TsOptional
    Double limit();

    /**
     * Opaque cursor from a previous page.
     *
     * @return the cursor to resume from, or null to start at the newest snapshot.
     */
    @TsOptional
    String cursor();
}
