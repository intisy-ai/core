// Generated from Java sources. Do not edit.

import type { CapabilityType, ServiceType, TopicType } from "@intisy-ai/api/contract";
import type { AccountRateLimitedEvent, AccountsService, ActivityService, CommandsCapability, ConfigChangedEvent, ConfigHistoryCapability, ConfigProfileChangedEvent, ConfigSnapshotEvent, CrossAppSyncCapability, CustomEndpointsCapability, LibraryManagementCapability, MarketplaceSourceCapability, NotificationEvent, PluginInstalledEvent, PluginManagementCapability, PluginProgressEvent, ProxyStatusEvent, RoutingService, ScreensCapability, SettingsCapability, SyncCompletedEvent } from "./contracts.js";

/** The capability a plugin provides to contribute navigation entries of its own. */
export const SCREENS: CapabilityType<ScreensCapability> = { id: "screens" };
/** The capability a plugin provides to contribute slash commands. */
export const COMMANDS: CapabilityType<CommandsCapability> = { id: "commands" };
/** The capability a plugin provides to declare its configurable settings. */
export const SETTINGS: CapabilityType<SettingsCapability> = { id: "settings" };
/** The capability a plugin provides to install, update and remove other plugins. */
export const PLUGIN_MANAGEMENT: CapabilityType<PluginManagementCapability> = { id: "plugin-management" };
/** The capability a plugin provides to manage a home's shared library store. */
export const LIBRARY_MANAGEMENT: CapabilityType<LibraryManagementCapability> = { id: "library-management" };
/** The capability a plugin provides to offer plugins a host can install. */
export const MARKETPLACE_SOURCE: CapabilityType<MarketplaceSourceCapability> = { id: "marketplace-source" };
/** The capability a plugin provides to reconcile state across two app homes. */
export const CROSS_APP_SYNC: CapabilityType<CrossAppSyncCapability> = { id: "cross-app-sync" };
/** The capability a plugin provides to record and restore configuration over time. */
export const CONFIG_HISTORY: CapabilityType<ConfigHistoryCapability> = { id: "config-history" };
/** The capability a plugin provides to serve endpoints of its own. */
export const CUSTOM_ENDPOINTS: CapabilityType<CustomEndpointsCapability> = { id: "custom-endpoints" };
/** The service through which a host reaches the accounts a provider holds. */
export const ACCOUNTS: ServiceType<AccountsService> = { id: "accounts" };
/** The service through which a host reaches the routing chain. */
export const ROUTING: ServiceType<RoutingService> = { id: "routing" };
/** The service through which a host records and reads activity. */
export const ACTIVITY: ServiceType<ActivityService> = { id: "activity" };
/** The topic carrying a change in the proxy's running state. */
export const PROXY_STATUS: TopicType<ProxyStatusEvent> = { id: "proxy.status" };
/** The topic carrying a cross-app reconciliation having finished. */
export const SYNC_COMPLETED: TopicType<SyncCompletedEvent> = { id: "sync.completed" };
/** The topic carrying a message meant for a person. */
export const NOTIFICATION: TopicType<NotificationEvent> = { id: "notification" };
/** The topic carrying a plugin having been installed. */
export const PLUGIN_INSTALLED: TopicType<PluginInstalledEvent> = { id: "plugin.installed" };
/** The topic carrying a switch to a different configuration profile. */
export const CONFIG_PROFILE_CHANGED: TopicType<ConfigProfileChangedEvent> = { id: "config.profile_changed" };
/** The topic carrying a whole configuration having been captured. */
export const CONFIG_SNAPSHOT: TopicType<ConfigSnapshotEvent> = { id: "config.snapshot" };
/** The topic carrying an upstream refusing an account for now. */
export const ACCOUNT_RATE_LIMITED: TopicType<AccountRateLimitedEvent> = { id: "account.rate_limited" };
/** The topic carrying how far a long-running plugin operation has got. */
export const PLUGIN_PROGRESS: TopicType<PluginProgressEvent> = { id: "plugin.progress" };
/** The topic carrying one configuration value having changed. */
export const CONFIG_CHANGED: TopicType<ConfigChangedEvent> = { id: "config.changed" };
