package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.contracts.ui.ActionResult;
import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;
import java.util.concurrent.CompletionStage;

/** Keeps a history of configuration changes and can put an earlier state back. */
@TsInterface
public interface ConfigHistoryCapability {
    /** Reads recorded snapshots, newest first. */
    CompletionStage<List<HistoryEntry>> history();

    CompletionStage<List<HistoryEntry>> history(HistoryQuery query);

    CompletionStage<ActionResult> restore(String entryId);
}
