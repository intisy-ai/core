package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** Which slice of the activity record a caller wants. */
@TsInterface(data = true)
public interface ActivityQuery {
    @TsOptional
    List<ActivityImpact> impacts();

    @TsOptional
    List<String> sources();

    @TsOptional
    List<String> topics();

    /** Keep only activity at or after this epoch millisecond. */
    @TsOptional
    Double since();

    /** Keep only activity at or before this epoch millisecond. */
    @TsOptional
    Double until();

    @TsOptional
    Double limit();

    /** Opaque cursor from a previous page. */
    @TsOptional
    String cursor();
}
