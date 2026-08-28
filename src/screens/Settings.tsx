/**
 * PRACTICE SETTINGS — the surface this retrofit had to BUILD rather than find.
 *
 * ── THERE WAS NOWHERE TO PUT IT ────────────────────────────────────────────
 *
 * `settings.add-on.panel` is `surface: admin`, `fill: per-add-on`: one add-on's
 * own form, inside whatever the host uses to manage that add-on. This app had
 * no settings screen of any kind and its `View` union had no `settings` member,
 * so there was nothing to mount into. Four of the fleet's apps are in the same
 * position; the only settings screen anywhere in it belongs to a different one.
 *
 * ── AND THE APP EARNS IT WITHOUT THE ADD-ON ────────────────────────────────
 *
 * The screen is not a socket with an add-on in it. `db/schema.sql` has declared
 * a `closures` table since this app was written and nothing in `src/` read it:
 * no type, no seam method, no engine function, no screen. A practice that shuts
 * for a training day had no way to say so, and the booking site went on
 * offering times on it. THIS PAGE IS WHERE IT SAYS SO. Everything above the
 * add-on panel works, and is worth having, with nothing connected — which is
 * also what makes 24 D6 checkable here: with an empty registry the second panel
 * draws its honest empty state and the first panel is the whole screen.
 *
 * ── WHICH SHELL IT LIVES IN, WHICH IS THE TRAP IN THIS REPO ────────────────
 *
 * This app ships THREE shells: the desk's own chrome, the patients' public
 * site, and no chrome at all when it is blended into the Adminium dashboard.
 * Putting a settings surface INSIDE a shell would have put it in exactly one of
 * the three — invisible in the internal placement, which is the placement an
 * operator most likely uses, and invisible in an externally-opened staff tab if
 * it went in the embedded one.
 *
 * So it is not in a shell at all. It is a SCREEN: a member of the `View` union,
 * an entry in `surface-nav.ts` with `side: "staff"`, and therefore a row in the
 * desk sidebar, a path in the URL sync, and a section Adminium's own sidebar
 * offers when this app is blended in. One declaration, three placements — and
 * on the patient side it is not merely hidden but ABSENT: `SURFACE_SIDE` folds
 * to a literal, so the public bundle does not contain this file.
 *
 * ── AND IT IS A CLINIC ─────────────────────────────────────────────────────
 *
 * Nothing on this page renders a patient's name, a date of birth, a reason for
 * a visit or anything else about a person. A closing day is a fact about the
 * building. The one place patient-adjacent data could have leaked is the
 * settings payload's `samples`, and what this app passes there is its VISIT
 * TYPES — see `useSamples` below for why, and for what was rejected.
 */

import { useMemo, useState } from "react";
import { CalendarOff, Trash2 } from "lucide-react";

import { AddOnSlot } from "../add-ons/slot.tsx";
import { DAY_SOURCES, dormantDayCounts } from "../add-ons/closures.ts";
import { AddOnAttributions, Affiliation, SourceChip } from "../components/Affiliation.tsx";
import { Button, Chip, Empty, Field, Mono, Panel } from "../components/Primitives.tsx";
import { dateLong, label } from "../lib/format.ts";
import { useI18n } from "../i18n/index.tsx";
import {
  CLINICIANS,
  VISIT_TYPES,
  clinicianById,
  useClosures,
  useStore,
} from "../state/store.ts";
import type { CatalogueSample } from "../add-ons/vendor/host/index.ts";

/**
 * WHAT A REPRESENTATIVE RECORD IS FOR A CLINIC, and why the field is required.
 *
 * `SettingsPanelPayload.samples` is REQUIRED, and its own comment records the
 * defect that made it so: a host once passed `{ patch }` alone, `tsc` was
 * happy, and an add-on's settings form threw on `.map`. An optional field would
 * have let a host mount the surface having thought about it not at all.
 *
 * A clinic has no catalogue of goods, and the honest answer is not "nothing".
 * What this practice offers is FOUR KINDS OF VISIT — a routine check, a new
 * patient, physiotherapy, a nurse appointment — each with a length and a fee,
 * and they are exactly what `CatalogueSample` describes: one representative
 * record per family of what the business sells, with a quantity somebody
 * actually buys and what one of them costs.
 *
 * `quantity: 1` because a person books ONE appointment. Inventing a basket size
 * would be a number no screen in this app can produce.
 *
 * `unitWeightGrams` and `unitSize` are ABSENT rather than zero. A visit has no
 * weight and no dimensions; a zero would read as "we measured it and it is
 * nothing", and an add-on reading it would quote a parcel for an appointment.
 * The field is optional precisely so a host with nothing true to say says
 * nothing.
 *
 * AND NOT ONE FIELD IS ABOUT A PERSON. The obvious wrong answer here is a
 * sample APPOINTMENT — it is the record this app is built around, and it
 * carries a patient id, a date of birth's worth of implication and a reason for
 * the visit. An add-on's settings form has no business with any of that, and a
 * payload is the easiest place in a seam to hand over more than was asked for.
 *
 * The currency is the practice's and not the reader's: `Money` carries its own
 * code, and `unitPrice` is a fact about a fee rather than a formatted string, so
 * nothing here goes near a formatter. `GBP` is what `db/seed.sql` prices this
 * demo practice in; a connected build takes the tenant's code from its scope,
 * which is a `snapshotSource` change and not this file's.
 */
