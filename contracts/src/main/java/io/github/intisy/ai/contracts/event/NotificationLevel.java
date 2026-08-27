package io.github.intisy.ai.contracts.event;

import io.github.intisy.ai.tsemit.TsEnum;

/** How prominent a notification is. */
@TsEnum
public enum NotificationLevel {
    /** Something worth saying, with nothing to act on. */
    info,
    /** Something the reader asked for has finished. */
    success,
    /** Something went wrong that did not stop the operation. */
    warning,
    /** Something went wrong that stopped the operation. */
    error
}
