package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** The active configuration profile changed. */
@TsInterface(data = true)
public interface ConfigProfileChangedEvent {
    /** Name of the profile now active. */
    String profile();

    /** Files the profile switch affected. */
    List<String> files();
}
