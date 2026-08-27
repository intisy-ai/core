package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.Map;

/** The result of the last update check, keyed by plugin id. */
@TsInterface(data = true)
public interface PluginUpdateCache {
    /**
     * When the check that produced this ran.
     *
     * @return the check's timestamp.
     */
    String checkedAt();

    /**
     * What the check found, keyed by plugin id.
     *
     * @return each plugin's result.
     */
    Map<String, CachedPluginUpdate> plugins();
}
