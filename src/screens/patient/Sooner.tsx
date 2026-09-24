/**
 * The earlier-time list (patients): someone already on file asks to hear of
 * an earlier time — what the visit is for, who they would see, when suits
 * them — and finds themselves by mobile and date of birth.
 *
 * "Put me on the list" finds them first (the same lookup, with the same
 * human check, as booking) and only then joins, under that session: the
 * details typed decide who joins, never a session someone else left behind.
 * The answer is only where they stand ("You are 3rd on the list"); nothing
 * about anyone else is shown, and the server holds one waiting place per
 * person, refusing a second.
 *
 * What was typed is kept in memory while the patient moves between pages,
 * never in the browser's storage or the address bar.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ListOrdered } from "lucide-react";
import { create } from "zustand";

import { PortError, type Wish } from "../../data/ports.ts";
import type { Id, PartOfDay } from "../../data/types.ts";
import { useI18n } from "../../i18n/index.tsx";
import type { MessageKey } from "../../i18n/messages/index.ts";
import { locale } from "../../i18n/ambient.ts";
import { Btn, Chip, btnGhost, btnPrimary, mono } from "../../components/ui.tsx";
import { num } from "../../lib/format.ts";
import { findMe, joinWaitlist, loadCatalogue, signOutPatient } from "../../state/patients.ts";
import { useDemoSignal } from "../../state/demoSignal.ts";
import { go, toast } from "../../state/ui.ts";
import { findMessage } from "./VerifyFlow.tsx";
import type { FindProblem } from "./flow.ts";
import { lookupProblem } from "./logic.ts";
import { Notice, PageHead, TextInput, cardStyle, labelStyle, screenColumn, useCatalogue } from "./parts.tsx";

/** What went wrong: a lookup miss (in the lookup's own words), already waiting, or the join itself. */
type Problem = FindProblem | "already" | "failed";

interface Joined {
  rank: number | null;
  wish: Wish;
}

interface SoonerForm {
  typeId: Id | null;
  clinicianId: Id | "any";
  part: PartOfDay;
  mobile: string;
  bornOn: string;
  problem: Problem | null;
  joined: Joined | null;
}

const useSooner = create<SoonerForm>(() => ({ typeId: null, clinicianId: "any", part: "any", mobile: "", bornOn: "", problem: null, joined: null }));
const setForm = (patch: Partial<SoonerForm>): void => useSooner.setState(patch);

const PARTS: { id: PartOfDay; key: MessageKey; sum: MessageKey }[] = [
  { id: "any", key: "sooner.anyTime", sum: "sooner.sumAny" },
  { id: "mornings", key: "sooner.mornings", sum: "sooner.sumMornings" },
  { id: "afternoons", key: "sooner.afternoons", sum: "sooner.sumAfternoons" },
];

/** "You are 3rd on the list": the line for the language's ordinal form of the place. */
function placeKey(rank: number): MessageKey {
  const form = new Intl.PluralRules(locale(), { type: "ordinal" }).select(rank);
  return form === "one" ? "sooner.place.one" : form === "two" ? "sooner.place.two" : form === "few" ? "sooner.place.few" : "sooner.place.other";
}

/** The server's refusal of the join, in the page's terms. */
function joinProblem(code: string): Problem {
  switch (code) {
    case "PUBLIC_LIMIT_REACHED":
      return "already";
    case "PUBLIC_SWITCHED_OFF":
      return "closed";
    case "PUBLIC_RATE_LIMITED":
      return "tooMany";
    default:
      return "failed";
  }
}

