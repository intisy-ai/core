package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** One plugin as the plugin manager sees it. */
@TsInterface(data = true)
public interface ManagedPlugin {
    String id();

    /** The version currently deployed, when one is known. */
    @TsOptional
    String version();

    boolean enabled();

    /** Where the plugin is installed from. */
    @TsOptional
    String url();
}
