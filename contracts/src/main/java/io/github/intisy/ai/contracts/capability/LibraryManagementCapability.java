package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.concurrent.CompletionStage;

/**
 * Manages the shared libraries a home materialises for its plugins.
 *
 * @implNote Minted beside {@link PluginManagementCapability} rather than folded into it, because a
 * library is a different noun: a host lists and prunes libraries on their own screen, and a library
 * outlives the plugin that first pulled it in. Every method acts on the home this capability was
 * resolved against, so nothing here takes one as a parameter.
 */
@TsInterface
public interface LibraryManagementCapability {
    /**
     * Every library in this home, shared and per-plugin.
     *
     * @return what the home holds.
     */
    CompletionStage<HomeLibraries> libraries();

    /**
     * Removes one library, declining while something still depends on it.
     *
     * @param specifier the library to remove.
     * @return whether it went, and what still depended on it when it did not.
     */
    CompletionStage<LibraryRemoval> remove(String specifier);
}
