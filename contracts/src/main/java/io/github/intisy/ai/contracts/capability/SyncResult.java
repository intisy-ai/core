package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** What one reconciliation across app homes moved. */
@TsInterface(data = true)
public interface SyncResult {
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
