package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;

/** One choice of a select field. */
@TsInterface(data = true)
public interface FieldOption {
    /**
     * What choosing this option stores.
     *
     * @return the value written to the setting.
     */
    String value();

    /**
     * What a reader sees for this option.
     *
     * @return the option's display text.
     */
    String label();
}
