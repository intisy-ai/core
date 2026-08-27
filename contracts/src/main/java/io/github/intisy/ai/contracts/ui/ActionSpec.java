package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** A button a plugin offers on a settings surface or a screen row. */
@TsInterface(data = true)
public interface ActionSpec {
    /**
     * The name this action is addressed by when a surface runs it.
     *
     * @return the action's id.
     */
    String id();

    /**
     * What a reader sees on the button.
     *
     * @return the action's label.
     */
    String label();

    /**
     * The explanation shown beside the button.
     *
     * @return the description, or null when the label says enough.
     */
    @TsOptional
    String description();

    /**
     * Text a surface must confirm with before running the action.
     *
     * @return the confirmation prompt, or null to run without confirming.
     */
    @TsOptional
    String confirm();

    /**
     * Marks the action as destructive, so a surface can style it as such.
     *
     * @return true when the action destroys something, null or false otherwise.
     */
    @TsOptional
    Boolean danger();

    /**
     * What this action needs collected before it runs, which a surface prompts for and passes back
     * as the run's input. Absent means the action takes none.
     *
     * @return the arguments to collect, or null for an action taking none.
     */
    @TsOptional
    List<FieldSpec> args();
}
