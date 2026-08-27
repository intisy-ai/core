package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** An account hit an upstream rate limit. */
@TsInterface(data = true)
public interface AccountRateLimitedEvent {
    /**
     * Provider whose upstream rate-limited the account.
     *
     * @return the provider id.
     */
    String provider();

    /**
     * Which of that provider's accounts was refused.
     *
     * @return the account id, or null when the provider holds only one.
     */
    @TsOptional
    String accountId();

    /**
     * Routing lane the account was serving, when known.
     *
     * @return the lane id, or null when it was not recorded.
     */
    @TsOptional
    String lane();

    /**
     * Epoch millis when the limit is expected to clear, when known.
     *
     * @return the reset time, or null when upstream did not say.
     */
    @TsOptional
    Double resetAt();
}
