/**
 * The practice's texts and the box for them, as the manifest declares them.
 *
 * A clinic's text shows on a locked phone and passes through a provider's
 * logs, so the line held here is the plan's ruling (Q11): a text says only
 * the practice's name, the date and the time — no clinician, no visit type,
 * no reason, and no word a stranger reads as medical. Replies are off. The
 * box is separate, unticked, never required, and kept with the very words a
 * patient saw.
 */
import { describe, expect, it } from "vitest";

import { asksForYes, checkTextTemplate } from "../testing/manifest/text-messages.ts";
import { placeholdersIn } from "../testing/manifest/placeholders.ts";
import { texts } from "../i18n/strings/texts.ts";
import { buildManifest } from "./build.ts";
import { TEXT_BOX_VERSION, TEXT_WORDS, boxWording } from "./texts.ts";

type Json = Record<string, unknown>;
type Column = Json & { ref: string; type: string; default?: unknown; nullable?: boolean; rules?: Json };
type Entry = Json & { table: string; methods: string[]; writable?: string[]; writableValues?: Json; defaults?: Json; claimedBy?: Json; level?: string; textConsent?: Json & { column: string; phone: string; class: string; means?: string; wording: { version: number; text: Record<string, string> } } };

const manifest = buildManifest() as Json & {
  textTemplates: { key: string; name: Record<string, string>; locales: Record<string, { body: string }> }[];
  textReplies: string;
  publicAccess: Entry[];
  outbox: Json & { recipient: Json & { fallback: Json }; kinds: Record<string, string>; channels: Record<string, string>; classes: Record<string, string>; producers: Json[] };
  requiredSchema: { tables: (Json & { ref: string; columns: Column[] })[] };
};
const column = (table: string, ref: string) => manifest.requiredSchema.tables.find((t) => t.ref === table)!.columns.find((c) => c.ref === ref)!;
const LOCALES = ["en-US", "de-DE", "fr-FR", "da-DK", "cs-CZ", "ar-EG", "zh-CN", "zh-TW"];

/** What a text may read: the practice's name for texts, the visit's date and its time. Nothing else. */
const ALLOWED = new Set(["practice.text_name", "appointment.starts_at.date", "appointment.starts_at.time"]);

/**
 * Words that tell a reader the text is about health, in each language: a
 * clinician, a doctor, a clinic, a treatment, a medical "visit". The box on
 * the practice's own site may say "看诊" (the prompt's words); a text may not.
 */
const MEDICAL = /doctor|clinic|clinician|nurse|treat|therap|medic|health|Arzt|Ärzt|Praxis|Behandl|Klinik|médecin|soin|clinique|praticien|læge|lege|behandl|klinik|lékař|ordinac|léčb|zdravot|طبيب|عيادة|علاج|صح|医|诊|醫|診|疗|療|护|護/iu;

const GSM = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
/** Segments, as a provider counts them: 160/153 in the GSM alphabet, 70/67 for anything else. */
function segments(text: string): number {
  const gsm = [...text].every((ch) => GSM.has(ch));
  const units = gsm ? [...text].length : text.length;
  const [alone, split] = gsm ? [160, 153] : [70, 67];
  return units <= alone ? 1 : Math.ceil(units / split);
}

/** A text as a patient gets it: filled in their language, with the longest opt-out line Adminium adds (a sender name's). */
function filled(locale: string, body: string): string {
  const at = new Date("2026-09-30T08:45:00Z");
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(at);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(at);
  const text = body.replace("{{practice.text_name}}", "Rowan Health").replace("{{appointment.starts_at.date}}", date).replace("{{appointment.starts_at.time}}", time);
  return `${text}\nTo stop these texts, contact 0117 496 0142`;
}

