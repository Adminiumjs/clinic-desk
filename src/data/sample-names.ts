/**
 * The sample practice's words in every language the app speaks.
 *
 * The app's message bundles stop at chrome on purpose: a practice's own visit
 * types, notes and questions are whatever its staff typed, in whatever
 * language they typed them. Sample data is different — it is ours, and it is
 * added by someone reading the dashboard in their own language, so a Danish
 * operator trying the app gets "Rutinekontrol", not a "Routine check" they
 * then have to rename. These are those words: content, not chrome, so they
 * live beside the sample rather than in the bundles.
 *
 * People's names, the street and the town are proper nouns and appear here
 * exactly as they are written in English, in every language. Where a
 * language inflects a name (Czech would decline "Nadia"), the sentence is
 * built so the name stays in its plain form.
 *
 * The FAQ answers keep `{phone}`, `{no_show_minutes}` and `{cancel_hours}`
 * as written: the questions page fills them from the practice's settings, so
 * an answer never quotes a window the practice has since changed.
 */
import type { LocaleTag } from "../i18n/locales.ts";

export type Names = Record<LocaleTag, string>;

const n = (en: string, de: string, fr: string, da: string, cs: string, ar: string, zhCN: string, zhTW: string): Names => ({
  "en-US": en,
  "de-DE": de,
  "fr-FR": fr,
  "da-DK": da,
  "cs-CZ": cs,
  "ar-EG": ar,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
});

// ── the practice ────────────────────────────────────────────────────────────

export const PRACTICE_TEXT = {
  intro: n(
    "A small practice on Rowan Walk with a level entrance.",
    "Eine kleine Praxis am Rowan Walk mit ebenerdigem Eingang.",
    "Un petit cabinet sur Rowan Walk, avec une entrée de plain-pied.",
    "En lille praksis på Rowan Walk med niveaufri indgang.",
    "Malá ordinace na Rowan Walk s bezbariérovým vchodem.",
    "عيادة صغيرة في Rowan Walk بمدخل بلا درجات.",
    "位于 Rowan Walk 的一家小诊所，入口无台阶。",
    "位於 Rowan Walk 的一間小診所，入口無階梯。",
  ),
  directions: n(
    "Two minutes from the Ashgrove bus stop. Bicycle stands by the side gate; no car park, but the street is unrestricted after 10.",
    "Zwei Minuten von der Bushaltestelle Ashgrove. Fahrradständer am Seitentor; kein Parkplatz, aber ab 10 Uhr darf man in der Straße frei parken.",
    "À deux minutes de l’arrêt de bus d’Ashgrove. Des arceaux à vélos près du portail latéral ; pas de parking, mais le stationnement est libre dans la rue après 10 h.",
    "To minutter fra busstoppestedet i Ashgrove. Cykelstativer ved sidelågen; ingen parkeringsplads, men der er fri parkering på gaden efter kl. 10.",
    "Dvě minuty od autobusové zastávky Ashgrove. Stojany na kola jsou u bočních vrat; parkoviště nemáme, ale po desáté se dá na ulici parkovat bez omezení.",
    "على بُعد دقيقتين من موقف حافلات Ashgrove. توجد حوامل للدراجات عند البوابة الجانبية؛ لا يوجد موقف سيارات، لكن الوقوف في الشارع مسموح بلا قيود بعد العاشرة.",
    "距 Ashgrove 公交站步行两分钟。侧门旁有自行车停放架；没有停车场，但 10 点以后街边可以随意停车。",
    "距 Ashgrove 公車站步行兩分鐘。側門旁有腳踏車停放架；沒有停車場，但 10 點以後路邊可以自由停車。",
  ),
  payNote: n(
    "Card, cash or a transfer on the day. We can take part of it now and the rest later.",
    "Karte, bar oder Überweisung am Tag des Besuchs. Wir können einen Teil sofort nehmen und den Rest später.",
    "Carte, espèces ou virement le jour même. Nous pouvons prendre une partie maintenant et le reste plus tard.",
    "Kort, kontanter eller bankoverførsel på dagen. Vi kan tage en del nu og resten senere.",
    "Kartou, v hotovosti nebo převodem v den návštěvy. Část můžeme přijmout hned a zbytek později.",
    "بالبطاقة أو نقدًا أو بتحويل بنكي في يوم الزيارة. يمكننا أخذ جزء الآن والباقي لاحقًا.",
    "当天可刷卡、付现金或转账。可以先付一部分，余款以后再付。",
    "當天可刷卡、付現或轉帳。可以先付一部分，其餘之後再付。",
  ),
  insurerNote: n(
    "Bring your policy number and we will send the paperwork on for you.",
    "Bringen Sie Ihre Versicherungsnummer mit, dann schicken wir die Unterlagen für Sie weiter.",
    "Apportez votre numéro de contrat et nous transmettrons les documents pour vous.",
    "Tag dit policenummer med, så sender vi papirerne videre for dig.",
    "Přineste číslo pojistky a papíry za vás odešleme.",
    "أحضر رقم وثيقة التأمين وسنرسل الأوراق نيابةً عنك.",
    "请带上您的保单号，我们会替您转交相关文件。",
    "請帶上您的保單號碼，我們會代您轉交相關文件。",
  ),
};

