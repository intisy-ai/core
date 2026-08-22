package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsEnum;

/** Where a plugin is installed from. */
@TsEnum
public enum PluginKind {
    git,
    npm
}
