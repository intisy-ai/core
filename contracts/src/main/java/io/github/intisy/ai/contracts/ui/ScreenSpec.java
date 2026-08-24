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
    String id();

    String label();

    /** Glyph beside the navigation entry, resolved by the surface. */
    @TsOptional
    String glyph();

    /** Sort order among screens. Lower sorts first. */
    @TsOptional
    Double order();

    @TsOptional
    Scope scope();

    /** Event topic prefixes whose arrival makes the host re-read this screen. */
    @TsOptional
    List<String> refreshOn();

    ScreenNode layout();

    /**
     * Per-surface layout overrides, keyed by surface id.
     *
     * @implNote A surface uses {@code layout} when it finds no entry of its own, and an id no host
     * renders is ignored.
     */
    @TsOptional
    Map<String, ScreenNode> surfaces();
}
