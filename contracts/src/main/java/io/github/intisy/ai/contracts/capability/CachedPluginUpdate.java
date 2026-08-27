package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsNullable;

/** What the last update check found for one plugin. */
@TsInterface(data = true)
public interface CachedPluginUpdate {
    /**
     * Where this plugin comes from, which decides which of the version fields below are filled.
     *
     * @return the plugin's kind.
     */
    PluginKind kind();

    /**
     * The version currently deployed in this home.
     *
     * @return the installed version, or null when nothing is deployed.
     */
    @TsNullable(asNull = true)
    String installedVersion();

    /**
     * Git only.
     *
     * @return the commit the local clone is on, or null for a plugin that is not a clone.
     */
    @TsNullable(asNull = true)
    String localHead();

    /**
     * Git only.
     *
     * @return the commit upstream is on, or null for a plugin that is not a clone.
     */
    @TsNullable(asNull = true)
    String remoteHead();

    /**
     * Npm only, the registry's latest.
     *
     * @return the newest published version, or null for a plugin that is not an npm package.
     */
    @TsNullable(asNull = true)
    String latestVersion();

    /**
     * Whether the check found something newer than what is deployed.
     *
     * @return true when an update is available.
     */
    boolean updateAvailable();

    /**
     * Whether this plugin publishes an experimental channel.
     *
     * @return true or false when known, null when the check could not tell. Null means unknown
     * rather than absent; see {@link PluginChannelState#experimentalAvailable}.
     */
    @TsNullable(asNull = true)
    Boolean experimentalAvailable();

    /**
     * Set only when a run actually applied an update.
     *
     * @return when the update was applied, or null when this check applied none.
     */
    @TsNullable(asNull = true)
    String updatedAt();
}
