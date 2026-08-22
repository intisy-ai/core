package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.contracts.ui.ActionResult;
import io.github.intisy.ai.contracts.ui.ScreenActionRequest;
import io.github.intisy.ai.contracts.ui.ScreenData;
import io.github.intisy.ai.contracts.ui.ScreenDataRequest;
import io.github.intisy.ai.contracts.ui.ScreenSpec;
import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsMaybeAsync;
import java.util.List;
import java.util.concurrent.CompletionStage;

/** Contributes navigation entries of its own, whose contents the plugin lays out and fills. */
@TsInterface
public interface ScreensCapability {
    @TsMaybeAsync
    List<ScreenSpec> screens();

    CompletionStage<ScreenData> read(ScreenDataRequest request);

    CompletionStage<ActionResult> invoke(ScreenActionRequest request);
}
