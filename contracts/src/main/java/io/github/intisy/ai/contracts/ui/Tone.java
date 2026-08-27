package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsEnum;
import io.github.intisy.ai.tsemit.TsLiteral;
import io.github.intisy.ai.tsemit.TsOpen;

/** Named tone a surface renders a table cell in, resolved through its own palette. */
@TsOpen
@TsEnum
public enum Tone {
    /** The surface's ordinary text colour. */
    normal,
    /** Played down, for text a reader can skip. */
    muted,
    /** Fixed width, for values whose alignment carries meaning. */
    mono,
    /** Marks the value being replaced, in a before-and-after pair. */
    old,
    /** Marks the replacing value, in a before-and-after pair. */
    @TsLiteral("new")
    NEW
}