// ── visit types ─────────────────────────────────────────────────────────────

export const TYPE_NAMES: Record<"routine" | "new" | "physio" | "nurse", { name: Names; short: Names }> = {
  routine: {
    name: n("Routine check", "Routinekontrolle", "Contrôle de routine", "Rutinekontrol", "Běžná kontrola", "فحص روتيني", "常规检查", "例行檢查"),
    short: n("Routine", "Routine", "Routine", "Rutine", "Kontrola", "روتيني", "常规", "例行"),
  },
  new: {
    name: n("New patient", "Neupatient", "Nouveau patient", "Ny patient", "Nový pacient", "مريض جديد", "初诊", "初診"),
    short: n("New patient", "Neupatient", "Nouveau patient", "Ny patient", "Nový pacient", "مريض جديد", "初诊", "初診"),
  },
  physio: {
    name: n("Physiotherapy", "Physiotherapie", "Kinésithérapie", "Fysioterapi", "Fyzioterapie", "علاج طبيعي", "物理治疗", "物理治療"),
    short: n("Physio", "Physio", "Kiné", "Fysio", "Fyzio", "علاج طبيعي", "理疗", "理療"),
  },
  nurse: {
    name: n(
      "Nurse — dressing or vaccination",
      "Pflege – Verband oder Impfung",
      "Soins infirmiers – pansement ou vaccination",
      "Sygeplejerske – forbinding eller vaccination",
      "Sestra – převaz nebo očkování",
      "التمريض — ضماد أو تطعيم",
      "护理——换药或接种疫苗",
      "護理——換藥或接種疫苗",
    ),
    short: n("Nurse", "Pflege", "Soins infirmiers", "Sygeplejerske", "Sestra", "تمريض", "护理", "護理"),
  },
};

// ── the clinicians: their role, and a line about them ───────────────────────

/** A role reads in the person's own grammatical gender where a language has one. */
export const CLINICIAN_TEXT: Record<"amara" | "piotr" | "nadia" | "tom", { role: Names; bio: Names }> = {
  amara: {
    role: n("GP", "Hausärztin", "Médecin généraliste", "Praktiserende læge", "Praktická lékařka", "طبيبة عامة", "全科医生", "家庭醫師"),
    bio: n(
      "Routine checks, follow-ups and new registrations. Tuesday and Thursday mornings fill first.",
      "Routinekontrollen, Nachkontrollen und Neuanmeldungen. Dienstag- und Donnerstagvormittag sind zuerst ausgebucht.",
      "Contrôles de routine, suivis et nouvelles inscriptions. Les mardis et jeudis matin se remplissent en premier.",
      "Rutinekontroller, opfølgninger og nye patienter. Tirsdag og torsdag formiddag bliver booket først.",
      "Běžné kontroly, kontrolní návštěvy a registrace nových pacientů. Úterní a čtvrteční dopoledne se zaplní nejdřív.",
      "فحوص روتينية ومتابعات وتسجيل مرضى جدد. صباحا الثلاثاء والخميس يمتلئان أولًا.",
      "常规检查、复诊和新患者登记。周二和周四上午最先约满。",
      "例行檢查、回診追蹤與新病患登記。週二和週四上午最先額滿。",
    ),
  },
  piotr: {
    role: n("GP", "Hausarzt", "Médecin généraliste", "Praktiserende læge", "Praktický lékař", "طبيب عام", "全科医生", "家庭醫師"),
    bio: n(
      "Routine checks and new registrations. Happy to see the whole household in one run.",
      "Routinekontrollen und Neuanmeldungen. Sieht gern den ganzen Haushalt in einem Rutsch.",
      "Contrôles de routine et nouvelles inscriptions. Reçoit volontiers toute la famille à la suite.",
      "Rutinekontroller og nye patienter. Ser gerne hele husstanden i én omgang.",
      "Běžné kontroly a registrace nových pacientů. Rád vezme celou domácnost najednou.",
      "فحوص روتينية وتسجيل مرضى جدد. يسعده استقبال أفراد الأسرة كلهم في جلسة واحدة.",
      "常规检查和新患者登记。乐意一次看完全家人。",
      "例行檢查與新病患登記。樂意一次看完全家人。",
    ),
  },
  nadia: {
    role: n("Physiotherapist", "Physiotherapeutin", "Kinésithérapeute", "Fysioterapeut", "Fyzioterapeutka", "أخصائية علاج طبيعي", "物理治疗师", "物理治療師"),
    bio: n(
      "Forty-five minutes for rehab and follow-ups. Bring shorts or loose trousers.",
      "Fünfundvierzig Minuten für Reha und Nachkontrollen. Bitte kurze oder weite Hosen mitbringen.",
      "Quarante-cinq minutes pour la rééducation et les suivis. Apportez un short ou un pantalon ample.",
      "Femogfyrre minutter til genoptræning og opfølgning. Tag shorts eller løse bukser med.",
      "Pětačtyřicet minut na rehabilitaci a kontroly. Vezměte si kraťasy nebo volné kalhoty.",
      "خمس وأربعون دقيقة لإعادة التأهيل والمتابعة. أحضر سروالًا قصيرًا أو بنطالًا واسعًا.",
      "康复和复诊每次四十五分钟。请穿短裤或宽松的裤子。",
      "復健與回診每次四十五分鐘。請穿短褲或寬鬆的褲子。",
    ),
  },
  tom: {
    role: n("Practice nurse", "Pflegefachkraft", "Infirmier", "Praksissygeplejerske", "Zdravotní bratr", "ممرض العيادة", "诊所护士", "診所護理師"),
    bio: n(
      "Dressings, jabs and stitches out. Short visits, quick in and out.",
      "Verbände, Impfungen und Fäden ziehen. Kurze Termine, schnell rein und raus.",
      "Pansements, vaccins et retrait de points. Des visites courtes, vite faites.",
      "Forbindinger, vaccinationer og fjernelse af sting. Korte besøg, hurtigt ind og ud.",
      "Převazy, očkování a vyndávání stehů. Krátké návštěvy, rychle tam a zpátky.",
      "ضمادات وتطعيمات وإزالة غرز. زيارات قصيرة، دخول وخروج سريعان.",
      "换药、打针和拆线。看诊时间短，来去都快。",
      "換藥、打針與拆線。看診時間短，來去都快。",
    ),
  },
};

