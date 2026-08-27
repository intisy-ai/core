package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsEnum;

/** Where a plugin is installed from. */
@TsEnum
public enum PluginKind {
    /** Cloned from a git repository and built in place. */
    git,
    /** Installed from an npm registry. */
    npm
}
