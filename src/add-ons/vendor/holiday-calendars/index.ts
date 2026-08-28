/*
 * VENDORED from add-ons/packages/holiday-calendars/src/index.ts — synced by scripts/sync-add-ons.sh.
 * Never hand-edit this copy: edit the monorepo and re-run `sync-add-ons.sh sync`.
 * The add-on key is `holiday-calendars`; its manifest, tests and README live in the monorepo.
 */
/**
 * What the host gets when it registers this add-on.
 *
 * One function returning one plain object. No side effects at import time, no
 * global registration, no reaching into the host: the host asks, the add-on
 * answers, and everything the host needs to draw a shelf row and one surface is
 * in the value it gets back.
 *
 * SCOPE, stated where somebody would come looking to widen it (24 §7): this
 * carries curated public-holiday day-sets and lets an operator choose one. It
 * is not a rota, not a leave engine, not an absence tracker and not a booking
 * calendar. Both of its hosts already own those, and an add-on that grew one
 * would be a second, disagreeing copy of a screen the app is built around.
 *
 * ── WHAT THIS OBJECT LEAVES OUT, AND WHY EACH ABSENCE IS A DECISION ─────────
 *
 * `demoSwitch` — absent. It exists so a credentialled add-on can offer "use a
 * stand-in instead of calling the real service" (24 D11). Nothing here calls
 * anything, so there is nothing to stand in for, and a switch offering to
 * disable a call that does not happen would be a lie in the connect dialog.
 *
 * `applySettings` — absent, and it is the one worth reading twice. Every other
 * add-on here keeps a module-level copy of its settings, because its engines
 * are handed settings rather than a store. This add-on's engines take the
 * values as an ARGUMENT — `nonWorkingDays(values)`, `applyImport(current, …)` —
 * so there is no copy to keep in step, no push to miss, and no state that can
 * be one change behind what the shop last saved. A host that never calls
 * `applySettings` is not a host this add-on can be stale in.
 *
 * `permissions` — empty. It is what connecting LETS the add-on do, shown as
 * ticked rows before a shop agrees. This one reads no host record, writes no
 * host record and reaches nowhere; the honest length of that list is zero, and
 * inventing a row so the dialog looks substantial would be asking for a power
 * to reassure somebody.
 *
 * `settings` — empty, which is NOT the same as storing nothing. `AddOn.settings`
 * is what the HOST's manage panel may render, and the host can only draw the
 * controls its vocabulary knows: a switch, a time, a text box, a multi-select.
 * What this add-on stores is a list of days, which is none of those, and it is
 * edited in `settings.add-on.panel` — the slot that exists precisely so an
 * add-on can own a form the host could not describe. `manifest.json` still
 * declares the key as a `json` setting, because an installer should be able to
 * see everything a package will write.
 */

import { createElement } from "react";

import type { AddOn } from "../host/index.ts";

import { strings } from "./i18n/strings.ts";
import { SettingsPanel } from "./ui/SettingsPanel.tsx";

