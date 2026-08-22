package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsEnum;

/** How prominent a notification is. */
@TsEnum
public enum NotificationLevel {
    info,
    success,
    warning,
    error
}
