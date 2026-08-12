import type { ScreenNode, ScreenSpec } from "./capabilities.types.js";

export interface FlatRow {
  kind: string;
  label?: string;
  node: ScreenNode;
  depth: number;
}

export const CONTAINER_KINDS = new Set(["stack", "row", "grid", "card", "group", "tabs"]);

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
export function flattenScreen(node: ScreenNode): FlatRow[] {
  const rows: FlatRow[] = [];
  walk(node, CONTAINER_KINDS.has(node.kind) ? -1 : 0, undefined, rows);
  return rows;
}

export function screenLayoutFor(spec: ScreenSpec, surface: "gui" | "tui"): ScreenNode {
  return (surface === "tui" && spec.surfaces?.tui) || spec.layout;
}
