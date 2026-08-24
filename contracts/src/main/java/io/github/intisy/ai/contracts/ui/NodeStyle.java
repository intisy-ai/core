package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/**
 * Presentation hints every screen node may carry.
 *
 * @implNote New sizing or spacing options belong here rather than on a kind, so adding one never
 * touches an existing kind's renderer.
 */
@TsInterface(data = true)
public interface NodeStyle {
    /** Width hint, in whatever unit the surface understands. */
    @TsOptional
    String width();

    /** Share of free space this node takes among its siblings. */
    @TsOptional
    Double grow();

    @TsOptional
    Align align();

    @TsOptional
    Pad pad();

    /** Named tone, resolved by the surface's own palette. */
    @TsOptional
    String tone();
}
