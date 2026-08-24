package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.Map;

/** The result of the last update check, keyed by plugin id. */
@TsInterface(data = true)
public interface PluginUpdateCache {
    String checkedAt();

    Map<String, CachedPluginUpdate> plugins();
}