export default function Sooner() {
  const { t } = useI18n();
  const cat = useCatalogue();
  const form = useSooner();
  const [busy, setBusy] = useState(false);
  const doneHead = useRef<HTMLHeadingElement>(null);

  // The demo card's "Fill Cormac Ellery".
  useDemoSignal("sooner.fill", (p) => setForm({ mobile: p["mobile"] ?? "", bornOn: p["bornOn"] ?? "", problem: null }));

  // The place is what the patient came for: it takes the focus when it appears.
  useEffect(() => {
    if (form.joined !== null) doneHead.current?.focus();
  }, [form.joined]);

  const settings = cat?.settings ?? null;
  if (cat === null || settings === null) return null;
  const phone = settings.phone;

  // Every kind of visit booked online: someone on file may still be waiting for their first one.
  const types = cat.visitTypes;
  const typeId = types.some((vt) => vt.id === form.typeId) ? form.typeId : (types[0]?.id ?? null);
  const doing = new Set(cat.links.filter((l) => l.visit_type_id === typeId).map((l) => l.clinician_id));
  const pool = cat.clinicians.filter((c) => doing.has(c.id));
  const clinicianId = form.clinicianId !== "any" && pool.some((c) => c.id === form.clinicianId) ? form.clinicianId : "any";

  const join = async () => {
    if (busy || typeId === null) return;
    const mobile = form.mobile.trim();
    const bornOn = form.bornOn.trim();
    if (mobile === "" || bornOn === "") {
      setForm({ problem: "needBoth" });
      return;
    }
    setBusy(true);
    setForm({ problem: null });
    try {
      let found: { name: string } | null;
      try {
        found = await findMe(mobile, bornOn);
      } catch (error) {
        setForm({ problem: lookupProblem(error instanceof PortError ? error.code : "") });
        return;
      }
      if (found === null) {
        setForm({ problem: "notFound" });
        return;
      }
      const wish: Wish = { visit_type_id: typeId, clinician_id: clinicianId === "any" ? null : clinicianId, part_of_day: form.part };
      try {
        const { rank } = await joinWaitlist(wish);
        setForm({ joined: { rank, wish }, problem: null });
        toast(t("sooner.joined"), { icon: "list-ordered", tone: "pos" });
      } catch (error) {
        const problem = joinProblem(error instanceof PortError ? error.code : "");
        // Switched off meanwhile: reading the practice again shows the "closed" page.
        if (problem === "closed") void loadCatalogue();
        setForm({ problem });
      }
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    // The next person finds themselves afresh: nothing of this one's session is left open.
    void signOutPatient();
    setForm({ joined: null, mobile: "", bornOn: "", problem: null });
  };

  const problemText =
    form.problem === null
      ? null
      : form.problem === "already"
        ? t("sooner.already", { phone })
        : form.problem === "failed"
          ? t("sooner.failed", { phone })
          : findMessage(t, form.problem, phone);
  const invalid = form.problem === "notFound" || form.problem === "needBoth";
  const errId = "sooner-err";

  const group = (id: string, label: MessageKey, chips: ReactNode) => (
    <div role="group" aria-labelledby={id}>
      <span id={id} style={labelStyle}>
        {t(label)}
      </span>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBlockStart: 9 }}>{chips}</div>
    </div>
  );

  const joined = form.joined;
  return (
    <section className="rh-screen" data-screen="Sooner" style={{ ...screenColumn, maxWidth: 660 }}>
      <PageHead title={t("sooner.title")} lede={t("sooner.lede")} />

      {joined === null ? (
        <form
          style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          {group(
            "sooner-what",
            "sooner.what",
            types.map((vt) => (
              <Chip key={vt.id} on={vt.id === typeId} onClick={() => setForm({ typeId: vt.id, clinicianId: "any" })}>
                {vt.short_name}
              </Chip>
            )),
          )}
          {group("sooner-who", "sooner.who", [
            <Chip key="any" on={clinicianId === "any"} onClick={() => setForm({ clinicianId: "any" })}>
              {t("sooner.anyone")}
            </Chip>,
            ...pool.map((c) => (
              <Chip key={c.id} on={c.id === clinicianId} onClick={() => setForm({ clinicianId: c.id })}>
                {c.short_name}
              </Chip>
            )),
          ])}
          {group(
            "sooner-when",
            "sooner.when",
            PARTS.map((p) => (
              <Chip key={p.id} on={form.part === p.id} onClick={() => setForm({ part: p.id })}>
                {t(p.key)}
              </Chip>
            )),
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            <TextInput
              id="sooner-mobile"
              label={t("code.mobile")}
              value={form.mobile}
              onChange={(v) => setForm({ mobile: v, problem: null })}
              placeholder="07700 900000"
              isMono
              type="tel"
              autoComplete="tel"
              invalid={invalid}
              describedBy={problemText !== null ? errId : undefined}
            />
            <TextInput
              id="sooner-born"
              label={t("code.bornOn")}
              value={form.bornOn}
              onChange={(v) => setForm({ bornOn: v, problem: null })}
              placeholder="1968-10-02"
              isMono
              autoComplete="bday"
              inputMode="numeric"
              invalid={invalid}
              describedBy={problemText !== null ? errId : undefined}
            />
          </div>
          {problemText !== null && <Notice id={errId}>{problemText}</Notice>}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Btn type="submit" icon={ListOrdered} busy={busy} disabled={typeId === null}>
              {t("sooner.join")}
            </Btn>
          </div>
        </form>
      ) : (
        <section aria-labelledby="sooner-place" style={{ padding: 22, borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
          <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 15, background: "var(--pos-soft)", color: "var(--pos)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={22} />
          </span>
          <h2 id="sooner-place" ref={doneHead} tabIndex={-1} style={{ margin: 0, ...mono(15, 600, "var(--fg)"), whiteSpace: "normal", outline: "none" }}>
            {joined.rank === null ? t("sooner.placeNone") : t(placeKey(joined.rank), { n: num(joined.rank) })}
          </h2>
          <span style={{ ...mono(12, 600, "var(--fg-subtle)"), whiteSpace: "normal" }}>
            {t("sooner.summary", {
              type: cat.visitTypes.find((vt) => vt.id === joined.wish.visit_type_id)?.name ?? "",
              clinician: joined.wish.clinician_id === null ? t("sooner.sumAnyone") : (cat.clinicians.find((c) => c.id === joined.wish.clinician_id)?.short_name ?? ""),
              part: t(PARTS.find((p) => p.id === joined.wish.part_of_day)?.sum ?? "sooner.sumAny"),
            })}
          </span>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("sooner.keep")}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="rh-btn" onClick={() => go("visits")} style={btnPrimary}>
              {t("sooner.seeVisits")}
            </button>
            <button type="button" className="rh-btn" onClick={again} style={btnGhost}>
              {t("sooner.again")}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
