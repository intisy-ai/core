package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** What one activity was about. */
@TsInterface(data = true)
public interface ActivitySubject {
    /** What kind of thing it is, for example {@code plugin} or {@code account}. */
    String kind();

    @TsOptional
    String id();

    @TsOptional
    String label();
}
