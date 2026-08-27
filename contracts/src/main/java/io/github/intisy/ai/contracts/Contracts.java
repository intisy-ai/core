package io.github.intisy.ai.contracts;

import io.github.intisy.ai.tsemit.TsConstant;

/**
 * The typed keys this package mints.
 *
 * @implNote A key is the one place the processor emits an implementation rather than a declaration,
 * because a key holds no logic: it is an id string behind a generated type. That is what lets this
 * package ship a few kilobytes of JavaScript with no TeaVM bundle and no JDK at consume time.
 *
 * <p>The Java field type is {@code Object} and its value {@code null} because the Java side never
 * reads a key: a Java host keys on the id string, and the typed key exists for the emitted
 * TypeScript. A Java consumer that needs these as values is a change to make with that consumer in
 * front of you.
 */
public final class Contracts {

    /** The capability a plugin provides to contribute navigation entries of its own. */
    @TsConstant(type = "CapabilityType<ScreensCapability>", id = "screens")
    public static final Object SCREENS = null;

    /** The capability a plugin provides to declare its configurable settings. */
    @TsConstant(type = "CapabilityType<SettingsCapability>", id = "settings")
    public static final Object SETTINGS = null;

    /** The capability a plugin provides to contribute slash commands. */
    @TsConstant(type = "CapabilityType<CommandsCapability>", id = "commands")
    public static final Object COMMANDS = null;

    /** The capability a plugin provides to install, update and remove other plugins. */
    @TsConstant(type = "CapabilityType<PluginManagementCapability>", id = "plugin-management")
    public static final Object PLUGIN_MANAGEMENT = null;

    /** The capability a plugin provides to manage a home's shared library store. */
    @TsConstant(type = "CapabilityType<LibraryManagementCapability>", id = "library-management")
    public static final Object LIBRARY_MANAGEMENT = null;

    /** The capability a plugin provides to reconcile state across two app homes. */
    @TsConstant(type = "CapabilityType<CrossAppSyncCapability>", id = "cross-app-sync")
    public static final Object CROSS_APP_SYNC = null;

    /** The capability a plugin provides to serve endpoints of its own. */
    @TsConstant(type = "CapabilityType<CustomEndpointsCapability>", id = "custom-endpoints")
    public static final Object CUSTOM_ENDPOINTS = null;

    /** The capability a plugin provides to record and restore configuration over time. */
    @TsConstant(type = "CapabilityType<ConfigHistoryCapability>", id = "config-history")
    public static final Object CONFIG_HISTORY = null;

    /** The capability a plugin provides to offer plugins a host can install. */
    @TsConstant(type = "CapabilityType<MarketplaceSourceCapability>", id = "marketplace-source")
    public static final Object MARKETPLACE_SOURCE = null;

    /** The service through which a host reaches the accounts a provider holds. */
    @TsConstant(type = "ServiceType<AccountsService>", id = "accounts")
    public static final Object ACCOUNTS = null;

    /** The service through which a host reaches the routing chain. */
    @TsConstant(type = "ServiceType<RoutingService>", id = "routing")
    public static final Object ROUTING = null;

    /** The service through which a host records and reads activity. */
    @TsConstant(type = "ServiceType<ActivityService>", id = "activity")
    public static final Object ACTIVITY = null;

    /** The topic carrying a message meant for a person. */
    @TsConstant(type = "TopicType<NotificationEvent>", id = "notification")
    public static final Object NOTIFICATION = null;

    /** The topic carrying a change in the proxy's running state. */
    @TsConstant(type = "TopicType<ProxyStatusEvent>", id = "proxy.status")
    public static final Object PROXY_STATUS = null;

    /** The topic carrying an upstream refusing an account for now. */
    @TsConstant(type = "TopicType<AccountRateLimitedEvent>", id = "account.rate_limited")
    public static final Object ACCOUNT_RATE_LIMITED = null;

    /** The topic carrying one configuration value having changed. */
    @TsConstant(type = "TopicType<ConfigChangedEvent>", id = "config.changed")
    public static final Object CONFIG_CHANGED = null;

    /** The topic carrying a whole configuration having been captured. */
    @TsConstant(type = "TopicType<ConfigSnapshotEvent>", id = "config.snapshot")
    public static final Object CONFIG_SNAPSHOT = null;

    /** The topic carrying a switch to a different configuration profile. */
    @TsConstant(type = "TopicType<ConfigProfileChangedEvent>", id = "config.profile_changed")
    public static final Object CONFIG_PROFILE_CHANGED = null;

    /** The topic carrying how far a long-running plugin operation has got. */
    @TsConstant(type = "TopicType<PluginProgressEvent>", id = "plugin.progress")
    public static final Object PLUGIN_PROGRESS = null;

    /** The topic carrying a plugin having been installed. */
    @TsConstant(type = "TopicType<PluginInstalledEvent>", id = "plugin.installed")
    public static final Object PLUGIN_INSTALLED = null;

    /** The topic carrying a cross-app reconciliation having finished. */
    @TsConstant(type = "TopicType<SyncCompletedEvent>", id = "sync.completed")
    public static final Object SYNC_COMPLETED = null;

    private Contracts() {
    }
}