describe("the practice's texts", () => {
  it("are two, a visit reminder and a missed-visit note, each in all eight languages", () => {
    expect(manifest.textTemplates.map((t) => t.key)).toEqual(["clinic-reminder-text", "clinic-missed-text"]);
    for (const template of manifest.textTemplates) {
      expect(Object.keys(template.locales).sort()).toEqual([...LOCALES].sort());
      expect(Object.keys(template.name).sort()).toEqual([...LOCALES].sort());
    }
  });

  it("say only the practice's name, the date and the time", () => {
    for (const template of manifest.textTemplates) {
      for (const [locale, { body }] of Object.entries(template.locales)) {
        const read = new Set(placeholdersIn(body).map((p) => p.name));
        expect([template.key, locale, [...read].sort()]).toEqual([template.key, locale, [...ALLOWED].sort()]);
      }
    }
  });

  it("carry no word that tells a stranger the text is about health", () => {
    for (const template of manifest.textTemplates) {
      for (const [locale, { body }] of Object.entries(template.locales)) {
        const words = body.replace(/\{\{[^}]+\}\}/g, "");
        expect([template.key, locale, words.match(MEDICAL)?.[0] ?? null]).toEqual([template.key, locale, null]);
      }
    }
    // The test's own net catches what it is for.
    expect("Your doctor will see you".match(MEDICAL)).not.toBeNull();
    expect("您的就诊时间".match(MEDICAL)).not.toBeNull();
  });

  it("pass Adminium's check for a text: no link, no code, no \"reply YES\", and no opt-out line of their own", () => {
    for (const template of manifest.textTemplates) {
      for (const [locale, { body }] of Object.entries(template.locales)) {
        expect([template.key, locale, checkTextTemplate(body)]).toEqual([template.key, locale, { ok: true }]);
        // Adminium adds the opt-out that works for the sender: a template that wrote "Reply STOP" would be wrong from a name.
        expect(/STOP/i.test(body)).toBe(false);
      }
    }
  });

  it("fit in two segments, filled and with the opt-out added, even in Arabic and Chinese", () => {
    for (const template of manifest.textTemplates) {
      for (const [locale, { body }] of Object.entries(template.locales)) {
        expect([template.key, locale, segments(filled(locale, body)) <= 2]).toEqual([template.key, locale, true]);
      }
    }
    // The English, German and Danish reminders stay in one segment, the cheapest a text can be.
    for (const locale of ["en-US", "de-DE", "da-DK"]) expect([locale, segments(filled(locale, TEXT_WORDS[locale as "en-US"].reminder))]).toEqual([locale, 1]);
  });

  it("go as texts from the outbox, to the patient's mobile, as service texts, only while the practice sends them", () => {
    expect(manifest.outbox.kinds["reminder_text"]).toBe("clinic-reminder-text");
    expect(manifest.outbox.kinds["missed_text"]).toBe("clinic-missed-text");
    expect(manifest.outbox.channels).toEqual({ reminder_text: "sms", missed_text: "sms" });
    expect([manifest.outbox.classes["reminder_text"], manifest.outbox.classes["missed_text"]]).toEqual(["service", "service"]);
    expect(manifest.outbox.recipient["phone"]).toBe("mobile");
    expect(manifest.outbox.recipient.fallback["phone"]).toBe("new_mobile");
    const producers = manifest.outbox.producers.filter((p) => p["kind"] === "reminder_text" || p["kind"] === "missed_text");
    expect(producers.map((p) => p["kind"]).sort()).toEqual(["missed_text", "reminder_text"]);
    for (const p of producers) {
      expect(p["gate"]).toEqual({ setting: { table: "settings", column: "texts_on" } });
      // The email switch is never the text's: one switch never moves the other.
      expect(p["optIn"]).toBeUndefined();
    }
    expect(column("settings", "texts_on")).toMatchObject({ type: "bool", default: false });
    // No text waits outside the sending hours: nobody is standing by for a reminder.
    expect(manifest.outbox["waiting"]).toBeUndefined();
  });

  it("are not answered: replies are off, so a patient who writes a symptom is told once that the number is not read", () => {
    expect(manifest.textReplies).toBe("off");
  });
});

describe("the box for texts", () => {
  const boxes = manifest.publicAccess.filter((e) => e.textConsent !== undefined);

  it("is on three doors: a first booking or a registration with nobody on file, and the patient's own Prefs, on and off", () => {
    expect(boxes.map((e) => [e.table, e.methods, e.textConsent!.means ?? "yes", e.claimedBy === undefined ? "nobody" : e.level])).toEqual([
      ["text_answers", ["POST"], "yes", "nobody"],
      ["text_answers", ["GET", "POST"], "yes", "verified"],
      ["text_answers", ["POST"], "no", "verified"],
    ]);
    // A stranger can say yes for a number, never no: nobody can stop someone else's texts from the patients' pages.
    expect(boxes.filter((e) => e.textConsent!.means === "no").every((e) => e.claimedBy !== undefined && e.level === "verified")).toBe(true);
  });

  it("starts unticked, is never required, and is never the email switch", () => {
    for (const e of boxes) {
      const box = e.textConsent!;
      const col = column(e.table, box.column);
      expect([box.column, col.type, col.default]).toEqual([box.column, "bool", false]);
      expect(col.rules?.["required"]).toBeUndefined();
      expect(e.defaults?.[box.column]).toBeUndefined();
      expect(e.writableValues?.[box.column]).toBeUndefined();
      expect(box.column).not.toBe("remind_email");
      expect(box.class).toBe("service");
    }
  });

  it("is kept with the very words the patient saw beside it, in all eight languages, and its version", () => {
    for (const e of boxes) expect(e.textConsent!.wording).toEqual({ version: TEXT_BOX_VERSION, text: boxWording() });
    const wording = boxWording();
    expect(Object.keys(wording).sort()).toEqual([...LOCALES].sort());
    for (const [locale, words] of Object.entries(texts)) {
      const said = wording[locale as "en-US"];
      for (const key of ["texts.box.label", "texts.box.sub", "texts.box.optional"] as const) expect(said).toContain(words[key]);
      expect([locale, asksForYes(said)]).toEqual([locale, false]);
    }
  });

  it("says what the design gives it, word for word, in the languages the design writes", () => {
    expect([texts["en-US"]["texts.box.label"], texts["en-US"]["texts.box.sub"], texts["en-US"]["texts.box.optional"]]).toEqual([
      "Text me reminders for my visits",
      "Only the practice name, the date and the time.",
      "Optional. You can stop at any time; each text tells you how.",
    ]);
    expect([texts["de-DE"]["texts.box.label"], texts["de-DE"]["texts.box.sub"]]).toEqual(["Erinnerungen an meine Termine per SMS", "Nur Praxisname, Datum und Uhrzeit."]);
    expect([texts["ar-EG"]["texts.box.label"], texts["ar-EG"]["texts.box.sub"]]).toEqual(["أرسلوا لي تذكيرات بمواعيدي عبر الرسائل النصية", "اسم العيادة والتاريخ والوقت فقط."]);
    expect([texts["zh-CN"]["texts.box.label"], texts["zh-CN"]["texts.box.sub"]]).toEqual(["通过短信提醒我就诊时间", "仅包含诊所名称、日期和时间。"]);
    expect([texts["zh-TW"]["texts.box.label"], texts["zh-TW"]["texts.box.sub"]]).toEqual(["以簡訊提醒我看診時間", "僅包含診所名稱、日期與時間。"]);
    expect(texts["en-US"]["texts.box.cn"]).toBe("We can’t send texts to numbers in mainland China. Everything else works as usual.");
    expect(texts["en-US"]["texts.prefs.stopped"]).toBe("Texts are off because you asked us to stop.");
  });
});
