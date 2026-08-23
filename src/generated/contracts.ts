// Generated from Java sources. Do not edit.

/**
 * A plugin asking a host for a navigation entry of its own whose contents it lays out.
 *
 * @remarks
 * The plugin supplies structure and data; the host supplies every component and all
 * styling.
 */
export interface ScreenSpec {
  /** Glyph beside the navigation entry, resolved by the surface. */
  glyph?: string;
  id: string;
  label: string;
  layout: ScreenNode;
  /** Sort order among screens. Lower sorts first. */
  order?: number;
  /** Event topic prefixes whose arrival makes the host re-read this screen. */
  refreshOn?: string[];
  scope?: Scope;
  /**
   * Per-surface layout overrides, keyed by surface id.
   *
   * @remarks
   * A surface uses `layout` when it finds no entry of its own, and an id no host
   * renders is ignored.
   */
  surfaces?: Record<string, ScreenNode>;
}

/**
 * Installs, updates, and removes other plugins.
 *
 * @remarks
 * Every method acts on the home this capability was resolved against, so none of them
 * takes one as a parameter. A host that drives several homes resolves the capability once per home
 * rather than passing a home in: a plugin is only ever responsible for the home it runs in, and
 * giving it a home argument would hand every plugin the power to reach into another one.
 */
export interface PluginManagementCapability {
  channelState(id: string): Promise<PluginChannelState>;
  /** Checks upstream and returns the fresh result. */
  checkUpdates(): Promise<PluginUpdateCache>;
  /**
   * The paths a plugin left in this home.
   *
   * @param declared - paths the plugin names itself, added to the ones naming conventions find.
   */
  data(id: string, declared: string[]): Promise<PluginDataEntry[]>;
  downgrade(id: string, version: string): Promise<ActionResult>;
  install(url: string): Promise<ActionResult>;
  /** Every plugin this manager knows about in the current home. */
  list(): Promise<ManagedPlugin[]>;
  listNpm(): Promise<ManagedNpmPlugin[]>;
  /** Deployed artifacts a plugin should have and does not, which is what makes repair worth offering. */
  missingArtifacts(id: string): Promise<string[]>;
  /**
   * Records a plugin without setting it up, and answers with the entry as recorded.
   *
   * @remarks
   * Separate from `install(String)` because setting a plugin up is slow enough
   * to want a surface showing it before the work starts. A host that does not need that shows
   * nothing until install returns, and calls install alone.
   */
  register(url: string): Promise<ManagedPlugin>;
  remove(id: string): Promise<ActionResult>;
  /** Deletes the given paths, returning the ones actually removed. */
  removeData(paths: string[]): Promise<string[]>;
  removeNpm(id: string): Promise<ActionResult>;
  /** Rebuilds and redeploys one installed plugin without fetching. */
  repair(id: string): Promise<ActionResult>;
  /**
   * Updates what this occasion is allowed to, doing nothing when the home has it switched off.
   *
   * @remarks
   * The policy lives with the plugin holding it rather than in each host, so two hosts
   * cannot disagree about whether an automatic run was permitted.
   */
  runUpdates(trigger: UpdateTrigger): Promise<ActionResult>;
  setAutoUpdate(id: string, autoUpdate: boolean): Promise<ActionResult>;
  setChannel(id: string, channel: PluginChannel): Promise<ActionResult>;
  setEnabled(id: string, enabled: boolean): Promise<ActionResult>;
  update(id: string): Promise<ActionResult>;
  /**
   * Updates everything eligible, whatever the home's policy says.
   *
   * @remarks
   * This is the explicit "update everything now" a person asked for. A run that should
   * honour what the home has switched off is `runUpdates(UpdateTrigger)` instead.
   */
  updateAll(): Promise<ActionResult>;
  /** The last check's result, without going upstream. */
  updateCache(): Promise<PluginUpdateCache>;
}

/**
 * Manages the shared libraries a home materialises for its plugins.
 *
 * @remarks
 * Minted beside {@link PluginManagementCapability} rather than folded into it, because a
 * library is a different noun: a host lists and prunes libraries on their own screen, and a library
 * outlives the plugin that first pulled it in. Every method acts on the home this capability was
 * resolved against, so nothing here takes one as a parameter.
 */