// ── what a visit is for: one short plain line, never more ───────────────────

/*
 * The desk knows who is coming and roughly what for — nothing about what is
 * wrong with anyone, no medicine, no result. Each reason is a line a
 * receptionist would write on the day sheet.
 */
export const REASONS = {
  annual: n("Annual check", "Jährliche Kontrolle", "Bilan annuel", "Årlig kontrol", "Roční kontrola", "فحص سنوي", "年度检查", "年度健檢"),
  sickNote: n("Sick note", "Krankschreibung", "Arrêt de travail", "Sygemelding", "Neschopenka", "إجازة مرضية", "病假证明", "病假證明"),
  dressing: n("Dressing change", "Verbandwechsel", "Changement de pansement", "Forbindingsskift", "Převaz", "تغيير ضمادة", "换药", "換藥"),
  flu: n("Flu jab", "Grippeimpfung", "Vaccin contre la grippe", "Influenzavaccination", "Očkování proti chřipce", "تطعيم الإنفلونزا", "流感疫苗接种", "流感疫苗接種"),
  knee: n("Knee follow-up", "Nachkontrolle Knie", "Suivi du genou", "Opfølgning på knæ", "Kontrola kolena", "متابعة الركبة", "膝盖复诊", "膝蓋回診"),
  followUp: n("Follow-up visit", "Nachkontrolle", "Visite de suivi", "Opfølgning", "Kontrolní návštěva", "زيارة متابعة", "复诊", "回診追蹤"),
  register: n(
    "New patient registration",
    "Neuanmeldung",
    "Inscription d’un nouveau patient",
    "Tilmelding som ny patient",
    "Registrace nového pacienta",
    "تسجيل مريض جديد",
    "新患者登记",
    "新病患登記",
  ),
  stitches: n("Stitches out", "Fäden ziehen", "Retrait des points", "Fjernelse af sting", "Vyndání stehů", "إزالة الغرز", "拆线", "拆線"),
  shoulderRehab: n("Shoulder rehab", "Schulter-Reha", "Rééducation de l’épaule", "Genoptræning af skulder", "Rehabilitace ramene", "إعادة تأهيل الكتف", "肩部康复", "肩部復健"),
  review: n("Review appointment", "Kontrolltermin", "Rendez-vous de contrôle", "Kontroltid", "Kontrolní termín", "موعد مراجعة", "复查", "複查"),
  back: n("Back follow-up", "Nachkontrolle Rücken", "Suivi du dos", "Opfølgning på ryg", "Kontrola zad", "متابعة الظهر", "腰背复诊", "背部回診"),
  travel: n("Travel jabs", "Reiseimpfung", "Vaccins de voyage", "Rejsevaccination", "Cestovní očkování", "تطعيمات السفر", "旅行疫苗接种", "旅遊疫苗接種"),
  form: n("Form to sign", "Formular zum Unterschreiben", "Formulaire à signer", "Blanket til underskrift", "Formulář k podpisu", "نموذج للتوقيع", "签署表格", "簽署表格"),
  ankleRehab: n("Ankle rehab", "Sprunggelenk-Reha", "Rééducation de la cheville", "Genoptræning af ankel", "Rehabilitace kotníku", "إعادة تأهيل الكاحل", "脚踝康复", "腳踝復健"),
  kneeRehab: n("Knee rehab", "Knie-Reha", "Rééducation du genou", "Genoptræning af knæ", "Rehabilitace kolena", "إعادة تأهيل الركبة", "膝盖康复", "膝蓋復健"),
  gait: n("Gait check", "Ganganalyse", "Bilan de la marche", "Gangundersøgelse", "Kontrola chůze", "فحص المشية", "步态检查", "步態檢查"),
  wound: n("Wound check", "Wundkontrolle", "Contrôle de la plaie", "Sårkontrol", "Kontrola rány", "فحص الجرح", "伤口检查", "傷口檢查"),
  firstPhysio: n("First physio visit", "Erster Physiotermin", "Première séance de kiné", "Første fysiobesøg", "První fyzioterapie", "أول جلسة علاج طبيعي", "首次理疗", "首次物理治療"),
  child: n("Child check", "Kindervorsorge", "Contrôle de l’enfant", "Børneundersøgelse", "Dětská prohlídka", "فحص الأطفال", "儿童检查", "兒童健檢"),
  bp: n("Blood pressure check", "Blutdruckkontrolle", "Contrôle de la tension", "Blodtrykskontrol", "Měření tlaku", "قياس ضغط الدم", "血压测量", "血壓量測"),
  shoulder: n("Shoulder follow-up", "Nachkontrolle Schulter", "Suivi de l’épaule", "Opfølgning på skulder", "Kontrola ramene", "متابعة الكتف", "肩部复诊", "肩部回診"),
} satisfies Record<string, Names>;

