package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** Everything a settings capability declares about itself. */
@TsInterface(data = true)
public interface CapabilitySchema {
    /**
     * The settings this plugin offers.
     *
     * @return the fields, or null for a plugin that offers none.
     */
    @TsOptional
    List<FieldSpec> fields();

    /**
     * The buttons this plugin offers.
     *
     * @return the actions, or null for a plugin that offers none.
     */
    @TsOptional
    List<ActionSpec> actions();

    /**
     * How the fields and actions are grouped for a reader.
     *
     * @return the sections, or null to let the surface lay them out.
     */
    @TsOptional
    List<SectionSpec> sections();

    /**
     * Where this plugin keeps state its own name does not reveal.
     *
     * @return the data declaration, or null when naming conventions find everything.
     */
    @TsOptional
    DataSpec data();
}