export interface LibraryManagementCapability {
  /** Every library in this home, shared and per-plugin. */
  libraries(): Promise<HomeLibraries>;
  /** Removes one library, declining while something still depends on it. */
  remove(specifier: string): Promise<LibraryRemoval>;
}

/**
 * One node of a screen's layout tree.
 *
 * @remarks
 * `kind` is open on purpose: each surface dispatches it through a registry and skips
 * what it does not know, so a plugin built against a newer host degrades instead of blanking a
 * screen. The index signature carries each kind's own props.
 */
export interface ScreenNode {
  children?: ScreenNode[];
  kind: string;
  style?: NodeStyle;
  [prop: string]: unknown;
}

/**
 * Presentation hints every screen node may carry.
 *
 * @remarks
 * New sizing or spacing options belong here rather than on a kind, so adding one never
 * touches an existing kind's renderer.
 */
export interface NodeStyle {
  align?: Align;
  /** Share of free space this node takes among its siblings. */
  grow?: number;
  pad?: Pad;
  /** Named tone, resolved by the surface's own palette. */
  tone?: string;
  /** Width hint, in whatever unit the surface understands. */
  width?: string;
}

/**
 * The account store contract.
 *
 * @remarks
 * Empty on purpose: this package names the contract without designing it. Filling it in is
 * new contract design rather than relocation, and a consumer wanting more than the contract reaches
 * for the owning plugin's own package.
 */
export interface AccountsService {
}

/**
 * The activity record contract.
 *
 * @remarks
 * Bare rather than namespaced because it is a contract any plugin may implement, exactly
 * like the account store. The shapes here are the smallest a consumer needs: an implementation is
 * free to record and return more, and a consumer wanting the extra reaches for that
 * implementation's own package.
 */
export interface ActivityService {
  emit(spec: ActivitySpec): void;
  /** Reads recorded activity, newest first. */
  read(): Promise<ActivityPage>;
  read(query: ActivityQuery): Promise<ActivityPage>;
}

/**
 * The data behind one screen, keyed by the source names its layout nodes reference.
 *
 * @remarks
 * Values are unknown because the node kind registry, not this type, is what pairs a source
 * with its renderer.
 */
export interface ScreenData {
  sources: Record<string, unknown>;
}

/**
 * The release channel a plugin tracks.
 *
 * @remarks
 * `inherit` is a real answer, not the absence of one: it says the plugin follows
 * whatever the home is set to, which is a different state from pinning the channel the home happens
 * to be on today. A surface that could not express it could never put a plugin back.
 */
export type PluginChannel = "inherit" | "stable" | "experimental";

/**
 * The routing contract.
 *
 * @remarks
 * Empty for the same reason {@link AccountsService} is.
 */
export interface RoutingService {
}

/**
 * What occasion an update run is answering to.
 *
 * @remarks
 * A home switches each of these on or off independently, which is why a run states
 * which one it is rather than asking for updates unconditionally.
 */
export type UpdateTrigger = "loader" | "app" | "cairn";

/**
 * Where a plugin keeps state inside a home, for a surface offering to delete it on uninstall.
 *
 * @remarks
 * Most plugins declare nothing: the config file, the log files and the cache entries are
 * all named after the plugin and are found without asking. This is only for state written somewhere
 * the plugin's name does not appear. Paths are relative to the home directory.
 */
export interface DataSpec {
  paths?: string[];
}

/** A button a plugin offers on a settings surface or a screen row. */
export interface ActionSpec {
  /** Text a surface must confirm with before running the action. */
  confirm?: string;
  /** Marks the action as destructive, so a surface can style it as such. */
  danger?: boolean;
  description?: string;
  id: string;
  label: string;
}

/** A configuration snapshot was taken. */
export interface ConfigSnapshotEvent {
  files: string[];
  /** Snapshot content hash. */
  hash: string;
  /** Why the snapshot was taken. */
  reason: string;
}

/** A cross-app reconciliation finished. */
export interface SyncCompletedEvent {
  files: string[];
  /** App homes involved in the reconciliation. */
  homes: string[];
  /** Plugins whose entries were mirrored. */
  plugins: string[];
}

