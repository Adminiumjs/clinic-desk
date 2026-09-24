/**
 * Register with us (P9): a new patient's details go to the desk, which reads
 * every one and rings to say hello. The thank-you shows the registration's
 * reference, and "Book a first visit" carries the details to Find a time with
 * the new-patient visit chosen.
 */
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Check, Inbox, PhoneCall, UserPlus } from "lucide-react";

import { PortError } from "../../data/ports.ts";
import { useI18n } from "../../i18n/index.tsx";
import { locale } from "../../i18n/ambient.ts";
import { Btn, cardStyle, monoPill } from "../../components/ui.tsx";
import { num } from "../../lib/format.ts";
import { loadCatalogue, register, usePatients } from "../../state/patients.ts";
import { useDemoSignal } from "../../state/demoSignal.ts";
import { go, toast } from "../../state/ui.ts";
import { resetRegistering, setBooking, setRegistering, useFlow } from "./flow.ts";
import { bookProblem, firstName, isEmail, personReady, type BookProblem } from "./logic.ts";
import { Fill, Notice, PageHead, TextInput, sectionLabel, useCatalogue, useNarrow } from "./parts.tsx";
import { bookWords } from "./Details.tsx";
import { useTodayDay } from "./useToday.ts";

export default function Register() {
  const { t } = useI18n();
  const cat = useCatalogue();
  const narrow = useNarrow();
  const today = useTodayDay();
  const r = useFlow((s) => s.registering);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<BookProblem | null>(null);

  useDemoSignal("register.fill", (p) => {
    setRegistering({ name: p["name"] ?? "", bornOn: p["bornOn"] ?? "", mobile: p["mobile"] ?? "", email: p["email"] ?? "", address: p["address"] ?? "", contact: p["contact"] ?? "", done: null });
  });

  const settings = cat?.settings ?? null;
  if (cat === null || settings === null) return null;
  // The first-visit type by position; without one, the page leaves its length out.
  const firstType = cat.visitTypes.filter((x) => x.new_patients_only && x.active && x.bookable_online).sort((a, b) => a.position - b.position)[0] ?? null;
  const emailOk = r.email.trim() === "" || isEmail(r.email);
  const ok = personReady({ name: r.name, bornOn: r.bornOn, mobile: r.mobile }, today) && emailOk;

  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    setProblem(null);
    try {
      const done = await register({
        name: r.name.trim(),
        born_on: r.bornOn.trim(),
        mobile: r.mobile.trim(),
        email: r.email.trim() === "" ? null : r.email.trim(),
        address: r.address.trim() === "" ? null : r.address.trim(),
        emergency_contact: r.contact.trim() === "" ? null : r.contact.trim(),
        language: locale(),
      });
      setRegistering({ done: done.ref });
      toast(t("register.toast", { ref: done.ref }), { icon: "user-plus", tone: "pos" });
    } catch (error) {
      const kind = bookProblem(error instanceof PortError ? error.code : "", error instanceof PortError ? error.params : {});
      if (kind === "switchedOff") void loadCatalogue();
      setProblem(kind);
    } finally {
      setBusy(false);
    }
  };

  const bookFirst = () => {
    setBooking({ returning: false, foundName: null, name: r.name, bornOn: r.bornOn, mobile: r.mobile, email: r.email });
    usePatients.setState({ ...(firstType === null ? {} : { typeId: firstType.id }), clinicianId: "any", time: null, moving: null });
    go("find");
  };

  const steps: { id: string; icon: LucideIcon; label: string; body: string }[] = [
    { id: "s1", icon: Inbox, label: t("register.step1"), body: t("register.step1Body") },
    { id: "s2", icon: PhoneCall, label: t("register.step2"), body: t("register.step2Body") },
    { id: "s3", icon: CalendarCheck, label: t("register.step3"), body: firstType === null ? t("register.step3BodyPlain") : t("register.step3Body", { n: num(firstType.minutes) }) },
  ];

  return (
    <div className="rh-screen" data-screen="Register" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHead title={t("register.title")} lede={t("register.lede")} ledeWidth="54ch" />
      {r.done === null ? (
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}
          >
            <TextInput id="rg-name" label={t("details.name")} value={r.name} onChange={(v) => setRegistering({ name: v })} placeholder={t("details.namePh")} autoComplete="name" />
            <TextInput id="rg-born" label={t("code.bornOn")} value={r.bornOn} onChange={(v) => setRegistering({ bornOn: v })} placeholder="1990-04-21" isMono inputMode="numeric" autoComplete="bday" />
            <TextInput id="rg-mobile" label={t("code.mobile")} value={r.mobile} onChange={(v) => setRegistering({ mobile: v })} placeholder="07700 900000" isMono type="tel" autoComplete="tel" />
            <TextInput id="rg-email" label={t("details.email")} value={r.email} onChange={(v) => setRegistering({ email: v })} placeholder="you@example.com" type="email" autoComplete="email" invalid={!emailOk} />
            <TextInput id="rg-address" label={t("register.address")} value={r.address} onChange={(v) => setRegistering({ address: v })} placeholder={t("register.addressPh")} autoComplete="street-address" wide />
            <TextInput id="rg-contact" label={t("register.contact")} value={r.contact} onChange={(v) => setRegistering({ contact: v })} placeholder={t("register.contactPh")} wide />
            <div style={{ gridColumn: "1/-1" }}>
              <Btn type="submit" icon={UserPlus} busy={busy} disabled={!ok} style={{ width: "100%", ...(ok ? {} : { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 }) }}>
                {t("register.send")}
              </Btn>
              {!ok && <p style={{ margin: "9px 0 0", fontSize: 11.5, fontWeight: 700, lineHeight: 1.5, color: "var(--fg-subtle)" }}>{emailOk ? t("details.hintPerson") : t("details.badEmail")}</p>}
              {problem !== null && <Notice style={{ marginBlockStart: 10 }}>{bookWords(t, problem, settings.phone)}</Notice>}
              {settings.privacy_link !== null && settings.privacy_link !== "" && (
                <p style={{ margin: "10px 0 0", fontSize: 11.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
                  {t("register.consent")}{" "}
                  <a href={settings.privacy_link} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 2 }}>
                    {t("register.privacy")}
                  </a>
                </p>
              )}
            </div>
          </form>
          <aside aria-labelledby="rg-next" style={{ position: narrow ? "static" : "sticky", insetBlockStart: 88, padding: 18, borderRadius: 16, border: "1px solid var(--border-strong)", background: "var(--surface)", boxShadow: "var(--shadow)" }}>
            <h2 id="rg-next" style={{ ...sectionLabel, margin: 0, lineHeight: "normal" }}>
              {t("register.next")}
            </h2>
            <ol style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 15 }}>
              {steps.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.id} style={{ display: "flex", gap: 11 }}>
                    <span aria-hidden="true" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 10, background: "var(--surface-3)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={15} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-.02em" }}>{s.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{s.body}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      ) : (
        <section aria-labelledby="rg-done" style={{ ...cardStyle, padding: 24, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 13, maxWidth: 560 }}>
          <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 17, background: "var(--pos-soft)", color: "var(--pos)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={26} />
          </span>
          <h2 id="rg-done" style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.03em", lineHeight: "normal" }}>
            {firstName(r.name) === "" ? t("register.thanksAnon") : t("register.thanks", { name: firstName(r.name) })}
          </h2>
          <span style={{ ...monoPill("var(--accent-soft)", "var(--accent)"), fontSize: 14, padding: "7px 14px" }}>{r.done}</span>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
            {firstType === null ? t("register.doneBodyPlain") : <Fill text={t("register.doneBody")} name="n">{num(firstType.minutes)}</Fill>}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {settings.new_patients_online && (
              <Btn icon={CalendarCheck} onClick={bookFirst}>
                {t("register.bookFirst")}
              </Btn>
            )}
            <Btn kind="ghost" onClick={resetRegistering}>
              {t("register.again")}
            </Btn>
          </div>
        </section>
      )}
    </div>
  );
}
