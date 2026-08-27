package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** Which keys of a row carry its title, subtitle, badge and icon in a list node. */
@TsInterface(data = true)
public interface ItemShape {
    /**
     * The row key holding the line a reader scans for.
     *
     * @return the key of the row's title.
     */
    String title();

    /**
     * The row key holding the line under the title.
     *
     * @return the key of the row's subtitle, or null when the row shows none.
     */
    @TsOptional
    String subtitle();

    /**
     * The row key holding a short status marker shown beside the title.
     *
     * @return the key of the row's badge, or null when the row shows none.
     */
    @TsOptional
    String badge();

    /**
     * The row key holding the row's mark.
     *
     * @return the key of the row's icon, or null when the row shows none.
     */
    @TsOptional
    String icon();
}
