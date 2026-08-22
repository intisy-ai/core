package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.Map;

/** A host asking a plugin to run one of a screen's actions. */
@TsInterface(data = true)
public interface ScreenActionRequest {
    String screenId();

    String actionId();

    /** Absolute path of the app home to act on, for a per-home screen. */
    @TsOptional
    String home();

    /** Values the surface collected for the action. */
    @TsOptional
    Map<String, Object> input();
}
