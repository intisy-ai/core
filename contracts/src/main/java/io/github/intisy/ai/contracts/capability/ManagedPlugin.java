package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** One plugin as the plugin manager sees it. */
@TsInterface(data = true)
public interface ManagedPlugin {
    String id();

    /** The version currently deployed, when one is known. */
    @TsOptional
    String version();

    boolean enabled();

    /** Where the plugin is installed from. */
    @TsOptional
    String url();

    /**
     * Whether this plugin updates itself when the home does.
     *
     * @implNote Readable because it is settable: a contract that takes a value and cannot give it
     * back forces every host to keep its own copy of what it just wrote.
     */
    @TsOptional
    Boolean autoUpdate();

    /** The channel this plugin declares for itself. Absent means it has never declared one. */
    @TsOptional
    PluginChannel channel();
}
