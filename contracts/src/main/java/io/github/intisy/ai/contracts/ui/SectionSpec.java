package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** A plugin asking a host's settings surface for a place of its own inside it. */
@TsInterface(data = true)
public interface SectionSpec {
    String id();

    String label();

    @TsOptional
    String description();

    /** Sort order among sections. Lower sorts first. */
    @TsOptional
    Double order();

    /**
     * @implNote {@code allHomes} says the setting is not a per-home one, so a surface managing
     * several homes writes it to all of them rather than asking which. The default is per-home.
     */
    @TsOptional
    Scope scope();

    @TsOptional
    List<String> fields();

    @TsOptional
    List<String> actions();
}
