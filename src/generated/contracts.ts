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
  /** The name this screen is addressed by, unique among the host's screens. */
  id: string;
  /** What a reader sees on the navigation entry. */
  label: string;
  /** The tree of nodes this screen is built from. */
  layout: ScreenNode;
  /** Sort order among screens. Lower sorts first. */
  order?: number;
  /** Event topic prefixes whose arrival makes the host re-read this screen. */
  refreshOn?: string[];
  /** Whether this screen belongs to one home or to every home. */
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
  /**
   * Which channel one plugin follows, and what that resolves to.
   *
   * @param id - the plugin to read.
   * @returns the plugin's channel and the version it resolves to.
   */
  channelState(id: string): Promise<PluginChannelState>;
  /**
   * Checks upstream and returns the fresh result.
   *
   * @returns what upstream currently offers for every managed plugin.
   */
  checkUpdates(): Promise<PluginUpdateCache>;
  /**
   * The paths a plugin left in this home.
   *
   * @param id - the plugin whose paths to collect.
   * @param declared - paths the plugin names itself, added to the ones naming conventions find.
   * @returns what the plugin left behind, each entry sized so a host can show the cost of deleting it.
   */
  data(id: string, declared: string[]): Promise<PluginDataEntry[]>;
  /**
   * Moves one plugin back to an earlier version.
   *
   * @param id - the plugin to move.
   * @param version - the version to move it to.
   * @returns the outcome, carrying the message a host shows.
   */
  downgrade(id: string, version: string): Promise<ActionResult>;
  /**
   * Records a plugin and sets it up, fetching whatever it needs.
   *
   * @param url - where the plugin is fetched from.
   * @returns the outcome, carrying the message a host shows.
   */
  install(url: string): Promise<ActionResult>;
  /**
   * Every plugin this manager knows about in the current home.
   *
   * @returns the managed plugins.
   */
  list(): Promise<ManagedPlugin[]>;
  /**
   * Every npm-installed plugin this manager knows about in the current home.
   *
   * @returns the npm-installed plugins.
   */
  listNpm(): Promise<ManagedNpmPlugin[]>;
  /**
   * Deployed artifacts a plugin should have and does not, which is what makes repair worth offering.
   *
   * @param id - the plugin to inspect.
   * @returns the artifact paths that are missing, empty when the deployment is whole.
   */
  missingArtifacts(id: string): Promise<string[]>;
  /**
   * Records a plugin without setting it up, and answers with the entry as recorded.
   *
   * @remarks
   * Separate from `install(String)` because setting a plugin up is slow enough
   * to want a surface showing it before the work starts. A host that does not need that shows
   * nothing until install returns, and calls install alone.
   *
   * @param url - where the plugin would be fetched from.
   * @returns the entry as recorded.
   */
  register(url: string): Promise<ManagedPlugin>;
  /**
   * Removes one plugin and the artifacts it deployed.
   *
   * @param id - the plugin to remove.
   * @returns the outcome, carrying the message a host shows.
   */
  remove(id: string): Promise<ActionResult>;
  /**
   * Deletes the given paths, returning the ones actually removed.
   *
   * @param paths - the paths to delete.
   * @returns the paths that were removed, which omits any that were already gone.
   */
  removeData(paths: string[]): Promise<string[]>;
  /**
   * Removes one npm-installed plugin.
   *
   * @param id - the plugin to remove.
   * @returns the outcome, carrying the message a host shows.
   */
  removeNpm(id: string): Promise<ActionResult>;
  /**
   * Rebuilds and redeploys one installed plugin without fetching.
   *
   * @param id - the plugin to repair.
   * @returns the outcome, carrying the message a host shows.
   */
  repair(id: string): Promise<ActionResult>;
  /**
   * Updates what this occasion is allowed to, doing nothing when the home has it switched off.
   *
   * @remarks
   * The policy lives with the plugin holding it rather than in each host, so two hosts
   * cannot disagree about whether an automatic run was permitted.
   *
   * @param trigger - the occasion this run is happening on.
   * @returns the outcome, carrying the message a host shows.
   */
  runUpdates(trigger: UpdateTrigger): Promise<ActionResult>;
  /**
   * Sets whether one plugin updates without being asked.
   *
   * @param id - the plugin to set.
   * @param autoUpdate - whether it updates on its own.
   * @returns the outcome, carrying the message a host shows.
   */
  setAutoUpdate(id: string, autoUpdate: boolean): Promise<ActionResult>;
  /**
   * Moves one plugin to a different release channel.
   *
   * @param id - the plugin to move.
   * @param channel - the channel it should follow.
   * @returns the outcome, carrying the message a host shows.
   */
  setChannel(id: string, channel: PluginChannel): Promise<ActionResult>;
  /**
   * Switches one plugin on or off without removing it.
   *
   * @param id - the plugin to switch.
   * @param enabled - whether it should load.
   * @returns the outcome, carrying the message a host shows.
   */
  setEnabled(id: string, enabled: boolean): Promise<ActionResult>;
  /**
   * Updates one plugin to the newest version its channel offers.
   *
   * @param id - the plugin to update.
   * @returns the outcome, carrying the message a host shows.
   */
  update(id: string): Promise<ActionResult>;
  /**
   * Updates everything eligible, whatever the home's policy says.
   *
   * @remarks
   * This is the explicit "update everything now" a person asked for. A run that should
   * honour what the home has switched off is `runUpdates(UpdateTrigger)` instead.
   *
   * @returns the outcome, carrying the message a host shows.
   */
  updateAll(): Promise<ActionResult>;
  /**
   * The last check's result, without going upstream.
   *
   * @returns the cached result, empty when nothing has been checked yet.
   */
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
  /**
   * Every library in this home, shared and per-plugin.
   *
   * @returns what the home holds.
   */
  libraries(): Promise<HomeLibraries>;
  /**
   * Removes one library, declining while something still depends on it.
   *
   * @param specifier - the library to remove.
   * @returns whether it went, and what still depended on it when it did not.
   */
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
  /** The nodes nested inside this one. */
  children?: ScreenNode[];
  /** Which renderer this node asks for, looked up in the surface's own registry. */
  kind: string;
  /** Presentation hints for this node. */
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
  /** How the node sits against its siblings. */
  align?: Align;
  /** Share of free space this node takes among its siblings. */
  grow?: number;
  /** How much space is left around the node's contents. */
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
  /**
   * Writes one activity down.
   *
   * @param spec - what happened.
   */
  emit(spec: ActivitySpec): void;
  /**
   * Reads recorded activity, newest first.
   *
   * @returns the newest page.
   */
  read(): Promise<ActivityPage>;
  /**
   * Reads the slice of recorded activity a query asks for, newest first.
   *
   * @param query - which slice to read.
   * @returns the matching page.
   */
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
  /** The data behind one screen, keyed by the source names its layout nodes reference. */
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
  /** Paths inside the home the plugin writes to that its own name does not reveal. */
  paths?: string[];
}

