package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsNullable;

/** Which channel a plugin is on, and whether the other one has anything to offer. */
@TsInterface(data = true)
public interface PluginChannelState {
    boolean onExperimental();

    /**
     * Whether an experimental build exists.
     *
     * @implNote Null means unknown, never checked or the check failed, which is NOT the same as
     * false: only a definite absence may send a plugin back to stable.
     */
    @TsNullable(asNull = true)
    Boolean experimentalAvailable();
}
