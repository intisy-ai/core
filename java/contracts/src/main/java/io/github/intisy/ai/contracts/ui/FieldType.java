package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsEnum;
import io.github.intisy.ai.tsemit.TsLiteral;

/** The input control a settings field asks a surface for. */
@TsEnum
public enum FieldType {
    @TsLiteral("boolean")
    BOOLEAN,
    number,
    string,
    secret,
    select,
    multiline,
    list
}
