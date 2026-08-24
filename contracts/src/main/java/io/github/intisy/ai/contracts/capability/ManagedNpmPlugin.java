package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** One npm-installed plugin as the plugin manager sees it. */
@TsInterface(data = true)
public interface ManagedNpmPlugin {
    String name();

    String version();

    boolean installed();

    /**
     * The package's entry file in this home, when it resolves to one.
     *
     * @implNote An npm plugin has no deployed bundle, so without this a surface has no file to
     * probe and its settings are unreachable. Where the package resolves is the manager's
     * knowledge, not a surface's: several homes cache packages in different places.
     */
    @TsOptional
    String entryPath();
}
