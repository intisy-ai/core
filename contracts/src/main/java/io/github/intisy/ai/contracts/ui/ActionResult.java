package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** What running an action produced, for a surface to report and act on. */
@TsInterface(data = true)
public interface ActionResult {
    boolean ok();

    /** One line for the surface to show, on success or on failure. */
    @TsOptional
    String message();

    /** Asks the surface to re-read the screen's data because the action changed it. */
    @TsOptional
    Boolean refresh();
}
