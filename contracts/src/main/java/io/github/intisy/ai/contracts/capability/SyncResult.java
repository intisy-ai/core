package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;

/** What one reconciliation across app homes moved. */
@TsInterface(data = true)
public interface SyncResult {
    List<String> files();

    List<String> plugins();

    List<String> homes();
}
