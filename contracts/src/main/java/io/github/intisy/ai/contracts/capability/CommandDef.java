package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** One slash command a plugin deploys into an app. */
@TsInterface(data = true)
public interface CommandDef {
    /** Command name, which becomes the deployed file name. */
    String name();

    /** One line shown in the command picker. */
    String description();

    /** Hint describing the arguments, for example {@code list | get <key> | set <key> <value>}. */
    @TsOptional
    String argumentHint();

    /** Markdown the model sees when the command runs. */
    @TsOptional
    String body();

    /** Shell run before the body, whose output the body follows. */
    @TsOptional
    String shell();
}
