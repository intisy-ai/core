package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.contracts.ui.ActionResult;
import io.github.intisy.ai.contracts.ui.CapabilitySchema;
import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsMaybeAsync;
import java.util.Map;
import java.util.concurrent.CompletionStage;

/** Declares configurable settings, actions, and the sections a settings surface renders them in. */
@TsInterface
public interface SettingsCapability {
    /**
     * Everything this plugin declares about its settings, actions and sections.
     *
     * @return the schema a settings surface renders.
     */
    @TsMaybeAsync
    CapabilitySchema schema();

    /**
     * Runs one of the declared actions.
     *
     * @implNote Two overloads rather than one optional parameter: the processor emits Java overloads
     * as TypeScript overload signatures, so an action taking no input needs no annotation.
     *
     * @param actionId which declared action to run.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> run(String actionId);

    /**
     * Runs one of the declared actions with the input a surface collected for it.
     *
     * @param actionId which declared action to run.
     * @param input the values the surface collected, keyed by field.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> run(String actionId, Map<String, Object> input);
}
