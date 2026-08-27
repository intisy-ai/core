package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** A plugin asking a host's settings surface for a place of its own inside it. */
@TsInterface(data = true)
public interface SectionSpec {
    /**
     * The name this section is addressed by, unique among the host's sections.
     *
     * @return the section's id.
     */
    String id();

    /**
     * The heading a reader sees.
     *
     * @return the section's label.
     */
    String label();

    /**
     * The explanation shown under the heading.
     *
     * @return the description, or null when the label says enough.
     */
    @TsOptional
    String description();

    /**
     * Sort order among sections. Lower sorts first.
     *
     * @return the sort key, or null to let the host place the section.
     */
    @TsOptional
    Double order();

    /**
     * Whether the settings in this section belong to one home or to every home.
     *
     * @return the scope, or null for the per-home default.
     * @implNote {@code allHomes} says the setting is not a per-home one, so a surface managing
     * several homes writes it to all of them rather than asking which. The default is per-home.
     */
    @TsOptional
    Scope scope();

    /**
     * The keys of the settings this section shows, in the order it shows them.
     *
     * @return the field keys, or null for a section that shows no settings.
     */
    @TsOptional
    List<String> fields();

    /**
     * The ids of the actions this section offers.
     *
     * @return the action ids, or null for a section that offers none.
     */
    @TsOptional
    List<String> actions();
}
