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
    String kind();

    @TsOptional
    NodeStyle style();

    @TsOptional
    List<ScreenNode> children();
}
