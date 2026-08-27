package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;

/** A plugin finished installing. */
@TsInterface(data = true)
public interface PluginInstalledEvent {
    /**
     * Which plugin was installed.
     *
     * @return the plugin's name.
     */
    String name();

    /**
     * The version that was installed.
     *
     * @return the version.
     */
    String version();
}
