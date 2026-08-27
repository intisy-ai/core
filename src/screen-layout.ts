import type { ScreenNode, ScreenSpec } from "./capabilities.types.js";

/** One node of a screen layout, flattened with its depth, for a surface that renders in lines. */
export interface FlatRow {
  /** Which renderer this node asks for. */
  kind: string;
  /** The text a surface shows for the node, when it has one. */
  label?: string;
  /** The node itself, so a renderer can read the props its kind carries. */
  node: ScreenNode;
  /** How deep the node sits, which is what a line-based surface indents by. */
  depth: number;
}

/** The node kinds that hold other nodes rather than rendering a value. */
export const CONTAINER_KINDS = new Set(["stack", "row", "grid", "card", "group", "tabs"]);

// How deep a layout is walked. A plugin's tree is a live in-process object, so it may nest into
// itself or nest absurdly; without a bound either one exhausts the stack and takes the host down.
// Being live is also what keeps this walk in TypeScript: a cyclic tree cannot be serialized across
// a JSON boundary, and a FlatRow hands the node itself back rather than a copy of it.
/** How deep a layout may nest before flattening stops, which is what bounds a cyclic tree. */
export const MAX_LAYOUT_DEPTH = 12;

interface Tab {
  id?: string;
  label?: string;
  child?: ScreenNode;
}

function titleOf(node: ScreenNode): string | undefined {
  const title = node.title ?? node.label;
  return typeof title === "string" && title ? title : undefined;
}

function join(outer: string | undefined, inner: string | undefined): string | undefined {
  if (outer && inner) return `${outer} / ${inner}`;
  return outer ?? inner;
}

// A surface with no nesting still wants to know what a leaf sat under, so a container
// contributes its title to the rows below it rather than a row of its own.
function walk(node: ScreenNode, depth: number, label: string | undefined, rows: FlatRow[]): void {
  if (depth >= MAX_LAYOUT_DEPTH) return;
  if (!CONTAINER_KINDS.has(node.kind)) {
    rows.push(label === undefined ? { kind: node.kind, node, depth } : { kind: node.kind, label, node, depth });
    return;
  }
  const own = join(label, titleOf(node));
  if (node.kind === "tabs") {
    const tabs = Array.isArray(node.tabs) ? (node.tabs as Tab[]) : [];
    for (const tab of tabs) {
      if (tab && tab.child) walk(tab.child, depth + 1, join(own, tab.label), rows);
    }
    return;
  }
  for (const child of node.children ?? []) walk(child, depth + 1, own, rows);
}

// The root container is the screen itself, so its direct children sit at depth 0 and a
// surface indents only what the plugin actually nested.
/**
 * Walks a layout tree into rows, depth first.
 *
 * @param node the root of the layout.
 * @returns one row per node, each carrying its depth.
 */
export function flattenScreen(node: ScreenNode): FlatRow[] {
  const rows: FlatRow[] = [];
  walk(node, CONTAINER_KINDS.has(node.kind) ? -1 : 0, undefined, rows);
  return rows;
}

// A surface asks for its own tree by its own id and falls back to the shared layout, so a surface
// this library has never heard of still renders what the plugin declared for it.
/**
 * The layout one surface should render for a screen.
 *
 * @param spec the screen.
 * @param surface which surface is asking.
 * @returns that surface own layout where the screen declares one, else the shared layout.
 */
export function screenLayoutFor(spec: ScreenSpec, surface: string): ScreenNode {
  return spec.surfaces?.[surface] ?? spec.layout;
}
