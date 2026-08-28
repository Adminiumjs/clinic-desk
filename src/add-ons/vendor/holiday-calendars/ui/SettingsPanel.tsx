/*
 * VENDORED from add-ons/packages/holiday-calendars/src/ui/SettingsPanel.tsx — synced by scripts/sync-add-ons.sh.
 * Never hand-edit this copy: edit the monorepo and re-run `sync-add-ons.sh sync`.
 * The add-on key is `holiday-calendars`; its manifest, tests and README live in the monorepo.
 */
/**
 * THE ONE SURFACE THIS ADD-ON HAS: its own form in the manage drawer.
 *
 * ── WHY IT FILLS EXACTLY ONE SLOT, AND WHY THAT IS NOT A THIN PRODUCT ───────
 *
 * Every other add-on here fills a slot where WORK happens — a dispatch action,
 * a checkout row, a personalize block — and fills `settings.add-on.panel` as
 * well, to configure that work. This one has no second surface, and the reason
 * is worth stating because it looks like an omission:
 *
 *   THE WORK IS THE DATA. What this add-on contributes is a list of days, and
 *   that list is consumed by the host's own engines at the host's own mount
 *   site (see `calendar.ts`). There is no screen on which this add-on draws a
 *   holiday — `people-ops` draws it on its calendar, its request form and its
 *   balance card, and `clinic-desk` on its day sheet. An add-on that also drew
 *   one would be a second, disagreeing copy of the host's own screen.
 *
 * So the panel is where an operator CHOOSES the data, and everything the
 * product does — preview, refuse, import, keep — happens here.
 *
 * ── WHAT THE PANEL OWES A READER, IN ORDER ─────────────────────────────────
 *
 *   1. What is already held, because that is the state being changed.
 *   2. A picker, with the days VISIBLE BEFORE the import — this add-on's whole
 *      claim is accuracy, and a claim nobody can check before committing to it
 *      is a claim on trust alone.
 *   3. Where the set came from and when it was last read through, next to the
 *      days themselves rather than in a README nobody opens.
 *   4. Somewhere to write in a day that no country decrees.
 *   5. The countries this pack refuses to guess, by name, with the reason.
 *   6. Who keeps it current, when the next read-through is due, and where a
 *      wrong date should be reported.
 *
 * Six sections is a long form for an add-on. Every one of them is a thing an
 * operator cannot get anywhere else, and dropping the last two would leave a
 * data pack that looks complete and has no owner — which is the failure this
 * product is shaped around.
 *
 * Styling is from the host's token custom properties only, in CSS logical
 * properties, for the reasons `atoms.tsx` sets out.
 */

import { useMemo, useState } from "react";

import type { SettingsPanelPayload } from "../../host/index.ts";

import {
  addOwnDay,
  applyImport,
  forgetOwnDay,
  forgetSet,
  readStored,
  writeStored,
  type Collision,
  type StoredDay,
} from "../calendar.ts";
import {
  ANNOUNCED_ANNUALLY,
  DAY_SETS,
  MAINTENANCE,
  YEARS,
  expandSet,
  type DaySet,
} from "../daysets.ts";
import { useFormat, useT } from "../i18n/t.ts";
import {
  Button,
  Eyebrow,
  Field,
  LinkButton,
  Mono,
  NoCompany,
  Note,
  Panel,
  PanelTitle,
  Tag,
  Typed,
  inputStyle,
} from "./atoms.tsx";

/**
 * A set's identity as one `<select>` value.
 *
 * `country|region` rather than an index, because an index into `DAY_SETS` is a
 * value that silently means a different set the day a country is inserted in
 * the middle of the list — and this component's state survives a re-render.
 */
const valueOf = (set: DaySet): string => `${set.country}|${set.region ?? ""}`;

/** What the last import did, held here because it is a fact about this session. */
type Outcome =
  | { readonly kind: "none" }
  | { readonly kind: "refused"; readonly collisions: readonly Collision[] }
  | { readonly kind: "done"; readonly added: number; readonly replaced: number }
  | { readonly kind: "badOwnDay"; readonly why: "date" | "name" | "duplicate" };

