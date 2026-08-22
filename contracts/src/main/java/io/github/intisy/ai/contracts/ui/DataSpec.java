package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import io.github.intisy.ai.tsemit.TsOptional;
import java.util.List;

/**
 * Where a plugin keeps state inside a home, for a surface offering to delete it on uninstall.
 *
 * @implNote Most plugins declare nothing: the config file, the log files and the cache entries are
 * all named after the plugin and are found without asking. This is only for state written somewhere
 * the plugin's name does not appear. Paths are relative to the home directory.
 */
@TsInterface(data = true)
public interface DataSpec {
    @TsOptional
    List<String> paths();
}
