package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** One plugin as the plugin manager sees it. */
@TsInterface(data = true)
public interface ManagedPlugin {
    /**
     * What this plugin is addressed by, and the name its deployed artifacts carry.
     *
     * @return the plugin's id.
     */
    String id();

    /**
     * The version currently deployed, when one is known.
     *
     * @return the deployed version, or null when nothing is deployed yet.
     */
    @TsOptional
    String version();

    /**
     * Whether the home loads this plugin.
     *
     * @return true when the plugin loads.
     */
    boolean enabled();

    /**
     * Where the plugin is installed from.
     *
     * @return the source url, or null for a plugin recorded without one.
     */
    @TsOptional
    String url();

    /**
     * Whether this plugin updates itself when the home does.
     *
     * @implNote Readable because it is settable: a contract that takes a value and cannot give it
     * back forces every host to keep its own copy of what it just wrote.
     *
     * @return true when the plugin updates with the home, or null when it has never been set.
     */
    @TsOptional
    Boolean autoUpdate();

    /**
     * The channel this plugin declares for itself. Absent means it has never declared one.
     *
     * @return the declared channel, or null when the plugin has declared none.
     */
    @TsOptional
    PluginChannel channel();
}
