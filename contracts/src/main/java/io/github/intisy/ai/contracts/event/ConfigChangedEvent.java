package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;

/** A plugin's configuration file changed. */
@TsInterface(data = true)
public interface ConfigChangedEvent {
    /** Config name that changed. */
    String name();
}
