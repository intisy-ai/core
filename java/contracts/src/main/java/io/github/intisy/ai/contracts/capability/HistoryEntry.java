package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** One recorded configuration snapshot. */
@TsInterface(data = true)
public interface HistoryEntry {
    String id();

    /** When it was taken, in epoch milliseconds. */
    double ts();

    /** One line describing what changed. */
    String summary();

    List<String> files();
}