/** A host asking a plugin for the data behind one screen. */
export interface ScreenDataRequest {
  /** Absolute path of the app home to read, for a per-home screen. */
  home?: string;
  /** Marks a re-read triggered by an event or by a completed action. */
  refresh?: boolean;
  screenId: string;
}

/** A host asking a plugin to run one of a screen's actions. */
export interface ScreenActionRequest {
  actionId: string;
  /** Absolute path of the app home to act on, for a per-home screen. */
  home?: string;
  /** Values the surface collected for the action. */
  input?: Record<string, unknown>;
  screenId: string;
}

/** A long-running plugin operation reported progress. */
export interface PluginProgressEvent {
  name: string;
  /** Completion percentage, when known. */
  pct?: number;
  /** Current phase of the operation. */
  phase: string;
}

/** A plugin asking a host's settings surface for a place of its own inside it. */
export interface SectionSpec {
  actions?: string[];
  description?: string;
  fields?: string[];
  id: string;
  label: string;
  /** Sort order among sections. Lower sorts first. */
  order?: number;
  /**
   * @remarks
   * `allHomes` says the setting is not a per-home one, so a surface managing
   * several homes writes it to all of them rather than asking which. The default is per-home.
   */
  scope?: Scope;
}

/** A plugin finished installing. */
export interface PluginInstalledEvent {
  name: string;
  version: string;
}

/** A plugin's configuration file changed. */
export interface ConfigChangedEvent {
  /** Config name that changed. */
  name: string;
}

/** An account hit an upstream rate limit. */
export interface AccountRateLimitedEvent {
  accountId?: string;
  /** Routing lane the account was serving, when known. */
  lane?: string;
  /** Provider whose upstream rate-limited the account. */
  provider: string;
  /** Epoch millis when the limit is expected to clear, when known. */
  resetAt?: number;
}

/** Contributes installable entries to a host's marketplace listing. */
export interface MarketplaceSourceCapability {
  entries(): Promise<MarketplaceEntry[]>;
}

/** Contributes navigation entries of its own, whose contents the plugin lays out and fills. */
export interface ScreensCapability {
  invoke(request: ScreenActionRequest): Promise<ActionResult>;
  read(request: ScreenDataRequest): Promise<ScreenData>;
  screens(): ScreenSpec[] | Promise<ScreenSpec[]>;
}

/** Contributes slash commands to whichever app the plugin is deployed into. */
export interface CommandsCapability {
  commands(): CommandDef[] | Promise<CommandDef[]>;
}

/** Cross-axis alignment of a screen node among its siblings. */
export type Align = "start" | "center" | "end";

/** Declares configurable settings, actions, and the sections a settings surface renders them in. */
export interface SettingsCapability {
  /**
   * Runs one of the declared actions.
   *
   * @remarks
   * Two overloads rather than one optional parameter: the processor emits Java overloads
   * as TypeScript overload signatures, so an action taking no input needs no annotation.
   */
  run(actionId: string): Promise<ActionResult>;
  run(actionId: string, input: Record<string, unknown>): Promise<ActionResult>;
  schema(): CapabilitySchema | Promise<CapabilitySchema>;
}

/** Element type of a list field. */
export type ItemType = "string" | "number";

/** Every library a home holds. */
export interface HomeLibraries {
  /** Per plugin, whether the dependency is shared or private to it. */
  plugins: PluginDependencies[];
  /** Materialised once and linked by several plugins. */
  shared: InstalledLibrary[];
}

/** Everything a settings capability declares about itself. */
export interface CapabilitySchema {
  actions?: ActionSpec[];
  data?: DataSpec;
  fields?: FieldSpec[];
  sections?: SectionSpec[];
}

/** How much one recorded activity matters. */
export type ActivityImpact = "debug" | "info" | "notice" | "warning" | "error";

/** How prominent a notification is. */
export type NotificationLevel = "info" | "success" | "warning" | "error";

/** Keeps a history of configuration changes and can put an earlier state back. */
export interface ConfigHistoryCapability {
  /** Reads recorded snapshots, newest first. */
  history(): Promise<HistoryEntry[]>;
  history(query: HistoryQuery): Promise<HistoryEntry[]>;
  restore(entryId: string): Promise<ActionResult>;
}

