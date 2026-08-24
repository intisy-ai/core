package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** One installable thing a marketplace source offers. */
@TsInterface(data = true)
public interface MarketplaceEntry {
    /** Entry id, normally the repository name. */
    String id();

    String url();

    @TsOptional
    String displayName();

    @TsOptional
    String description();

    /** Topics a host filters and groups by. */
    @TsOptional
    List<String> topics();
}
