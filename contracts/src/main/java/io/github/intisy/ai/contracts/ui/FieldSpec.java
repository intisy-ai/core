package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** One configurable setting a plugin declares, which every settings surface renders its own way. */
@TsInterface(data = true)
public interface FieldSpec {
    /**
     * The name this setting is stored and read under.
     *
     * @return the setting's key.
     */
    String key();

    /**
     * The input control this setting asks for.
     *
     * @return the control type.
     */
    FieldType type();

    /**
     * What a reader sees beside the control.
     *
     * @return the label, or null to fall back to the key.
     */
    @TsOptional
    String label();

    /**
     * The longer explanation shown under the control.
     *
     * @return the description, or null when the label says enough.
     */
    @TsOptional
    String description();

    /**
     * The heading this setting is filed under, so related settings sit together.
     *
     * @return the group name, or null to leave the setting ungrouped.
     */
    @TsOptional
    String group();

    /**
     * The choices a select field offers.
     *
     * @return the options, or null for a field that is not a select.
     */
    @TsOptional
    List<FieldOption> options();

    /**
     * The lowest value a numeric field accepts.
     *
     * @return the lower bound, or null when the field has none.
     */
    @TsOptional
    Double min();

    /**
     * The highest value a numeric field accepts.
     *
     * @return the upper bound, or null when the field has none.
     */
    @TsOptional
    Double max();

    /**
     * How far one nudge moves a numeric field.
     *
     * @return the step, or null to leave the surface to choose.
     */
    @TsOptional
    Double step();

    /**
     * What each element of a list field holds.
     *
     * @return the element type, or null for a field that is not a list.
     */
    @TsOptional
    ItemType itemType();

    /**
     * The hint shown in an empty control.
     *
     * @return the placeholder text, or null when the field shows none.
     */
    @TsOptional
    String placeholder();
}