export function register(): AddOn {
  return {
    key: "holiday-calendars",
    /*
     * A NAME AND NOT A `nameKey`. The described-but-not-built shelf stubs in
     * the host apps use `nameKey` because their "name" is a sentence — "a
     * second delivery company" — that would sit in English on an Arabic shelf.
     * This is a real thing with a real name, and a translated name is a
     * different thing. Everything ABOUT it translates, and does.
     */
    name: "Holiday Calendars",
    shortName: "Holidays",
    lineKey: "addon.holiday-calendars.line",
    whatKey: "addon.holiday-calendars.what",
    // Three letters on a neutral tile. There is no mark to avoid redrawing
    // here (D12) and the tile is drawn the same way regardless, because a shelf
    // has to read as one system rather than as twenty marks.
    monogram: "CAL",
    /*
     * `data` from the closed five (24 D2). Not `operations`, which is an APP
     * facet and belongs to the other vocabulary — an add-on is not a vertical.
     * Of the five, `data` is the one this fits: it brings a reference dataset
     * into a shop that had none.
     */
    category: "data",
    /*
     * NOTHING TO CONNECT TO. No credential, no account, no authorization step —
     * the day-sets are compiled into the bundle the host already loaded.
     */
    connect: "none",
    permissions: [],
    settings: [],
    defaultSettings: { days: [] },
    // The host merges these into its own bundle at registration and asserts
    // that all eight locales carry every key of the English set.
    messages: strings,
    /*
     * D16, and it is unusually easy to state honestly here: there is no
     * credential to delete, so the whole of "what goes" is the surface, and the
     * whole of "what stays" is the data. Both halves are checked by
     * `packages/host/src/disconnect-copy.test.ts`, which fails an add-on that
     * puts a deletion under the heading that says things survive.
     */
    disconnect: {
      goesKey: "addon.holiday-calendars.disconnect.goes",
      staysKey: "addon.holiday-calendars.disconnect.stays",
    },
    /*
     * The shop's seeded record of using this add-on, newest first — RELATIVE,
     * and pinned to nobody's Wednesday. The host dates these against its own
     * clock with `resolveActivity`.
     *
     * NEITHER LINE NAMES A REFERENCE, and that is not an oversight. `refIndex`
     * points at one of the HOST's own paperwork references, and an entry whose
     * index the host cannot fill is dropped. This add-on touches no host record
     * at all — it stores its own days and hands them over as data — so there is
     * no order, job or invoice either of these lines could honestly point at. A
     * line about nothing in particular is exactly what `refIndex: undefined` is
     * for.
     */
    activity: [
      { minutesAgo: 46, messageKey: "addon.holiday-calendars.act.1" },
      { minutesAgo: 2_920, messageKey: "addon.holiday-calendars.act.2" },
    ],
    /*
     * IT NAMES NO COMPANY — the first add-on in this repository of which that
     * is true. `noCompanyKeys` is what the host renders where the
     * not-affiliated line would otherwise go: an absent line is
     * indistinguishable from a forgotten one, so the positive fact is stated
     * instead, in the add-on's own words and in all eight locales.
     */
    namesCompany: false,
    noCompanyKeys: ["addon.holiday-calendars.noCompany"],
    fills: [
      /*
       * `render` returns an ELEMENT rather than calling a function that uses
       * hooks. The host maps over fills inside its own render, so a fill that
       * called `useState` directly would be borrowing the host component's hook
       * slots — stable today, broken the first time a fill is conditional.
       *
       * NO CAST. `payload` arrives already typed as this slot's payload,
       * because `AddOnFill` is parameterised by slot id; a component reading a
       * field the slot does not carry is a red build in this repository rather
       * than a throw in somebody else's.
       */
      {
        slot: "settings.add-on.panel",
        order: 10,
        render: (payload) => createElement(SettingsPanel, { payload }),
      },
    ],
  };
}

/** The strings the host merges into its own bundle before rendering any fill. */
export { strings } from "./i18n/strings.ts";

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * THE READ SURFACE — the reason a host installs this rather than the panel
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * `nonWorkingDays(values)` is a pure function of the values the host already
 * holds for this add-on. A host calls it at the mount site where it builds the
 * array it was going to build anyway, maps each day into its OWN record shape,
 * and everything downstream — leave balances, a day sheet, a closed-day chip —
 * carries on unchanged. `calendar.ts` documents both hosts' mappings in full.
 *
 * `epochDayOf` travels with it because one of the two hosts stores days as
 * whole days since the epoch, and a host writing that conversion for itself is
 * a host with a chance of writing it in a timezone.
 *
 * WHAT IS DELIBERATELY NOT HERE: the storage shape. `StoredDay`, `STORAGE_KEY`,
 * `applyImport` and the rest are this package's private document, exported from
 * `calendar.ts` for this package's own panel and suites and no further. A host
 * that reached into an add-on's storage would be coupled to a shape that is
 * expected to change, and the first change would break two apps this repository
 * does not build.
 */
export { nonWorkingDays, type DayOrigin, type NonWorkingDay } from "./calendar.ts";
export { epochDayOf } from "./civil.ts";

/**
 * The years this pack has been reviewed for, and the countries it refuses to
 * guess — both public because they are the honest answer to "what can I get?".
 *
 * A host or a marketplace listing that wanted to say what this add-on covers
 * would otherwise have to read the data file, and `ANNOUNCED_ANNUALLY` in
 * particular is a product statement rather than an implementation detail: it is
 * the list of places this add-on will not invent a calendar for.
 */
export { ANNOUNCED_ANNUALLY, YEARS, type AnnouncedAnnually } from "./daysets.ts";
