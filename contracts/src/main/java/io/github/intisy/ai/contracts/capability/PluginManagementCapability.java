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
    /**
     * Every plugin this manager knows about in the current home.
     *
     * @return the managed plugins.
     */
    CompletionStage<List<ManagedPlugin>> list();

    /**
     * Every npm-installed plugin this manager knows about in the current home.
     *
     * @return the npm-installed plugins.
     */
    CompletionStage<List<ManagedNpmPlugin>> listNpm();

    /**
     * Records a plugin and sets it up, fetching whatever it needs.
     *
     * @param url where the plugin is fetched from.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> install(String url);

    /**
     * Records a plugin without setting it up, and answers with the entry as recorded.
     *
     * @implNote Separate from {@link #install(String)} because setting a plugin up is slow enough
     * to want a surface showing it before the work starts. A host that does not need that shows
     * nothing until install returns, and calls install alone.
     *
     * @param url where the plugin would be fetched from.
     * @return the entry as recorded.
     */
    CompletionStage<ManagedPlugin> register(String url);

    /**
     * Updates one plugin to the newest version its channel offers.
     *
     * @param id the plugin to update.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> update(String id);

    /**
     * Updates everything eligible, whatever the home's policy says.
     *
     * @implNote This is the explicit "update everything now" a person asked for. A run that should
     * honour what the home has switched off is {@link #runUpdates(UpdateTrigger)} instead.
     *
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> updateAll();

    /**
     * Updates what this occasion is allowed to, doing nothing when the home has it switched off.
     *
     * @implNote The policy lives with the plugin holding it rather than in each host, so two hosts
     * cannot disagree about whether an automatic run was permitted.
     *
     * @param trigger the occasion this run is happening on.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> runUpdates(UpdateTrigger trigger);

    /**
     * Removes one plugin and the artifacts it deployed.
     *
     * @param id the plugin to remove.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> remove(String id);

    /**
     * Removes one npm-installed plugin.
     *
     * @param id the plugin to remove.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> removeNpm(String id);

    /**
     * Rebuilds and redeploys one installed plugin without fetching.
     *
     * @param id the plugin to repair.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> repair(String id);

    /**
     * Moves one plugin back to an earlier version.
     *
     * @param id the plugin to move.
     * @param version the version to move it to.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> downgrade(String id, String version);

    /**
     * Checks upstream and returns the fresh result.
     *
     * @return what upstream currently offers for every managed plugin.
     */
    CompletionStage<PluginUpdateCache> checkUpdates();

    /**
     * The last check's result, without going upstream.
     *
     * @return the cached result, empty when nothing has been checked yet.
     */
    CompletionStage<PluginUpdateCache> updateCache();

    /**
     * Switches one plugin on or off without removing it.
     *
     * @param id the plugin to switch.
     * @param enabled whether it should load.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> setEnabled(String id, boolean enabled);

    /**
     * Sets whether one plugin updates without being asked.
     *
     * @param id the plugin to set.
     * @param autoUpdate whether it updates on its own.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> setAutoUpdate(String id, boolean autoUpdate);

    /**
     * Moves one plugin to a different release channel.
     *
     * @param id the plugin to move.
     * @param channel the channel it should follow.
     * @return the outcome, carrying the message a host shows.
     */
    CompletionStage<ActionResult> setChannel(String id, PluginChannel channel);

    /**
     * Which channel one plugin follows, and what that resolves to.
     *
     * @param id the plugin to read.
     * @return the plugin's channel and the version it resolves to.
     */
    CompletionStage<PluginChannelState> channelState(String id);

    /**
     * Deployed artifacts a plugin should have and does not, which is what makes repair worth offering.
     *
     * @param id the plugin to inspect.
     * @return the artifact paths that are missing, empty when the deployment is whole.
     */
    CompletionStage<List<String>> missingArtifacts(String id);

    /**
     * The paths a plugin left in this home.
     *
     * @param id the plugin whose paths to collect.
     * @param declared paths the plugin names itself, added to the ones naming conventions find.
     * @return what the plugin left behind, each entry sized so a host can show the cost of deleting it.
     */
    CompletionStage<List<PluginDataEntry>> data(String id, List<String> declared);

    /**
     * Deletes the given paths, returning the ones actually removed.
     *
     * @param paths the paths to delete.
     * @return the paths that were removed, which omits any that were already gone.
     */
    CompletionStage<List<String>> removeData(List<String> paths);
}
