package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsEnum;

/** Whether a setting or a screen is per-home or shared across every home. */
@TsEnum
public enum Scope {
    /** The value belongs to one home and another home may hold a different one. */
    home,
    /** One value is shared by every home on the machine. */
    allHomes
}
