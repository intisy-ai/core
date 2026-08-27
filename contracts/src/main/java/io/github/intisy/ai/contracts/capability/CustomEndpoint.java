package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;

/** One user-defined upstream endpoint. */
@TsInterface(data = true)
public interface CustomEndpoint {
    /**
     * What this endpoint is addressed by in a routing chain.
     *
     * @return the endpoint's id.
     */
    String id();

    /**
     * What a reader sees instead of the id.
     *
     * @return the endpoint's label.
     */
    String label();

    /**
     * Base URL requests are sent to.
     *
     * @return the base URL.
     */
    String baseUrl();
}
