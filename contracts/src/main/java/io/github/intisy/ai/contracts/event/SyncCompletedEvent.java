package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** A cross-app reconciliation finished. */
@TsInterface(data = true)
public interface SyncCompletedEvent {
    /**
     * The files reconciled across the homes.
     *
     * @return the file paths, relative to each home.
     */
    List<String> files();

    /**
     * Plugins whose entries were mirrored.
     *
     * @return the plugin ids.
     */
    List<String> plugins();

    /**
     * App homes involved in the reconciliation.
     *
     * @return the home paths.
     */
    List<String> homes();
}