/** Named tone a surface renders a table cell in, resolved through its own palette. */
export type Tone = "normal" | "muted" | "mono" | "old" | "new" | (string & {});

/** One activity as it is read back. */
export interface ActivityRecord {
  action: string;
  details: Record<string, unknown>;
  /** Absolute path of the app home it was recorded in. */
  home: string;
  id: string;
  impact: ActivityImpact;
  /** Who recorded it, normally a plugin id. */
  source: string;
  subject?: ActivitySubject;
  /** One line describing the activity, for a surface that renders text. */
  text: string;
  topic: string;
  /** When it happened, in epoch milliseconds. */
  ts: number;
}

/** One choice of a select field. */
export interface FieldOption {
  label: string;
  value: string;
}

/** One column of a table node. */
export interface Column {
  key: string;
  label?: string;
  tone?: Tone;
  /** Character budget beyond which the surface truncates. */
  truncate?: number;
}

/** One configurable setting a plugin declares, which every settings surface renders its own way. */
export interface FieldSpec {
  description?: string;
  group?: string;
  itemType?: ItemType;
  key: string;
  label?: string;
  max?: number;
  min?: number;
  options?: FieldOption[];
  placeholder?: string;
  step?: number;
  type: FieldType;
}

/** One installable thing a marketplace source offers. */
export interface MarketplaceEntry {
  description?: string;
  displayName?: string;
  /** Entry id, normally the repository name. */
  id: string;
  /** Topics a host filters and groups by. */
  topics?: string[];
  url: string;
}

/** One library materialised in a home. */
export interface InstalledLibrary {
  specifier: string;
  /** The deployed plugins linking this copy, which is what makes a removal safe or not. */
  usedBy: string[];
  version: string;
}

/** One npm-installed plugin as the plugin manager sees it. */
export interface ManagedNpmPlugin {
  installed: boolean;
  name: string;
  version: string;
}

/** One page of read-back activity. */
export interface ActivityPage {
  /** Cursor the next query takes, absent on the last page. */
  nextCursor?: string;
  /** The records, newest first. */
  records: ActivityRecord[];
}

/** One path a plugin left behind in a home. */
export interface PluginDataEntry {
  bytes: number;
  /** Set where the plugin asked for this path rather than naming conventions finding it. */
  declared?: boolean;
  /**
   * Relative to the home.
   *
   * @remarks
   * Relative rather than absolute because this is what a delete confirmation shows, and
   * the home is the thing being cleaned.
   */
  path: string;
}

/** One plugin as the plugin manager sees it. */
export interface ManagedPlugin {
  /**
   * Whether this plugin updates itself when the home does.
   *
   * @remarks
   * Readable because it is settable: a contract that takes a value and cannot give it
   * back forces every host to keep its own copy of what it just wrote.
   */
  autoUpdate?: boolean;
  /** The channel this plugin declares for itself. Absent means it has never declared one. */
  channel?: PluginChannel;
  enabled: boolean;
  id: string;
  /** Where the plugin is installed from. */
  url?: string;
  /** The version currently deployed, when one is known. */
  version?: string;
}

/** One recorded configuration snapshot. */
export interface HistoryEntry {
  files: string[];
  id: string;
  /** One line describing what changed. */
  summary: string;
  /** When it was taken, in epoch milliseconds. */
  ts: number;
}

/** One slash command a plugin deploys into an app. */
export interface CommandDef {
  /** Hint describing the arguments, for example `list | get <key> | set <key> <value>`. */
  argumentHint?: string;
  /** Markdown the model sees when the command runs. */
  body?: string;
  /** One line shown in the command picker. */
  description: string;
  /** Command name, which becomes the deployed file name. */
  name: string;
  /** Shell run before the body, whose output the body follows. */
  shell?: string;
}

/** One user-defined upstream endpoint. */
export interface CustomEndpoint {
  /** Base URL requests are sent to. */
  baseUrl: string;
  id: string;
  label: string;
}

/** Padding hint a surface resolves through its own spacing scale. */
export type Pad = "none" | "tight" | "normal";

/** Reconciles state across the app homes on this machine. */
export interface CrossAppSyncCapability {
  sync(): Promise<SyncResult>;
}

/** Serves endpoints the user defined rather than ones the ecosystem ships. */
export interface CustomEndpointsCapability {
  endpoints(): Promise<CustomEndpoint[]>;
}

