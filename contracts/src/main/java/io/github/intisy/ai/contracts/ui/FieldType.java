package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsEnum;
import io.github.intisy.ai.tsemit.TsLiteral;

/** The input control a settings field asks a surface for. */
@TsEnum
public enum FieldType {
    /** An on or off switch. */
    @TsLiteral("boolean")
    BOOLEAN,
    /** A single numeric value. */
    number,
    /** A single line of free text. */
    string,
    /** A single line of free text a surface masks and does not log. */
    secret,
    /** One choice out of the field's options. */
    select,
    /** Free text over several lines. */
    multiline,
    /** An ordered list of values, each of the field's item type. */
    list
}
