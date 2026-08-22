package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.Map;

/** One activity as it is read back. */
@TsInterface(data = true)
public interface ActivityRecord {
    String id();

    /** When it happened, in epoch milliseconds. */
    double ts();

    /** Absolute path of the app home it was recorded in. */
    String home();

    String topic();

    String action();

    ActivityImpact impact();

    /** Who recorded it, normally a plugin id. */
    String source();

    @TsOptional
    ActivitySubject subject();

    Map<String, Object> details();

    /** One line describing the activity, for a surface that renders text. */
    String text();
}
