package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** A button a plugin offers on a settings surface or a screen row. */
@TsInterface(data = true)
public interface ActionSpec {
    String id();

    String label();

    @TsOptional
    String description();

    /** Text a surface must confirm with before running the action. */
    @TsOptional
    String confirm();

    /** Marks the action as destructive, so a surface can style it as such. */
    @TsOptional
    Boolean danger();

    /**
     * What this action needs collected before it runs, which a surface prompts for and passes back
     * as the run's input. Absent means the action takes none.
     */
    @TsOptional
    List<FieldSpec> args();
}
