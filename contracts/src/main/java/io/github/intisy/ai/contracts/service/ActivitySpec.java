package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.Map;

/** What a plugin hands the activity record to have one activity written down. */
@TsInterface(data = true)
public interface ActivitySpec {
    /**
     * Dotted topic the activity belongs to, for example {@code config.changed}.
     *
     * @return the topic.
     */
    String topic();

    /**
     * What happened, as one verb.
     *
     * @return the action.
     */
    String action();

    /**
     * How much it matters. The implementation picks a default per topic when this is absent.
     *
     * @return the impact, or null to take the topic's default.
     */
    @TsOptional
    ActivityImpact impact();

    /**
     * What the activity was about, when it was about one identifiable thing.
     *
     * @return the subject, or null when the activity names none.
     */
    @TsOptional
    ActivitySubject subject();

    /**
     * Anything else worth keeping, which a surface renders as it likes.
     *
     * @return the details, or null when there are none.
     */
    @TsOptional
    Map<String, Object> details();
}
