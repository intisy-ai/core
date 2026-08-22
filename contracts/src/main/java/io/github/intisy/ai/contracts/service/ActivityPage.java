package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/** One page of read-back activity. */
@TsInterface(data = true)
public interface ActivityPage {
    /** The records, newest first. */
    List<ActivityRecord> records();

    /** Cursor the next query takes, absent on the last page. */
    @TsOptional
    String nextCursor();
}
