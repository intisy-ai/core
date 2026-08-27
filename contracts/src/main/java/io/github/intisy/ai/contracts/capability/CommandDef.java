package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** One slash command a plugin deploys into an app. */
@TsInterface(data = true)
public interface CommandDef {
    /**
     * Command name, which becomes the deployed file name.
     *
     * @return the command's name.
     */
    String name();

    /**
     * One line shown in the command picker.
     *
     * @return the description.
     */
    String description();

    /**
     * Hint describing the arguments, for example {@code list | get <key> | set <key> <value>}.
     *
     * @return the argument hint, or null for a command taking none.
     */
    @TsOptional
    String argumentHint();

    /**
     * Markdown the model sees when the command runs.
     *
     * @return the body, or null for a command that only runs its shell.
     */
    @TsOptional
    String body();

    /**
     * Shell run before the body, whose output the body follows.
     *
     * @return the shell to run, or null for a command that runs none.
     */
    @TsOptional
    String shell();
}
