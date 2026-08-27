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
    /**
     * The navigation entries this plugin contributes.
     *
     * @return the screens, empty when the plugin contributes none.
     */
    @TsMaybeAsync
    List<ScreenSpec> screens();

    /**
     * Fills one screen's layout with data.
     *
     * @param request which screen, in which home, and whether this is a re-read.
     * @return the data, keyed by the source names the layout references.
     */
    CompletionStage<ScreenData> read(ScreenDataRequest request);

    /**
     * Runs one of a screen's actions.
     *
     * @param request which action, on which screen, with whatever input the surface collected.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> invoke(ScreenActionRequest request);
}
