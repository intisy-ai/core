package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;
import java.util.concurrent.CompletionStage;

/** Contributes installable entries to a host's marketplace listing. */
@TsInterface
public interface MarketplaceSourceCapability {
    CompletionStage<List<MarketplaceEntry>> entries();
}