export function SettingsPanel({ payload }: { payload: SettingsPanelPayload }) {
  const t = useT();
  const format = useFormat();

  const held = readStored(payload.settings);

  const [choice, setChoice] = useState<string>(valueOf(DAY_SETS[0]!));
  const [year, setYear] = useState<number>(YEARS[0]!);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "none" });
  const [ownDate, setOwnDate] = useState("");
  const [ownName, setOwnName] = useState("");

  const set = DAY_SETS.find((candidate) => valueOf(candidate) === choice) ?? DAY_SETS[0]!;
  const preview = useMemo(() => expandSet(set, year), [set, year]);

  /*
   * EVERY WRITE GOES THROUGH `patch`, AND `patch` TAKES THE WHOLE LIST.
   *
   * The engines in `calendar.ts` return a complete day list rather than a diff,
   * so there is no path here that appends to what the host holds — which is
   * what makes a re-import idempotent no matter how many times a button is
   * pressed. This function is the only writer in the file.
   */
  const save = (days: readonly StoredDay[]) => {
    payload.patch(writeStored(days));
  };

  const doImport = () => {
    const result = applyImport(held, set, year);
    if (!result.ok) {
      setOutcome({ kind: "refused", collisions: result.collisions });
      return;
    }
    save(result.days);
    setOutcome({ kind: "done", added: result.added, replaced: result.replaced });
  };

  const doAddOwn = () => {
    const result = addOwnDay(held, ownDate, ownName);
    if (!result.ok) {
      setOutcome({ kind: "badOwnDay", why: result.why });
      return;
    }
    save(result.days);
    setOwnDate("");
    setOwnName("");
    setOutcome({ kind: "none" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <HeldDays
        held={held}
        onForgetSet={(country, region, forYear) => {
          save(forgetSet(held, country, region, forYear));
          setOutcome({ kind: "none" });
        }}
        onForgetOwn={(date) => {
          save(forgetOwnDay(held, date));
          setOutcome({ kind: "none" });
        }}
      />

      <Panel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBlockEnd: 12 }}>
          <Field label={t("addon.holiday-calendars.pick.area")}>
            <select
              value={choice}
              onChange={(event) => {
                setChoice(event.target.value);
                setOutcome({ kind: "none" });
              }}
              style={inputStyle}
            >
              {DAY_SETS.map((candidate) => (
                <option key={valueOf(candidate)} value={valueOf(candidate)}>
                  {t(candidate.labelKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("addon.holiday-calendars.pick.year")}>
            <select
              value={String(year)}
              onChange={(event) => {
                setYear(Number.parseInt(event.target.value, 10));
                setOutcome({ kind: "none" });
              }}
              style={inputStyle}
            >
              {YEARS.map((candidate) => (
                <option key={candidate} value={String(candidate)}>
                  {format.year(candidate)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBlockEnd: 8 }}>
          <Tag tone="info">{t("addon.holiday-calendars.pick.preview", { count: preview.length })}</Tag>
          <Note style={{ fontSize: 11 }}>
            {t("addon.holiday-calendars.pick.reviewed", {
              date: format.day(set.derivation.reviewedOn, {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
          </Note>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 11,
            overflow: "hidden",
            marginBlockEnd: 10,
          }}
        >
          {preview.map((day, index) => (
            <div
              key={day.date}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "7px 11px",
                background: "var(--surface-2)",
                borderBlockEnd: index === preview.length - 1 ? "0" : "1px solid var(--border)",
              }}
            >
              {/* The day's own name, in its own language — see `daysets.ts`. */}
              <Typed style={{ fontSize: 12.5 }}>{day.name}</Typed>
              <Mono style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>
                {format.day(day.date, { day: "numeric", month: "short" })}
              </Mono>
            </div>
          ))}
        </div>

        <Note>{t(set.noteKey)}</Note>
        <Note style={{ marginBlockStart: 5 }}>{t(set.derivation.statedIn)}</Note>
        <Note style={{ marginBlockStart: 5 }}>{t("addon.holiday-calendars.pick.noSubstitutes")}</Note>

        <div style={{ marginBlockStart: 12 }}>
          <Button onClick={doImport}>{t("addon.holiday-calendars.pick.import")}</Button>
        </div>
      </Panel>

      {outcome.kind === "refused" && (
        <Panel tone="danger">
          <PanelTitle tone="danger">{t("addon.holiday-calendars.refuse.title")}</PanelTitle>
          <Note style={{ fontSize: 12.5, color: "var(--fg-muted)", marginBlockStart: 6 }}>
            {t("addon.holiday-calendars.refuse.body")}
          </Note>
          <ul style={{ margin: "10px 0 0", paddingInlineStart: 18 }}>
            {outcome.collisions.map((collision) => (
              <li key={collision.date} style={{ fontSize: 12, marginBlockEnd: 4 }}>
                {t("addon.holiday-calendars.refuse.row", {
                  date: format.day(collision.date, { day: "numeric", month: "long" }),
                  yours: collision.yours,
                  theirs: collision.theirs,
                })}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {outcome.kind === "done" && (
        <Panel tone="pos">
          <Note style={{ fontSize: 12.5, color: "var(--fg)" }}>
            {outcome.replaced > 0
              ? t("addon.holiday-calendars.done.replaced", { count: outcome.added })
              : t("addon.holiday-calendars.done.added", { count: outcome.added })}
          </Note>
        </Panel>
      )}

      <Panel>
        <PanelTitle>{t("addon.holiday-calendars.own.title")}</PanelTitle>
        <Note style={{ marginBlockStart: 6, marginBlockEnd: 10 }}>
          {t("addon.holiday-calendars.own.note")}
        </Note>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <Field label={t("addon.holiday-calendars.own.date")}>
            <input
              type="date"
              value={ownDate}
              onChange={(event) => setOwnDate(event.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label={t("addon.holiday-calendars.own.name")}>
            <input
              type="text"
              value={ownName}
              onChange={(event) => setOwnName(event.target.value)}
              style={inputStyle}
            />
          </Field>
          <Button variant="ghost" onClick={doAddOwn}>
            {t("addon.holiday-calendars.own.add")}
          </Button>
        </div>
        {outcome.kind === "badOwnDay" && (
          <Note style={{ color: "var(--danger)", marginBlockStart: 8 }}>
            {t(
              outcome.why === "date"
                ? "addon.holiday-calendars.own.badDate"
                : outcome.why === "name"
                  ? "addon.holiday-calendars.own.badName"
                  : "addon.holiday-calendars.own.duplicate",
            )}
          </Note>
        )}
      </Panel>

      <Panel>
        <PanelTitle>{t("addon.holiday-calendars.announced.title")}</PanelTitle>
        <Note style={{ marginBlockStart: 6 }}>{t("addon.holiday-calendars.announced.lead")}</Note>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBlockStart: 10 }}>
          {ANNOUNCED_ANNUALLY.map((entry) => (
            <div key={entry.country} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <Tag>{t(entry.labelKey)}</Tag>
              <Note style={{ flex: "1 1 0", minInlineSize: 0 }}>{t(entry.whyKey)}</Note>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Note>
          {t("addon.holiday-calendars.maint.line", {
            owner: t(MAINTENANCE.ownerKey),
            last: format.day(MAINTENANCE.lastReviewed, {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            next: format.day(MAINTENANCE.nextReview, {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          })}
        </Note>
        <Note>{t("addon.holiday-calendars.maint.corrections")}</Note>
        <NoCompany>{t("addon.holiday-calendars.noCompany")}</NoCompany>
      </div>
    </div>
  );
}

/**
 * What is held now, grouped by where it came from.
 *
 * THE GROUPS ARE THE UNIT A READER ACTS ON. An imported year is removed as a
 * year — that is how it arrived — and a day somebody wrote in is removed on its
 * own, because nobody else put it there. Offering "remove" on a single imported
 * day would leave a set that is neither the statute's nor the operator's, and
 * the next re-import would silently put the day back, which is a worse
 * experience than not offering the button.
 */
function HeldDays({
  held,
  onForgetSet,
  onForgetOwn,
}: {
  held: readonly StoredDay[];
  onForgetSet: (country: string, region: string | undefined, year: number) => void;
  onForgetOwn: (date: string) => void;
}) {
  const t = useT();
  const format = useFormat();

  const groups = useMemo(() => {
    const byOrigin = new Map<
      string,
      { country: string; region?: string; year: number; days: StoredDay[] }
    >();
    const own: StoredDay[] = [];
    for (const day of held) {
      if (day.from === undefined) {
        own.push(day);
        continue;
      }
      const id = `${day.from.country}|${day.from.region ?? ""}|${day.from.year}`;
      const group = byOrigin.get(id);
      if (group === undefined) byOrigin.set(id, { ...day.from, days: [day] });
      else group.days.push(day);
    }
    return { sets: [...byOrigin.entries()], own };
  }, [held]);

  return (
    <div>
      <Eyebrow>{t("addon.holiday-calendars.held.title")}</Eyebrow>
      {held.length === 0 ? (
        <Note>{t("addon.holiday-calendars.held.none")}</Note>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {groups.sets.map(([id, group]) => {
            const set = DAY_SETS.find(
              (candidate) =>
                candidate.country === group.country &&
                (candidate.region ?? "") === (group.region ?? ""),
            );
            return (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  flexWrap: "wrap",
                  border: "1px solid var(--border)",
                  borderRadius: 11,
                  padding: "9px 11px",
                  background: "var(--surface-2)",
                }}
              >
                {/*
                 * A set removed from the pack after it was imported still has
                 * days in the shop's list, and they are still real days. The
                 * row falls back to the stored country code rather than
                 * disappearing, so the days can always be removed.
                 */}
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {set === undefined ? group.country : t(set.labelKey)}
                </span>
                <Mono style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                  {format.year(group.year)}
                </Mono>
                <Tag>{t("addon.holiday-calendars.pick.preview", { count: group.days.length })}</Tag>
                <span style={{ marginInlineStart: "auto" }}>
                  <LinkButton onClick={() => onForgetSet(group.country, group.region, group.year)}>
                    {t("addon.holiday-calendars.held.removeSet")}
                  </LinkButton>
                </span>
              </div>
            );
          })}

          {groups.own.map((day) => (
            <div
              key={`own-${day.date}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                flexWrap: "wrap",
                border: "1px dashed var(--border-strong)",
                borderRadius: 11,
                padding: "9px 11px",
              }}
            >
              <Tag tone="warn">{t("addon.holiday-calendars.held.own")}</Tag>
              <Typed style={{ fontSize: 12.5 }}>{day.name}</Typed>
              <Mono style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>
                {format.day(day.date, { day: "numeric", month: "short", year: "numeric" })}
              </Mono>
              <span style={{ marginInlineStart: "auto" }}>
                <LinkButton onClick={() => onForgetOwn(day.date)}>
                  {t("addon.holiday-calendars.held.remove")}
                </LinkButton>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
