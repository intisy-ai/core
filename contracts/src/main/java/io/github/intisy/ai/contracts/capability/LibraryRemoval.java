package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** The outcome of removing a library. */
@TsInterface(data = true)
public interface LibraryRemoval {
    boolean removed();

    /** What still depended on it, which is why a removal declines rather than breaking a plugin. */
    List<String> usedBy();
}
