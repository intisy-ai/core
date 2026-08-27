package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsEnum;

/** How much one recorded activity matters. */
@TsEnum
public enum ActivityImpact {
    /** Detail kept for diagnosis, which a surface hides by default. */
    debug,
    /** Something happened that a reader may want to see. */
    info,
    /** Something a reader should see, though nothing is wrong. */
    notice,
    /** Something went wrong that did not stop the operation. */
    warning,
    /** Something went wrong that stopped the operation. */
    error
}