export type Reason = keyof typeof REASONS;

// ── the allergies chip: the one thing beyond logistics a desk carries ───────

export const ALLERGIES = {
  latex: n("Latex", "Latex", "Latex", "Latex", "Latex", "اللاتكس", "乳胶", "乳膠"),
  peanuts: n("Peanuts", "Erdnüsse", "Arachides", "Jordnødder", "Arašídy", "الفول السوداني", "花生", "花生"),
  dressings: n("Adhesive dressings", "Pflaster", "Pansements adhésifs", "Plaster", "Náplasti", "الضمادات اللاصقة", "医用胶布", "醫用膠布"),
  shellfish: n("Shellfish", "Meeresfrüchte", "Crustacés", "Skaldyr", "Korýši", "المحار", "甲壳类海鲜", "帶殼海鮮"),
  stings: n("Bee stings", "Bienenstiche", "Piqûres d’abeille", "Bistik", "Včelí bodnutí", "لسع النحل", "蜂蜇", "蜂螫"),
} satisfies Record<string, Names>;

export type Allergy = keyof typeof ALLERGIES;

// ── what a patient told the desk: logistics, and nothing else ───────────────

export const DESK_NOTES = {
  parent: n(
    "Her father is bringing her.",
    "Ihr Vater bringt sie.",
    "C’est son père qui l’accompagne.",
    "Hendes far følger hende.",
    "Přivede ji její otec.",
    "والدها هو من سيُحضرها.",
    "由她父亲陪同前来。",
    "她的父親會陪她一起來。",
  ),
  early: n(
    "Coming straight from work, so may be a few minutes early.",
    "Kommt direkt von der Arbeit und ist vielleicht ein paar Minuten früher da.",
    "Vient directement du travail et arrivera peut-être quelques minutes en avance.",
    "Kommer direkte fra arbejde og er måske et par minutter tidligt på den.",
    "Přijde rovnou z práce, takže může dorazit o pár minut dřív.",
    "قادم من العمل مباشرة، وقد يصل قبل الموعد بدقائق.",
    "直接从公司过来，可能会早到几分钟。",
    "直接從公司過來，可能會提早幾分鐘到。",
  ),
  wheelchair: n(
    "Uses a wheelchair. Please keep the ground-floor room.",
    "Nutzt einen Rollstuhl. Bitte den Raum im Erdgeschoss reservieren.",
    "Se déplace en fauteuil roulant. Merci de conserver la salle du rez-de-chaussée.",
    "Bruger kørestol. Behold venligst rummet i stueetagen.",
    "Používá invalidní vozík. Ponechte prosím ordinaci v přízemí.",
    "يستخدم كرسيًا متحركًا. من فضلك احتفظ بالغرفة في الدور الأرضي.",
    "使用轮椅，请保留一楼的诊室。",
    "使用輪椅，請保留一樓的診間。",
  ),
} satisfies Record<string, Names>;

