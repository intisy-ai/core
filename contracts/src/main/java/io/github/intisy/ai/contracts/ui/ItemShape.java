package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** Which keys of a row carry its title, subtitle, badge and icon in a list node. */
@TsInterface(data = true)
public interface ItemShape {
    String title();

    @TsOptional
    String subtitle();

    @TsOptional
    String badge();

    @TsOptional
    String icon();
}
