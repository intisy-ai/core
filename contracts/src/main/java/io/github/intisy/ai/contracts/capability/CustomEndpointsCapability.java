package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;
import java.util.concurrent.CompletionStage;

/** Serves endpoints the user defined rather than ones the ecosystem ships. */
@TsInterface
public interface CustomEndpointsCapability {
    CompletionStage<List<CustomEndpoint>> endpoints();
}
