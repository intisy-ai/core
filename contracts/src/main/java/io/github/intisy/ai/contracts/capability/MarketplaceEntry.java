package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** One installable thing a marketplace source offers. */
@TsInterface(data = true)
public interface MarketplaceEntry {
    /**
     * Entry id, normally the repository name.
     *
     * @return the entry's id.
     */
    String id();

    /**
     * Where installing this entry fetches from.
     *
     * @return the source url.
     */
    String url();

    /**
     * What a reader sees instead of the id.
     *
     * @return the display name, or null to fall back to the id.
     */
    @TsOptional
    String displayName();

    /**
     * One line saying what the entry is for.
     *
     * @return the description, or null when the source offers none.
     */
    @TsOptional
    String description();

    /**
     * Topics a host filters and groups by.
     *
     * @return the topics, or null when the source offers none.
     */
    @TsOptional
    List<String> topics();
}
