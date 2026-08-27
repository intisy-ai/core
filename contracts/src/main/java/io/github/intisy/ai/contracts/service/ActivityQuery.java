package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** Which slice of the activity record a caller wants. */
@TsInterface(data = true)
public interface ActivityQuery {
    /**
     * Keep only activity of these impacts.
     *
     * @return the impacts to keep, or null to keep every impact.
     */
    @TsOptional
    List<ActivityImpact> impacts();

    /**
     * Keep only activity recorded by these sources.
     *
     * @return the source ids to keep, or null to keep every source.
     */
    @TsOptional
    List<String> sources();

    /**
     * Keep only activity on these topics.
     *
     * @return the topics to keep, or null to keep every topic.
     */
    @TsOptional
    List<String> topics();

    /**
     * Keep only activity at or after this epoch millisecond.
     *
     * @return the lower bound, or null for no lower bound.
     */
    @TsOptional
    Double since();

    /**
     * Keep only activity at or before this epoch millisecond.
     *
     * @return the upper bound, or null for no upper bound.
     */
    @TsOptional
    Double until();

    /**
     * How many records one page may hold.
     *
     * @return the page size, or null to let the service choose.
     */
    @TsOptional
    Double limit();

    /**
     * Opaque cursor from a previous page.
     *
     * @return the cursor to resume from, or null to start at the newest record.
     */
    @TsOptional
    String cursor();
}
