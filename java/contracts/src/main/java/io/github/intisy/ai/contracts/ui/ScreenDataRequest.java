package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** A host asking a plugin for the data behind one screen. */
@TsInterface(data = true)
public interface ScreenDataRequest {
    String screenId();

    /** Absolute path of the app home to read, for a per-home screen. */
    @TsOptional
    String home();

    /** Marks a re-read triggered by an event or by a completed action. */
    @TsOptional
    Boolean refresh();
}
