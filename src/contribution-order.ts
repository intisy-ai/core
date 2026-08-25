// The one ordering rule for a plugin's contributions. A settings section, a screen and a
// settings group are each a labelled thing with an optional position, and every surface that
// renders them (the dashboard, a loader's TUI) sorts them the same way.

export interface OrderedContribution {
  order?: number;
  label: string;
}

/**
 * Declared order first, an undeclared one last, then the label.
 *
 * @implNote the tie-break is `localeCompare`, which is case-insensitive first and puts the
 * lowercase form ahead on a tie, and which collates an accented letter with its unaccented base
 * rather than by code point. TeaVM 0.15.0 ships no `java.text.Collator`, so this rule cannot move
 * to Java without reordering every label that starts with one.
 */
export function byOrderThenLabel(a: OrderedContribution, b: OrderedContribution): number {
  return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.label.localeCompare(b.label);
}
