package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsIndexSignature;
import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/**
 * One node of a screen's layout tree.
 *
 * @implNote {@code kind} is open on purpose: each surface dispatches it through a registry and skips
 * what it does not know, so a plugin built against a newer host degrades instead of blanking a
 * screen. The index signature carries each kind's own props.
 */
@TsInterface(data = true)
@TsIndexSignature(key = "prop", value = "unknown")
public interface ScreenNode {
    /**
     * Which renderer this node asks for, looked up in the surface's own registry.
     *
     * @return the node kind.
     */
    String kind();

    /**
     * Presentation hints for this node.
     *
     * @return the style, or null to take the surface's defaults.
     */
    @TsOptional
    NodeStyle style();

    /**
     * The nodes nested inside this one.
     *
     * @return the children, or null for a leaf.
     */
    @TsOptional
    List<ScreenNode> children();
}
