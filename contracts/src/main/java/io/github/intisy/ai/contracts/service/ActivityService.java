package io.github.intisy.ai.contracts.service;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.concurrent.CompletionStage;

/**
 * The activity record contract.
 *
 * @implNote Bare rather than namespaced because it is a contract any plugin may implement, exactly
 * like the account store. The shapes here are the smallest a consumer needs: an implementation is
 * free to record and return more, and a consumer wanting the extra reaches for that
 * implementation's own package.
 */
@TsInterface
public interface ActivityService {
    void emit(ActivitySpec spec);

    /** Reads recorded activity, newest first. */
    CompletionStage<ActivityPage> read();

    CompletionStage<ActivityPage> read(ActivityQuery query);
}
