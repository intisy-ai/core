package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsMaybeAsync;
import java.util.List;

/** Contributes slash commands to whichever app the plugin is deployed into. */
@TsInterface
public interface CommandsCapability {
    /**
     * The slash commands this plugin contributes.
     *
     * @return the commands, empty when the plugin contributes none.
     */
    @TsMaybeAsync
    List<CommandDef> commands();
}