/** A button a plugin offers on a settings surface or a screen row. */
export interface ActionSpec {
  /**
   * What this action needs collected before it runs, which a surface prompts for and passes back
   * as the run's input. Absent means the action takes none.
   */
  args?: FieldSpec[];
  /** Text a surface must confirm with before running the action. */
  confirm?: string;
  /** Marks the action as destructive, so a surface can style it as such. */
  danger?: boolean;
  /** The explanation shown beside the button. */
  description?: string;
  /** The name this action is addressed by when a surface runs it. */
  id: string;
  /** What a reader sees on the button. */
  label: string;
}

/** A configuration snapshot was taken. */
export interface ConfigSnapshotEvent {
  /** The configuration files this snapshot covers. */
  files: string[];
  /** Snapshot content hash. */
  hash: string;
  /** Why the snapshot was taken. */
  reason: string;
}

/** A cross-app reconciliation finished. */
export interface SyncCompletedEvent {
  /** The files reconciled across the homes. */
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
  /** Which screen the data is wanted for. */
  screenId: string;
}

/** A host asking a plugin to run one of a screen's actions. */
export interface ScreenActionRequest {
  /** Which of that screen's actions to run. */
  actionId: string;
  /** Absolute path of the app home to act on, for a per-home screen. */
  home?: string;
  /** Values the surface collected for the action. */
  input?: Record<string, unknown>;
  /** Which screen the action belongs to. */
  screenId: string;
}

/** A long-running plugin operation reported progress. */
export interface PluginProgressEvent {
  /** Which plugin the operation is running against. */
  name: string;
  /** Completion percentage, when known. */
  pct?: number;
  /** Current phase of the operation. */
  phase: string;
}

