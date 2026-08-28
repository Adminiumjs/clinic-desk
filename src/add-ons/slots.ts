/**
 * THE SLOTS THIS APP MOUNTS — one of them — and why the list is this short.
 *
 * ── IT IS NOT THE CLOSED REGISTRY, AND THE DIFFERENCE IS LOAD-BEARING ───────
 *
 * `vendor/host/slots.ts` exports the twelve-id CLOSED REGISTRY under the name
 * `HOSTED_SLOTS`, which is the same identifier this file uses for the one id
 * this app actually draws. Importing the wrong one is a mistake that compiles:
 * every check in the host kit is generic over whatever `hostedSlots` holds, so
 * the wider union would make the mounts guard demand mounts for twelve ids, the
 * empty-behaviour table need twelve rows, and the payload generic accept ids
 * nothing in `src/screens/` renders. The kit's mounts guard asserts this list is
 * a strict SUBSET of the registry, so a mis-import is a named failure rather
 * than a silently widened contract.
 *
 * ── WHY ONE, AND NOT THE THREE A CLINIC LOOKS LIKE IT COULD OFFER ───────────
 *
 * A slot is a promise that something draws there. The registry's own header
 * refuses a slot nobody fills because an unfilled id is a guess about a future
 * add-on, and the same rule applies one level down: an id in THIS list that no
 * screen mounts is a promise this app does not keep.
 *
 * Three were considered and all three are absent:
 *
 *   `record.actions` — a button on the screen where somebody is looking at one
 *     record. This app has a visit panel and a patient sheet, both of which
 *     qualify. It ships UNFILLED in the closed registry (its first consumer is
 *     wave 5), so mounting it here would draw a fallback on two clinical
 *     surfaces for nothing anybody can connect.
 *
 *   `nav.add-on.routes` — a whole page in the host's shell. This app's routing
 *     is a switch over a `View` union with a screen per member, and a route an
 *     add-on supplies would have to arrive as a thirteenth member the union
 *     cannot know about. That is a real change to `App.tsx`, not a mount, and
 *     one host already shipped this id with a real fill and no screen.
 *
 *   `record.editor.panel` — a panel inside the generated dashboard's record
 *     editor. Its host is Adminium, not an app; this app has no record editor.
 *
 * ── AND WHY `settings.add-on.panel` IS THE ONE ──────────────────────────────
 *
 * Because it is the only slot in the registry whose SUBJECT is the add-on
 * itself rather than one of this app's records. Everything this app's records
 * carry is about a named patient on a named day; a settings form is about a
 * country and a year. The one surface an add-on can own here without being
 * handed anything clinical is the one this app hosts.
 */

import { HOSTED_SLOTS as CLOSED_REGISTRY, type SlotId } from './vendor/host/index.ts';

/**
 * The ids this app draws. `satisfies` bites in both directions: a typo is a
 * compile error, and an id the closed registry ever DROPS turns this line red
 * rather than leaving a mount nothing can fill.
 */
export const HOSTED_SLOTS = ['settings.add-on.panel'] as const satisfies readonly SlotId[];

/** The union every mount, payload and empty-state decision in this app is over. */
export type HostedSlotId = (typeof HOSTED_SLOTS)[number];

/**
 * A runtime restatement of what the `satisfies` above already proves, exported
 * so the host kit's mounts guard has something to read.
 *
 * It is not a duplicate check. The `satisfies` is a claim about this file at
 * compile time; this is the same claim about the VENDORED registry as it stands
 * on disk, which is what a re-sync can change without anybody recompiling.
 */
export const CLOSED_SLOT_IDS: readonly string[] = CLOSED_REGISTRY;
