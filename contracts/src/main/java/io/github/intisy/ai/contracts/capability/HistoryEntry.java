package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** One recorded configuration snapshot. */
@TsInterface(data = true)
public interface HistoryEntry {
    /**
     * What this snapshot is addressed by when restoring it.
     *
     * @return the snapshot's id.
     */
    String id();

    /**
     * When it was taken, in epoch milliseconds.
     *
     * @return the timestamp.
     */
    double ts();

    /**
     * One line describing what changed.
     *
     * @return the summary.
     */
    String summary();

    /**
     * The configuration files this snapshot covers.
     *
     * @return the file paths, relative to the home.
     */
    List<String> files();
}
