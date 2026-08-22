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

    @TsConstant(type = "CapabilityType<ScreensCapability>", id = "screens")
    public static final Object SCREENS = null;

    @TsConstant(type = "CapabilityType<SettingsCapability>", id = "settings")
    public static final Object SETTINGS = null;

    @TsConstant(type = "CapabilityType<CommandsCapability>", id = "commands")
    public static final Object COMMANDS = null;

    @TsConstant(type = "CapabilityType<PluginManagementCapability>", id = "plugin-management")
    public static final Object PLUGIN_MANAGEMENT = null;

    @TsConstant(type = "CapabilityType<LibraryManagementCapability>", id = "library-management")
    public static final Object LIBRARY_MANAGEMENT = null;

    @TsConstant(type = "CapabilityType<CrossAppSyncCapability>", id = "cross-app-sync")
    public static final Object CROSS_APP_SYNC = null;

    @TsConstant(type = "CapabilityType<CustomEndpointsCapability>", id = "custom-endpoints")
    public static final Object CUSTOM_ENDPOINTS = null;

    @TsConstant(type = "CapabilityType<ConfigHistoryCapability>", id = "config-history")
    public static final Object CONFIG_HISTORY = null;

    @TsConstant(type = "CapabilityType<MarketplaceSourceCapability>", id = "marketplace-source")
    public static final Object MARKETPLACE_SOURCE = null;

    @TsConstant(type = "ServiceType<AccountsService>", id = "accounts")
    public static final Object ACCOUNTS = null;

    @TsConstant(type = "ServiceType<RoutingService>", id = "routing")
    public static final Object ROUTING = null;

    @TsConstant(type = "ServiceType<ActivityService>", id = "activity")
    public static final Object ACTIVITY = null;

    @TsConstant(type = "TopicType<NotificationEvent>", id = "notification")
    public static final Object NOTIFICATION = null;

    @TsConstant(type = "TopicType<ProxyStatusEvent>", id = "proxy.status")
    public static final Object PROXY_STATUS = null;

    @TsConstant(type = "TopicType<AccountRateLimitedEvent>", id = "account.rate_limited")
    public static final Object ACCOUNT_RATE_LIMITED = null;

    @TsConstant(type = "TopicType<ConfigChangedEvent>", id = "config.changed")
    public static final Object CONFIG_CHANGED = null;

    @TsConstant(type = "TopicType<ConfigSnapshotEvent>", id = "config.snapshot")
    public static final Object CONFIG_SNAPSHOT = null;

    @TsConstant(type = "TopicType<ConfigProfileChangedEvent>", id = "config.profile_changed")
    public static final Object CONFIG_PROFILE_CHANGED = null;

    @TsConstant(type = "TopicType<PluginProgressEvent>", id = "plugin.progress")
    public static final Object PLUGIN_PROGRESS = null;

    @TsConstant(type = "TopicType<PluginInstalledEvent>", id = "plugin.installed")
    public static final Object PLUGIN_INSTALLED = null;

    @TsConstant(type = "TopicType<SyncCompletedEvent>", id = "sync.completed")
    public static final Object SYNC_COMPLETED = null;

    private Contracts() {
    }
}
