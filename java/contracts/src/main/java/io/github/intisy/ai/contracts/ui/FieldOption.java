package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;

/** One choice of a select field. */
@TsInterface(data = true)
public interface FieldOption {
    String value();

    String label();
}
