package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** One library materialised in a home. */
@TsInterface(data = true)
public interface InstalledLibrary {
    /**
     * The package name this library is installed under.
     *
     * @return the specifier.
     */
    String specifier();

    /**
     * The version materialised in the home.
     *
     * @return the version.
     */
    String version();

    /**
     * The deployed plugins linking this copy, which is what makes a removal safe or not.
     *
     * @return the plugin ids, empty when nothing links it any more.
     */
    List<String> usedBy();
}
