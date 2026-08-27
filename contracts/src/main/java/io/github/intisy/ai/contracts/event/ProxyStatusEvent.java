package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;

/** The proxy came up or went down. */
@TsInterface(data = true)
public interface ProxyStatusEvent {
    /**
     * Whether the proxy is now reachable.
     *
     * @return true when it is up.
     */
    boolean up();

    /**
     * The port it is listening on, or was listening on before it went down.
     *
     * @return the port.
     */
    double port();
}
