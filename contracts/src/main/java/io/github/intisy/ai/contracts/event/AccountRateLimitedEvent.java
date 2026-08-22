package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;

/** An account hit an upstream rate limit. */
@TsInterface(data = true)
public interface AccountRateLimitedEvent {
    /** Provider whose upstream rate-limited the account. */
    String provider();

    @TsOptional
    String accountId();

    /** Routing lane the account was serving, when known. */
    @TsOptional
    String lane();

    /** Epoch millis when the limit is expected to clear, when known. */
    @TsOptional
    Double resetAt();
}
