package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.Map;

/** One activity as it is read back. */
@TsInterface(data = true)
public interface ActivityRecord {
    /**
     * What this record is addressed by, unique within the home.
     *
     * @return the record's id.
     */
    String id();

    /**
     * When it happened, in epoch milliseconds.
     *
     * @return the timestamp.
     */
    double ts();

    /**
     * Absolute path of the app home it was recorded in.
     *
     * @return the home path.
     */
    String home();

    /**
     * What kind of thing happened, which is what a reader filters on.
     *
     * @return the topic.
     */
    String topic();

    /**
     * What was done, within the topic.
     *
     * @return the action.
     */
    String action();

    /**
     * How much this activity mattered, which is what a surface sorts and colours by.
     *
     * @return the impact.
     */
    ActivityImpact impact();

    /**
     * Who recorded it, normally a plugin id.
     *
     * @return the source id.
     */
    String source();

    /**
     * What the activity was about, when it was about one identifiable thing.
     *
     * @return the subject, or null when the activity names none.
     */
    @TsOptional
    ActivitySubject subject();

    /**
     * Everything the recorder attached that has no field of its own.
     *
     * @return the details, empty when the recorder attached none.
     */
    Map<String, Object> details();

    /**
     * One line describing the activity, for a surface that renders text.
     *
     * @return the rendered line.
     */
    String text();
}