// ── days the practice, or one clinician, is closed ──────────────────────────

export const CLOSURE_TEXT = {
  training: {
    label: n("Staff training day", "Fortbildungstag", "Journée de formation", "Kursusdag for personalet", "Školicí den", "يوم تدريب الفريق", "员工培训日", "員工培訓日"),
    note: n(
      "The whole practice is shut for staff training.",
      "Die ganze Praxis bleibt wegen einer Fortbildung geschlossen.",
      "Tout le cabinet est fermé pour la formation de l’équipe.",
      "Hele praksis har lukket på grund af kursus for personalet.",
      "Celá ordinace je kvůli školení zavřená.",
      "العيادة كلها مغلقة لتدريب الفريق.",
      "全诊所因员工培训停诊。",
      "全診所因員工培訓休診。",
    ),
  },
  nadia: {
    label: n("Nadia away", "Nadia nicht da", "Nadia absente", "Nadia er væk", "Nadia mimo ordinaci", "Nadia غائبة", "Nadia 不在", "Nadia 不在"),
    note: n(
      "Teaching for the day — no physiotherapy times.",
      "Unterrichtet an diesem Tag – keine Physiotherapie-Termine.",
      "Elle enseigne ce jour-là — pas de créneaux de kinésithérapie.",
      "Underviser hele dagen – ingen tider til fysioterapi.",
      "Celý den učí – žádné termíny fyzioterapie.",
      "تُدرِّس طوال اليوم — لا مواعيد للعلاج الطبيعي.",
      "当天外出授课——没有物理治疗时段。",
      "當天外出授課——沒有物理治療時段。",
    ),
  },
  amara: {
    label: n("Dr Osei away", "Dr. Osei nicht da", "Dr Osei absente", "Dr. Osei er væk", "Dr. Osei mimo ordinaci", "د. Osei غائبة", "Osei 医生不在", "Osei 醫師不在"),
    note: n(
      "Annual leave. Dr Nowak covers the routine checks.",
      "Urlaub. Dr. Nowak übernimmt die Routinekontrollen.",
      "Congés annuels. Le Dr Nowak assure les contrôles de routine.",
      "Ferie. Dr. Nowak tager rutinekontrollerne.",
      "Dovolená. Běžné kontroly převezme Dr. Nowak.",
      "إجازة سنوية. يتولى د. Nowak الفحوص الروتينية.",
      "年假。常规检查由 Nowak 医生接诊。",
      "年假。例行檢查由 Nowak 醫師代診。",
    ),
  },
};

// ── the questions page ──────────────────────────────────────────────────────

