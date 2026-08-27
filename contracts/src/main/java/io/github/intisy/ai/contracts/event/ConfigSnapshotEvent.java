package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** A configuration snapshot was taken. */
@TsInterface(data = true)
public interface ConfigSnapshotEvent {
    /**
     * Snapshot content hash.
     *
     * @return the hash, which is what tells two snapshots apart.
     */
    String hash();

    /**
     * Why the snapshot was taken.
     *
     * @return the reason.
     */
    String reason();

    /**
     * The configuration files this snapshot covers.
     *
     * @return the file paths, relative to the home.
     */
    List<String> files();
}
