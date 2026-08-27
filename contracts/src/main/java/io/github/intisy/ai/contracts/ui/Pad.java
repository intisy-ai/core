package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsEnum;

/** Padding hint a surface resolves through its own spacing scale. */
@TsEnum
public enum Pad {
    /** No padding at all. */
    none,
    /** Less padding than the surface's default. */
    tight,
    /** The surface's default padding. */
    normal
}
