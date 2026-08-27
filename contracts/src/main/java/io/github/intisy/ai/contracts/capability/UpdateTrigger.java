package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsEnum;

/**
 * What occasion an update run is answering to.
 *
 * @implNote A home switches each of these on or off independently, which is why a run states
 * which one it is rather than asking for updates unconditionally.
 */
@TsEnum
public enum UpdateTrigger {
    /** A loader starting up. */
    loader,
    /** An app starting up. */
    app,
    /** The control plane asking on its own schedule. */
    cairn
}
