/**
 * The design's colour arithmetic for a clinician's or a visit type's own
 * colour: the tile, the soft wash behind a pill, the dot — each lighter in
 * the dark theme so it still reads on a dark ground.
 *
 * These are the design's own formulas (`hexToRgba`, `lighten`, `tint`, `soft`,
 * `tileBg`), computed here because CSS cannot derive a translucent wash from a
 * hex that arrives as data.
 */

function rgb(hex: string): [number, number, number] {
  let h = (hex || "#0369a1").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [3, 105, 161];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${String(r)},${String(g)},${String(b)},${String(alpha)})`;
}

export function lighten(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex).map((c) => Math.round(c + (255 - c) * amount)) as [number, number, number];
  return `rgb(${String(r)},${String(g)},${String(b)})`;
}

/** A colour as it is drawn as text or a dot: lighter on a dark ground. */
export const tint = (hex: string, dark: boolean): string => (dark ? lighten(hex, 0.42) : hex);

/** The soft wash behind a pill or a chip in that colour. */
export const soft = (hex: string, dark: boolean): string => rgba(hex, dark ? 0.18 : 0.1);

/** The design's tile: a lit top, a glow at the corner, a gentle gradient of the colour. */
export function tileBg(hex: string, dark: boolean, angle = "150deg"): string {
  const hi = dark
    ? "radial-gradient(120% 84% at 50% 0%, rgba(255,255,255,.07), transparent 56%)"
    : "radial-gradient(120% 84% at 50% 0%, rgba(255,255,255,.6), transparent 58%)";
  const glow = `radial-gradient(58% 46% at 72% 88%, ${rgba(hex, dark ? 0.3 : 0.2)}, transparent 72%)`;
  const base = dark
    ? `linear-gradient(${angle}, ${rgba(hex, 0.34)}, ${rgba(hex, 0.12)})`
    : `linear-gradient(${angle}, ${rgba(hex, 0.22)}, ${rgba(hex, 0.07)})`;
  return `${hi}, ${glow}, ${base}`;
}

/** Two letters for a tile, as the design takes them: the first two words' first letters, skipping "Dr" and initials. */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => !p.includes(".") && p !== "Dr");
  return `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}`.toUpperCase();
}
