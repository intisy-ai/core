package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** One column of a table node. */
@TsInterface(data = true)
public interface Column {
    String key();

    @TsOptional
    String label();

    @TsOptional
    Tone tone();

    /** Character budget beyond which the surface truncates. */
    @TsOptional
    Double truncate();
}
