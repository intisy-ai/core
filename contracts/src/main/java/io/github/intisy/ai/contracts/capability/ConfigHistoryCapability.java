package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.contracts.ui.ActionResult;
import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;
import java.util.concurrent.CompletionStage;

/** Keeps a history of configuration changes and can put an earlier state back. */
@TsInterface
public interface ConfigHistoryCapability {
    /**
     * Reads recorded snapshots, newest first.
     *
     * @return every recorded snapshot.
     */
    CompletionStage<List<HistoryEntry>> history();

    /**
     * Reads the slice of recorded snapshots a query asks for, newest first.
     *
     * @param query which slice to read.
     * @return the matching snapshots.
     */
    CompletionStage<List<HistoryEntry>> history(HistoryQuery query);

    /**
     * Puts the configuration back to one recorded snapshot.
     *
     * @param entryId the snapshot to restore.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> restore(String entryId);
}
