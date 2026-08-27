package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** What one plugin depends on. */
@TsInterface(data = true)
public interface PluginDependencies {
    /**
     * Which deployed plugin this describes.
     *
     * @return the plugin's id.
     */
    String plugin();

    /**
     * The libraries it links, shared or private alike.
     *
     * @return its dependencies.
     */
    List<InstalledLibrary> dependencies();
}
