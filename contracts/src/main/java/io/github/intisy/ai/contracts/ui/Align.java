package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsEnum;

/** Cross-axis alignment of a screen node among its siblings. */
@TsEnum
public enum Align {
    /** Against the leading edge. */
    start,
    /** Centred between the edges. */
    center,
    /** Against the trailing edge. */
    end
}
