package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsEnum;

/** How much one recorded activity matters. */
@TsEnum
public enum ActivityImpact {
    debug,
    info,
    notice,
    warning,
    error
}