/** A plugin asking a host's settings surface for a place of its own inside it. */
export interface SectionSpec {
  /** The ids of the actions this section offers. */
  actions?: string[];
  /** The explanation shown under the heading. */
  description?: string;
  /** The keys of the settings this section shows, in the order it shows them. */
  fields?: string[];
  /** The name this section is addressed by, unique among the host's sections. */
  id: string;
  /** The heading a reader sees. */
  label: string;
  /** Sort order among sections. Lower sorts first. */
  order?: number;
  /**
   * Whether the settings in this section belong to one home or to every home.
   *
   * @remarks
   * `allHomes` says the setting is not a per-home one, so a surface managing
   * several homes writes it to all of them rather than asking which. The default is per-home.
   */
  scope?: Scope;
}

/** A plugin finished installing. */
export interface PluginInstalledEvent {
  /** Which plugin was installed. */
  name: string;
  /** The version that was installed. */
  version: string;
}

/** A plugin's configuration file changed. */
export interface ConfigChangedEvent {
  /** Config name that changed. */
  name: string;
}

/** An account hit an upstream rate limit. */
export interface AccountRateLimitedEvent {
  /** Which of that provider's accounts was refused. */
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
  /**
   * The installable entries this source offers.
   *
   * @returns the entries, empty when the source offers none.
   */
  entries(): Promise<MarketplaceEntry[]>;
}

/** Contributes navigation entries of its own, whose contents the plugin lays out and fills. */
export interface ScreensCapability {
  /**
   * Runs one of a screen's actions.
   *
   * @param request - which action, on which screen, with whatever input the surface collected.
   * @returns the outcome, carrying the message a host shows.
   */
  invoke(request: ScreenActionRequest): Promise<ActionResult>;
  /**
   * Fills one screen's layout with data.
   *
   * @param request - which screen, in which home, and whether this is a re-read.
   * @returns the data, keyed by the source names the layout references.
   */
  read(request: ScreenDataRequest): Promise<ScreenData>;
  /**
   * The navigation entries this plugin contributes.
   *
   * @returns the screens, empty when the plugin contributes none.
   */
  screens(): ScreenSpec[] | Promise<ScreenSpec[]>;
}

/** Contributes slash commands to whichever app the plugin is deployed into. */
export interface CommandsCapability {
  /**
   * The slash commands this plugin contributes.
   *
   * @returns the commands, empty when the plugin contributes none.
   */
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
   *
   * @param actionId - which declared action to run.
   * @returns the outcome, carrying the message a host shows.
   */
  run(actionId: string): Promise<ActionResult>;
  /**
   * Runs one of the declared actions with the input a surface collected for it.
   *
   * @param actionId - which declared action to run.
   * @param input - the values the surface collected, keyed by field.
   * @returns the outcome, carrying the message a host shows.
   */
  run(actionId: string, input: Record<string, unknown>): Promise<ActionResult>;
  /**
   * Everything this plugin declares about its settings, actions and sections.
   *
   * @returns the schema a settings surface renders.
   */
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
  /** The buttons this plugin offers. */
  actions?: ActionSpec[];
  /** Where this plugin keeps state its own name does not reveal. */
  data?: DataSpec;
  /** The settings this plugin offers. */
  fields?: FieldSpec[];
  /** How the fields and actions are grouped for a reader. */
  sections?: SectionSpec[];
}

/** How much one recorded activity matters. */
export type ActivityImpact = "debug" | "info" | "notice" | "warning" | "error";

/** How prominent a notification is. */
export type NotificationLevel = "info" | "success" | "warning" | "error";

/** Keeps a history of configuration changes and can put an earlier state back. */
export interface ConfigHistoryCapability {
  /**
   * Reads recorded snapshots, newest first.
   *
   * @returns every recorded snapshot.
   */
  history(): Promise<HistoryEntry[]>;
  /**
   * Reads the slice of recorded snapshots a query asks for, newest first.
   *
   * @param query - which slice to read.
   * @returns the matching snapshots.
   */
  history(query: HistoryQuery): Promise<HistoryEntry[]>;
  /**
   * Puts the configuration back to one recorded snapshot.
   *
   * @param entryId - the snapshot to restore.
   * @returns the outcome, carrying the message a host shows.
   */
  restore(entryId: string): Promise<ActionResult>;
}

