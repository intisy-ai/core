package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** One column of a table node. */
@TsInterface(data = true)
public interface Column {
    /**
     * The row key this column reads.
     *
     * @return the key of the value shown in this column.
     */
    String key();

    /**
     * The column's heading.
     *
     * @return the heading text, or null to fall back to the key.
     */
    @TsOptional
    String label();

    /**
     * How the surface should colour this column's cells.
     *
     * @return the tone, or null for the surface's default.
     */
    @TsOptional
    Tone tone();

    /**
     * Character budget beyond which the surface truncates.
     *
     * @return the budget in characters, or null to leave the value whole.
     */
    @TsOptional
    Double truncate();
}
