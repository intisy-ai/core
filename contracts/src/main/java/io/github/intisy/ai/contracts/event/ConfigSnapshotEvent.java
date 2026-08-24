package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** A configuration snapshot was taken. */
@TsInterface(data = true)
public interface ConfigSnapshotEvent {
    /** Snapshot content hash. */
    String hash();

    /** Why the snapshot was taken. */
    String reason();

    List<String> files();
}
