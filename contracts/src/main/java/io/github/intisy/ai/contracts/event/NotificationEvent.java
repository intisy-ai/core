package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;

/** Something a surface should show the user. */
@TsInterface(data = true)
public interface NotificationEvent {
    /**
     * What the reader is being told.
     *
     * @return the message.
     */
    String message();

    /**
     * How prominently a surface should show it.
     *
     * @return the level.
     */
    NotificationLevel level();
}
