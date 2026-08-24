// Generated from Java sources. Do not edit.

import type { CapabilityType, ServiceType, TopicType } from "@intisy-ai/api/contract";
import type { AccountRateLimitedEvent, AccountsService, ActivityService, CommandsCapability, ConfigChangedEvent, ConfigHistoryCapability, ConfigProfileChangedEvent, ConfigSnapshotEvent, CrossAppSyncCapability, CustomEndpointsCapability, LibraryManagementCapability, MarketplaceSourceCapability, NotificationEvent, PluginInstalledEvent, PluginManagementCapability, PluginProgressEvent, ProxyStatusEvent, RoutingService, ScreensCapability, SettingsCapability, SyncCompletedEvent } from "./contracts.js";

export const ACCOUNTS: ServiceType<AccountsService> = { id: "accounts" };
export const ACCOUNT_RATE_LIMITED: TopicType<AccountRateLimitedEvent> = { id: "account.rate_limited" };
export const ACTIVITY: ServiceType<ActivityService> = { id: "activity" };
export const COMMANDS: CapabilityType<CommandsCapability> = { id: "commands" };
export const CONFIG_CHANGED: TopicType<ConfigChangedEvent> = { id: "config.changed" };
export const CONFIG_HISTORY: CapabilityType<ConfigHistoryCapability> = { id: "config-history" };
export const CONFIG_PROFILE_CHANGED: TopicType<ConfigProfileChangedEvent> = { id: "config.profile_changed" };
export const CONFIG_SNAPSHOT: TopicType<ConfigSnapshotEvent> = { id: "config.snapshot" };
export const CROSS_APP_SYNC: CapabilityType<CrossAppSyncCapability> = { id: "cross-app-sync" };
export const CUSTOM_ENDPOINTS: CapabilityType<CustomEndpointsCapability> = { id: "custom-endpoints" };
export const LIBRARY_MANAGEMENT: CapabilityType<LibraryManagementCapability> = { id: "library-management" };
export const MARKETPLACE_SOURCE: CapabilityType<MarketplaceSourceCapability> = { id: "marketplace-source" };
export const NOTIFICATION: TopicType<NotificationEvent> = { id: "notification" };
export const PLUGIN_INSTALLED: TopicType<PluginInstalledEvent> = { id: "plugin.installed" };
export const PLUGIN_MANAGEMENT: CapabilityType<PluginManagementCapability> = { id: "plugin-management" };
export const PLUGIN_PROGRESS: TopicType<PluginProgressEvent> = { id: "plugin.progress" };
export const PROXY_STATUS: TopicType<ProxyStatusEvent> = { id: "proxy.status" };
export const ROUTING: ServiceType<RoutingService> = { id: "routing" };
export const SCREENS: CapabilityType<ScreensCapability> = { id: "screens" };
export const SETTINGS: CapabilityType<SettingsCapability> = { id: "settings" };
export const SYNC_COMPLETED: TopicType<SyncCompletedEvent> = { id: "sync.completed" };
