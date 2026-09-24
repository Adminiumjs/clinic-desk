/**
 * Per-action keys: how a retried action finds what its first try saved.
 *
 * A desk action that writes several rows — take a payment, set a recall, mark
 * the visit seen — can fail half-way (the network drops, the balance moved).
 * Trying again must not take the payment twice, and the tables number their
 * own rows, so there is no key the desk could have made up front. Instead
 * every row an action creates carries a `client_key` (unique in its table),
 * made once when the action starts and kept until it succeeds: a retry that
 * hits one is answered with the row already saved, and the action carries on
 * from the first step not yet done.
 */

/** A fresh action key (36 characters, as the column holds). */
export function actionKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

/**
 * The key one step of an action writes with: the action's key with its first
 * character replaced by the step's letter — still 36 characters, still unique
 * per action, and the same on every retry.
 */
export function stepKey(action: string, step: "a" | "b" | "c" | "d" | "e" | "f"): string {
  return `${step}${action.slice(1)}`;
}
