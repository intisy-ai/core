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
    /**
     * Width hint, in whatever unit the surface understands.
     *
     * @return the width hint, or null to let the surface size the node.
     */
    @TsOptional
    String width();

    /**
     * Share of free space this node takes among its siblings.
     *
     * @return the growth factor, or null for no share of the free space.
     */
    @TsOptional
    Double grow();

    /**
     * How the node sits against its siblings.
     *
     * @return the alignment, or null for the surface's default.
     */
    @TsOptional
    Align align();

    /**
     * How much space is left around the node's contents.
     *
     * @return the padding hint, or null for the surface's default.
     */
    @TsOptional
    Pad pad();

    /**
     * Named tone, resolved by the surface's own palette.
     *
     * @return the tone name, or null for the surface's ordinary colour.
     */
    @TsOptional
    String tone();
}
