package io.github.intisy.ai.contracts.ui;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.Map;

/**
 * The data behind one screen, keyed by the source names its layout nodes reference.
 *
 * @implNote Values are unknown because the node kind registry, not this type, is what pairs a source
 * with its renderer.
 */
@TsInterface(data = true)
public interface ScreenData {
    Map<String, Object> sources();
}
