package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** A host asking a plugin for the data behind one screen. */
@TsInterface(data = true)
public interface ScreenDataRequest {
    /**
     * Which screen the data is wanted for.
     *
     * @return the screen's id.
     */
    String screenId();

    /**
     * Absolute path of the app home to read, for a per-home screen.
     *
     * @return the home path, or null for a screen that is not per-home.
     */
    @TsOptional
    String home();

    /**
     * Marks a re-read triggered by an event or by a completed action.
     *
     * @return true when this is a re-read, null or false on the first read.
     */
    @TsOptional
    Boolean refresh();
}
