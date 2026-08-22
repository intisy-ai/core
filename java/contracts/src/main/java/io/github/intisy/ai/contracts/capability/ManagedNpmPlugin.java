package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;

/** One npm-installed plugin as the plugin manager sees it. */
@TsInterface(data = true)
public interface ManagedNpmPlugin {
    String name();

    String version();

    boolean installed();
}
