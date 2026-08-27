package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** What running an action produced, for a surface to report and act on. */
@TsInterface(data = true)
public interface ActionResult {
    /**
     * Whether the action did what it was asked to.
     *
     * @return true when the action succeeded.
     */
    boolean ok();

    /**
     * One line for the surface to show, on success or on failure.
     *
     * @return the message, or null when there is nothing to say.
     */
    @TsOptional
    String message();

    /**
     * Asks the surface to re-read the screen's data because the action changed it.
     *
     * @return true when the surface should re-read, null when nothing changed.
     */
    @TsOptional
    Boolean refresh();
}
