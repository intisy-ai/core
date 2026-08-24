package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** What one plugin depends on. */
@TsInterface(data = true)
public interface PluginDependencies {
    String plugin();

    List<InstalledLibrary> dependencies();
}
