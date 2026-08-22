package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;

/** One user-defined upstream endpoint. */
@TsInterface(data = true)
public interface CustomEndpoint {
    String id();

    String label();

    /** Base URL requests are sent to. */
    String baseUrl();
}
