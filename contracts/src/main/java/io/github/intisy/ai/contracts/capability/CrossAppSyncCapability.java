package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.concurrent.CompletionStage;

/** Reconciles state across the app homes on this machine. */
@TsInterface
public interface CrossAppSyncCapability {
    /**
     * Reconciles the configured state across every app home on this machine.
     *
     * @return what the reconciliation moved.
     */
    CompletionStage<SyncResult> sync();
}
