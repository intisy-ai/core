package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** Every library a home holds. */
@TsInterface(data = true)
public interface HomeLibraries {
    /**
     * Materialised once and linked by several plugins.
     *
     * @return the home's shared libraries.
     */
    List<InstalledLibrary> shared();

    /**
     * Per plugin, whether the dependency is shared or private to it.
     *
     * @return what each deployed plugin depends on.
     */
    List<PluginDependencies> plugins();
}
