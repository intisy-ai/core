package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsInterface;

/** Something a surface should show the user. */
@TsInterface(data = true)
public interface NotificationEvent {
    String message();

    NotificationLevel level();
}