export const FAQS: { question: Names; answer: Names }[] = [
  {
    question: n(
      "What if I am running late?",
      "Was ist, wenn ich mich verspäte?",
      "Et si je suis en retard ?",
      "Hvad hvis jeg er forsinket?",
      "Co když se opozdím?",
      "ماذا لو تأخرت؟",
      "如果我要迟到怎么办？",
      "如果我會遲到怎麼辦？",
    ),
    answer: n(
      "Come anyway and speak to the desk. If you are more than {no_show_minutes} minutes past your start we may have to move you to the next open time, but we will always try to fit you in.",
      "Kommen Sie trotzdem und sprechen Sie mit dem Empfang. Wenn Sie mehr als {no_show_minutes} Minuten nach Ihrer Zeit kommen, müssen wir Sie vielleicht auf die nächste freie Zeit verlegen, aber wir versuchen immer, Sie noch unterzubringen.",
      "Venez quand même et adressez-vous à l’accueil. Si vous avez plus de {no_show_minutes} minutes de retard, nous devrons peut-être vous déplacer au prochain créneau libre, mais nous essaierons toujours de vous recevoir.",
      "Kom alligevel, og tal med receptionen. Er du mere end {no_show_minutes} minutter forsinket, må vi måske flytte dig til den næste ledige tid, men vi prøver altid at finde plads til dig.",
      "Přijďte i tak a ozvěte se na recepci. Pokud dorazíte o víc než {no_show_minutes} minut později, možná vás budeme muset přesunout na nejbližší volný termín, ale vždycky se vás pokusíme vzít.",
      "تعالَ على أي حال وتحدث إلى مكتب الاستقبال. إذا تأخرت أكثر من {no_show_minutes} دقيقة عن موعدك فقد نضطر إلى نقلك إلى أقرب موعد متاح، لكننا سنحاول دائمًا أن نجد لك مكانًا.",
      "请照常过来，并告诉前台。如果您比预约时间晚了 {no_show_minutes} 分钟以上，我们可能需要把您改到下一个空档，但我们总会尽量为您安排。",
      "請照常過來，並告知櫃台。如果您比預約時間晚了 {no_show_minutes} 分鐘以上，我們可能需要把您改到下一個空檔，但我們一定會盡量為您安排。",
    ),
  },
  {
    question: n(
      "How do I change or cancel?",
      "Wie kann ich einen Termin ändern oder absagen?",
      "Comment modifier ou annuler ?",
      "Hvordan ændrer eller aflyser jeg?",
      "Jak návštěvu změním nebo zruším?",
      "كيف أغيّر موعدي أو ألغيه؟",
      "如何更改或取消预约？",
      "如何更改或取消預約？",
    ),
    answer: n(
      "From My visits, or ring the desk on {phone}. There is no charge until {cancel_hours} hours before the start. Inside that we still will not charge you, but the time is hard to give to somebody else — so tell us as soon as you know.",
      "Unter „Meine Termine“ oder telefonisch am Empfang unter {phone}. Bis {cancel_hours} Stunden vor Beginn kostet das nichts. Danach berechnen wir Ihnen auch nichts, aber die Zeit lässt sich kaum noch an jemand anderen vergeben – sagen Sie uns also Bescheid, sobald Sie es wissen.",
      "Depuis « Mes rendez-vous », ou en appelant l’accueil au {phone}. C’est gratuit jusqu’à {cancel_hours} heures avant le début. Passé ce délai, nous ne vous facturons toujours rien, mais le créneau est difficile à redonner à quelqu’un d’autre — prévenez-nous dès que vous le savez.",
      "Under „Mine besøg“ eller ved at ringe til receptionen på {phone}. Det er gratis indtil {cancel_hours} timer før starttidspunktet. Derefter tager vi stadig ikke betaling, men tiden er svær at give videre til en anden – så sig til, så snart du ved det.",
      "V části „Moje návštěvy“, nebo zavolejte na recepci na {phone}. Do {cancel_hours} hodin před začátkem je to zdarma. I potom vám nic neúčtujeme, ale ten čas už těžko dáme někomu jinému – dejte nám proto vědět, jakmile to budete vědět.",
      "من صفحة «زياراتي»، أو اتصل بمكتب الاستقبال على {phone}. لا رسوم حتى {cancel_hours} ساعة قبل الموعد. وبعد ذلك لن نحاسبك أيضًا، لكن يصعب إعطاء الوقت لشخص آخر — لذا أخبرنا فور أن تعرف.",
      "在“我的就诊”中操作，或致电前台 {phone}。开始前 {cancel_hours} 小时之前取消不收费。在那之后我们也不会收费，但这个时段很难再让给别人——所以一旦确定请尽早告诉我们。",
      "在「我的就診」中操作，或致電櫃台 {phone}。開始前 {cancel_hours} 小時之前取消不收費。在那之後我們也不會收費，但這個時段很難再讓給別人——所以一旦確定請盡早告訴我們。",
    ),
  },
  {
    question: n(
      "What should I bring?",
      "Was soll ich mitbringen?",
      "Que dois-je apporter ?",
      "Hvad skal jeg have med?",
      "Co si mám vzít s sebou?",
      "ماذا أُحضر معي؟",
      "我需要带什么？",
      "我需要帶什麼？",
    ),
    answer: n(
      "Your mobile, so you have the reference, and anything the desk asked for when you booked. If you told us something in the note, it is already on the day sheet.",
      "Ihr Handy, damit Sie die Buchungsnummer dabeihaben, und alles, worum der Empfang bei der Buchung gebeten hat. Was Sie uns in der Notiz geschrieben haben, steht schon auf dem Tagesplan.",
      "Votre téléphone, pour avoir la référence, et tout ce que l’accueil vous a demandé lors de la réservation. Si vous nous avez laissé un mot, il figure déjà sur la feuille du jour.",
      "Din mobil, så du har referencen, og det, receptionen bad om, da du bookede. Hvis du skrev noget i beskeden, står det allerede på dagsoversigten.",
      "Mobil, abyste měli číslo rezervace, a cokoli, o co vás recepce při objednání požádala. Pokud jste nám něco napsali do poznámky, už to máme v denním rozpisu.",
      "هاتفك المحمول ليكون معك رقم الحجز، وأي شيء طلبه مكتب الاستقبال عند الحجز. وإذا كتبت لنا شيئًا في الملاحظة فهو موجود بالفعل في جدول اليوم.",
      "带上手机，方便出示预约编号，以及预约时前台要求您带的东西。如果您在备注里写了什么，已经记在当天的日程表上了。",
      "帶上手機，方便出示預約編號，以及預約時櫃台請您帶的東西。如果您在備註裡寫了什麼，已經記在當天的日程表上了。",
    ),
  },
  {
    question: n(
      "Can I book for somebody else?",
      "Kann ich für jemand anderen buchen?",
      "Puis-je réserver pour quelqu’un d’autre ?",
      "Kan jeg booke for en anden?",
      "Můžu objednat někoho jiného?",
      "هل يمكنني الحجز لشخص آخر؟",
      "我可以替别人预约吗？",
      "我可以幫別人預約嗎？",
    ),
    answer: n(
      "Yes. Book it in their name and add a line for the desk so we know who is coming with them.",
      "Ja. Buchen Sie auf deren Namen und schreiben Sie eine Zeile für den Empfang, damit wir wissen, wer mitkommt.",
      "Oui. Réservez à son nom et ajoutez un mot pour l’accueil, pour que nous sachions qui l’accompagne.",
      "Ja. Book i deres navn, og skriv en linje til receptionen, så vi ved, hvem der kommer med.",
      "Ano. Objednejte ho na jeho jméno a připište pro recepci, kdo s ním přijde.",
      "نعم. احجز باسمه وأضف سطرًا لمكتب الاستقبال حتى نعرف من سيأتي معه.",
      "可以。用对方的名字预约，并给前台留一句话，让我们知道谁会陪同前来。",
      "可以。用對方的名字預約，並給櫃台留一句話，讓我們知道誰會陪同前來。",
    ),
  },
  {
    question: n(
      "How long will I wait once I am there?",
      "Wie lange muss ich vor Ort warten?",
      "Combien de temps vais-je attendre sur place ?",
      "Hvor længe skal jeg vente, når jeg er der?",
      "Jak dlouho budu na místě čekat?",
      "كم سأنتظر بعد وصولي؟",
      "到了以后要等多久？",
      "到了以後要等多久？",
    ),
    answer: n(
      "The board at the desk shows how long each person has been in the building. Most people are seen within ten minutes of their start; if it slips past twenty, ask us and we will find out where things are.",
      "Die Tafel am Empfang zeigt, wie lange jede Person schon im Haus ist. Die meisten kommen innerhalb von zehn Minuten nach ihrer Zeit dran; werden es mehr als zwanzig, fragen Sie uns, und wir sehen nach, wo es hakt.",
      "Le tableau de l’accueil indique depuis combien de temps chaque personne est là. La plupart sont reçues dans les dix minutes suivant leur heure ; si cela dépasse vingt minutes, demandez-nous et nous verrons où en sont les choses.",
      "Tavlen i receptionen viser, hvor længe hver person har været i huset. De fleste kommer ind inden for ti minutter efter deres tid; går der mere end tyve, så spørg os, så finder vi ud af, hvordan det går.",
      "Tabule na recepci ukazuje, jak dlouho už je kdo v budově. Většina lidí přijde na řadu do deseti minut od svého času; když to přesáhne dvacet, zeptejte se nás a zjistíme, jak to vypadá.",
      "تعرض اللوحة عند مكتب الاستقبال المدة التي قضاها كل شخص في المبنى. يُستقبل معظم الناس خلال عشر دقائق من موعدهم؛ وإذا تجاوز الانتظار عشرين دقيقة فاسألنا وسنعرف أين وصلت الأمور.",
      "前台的看板会显示每个人已经到了多久。大多数人会在预约时间后十分钟内就诊；如果超过二十分钟，请问我们，我们会去了解情况。",
      "櫃台的看板會顯示每個人已經到了多久。大多數人會在預約時間後十分鐘內看診；如果超過二十分鐘，請問我們，我們會去了解情況。",
    ),
  },
  {
    question: n(
      "Do you see children?",
      "Behandeln Sie auch Kinder?",
      "Recevez-vous les enfants ?",
      "Tager I imod børn?",
      "Přijímáte i děti?",
      "هل تستقبلون الأطفال؟",
      "你们看儿童吗？",
      "你們看兒童嗎？",
    ),
    answer: n(
      "Yes, from birth upwards. Bring an adult who can stay for the whole visit.",
      "Ja, von Geburt an. Bitte bringen Sie einen Erwachsenen mit, der während des ganzen Besuchs bleiben kann.",
      "Oui, dès la naissance. Venez avec un adulte qui peut rester pendant toute la visite.",
      "Ja, lige fra fødslen. Tag en voksen med, der kan blive under hele besøget.",
      "Ano, už od narození. Vezměte s sebou dospělého, který může zůstat po celou návštěvu.",
      "نعم، منذ الولادة. أحضر شخصًا بالغًا يمكنه البقاء طوال الزيارة.",
      "看的，从新生儿起都可以。请带一位能全程陪同的成年人。",
      "看的，從新生兒起都可以。請帶一位能全程陪同的成年人。",
    ),
  },
];

