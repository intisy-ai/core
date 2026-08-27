package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.Map;

/** A host asking a plugin to run one of a screen's actions. */
@TsInterface(data = true)
public interface ScreenActionRequest {
    /**
     * Which screen the action belongs to.
     *
     * @return the screen's id.
     */
    String screenId();

    /**
     * Which of that screen's actions to run.
     *
     * @return the action's id.
     */
    String actionId();

    /**
     * Absolute path of the app home to act on, for a per-home screen.
     *
     * @return the home path, or null for a screen that is not per-home.
     */
    @TsOptional
    String home();

    /**
     * Values the surface collected for the action.
     *
     * @return the collected input keyed by field, or null for an action taking none.
     */
    @TsOptional
    Map<String, Object> input();
}
