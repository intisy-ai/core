package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** The outcome of removing a library. */
@TsInterface(data = true)
public interface LibraryRemoval {
    /**
     * Whether the library was actually removed.
     *
     * @return true when it went.
     */
    boolean removed();

    /**
     * What still depended on it, which is why a removal declines rather than breaking a plugin.
     *
     * @return the plugin ids still linking it, empty when the removal succeeded.
     */
    List<String> usedBy();
}