// ── notes the desk wrote ────────────────────────────────────────────────────

export const DESK_TEXT = {
  writeOffSameWound: n(
    "Same wound as the week before — no second charge.",
    "Dieselbe Wunde wie in der Woche davor – keine zweite Gebühr.",
    "Même plaie que la semaine précédente — pas de second paiement.",
    "Samme sår som ugen før – ingen ekstra betaling.",
    "Stejná rána jako minulý týden – podruhé neúčtujeme.",
    "الجرح نفسه من الأسبوع السابق — بلا رسوم ثانية.",
    "与上周是同一处伤口——不再重复收费。",
    "與上週是同一處傷口——不再重複收費。",
  ),
  writeOffStudent: n(
    "Student rate, agreed with Nadia.",
    "Studententarif, mit Nadia abgesprochen.",
    "Tarif étudiant, convenu avec Nadia.",
    "Studiepris, aftalt med Nadia.",
    "Studentská sazba – schválila Nadia.",
    "سعر الطلاب، بالاتفاق مع Nadia.",
    "学生价，已与 Nadia 商定。",
    "學生價，已與 Nadia 講好。",
  ),
  voidTwice: n(
    "Taken twice by mistake.",
    "Versehentlich doppelt gebucht.",
    "Encaissé deux fois par erreur.",
    "Registreret to gange ved en fejl.",
    "Omylem zaúčtováno dvakrát.",
    "سُجِّلت مرتين عن طريق الخطأ.",
    "误收了两次。",
    "不小心重複收款。",
  ),
  recallNotNeeded: n(
    "Knee much better — will ring if it flares up.",
    "Dem Knie geht es viel besser – meldet sich, falls es wieder schlimmer wird.",
    "Le genou va beaucoup mieux — il appellera en cas de rechute.",
    "Knæet har det meget bedre – ringer, hvis det blusser op igen.",
    "Koleno je mnohem lepší – zavolá, kdyby se to zhoršilo.",
    "الركبة أفضل بكثير — سيتصل إذا عاد الألم.",
    "膝盖好多了——如果复发会打电话来。",
    "膝蓋好多了——如果復發會打電話來。",
  ),
  waitShortNotice: n(
    "Can come at short notice.",
    "Kann kurzfristig kommen.",
    "Peut venir au dernier moment.",
    "Kan komme med kort varsel.",
    "Může přijít i na poslední chvíli.",
    "يمكنه الحضور في وقت قصير.",
    "临时通知也可以来。",
    "臨時通知也能來。",
  ),
  waitMornings: n(
    "Mornings only — she has a lift until noon.",
    "Nur vormittags – bis mittags wird sie gefahren.",
    "Le matin seulement — quelqu’un la conduit jusqu’à midi.",
    "Kun om formiddagen – hun kan blive kørt indtil middag.",
    "Jen dopoledne – do poledne ji má kdo odvézt.",
    "صباحًا فقط — هناك من يوصلها حتى الظهر.",
    "只能上午——中午前有人送她过来。",
    "只能上午——中午前有人載她過來。",
  ),
  leftMessage: n(
    "Left a message. Will try again tomorrow.",
    "Nachricht hinterlassen. Versuche es morgen noch einmal.",
    "Message laissé. Je réessaie demain.",
    "Lagt en besked. Prøver igen i morgen.",
    "Nechala jsem vzkaz. Zkusím to zítra znovu.",
    "تركتُ رسالة. سأحاول مرة أخرى غدًا.",
    "已留言，明天再打。",
    "已留言，明天再打。",
  ),
  mailboxFull: n(
    "Not delivered: the mailbox is full.",
    "Nicht zugestellt: Das Postfach ist voll.",
    "Non distribué : la boîte de réception est pleine.",
    "Ikke leveret: postkassen er fuld.",
    "Nedoručeno: schránka je plná.",
    "لم تُسلَّم: صندوق البريد ممتلئ.",
    "未送达：邮箱已满。",
    "未送達：信箱已滿。",
  ),
  dayClosed: n(
    "All square. Card terminal batch sent at 17:35.",
    "Alles stimmt. Tagesabschluss am Kartenterminal um 17:35 gesendet.",
    "Tout est juste. Clôture du terminal de paiement envoyée à 17 h 35.",
    "Alt stemmer. Kortterminalens dagsopgørelse sendt kl. 17.35.",
    "Vše sedí. Uzávěrka platebního terminálu odeslána v 17:35.",
    "كل شيء مطابق. أُرسلت تسوية جهاز البطاقات في 17:35.",
    "账目相符。刷卡机已于 17:35 结算。",
    "帳目相符。刷卡機已於 17:35 結帳。",
  ),
};
