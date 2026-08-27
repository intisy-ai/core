package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** The active configuration profile changed. */
@TsInterface(data = true)
public interface ConfigProfileChangedEvent {
    /**
     * Name of the profile now active.
     *
     * @return the profile's name.
     */
    String profile();

    /**
     * Files the profile switch affected.
     *
     * @return the file paths, relative to the home.
     */
    List<String> files();
}
