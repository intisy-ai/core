package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;

/** A plugin finished installing. */
@TsInterface(data = true)
public interface PluginInstalledEvent {
    String name();

    String version();
}
