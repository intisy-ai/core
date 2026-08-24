package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsEnum;

/** Whether a setting or a screen is per-home or shared across every home. */
@TsEnum
public enum Scope {
    home,
    allHomes
}