/** Named tone a surface renders a table cell in, resolved through its own palette. */
export type Tone = "normal" | "muted" | "mono" | "old" | "new" | (string & {});

/** One activity as it is read back. */
export interface ActivityRecord {
  /** What was done, within the topic. */
  action: string;
  /** Everything the recorder attached that has no field of its own. */
  details: Record<string, unknown>;
  /** Absolute path of the app home it was recorded in. */
  home: string;
  /** What this record is addressed by, unique within the home. */
  id: string;
  /** How much this activity mattered, which is what a surface sorts and colours by. */
  impact: ActivityImpact;
  /** Who recorded it, normally a plugin id. */
  source: string;
  /** What the activity was about, when it was about one identifiable thing. */
  subject?: ActivitySubject;
  /** One line describing the activity, for a surface that renders text. */
  text: string;
  /** What kind of thing happened, which is what a reader filters on. */
  topic: string;
  /** When it happened, in epoch milliseconds. */
  ts: number;
}

/** One choice of a select field. */
export interface FieldOption {
  /** What a reader sees for this option. */
  label: string;
  /** What choosing this option stores. */
  value: string;
}

/** One column of a table node. */
export interface Column {
  /** The row key this column reads. */
  key: string;
  /** The column's heading. */
  label?: string;
  /** How the surface should colour this column's cells. */
  tone?: Tone;
  /** Character budget beyond which the surface truncates. */
  truncate?: number;
}

/** One configurable setting a plugin declares, which every settings surface renders its own way. */
export interface FieldSpec {
  /** The longer explanation shown under the control. */
  description?: string;
  /** The heading this setting is filed under, so related settings sit together. */
  group?: string;
  /** What each element of a list field holds. */
  itemType?: ItemType;
  /** The name this setting is stored and read under. */
  key: string;
  /** What a reader sees beside the control. */
  label?: string;
  /** The highest value a numeric field accepts. */
  max?: number;
  /** The lowest value a numeric field accepts. */
  min?: number;
  /** The choices a select field offers. */
  options?: FieldOption[];
  /** The hint shown in an empty control. */
  placeholder?: string;
  /** How far one nudge moves a numeric field. */
  step?: number;
  /** The input control this setting asks for. */
  type: FieldType;
}

/** One installable thing a marketplace source offers. */
export interface MarketplaceEntry {
  /** One line saying what the entry is for. */
  description?: string;
  /** What a reader sees instead of the id. */
  displayName?: string;
  /** Entry id, normally the repository name. */
  id: string;
  /** Topics a host filters and groups by. */
  topics?: string[];
  /** Where installing this entry fetches from. */
  url: string;
}

/** One library materialised in a home. */
export interface InstalledLibrary {
  /** The package name this library is installed under. */
  specifier: string;
  /** The deployed plugins linking this copy, which is what makes a removal safe or not. */
  usedBy: string[];
  /** The version materialised in the home. */
  version: string;
}

/** One npm-installed plugin as the plugin manager sees it. */
export interface ManagedNpmPlugin {
  /**
   * The package's entry file in this home, when it resolves to one.
   *
   * @remarks
   * An npm plugin has no deployed bundle, so without this a surface has no file to
   * probe and its settings are unreachable. Where the package resolves is the manager's
   * knowledge, not a surface's: several homes cache packages in different places.
   */
  entryPath?: string;
  /** Whether the package is present in this home's store. */
  installed: boolean;
  /** The package name this plugin is published under. */
  name: string;
  /** The version this home asks for. */
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
  /** How much space the path occupies, so a surface can show the cost of deleting it. */
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
  /** Whether the home loads this plugin. */
  enabled: boolean;
  /** What this plugin is addressed by, and the name its deployed artifacts carry. */
  id: string;
  /** Where the plugin is installed from. */
  url?: string;
  /** The version currently deployed, when one is known. */
  version?: string;
}

/** One recorded configuration snapshot. */
export interface HistoryEntry {
  /** The configuration files this snapshot covers. */
  files: string[];
  /** What this snapshot is addressed by when restoring it. */
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
  /** What this endpoint is addressed by in a routing chain. */
  id: string;
  /** What a reader sees instead of the id. */
  label: string;
}

/** Padding hint a surface resolves through its own spacing scale. */
export type Pad = "none" | "tight" | "normal";

