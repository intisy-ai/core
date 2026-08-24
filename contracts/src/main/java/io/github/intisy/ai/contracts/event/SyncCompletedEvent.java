package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** A cross-app reconciliation finished. */
@TsInterface(data = true)
public interface SyncCompletedEvent {
    List<String> files();

    /** Plugins whose entries were mirrored. */
    List<String> plugins();

    /** App homes involved in the reconciliation. */
    List<String> homes();
}
