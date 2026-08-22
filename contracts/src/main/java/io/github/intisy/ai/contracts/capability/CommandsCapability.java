package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsMaybeAsync;
import java.util.List;

/** Contributes slash commands to whichever app the plugin is deployed into. */
@TsInterface
public interface CommandsCapability {
    @TsMaybeAsync
    List<CommandDef> commands();
}
