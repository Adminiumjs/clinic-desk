/**
 * The parts of the desk that work only with an add-on, and which add-ons.
 *
 * One list, read by two sides: the manifest writes it as `addOns.features`
 * (so Adminium knows what switches off without an add-on), and the desk reads
 * it to decide what to show. The desk's answer comes from the add-ons
 * Adminium says are connected to this app and switched on (the staff config's
 * `addOns`); the server's answer is the one that counts — a document it will
 * not draw is refused `FEATURE_OFF`, whatever the desk showed.
 *
 * Kept tiny and free of words: the desk bundle imports it, and the manifest's
 * labels live in `manifest/`, which the desk never loads.
 */

/** A receipt a patient can send to their insurer: drawn and emailed by Invoices & Receipts. */
export const INSURER_RECEIPTS = "insurer-receipts";

/** Each feature and the add-on keys it needs, every one of them. */
export const FEATURES = {
  [INSURER_RECEIPTS]: ["invoices"],
} as const satisfies Record<string, readonly string[]>;

export type FeatureId = keyof typeof FEATURES;

/** Whether a feature is on, given the add-on keys connected to the app and switched on. */
export function featureOn(id: FeatureId, connected: ReadonlySet<string> | readonly string[]): boolean {
  const has = (key: string) => (Array.isArray(connected) ? connected.includes(key) : (connected as ReadonlySet<string>).has(key));
  return FEATURES[id].every(has);
}
