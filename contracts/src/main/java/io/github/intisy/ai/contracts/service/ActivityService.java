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
    /**
     * Writes one activity down.
     *
     * @param spec what happened.
     */
    void emit(ActivitySpec spec);

    /**
     * Reads recorded activity, newest first.
     *
     * @return the newest page.
     */
    CompletionStage<ActivityPage> read();

    /**
     * Reads the slice of recorded activity a query asks for, newest first.
     *
     * @param query which slice to read.
     * @return the matching page.
     */
    CompletionStage<ActivityPage> read(ActivityQuery query);
}
