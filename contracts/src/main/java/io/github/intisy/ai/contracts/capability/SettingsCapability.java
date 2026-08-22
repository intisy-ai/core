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
    @TsMaybeAsync
    CapabilitySchema schema();

    /**
     * Runs one of the declared actions.
     *
     * @implNote Two overloads rather than one optional parameter: the processor emits Java overloads
     * as TypeScript overload signatures, so an action taking no input needs no annotation.
     */
    CompletionStage<ActionResult> run(String actionId);

    CompletionStage<ActionResult> run(String actionId, Map<String, Object> input);
}