/** Something a surface should show the user. */
export interface NotificationEvent {
  level: NotificationLevel;
  message: string;
}

/** The active configuration profile changed. */
export interface ConfigProfileChangedEvent {
  /** Files the profile switch affected. */
  files: string[];
  /** Name of the profile now active. */
  profile: string;
}

/** The input control a settings field asks a surface for. */
export type FieldType = "boolean" | "number" | "string" | "secret" | "select" | "multiline" | "list";

/** The outcome of removing a library. */
export interface LibraryRemoval {
  removed: boolean;
  /** What still depended on it, which is why a removal declines rather than breaking a plugin. */
  usedBy: string[];
}

/** The proxy came up or went down. */
export interface ProxyStatusEvent {
  port: number;
  /** Whether the proxy is now reachable. */
  up: boolean;
}

/** The result of the last update check, keyed by plugin id. */
export interface PluginUpdateCache {
  checkedAt: string;
  plugins: Record<string, CachedPluginUpdate>;
}

/** What a plugin hands the activity record to have one activity written down. */
export interface ActivitySpec {
  /** What happened, as one verb. */
  action: string;
  /** Anything else worth keeping, which a surface renders as it likes. */
  details?: Record<string, unknown>;
  /** How much it matters. The implementation picks a default per topic when this is absent. */
  impact?: ActivityImpact;
  subject?: ActivitySubject;
  /** Dotted topic the activity belongs to, for example `config.changed`. */
  topic: string;
}

/** What one activity was about. */
export interface ActivitySubject {
  id?: string;
  /** What kind of thing it is, for example `plugin` or `account`. */
  kind: string;
  label?: string;
}

/** What one plugin depends on. */
export interface PluginDependencies {
  dependencies: InstalledLibrary[];
  plugin: string;
}

/** What one reconciliation across app homes moved. */
export interface SyncResult {
  files: string[];
  homes: string[];
  plugins: string[];
}

/** What running an action produced, for a surface to report and act on. */
export interface ActionResult {
  /** One line for the surface to show, on success or on failure. */
  message?: string;
  ok: boolean;
  /** Asks the surface to re-read the screen's data because the action changed it. */
  refresh?: boolean;
}

/** What the last update check found for one plugin. */
export interface CachedPluginUpdate {
  /** Null means unknown rather than absent; see {@link PluginChannelState.experimentalAvailable}. */
  experimentalAvailable: boolean | null;
  installedVersion: string | null;
  kind: PluginKind;
  /** Npm only, the registry's latest. */
  latestVersion: string | null;
  /** Git only. */
  localHead: string | null;
  /** Git only. */
  remoteHead: string | null;
  updateAvailable: boolean;
  /** Set only when a run actually applied an update. */
  updatedAt: string | null;
}

/** Where a plugin is installed from. */
export type PluginKind = "git" | "npm";

/** Whether a setting or a screen is per-home or shared across every home. */
export type Scope = "home" | "allHomes";

/** Which channel a plugin is on, and whether the other one has anything to offer. */
export interface PluginChannelState {
  /**
   * Whether an experimental build exists.
   *
   * @remarks
   * Null means unknown, never checked or the check failed, which is NOT the same as
   * false: only a definite absence may send a plugin back to stable.
   */
  experimentalAvailable: boolean | null;
  onExperimental: boolean;
}

/** Which keys of a row carry its title, subtitle, badge and icon in a list node. */
export interface ItemShape {
  badge?: string;
  icon?: string;
  subtitle?: string;
  title: string;
}

/** Which slice of the activity record a caller wants. */
export interface ActivityQuery {
  /** Opaque cursor from a previous page. */
  cursor?: string;
  impacts?: ActivityImpact[];
  limit?: number;
  /** Keep only activity at or after this epoch millisecond. */
  since?: number;
  sources?: string[];
  topics?: string[];
  /** Keep only activity at or before this epoch millisecond. */
  until?: number;
}

/** Which slice of the configuration history a caller wants. */
export interface HistoryQuery {
  /** Opaque cursor from a previous page. */
  cursor?: string;
  /** Absolute path of the app home to read. */
  home?: string;
  limit?: number;
}

