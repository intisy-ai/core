package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;
import java.util.Map;

/**
 * A plugin asking a host for a navigation entry of its own whose contents it lays out.
 *
 * @implNote The plugin supplies structure and data; the host supplies every component and all
 * styling.
 */
@TsInterface(data = true)
public interface ScreenSpec {
    /**
     * The name this screen is addressed by, unique among the host's screens.
     *
     * @return the screen's id.
     */
    String id();

    /**
     * What a reader sees on the navigation entry.
     *
     * @return the screen's label.
     */
    String label();

    /**
     * Glyph beside the navigation entry, resolved by the surface.
     *
     * @return the glyph name, or null for no glyph.
     */
    @TsOptional
    String glyph();

    /**
     * Sort order among screens. Lower sorts first.
     *
     * @return the sort key, or null to let the host place the screen.
     */
    @TsOptional
    Double order();

    /**
     * Whether this screen belongs to one home or to every home.
     *
     * @return the scope, or null for the per-home default.
     */
    @TsOptional
    Scope scope();

    /**
     * Event topic prefixes whose arrival makes the host re-read this screen.
     *
     * @return the prefixes, or null for a screen that never re-reads on its own.
     */
    @TsOptional
    List<String> refreshOn();

    /**
     * The tree of nodes this screen is built from.
     *
     * @return the root node.
     */
    ScreenNode layout();

    /**
     * Per-surface layout overrides, keyed by surface id.
     *
     * @implNote A surface uses {@code layout} when it finds no entry of its own, and an id no host
     * renders is ignored.
     *
     * @return the overriding layouts keyed by surface id, or null when one layout serves every surface.
     */
    @TsOptional
    Map<String, ScreenNode> surfaces();
}