/** Reconciles state across the app homes on this machine. */
export interface CrossAppSyncCapability {
  /**
   * Reconciles the configured state across every app home on this machine.
   *
   * @returns what the reconciliation moved.
   */
  sync(): Promise<SyncResult>;
}

/** Serves endpoints the user defined rather than ones the ecosystem ships. */
export interface CustomEndpointsCapability {
  /**
   * The endpoints the user has defined.
   *
   * @returns the endpoints, empty when the user has defined none.
   */
  endpoints(): Promise<CustomEndpoint[]>;
}

/** Something a surface should show the user. */
export interface NotificationEvent {
  /** How prominently a surface should show it. */
  level: NotificationLevel;
  /** What the reader is being told. */
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
  /** Whether the library was actually removed. */
  removed: boolean;
  /** What still depended on it, which is why a removal declines rather than breaking a plugin. */
  usedBy: string[];
}

/** The proxy came up or went down. */
export interface ProxyStatusEvent {
  /** The port it is listening on, or was listening on before it went down. */
  port: number;
  /** Whether the proxy is now reachable. */
  up: boolean;
}

/** The result of the last update check, keyed by plugin id. */
export interface PluginUpdateCache {
  /** When the check that produced this ran. */
  checkedAt: string;
  /** What the check found, keyed by plugin id. */
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
  /** What the activity was about, when it was about one identifiable thing. */
  subject?: ActivitySubject;
  /** Dotted topic the activity belongs to, for example `config.changed`. */
  topic: string;
}

/** What one activity was about. */
export interface ActivitySubject {
  /** Which one of that kind it was. */
  id?: string;
  /** What kind of thing it is, for example `plugin` or `account`. */
  kind: string;
  /** What a reader sees instead of the id. */
  label?: string;
}

/** What one plugin depends on. */
export interface PluginDependencies {
  /** The libraries it links, shared or private alike. */
  dependencies: InstalledLibrary[];
  /** Which deployed plugin this describes. */
  plugin: string;
}

/** What one reconciliation across app homes moved. */
export interface SyncResult {
  /** The files reconciled across the homes. */
  files: string[];
  /** App homes involved in the reconciliation. */
  homes: string[];
  /** Plugins whose entries were mirrored. */
  plugins: string[];
}

/** What running an action produced, for a surface to report and act on. */
export interface ActionResult {
  /** One line for the surface to show, on success or on failure. */
  message?: string;
  /** Whether the action did what it was asked to. */
  ok: boolean;
  /** Asks the surface to re-read the screen's data because the action changed it. */
  refresh?: boolean;
}

/** What the last update check found for one plugin. */
export interface CachedPluginUpdate {
  /**
   * Whether this plugin publishes an experimental channel.
   *
   * rather than absent; see {@link PluginChannelState.experimentalAvailable}.
   */
  experimentalAvailable: boolean | null;
  /** The version currently deployed in this home. */
  installedVersion: string | null;
  /** Where this plugin comes from, which decides which of the version fields below are filled. */
  kind: PluginKind;
  /** Npm only, the registry's latest. */
  latestVersion: string | null;
  /** Git only. */
  localHead: string | null;
  /** Git only. */
  remoteHead: string | null;
  /** Whether the check found something newer than what is deployed. */
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
  /** Whether the plugin currently follows the pre-release channel. */
  onExperimental: boolean;
}

/** Which keys of a row carry its title, subtitle, badge and icon in a list node. */
export interface ItemShape {
  /** The row key holding a short status marker shown beside the title. */
  badge?: string;
  /** The row key holding the row's mark. */
  icon?: string;
  /** The row key holding the line under the title. */
  subtitle?: string;
  /** The row key holding the line a reader scans for. */
  title: string;
}

/** Which slice of the activity record a caller wants. */
export interface ActivityQuery {
  /** Opaque cursor from a previous page. */
  cursor?: string;
  /** Keep only activity of these impacts. */
  impacts?: ActivityImpact[];
  /** How many records one page may hold. */
  limit?: number;
  /** Keep only activity at or after this epoch millisecond. */
  since?: number;
  /** Keep only activity recorded by these sources. */
  sources?: string[];
  /** Keep only activity on these topics. */
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
  /** How many snapshots one page may hold. */
  limit?: number;
}

