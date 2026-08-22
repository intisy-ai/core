package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.concurrent.CompletionStage;

/** Reconciles state across the app homes on this machine. */
@TsInterface
public interface CrossAppSyncCapability {
    CompletionStage<SyncResult> sync();
}
