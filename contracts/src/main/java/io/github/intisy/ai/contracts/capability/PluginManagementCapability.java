package io.github.intisy.ai.contracts.capability;

import io.github.intisy.ai.contracts.ui.ActionResult;
import io.github.intisy.ai.tsemit.TsInterface;
import java.util.List;
import java.util.concurrent.CompletionStage;

/**
 * Installs, updates, and removes other plugins.
 *
 * @implNote Every method acts on the home this capability was resolved against, so none of them
 * takes one as a parameter. A host that drives several homes resolves the capability once per home
 * rather than passing a home in: a plugin is only ever responsible for the home it runs in, and
 * giving it a home argument would hand every plugin the power to reach into another one.
 */
@TsInterface
public interface PluginManagementCapability {
    /** Every plugin this manager knows about in the current home. */
    CompletionStage<List<ManagedPlugin>> list();

    CompletionStage<List<ManagedNpmPlugin>> listNpm();

    CompletionStage<ActionResult> install(String url);

    CompletionStage<ActionResult> update(String id);

    /** Updates everything eligible, which is also what a host runs on startup. */
    CompletionStage<ActionResult> updateAll();

    CompletionStage<ActionResult> remove(String id);

    CompletionStage<ActionResult> removeNpm(String id);

    /** Rebuilds and redeploys one installed plugin without fetching. */
    CompletionStage<ActionResult> repair(String id);

    CompletionStage<ActionResult> downgrade(String id, String version);

    /** Checks upstream and returns the fresh result. */
    CompletionStage<PluginUpdateCache> checkUpdates();

    /** The last check's result, without going upstream. */
    CompletionStage<PluginUpdateCache> updateCache();

    CompletionStage<ActionResult> setEnabled(String id, boolean enabled);

    CompletionStage<ActionResult> setAutoUpdate(String id, boolean autoUpdate);

    CompletionStage<ActionResult> setChannel(String id, PluginChannel channel);

    CompletionStage<PluginChannelState> channelState(String id);

    /** Deployed artifacts a plugin should have and does not, which is what makes repair worth offering. */
    CompletionStage<List<String>> missingArtifacts(String id);

    /**
     * The paths a plugin left in this home.
     *
     * @param declared paths the plugin names itself, added to the ones naming conventions find.
     */
    CompletionStage<List<PluginDataEntry>> data(String id, List<String> declared);

    /** Deletes the given paths, returning the ones actually removed. */
    CompletionStage<List<String>> removeData(List<String> paths);
}
