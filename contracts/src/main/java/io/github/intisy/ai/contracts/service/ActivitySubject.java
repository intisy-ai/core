package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** What one activity was about. */
@TsInterface(data = true)
public interface ActivitySubject {
    /**
     * What kind of thing it is, for example {@code plugin} or {@code account}.
     *
     * @return the subject's kind.
     */
    String kind();

    /**
     * Which one of that kind it was.
     *
     * @return the subject's id, or null when the activity names no particular one.
     */
    @TsOptional
    String id();

    /**
     * What a reader sees instead of the id.
     *
     * @return the display text, or null to fall back to the id.
     */
    @TsOptional
    String label();
}
