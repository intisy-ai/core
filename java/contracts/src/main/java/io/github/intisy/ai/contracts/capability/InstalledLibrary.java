package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** One library materialised in a home. */
@TsInterface(data = true)
public interface InstalledLibrary {
    String specifier();

    String version();

    /** The deployed plugins linking this copy, which is what makes a removal safe or not. */
    List<String> usedBy();
}
