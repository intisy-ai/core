package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** One configurable setting a plugin declares, which every settings surface renders its own way. */
@TsInterface(data = true)
public interface FieldSpec {
    String key();

    FieldType type();

    @TsOptional
    String label();

    @TsOptional
    String description();

    @TsOptional
    String group();

    @TsOptional
    List<FieldOption> options();

    @TsOptional
    Double min();

    @TsOptional
    Double max();

    @TsOptional
    Double step();

    @TsOptional
    ItemType itemType();

    @TsOptional
    String placeholder();
}