function useSamples(): readonly CatalogueSample[] {
  return useMemo(
    () =>
      VISIT_TYPES.map((type) => ({
        key: type.id,
        label: label(type.label),
        quantity: 1,
        unitPrice: { amount: type.fee, currency: "GBP" },
      })),
    [],
  );
}

/* ------------------------------------------------------- the closure list */

function ClosureList() {
  const { t } = useI18n();
  const closures = useClosures();
  const removeClosure = useStore((s) => s.removeClosure);

  if (closures.length === 0) {
    return (
      <Empty
        icon={<CalendarOff size={22} aria-hidden="true" />}
        title={t("settings.closed.empty")}
      />
    );
  }

  return (
    <>
      <ul className="rh-closures">
        {closures.map((c) => (
          <li key={`${c.date}·${c.clinician ?? ""}·${c.reason}`} className="rh-closure">
            <Mono className="rh-closure__date">{dateLong(c.date)}</Mono>
            <span className="rh-closure__reason">{c.reason}</span>
            <span className="rh-closure__who">
              {c.clinician === null
                ? t("settings.closed.whole")
                : (clinicianById(c.clinician)?.name ?? c.clinician)}
            </span>

            {/*
              * EVERY ROW SAYS WHERE IT CAME FROM. Not only the imported ones: a
              * list where some rows carry a source and the rest carry nothing
              * makes the unlabelled ones ambiguous — forgotten, or the
              * practice's own? — and this is the screen where that difference
              * decides whether somebody presses delete.
              */}
            {c.from === null ? (
              <Chip>{t("settings.closed.own")}</Chip>
            ) : (
              <SourceChip addOnKey={c.from} messageKey="addon.host.fromAddOn" />
            )}

            {/*
              * THE DELETE BUTTON EXISTS ONLY FOR THE PRACTICE'S OWN ROWS.
              *
              * A disabled button on an imported row would be the wrong shape of
              * refusal — it invites a reader to hunt for the permission that
              * unlocks it, and there is not one. An imported day is removed
              * where it was imported: in that add-on's own panel, below. 25 D10
              * asks that a refusal be a real rule a reader can act on, and the
              * rule here is "this list is not where that day lives".
              */}
            {c.from === null && (
              <button
                type="button"
                className="rh-closure__x"
                onClick={() => removeClosure(c.date, c.reason)}
                aria-label={t("settings.closed.remove", {
                  reason: c.reason,
                  date: dateLong(c.date),
                })}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {/*
        * The not-affiliated line, ONCE for each add-on this list actually
        * names, under the rows rather than inside every one of them — and
        * outside the `<ul>`, because a paragraph is not a list item. Fed the
        * column that was drawn, so it cannot name fewer add-ons than the rows.
        */}
      <AddOnAttributions from={closures.map((c) => c.from)} />
    </>
  );
}

/* ------------------------------------------------------- record a new one */

function AddClosure() {
  const { t } = useI18n();
  const addClosure = useStore((s) => s.addClosure);
  const closures = useStore((s) => s.closures);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [who, setWho] = useState("");
  const [refused, setRefused] = useState<"needed" | "duplicate" | null>(null);

  /*
   * THE SAME TWO REFUSALS THE STORE MAKES, MADE AGAIN HERE, and the duplication
   * is the point rather than an oversight.
   *
   * `addClosure` refuses because it holds the invariant and must refuse
   * whichever caller asks — it returns a boolean and nothing more, because a
   * store action that returned a reason would be a store action writing copy.
   * This refuses because it is the only place that can SAY WHICH refusal it
   * was, and 25 D10 asks for a rule the reader can act on rather than a form
   * that quietly does nothing. Neither is redundant; deleting either leaves a
   * real hole.
   *
   * It reads the practice's OWN list, not the merged one, so a date an add-on
   * already covers is accepted: "Stocktake" on a day that is also a bank
   * holiday is a coherent thing to record, and refusing it would make an
   * imported set an obstacle rather than a starting point.
   */
  const submit = () => {
    const clinician = who === "" ? null : who;
    if (date.trim() === "" || reason.trim() === "") return setRefused("needed");
    if (closures.some((c) => c.date === date && c.clinician === clinician)) {
      return setRefused("duplicate");
    }
    addClosure(date, reason, clinician);
    setDate("");
    setReason("");
    setWho("");
    setRefused(null);
  };

  return (
    <form
      className="rh-addclosure"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label={t("settings.add.date")}>
        <input
          className="rh-fld"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setRefused(null);
          }}
        />
      </Field>

      <Field label={t("settings.add.reason")} hint={t("settings.add.reasonHint")}>
        <input
          className="rh-fld"
          type="text"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setRefused(null);
          }}
        />
      </Field>

      <Field label={t("settings.add.who")}>
        <select
          className="rh-fld"
          value={who}
          onChange={(e) => {
            setWho(e.target.value);
            setRefused(null);
          }}
        >
          <option value="">{t("settings.add.everyone")}</option>
          {CLINICIANS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Button type="submit">{t("settings.add.submit")}</Button>

      {/*
        * A REFUSAL BY A RULE THE READER CAN ACT ON (25 D10). Both of these name
        * what is missing or what already exists and what to do about it; neither
        * is a generic "invalid". The duplicate case in particular says the
        * remedy out loud, because the natural next move — typing the same date
        * again with a better reason — is the one that would fail again.
        */}
      {refused !== null && (
        <p className="rh-note rh-note--danger" role="alert">
          {t(refused === "needed" ? "settings.add.needed" : "settings.add.duplicate")}
        </p>
      )}
    </form>
  );
}

/* ------------------------------------------------------------- the add-ons */

/**
 * The shelf, and the per-add-on slot under each row.
 *
 * The slot is scoped with `forAddOn`, which is what `per-add-on` MEANS: this
 * row asks for the panel of the add-on it is about and gets that one, or the
 * fallback if that add-on draws no settings form. A page-wide mount would put
 * every add-on's form under the first row.
 */
function AddOnShelf() {
  const { t, tAddOn } = useI18n();
  const registry = useStore((s) => s.registry);
  const enabled = useStore((s) => s.enabled);
  const addOnSettings = useStore((s) => s.addOnSettings);
  const toggleAddOn = useStore((s) => s.toggleAddOn);
  const patchAddOnSettings = useStore((s) => s.patchAddOnSettings);
  const samples = useSamples();

  const dormant = useMemo(
    () => new Map(dormantDayCounts(DAY_SOURCES, enabled, addOnSettings).map((r) => [r.addOn, r.days])),
    [enabled, addOnSettings],
  );

  if (registry.all.length === 0) {
    return <p className="rh-note">{t("addon.host.none")}</p>;
  }

  return (
    <div className="rh-shelf">
      {registry.all.map((addOn) => {
        const on = enabled.has(addOn.key);
        const stillHeld = dormant.get(addOn.key) ?? 0;
        return (
          <section key={addOn.key} className="rh-addon-card">
            <header className="rh-addon-card__head">
              <span className="rh-addon-card__mark" aria-hidden="true">
                {addOn.monogram}
              </span>
              <div style={{ minWidth: 0 }}>
                <h3 className="rh-addon-card__name">{addOn.name}</h3>
                <p className="rh-addon-card__line">{tAddOn(addOn.lineKey)}</p>
              </div>
              <div style={{ marginInlineStart: "auto", display: "flex", gap: 7 }}>
                {on && <Chip tone="pos">{t("addon.host.isOn")}</Chip>}
                <Button
                  size="sm"
                  tone={on ? "ghost" : "accent"}
                  onClick={() => toggleAddOn(addOn.key)}
                >
                  {t(on ? "addon.host.off" : "addon.host.on")}
                </Button>
              </div>
            </header>

            {/* 24 AC6, on the surface where the reader meets the name. */}
            <Affiliation addOn={addOn} />

            {/*
              * 24 D16, SAID OUT LOUD AND NOT MERELY HONOURED.
              *
              * Switching an add-on off takes its surfaces and leaves every day
              * it holds exactly where it is. What changes is that those days
              * stop shutting the practice — which is the right call for a
              * clinic (a rule with no page is a shut Thursday nobody can
              * explain or undo) and is also completely invisible unless the app
              * says so. So while an add-on is off and still holding days, this
              * counts them, states that nothing was deleted, and names the two
              * things a reader can do about it.
              */}
            {!on && stillHeld > 0 && (
              <div className="rh-dormant">
                <p>{t("addon.host.dormant", { count: stillHeld }, stillHeld)}</p>
                <p className="rh-fine">{t("addon.host.dormantHow")}</p>
              </div>
            )}

            {on && (
              <AddOnSlot
                slot="settings.add-on.panel"
                forAddOn={addOn.key}
                payload={{
                  patch: (values) => patchAddOnSettings(addOn.key, values),
                  samples,
                }}
                fallback={<p className="rh-note">{t("addon.host.slotEmpty")}</p>}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- the screen */

export default function Settings() {
  const { t } = useI18n();
  const closures = useClosures();

  return (
    <div className="rh-screen rh-column">
      <header className="rh-head">
        <h1 className="rh-head__title">{t("settings.title")}</h1>
        <p className="rh-head__sub">{t("settings.sub")}</p>
      </header>

      <Panel
        title={t("settings.closed.title")}
        actions={
          closures.length > 0 ? (
            <Chip>{t("settings.closed.count", { count: closures.length }, closures.length)}</Chip>
          ) : undefined
        }
      >
        <ClosureList />
      </Panel>

      <Panel title={t("settings.add.title")}>
        <AddClosure />
      </Panel>

      <Panel title={t("addon.host.title")} subtitle={t("addon.host.sub")}>
        <p className="rh-note">{t("addon.host.reads")}</p>
        <AddOnShelf />
      </Panel>
    </div>
  );
}
