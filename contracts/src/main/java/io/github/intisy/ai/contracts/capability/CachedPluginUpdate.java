package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsNullable;

/** What the last update check found for one plugin. */
@TsInterface(data = true)
public interface CachedPluginUpdate {
    PluginKind kind();

    @TsNullable(asNull = true)
    String installedVersion();

    /** Git only. */
    @TsNullable(asNull = true)
    String localHead();

    /** Git only. */
    @TsNullable(asNull = true)
    String remoteHead();

    /** Npm only, the registry's latest. */
    @TsNullable(asNull = true)
    String latestVersion();

    boolean updateAvailable();

    /** Null means unknown rather than absent; see {@link PluginChannelState#experimentalAvailable}. */
    @TsNullable(asNull = true)
    Boolean experimentalAvailable();

    /** Set only when a run actually applied an update. */
    @TsNullable(asNull = true)
    String updatedAt();
}
