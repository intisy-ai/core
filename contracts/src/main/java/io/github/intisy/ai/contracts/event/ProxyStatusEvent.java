package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;

/** The proxy came up or went down. */
@TsInterface(data = true)
public interface ProxyStatusEvent {
    /** Whether the proxy is now reachable. */
    boolean up();

    double port();
}
