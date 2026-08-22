package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** Everything a settings capability declares about itself. */
@TsInterface(data = true)
public interface CapabilitySchema {
    @TsOptional
    List<FieldSpec> fields();

    @TsOptional
    List<ActionSpec> actions();

    @TsOptional
    List<SectionSpec> sections();

    @TsOptional
    DataSpec data();
}
