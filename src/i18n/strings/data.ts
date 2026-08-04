/**
 * Area bundle: **data**.
 *
 * The seed's prose. `data/demo.ts` stores an i18n KEY in every translatable
 * field — a role line, a reason for a visit, a note the patient left for the
 * desk, an allergy — and this module holds the words. Proper nouns are NOT
 * here: people's names, phone numbers and the practice address stay literal in
 * the seed, because a name is a name in every language.
 *
 * The scope boundary lives in this file more than any other. Every reason for a
 * visit is ONE short plain line about why someone is coming through the door.
 * There is nothing here about what is wrong with anyone, nothing that names a
 * medicine, nothing from a lab, and nothing a reader could take as advice. A
 * front desk knows who is coming and roughly what for. That is all it knows,
 * and that is all this bundle says.
 */
import type { LocaleTag } from "../locales.ts";

const EN = {
  /* --- who works here --- */
  "data.role.gp": "GP",
  "data.role.physio": "Physiotherapist",
  "data.role.nurse": "Practice nurse",
  "data.role.desk": "Front desk",

  /* --- what can be booked, and how long it runs --- */
  "data.type.routine": "Routine check",
  "data.type.routine.blurb": "A short look at something already on your record.",
  "data.type.newpatient": "New patient",
  "data.type.newpatient.blurb": "Your first visit with us. We leave more time for it.",
  "data.type.physio": "Physiotherapy",
  "data.type.physio.blurb": "A full session with Nadia.",
  "data.type.nurse": "Nurse",
  "data.type.nurse.blurb": "Dressings and vaccinations.",

  /* --- the reason line: one short sentence fragment, never more --- */
  "data.reason.annual": "Annual check",
  "data.reason.review": "Follow-up review",
  "data.reason.bp": "Blood pressure check",
  "data.reason.register": "New patient registration",
  "data.reason.dressing": "Dressing change",
  "data.reason.stitches": "Stitches out",
  "data.reason.flu": "Flu vaccination",
  "data.reason.travel": "Travel vaccination",
  "data.reason.child": "Child check",
  "data.reason.ear": "Ear check",
  "data.reason.knee": "Knee follow-up",
  "data.reason.back": "Back follow-up",
  "data.reason.shoulder": "Shoulder follow-up",
  "data.reason.wrist": "Wrist follow-up",
  "data.reason.ankle": "Ankle follow-up",

  /* --- the allergies chip: the one thing beyond logistics a desk carries --- */
  "data.allergy.latex": "Latex",
  "data.allergy.peanuts": "Peanuts",
  "data.allergy.dressings": "Adhesive dressings",
  "data.allergy.shellfish": "Shellfish",
  "data.allergy.stings": "Bee stings",

  /* --- what the patient told the desk: logistics, and nothing else --- */
  "data.desknote.early": "Coming straight from work, so may be a few minutes early.",
  "data.desknote.wheelchair": "Uses a wheelchair. Please keep the ground-floor room.",
  "data.desknote.parent": "Her father is bringing her.",
} as const satisfies Record<string, string>;

/*
 * The seeded fiction is translated in the same pass as the chrome, so a locale
 * switch never leaves an English island inside a translated screen. Key order
 * matches `EN` in every bundle so the file stays diffable. People's names stay
 * literal: "Nadia" is "Nadia" in all eight, including the two Chinese bundles
 * and the Arabic one, because a name is a name.
 */
export const data = {
  "en-US": EN,

  "de-DE": {
    /* --- who works here --- */
    "data.role.gp": "Hausarzt",
    "data.role.physio": "Physiotherapeut",
    "data.role.nurse": "Pflegefachkraft",
    "data.role.desk": "Empfang",

    /* --- what can be booked, and how long it runs --- */
    "data.type.routine": "Routinekontrolle",
    "data.type.routine.blurb": "Ein kurzer Blick auf etwas, das bei uns schon vermerkt ist.",
    "data.type.newpatient": "Neupatient",
    "data.type.newpatient.blurb": "Ihr erster Besuch bei uns. Dafür nehmen wir uns mehr Zeit.",
    "data.type.physio": "Physiotherapie",
    "data.type.physio.blurb": "Eine volle Sitzung bei Nadia.",
    "data.type.nurse": "Pflege",
    "data.type.nurse.blurb": "Verbandwechsel und Impfungen.",

    /* --- the reason line --- */
    "data.reason.annual": "Jährliche Kontrolle",
    "data.reason.review": "Nachkontrolle",
    "data.reason.bp": "Blutdruckkontrolle",
    "data.reason.register": "Neuanmeldung",
    "data.reason.dressing": "Verbandwechsel",
    "data.reason.stitches": "Fäden ziehen",
    "data.reason.flu": "Grippeimpfung",
    "data.reason.travel": "Reiseimpfung",
    "data.reason.child": "Kindervorsorge",
    "data.reason.ear": "Ohrenkontrolle",
    "data.reason.knee": "Nachkontrolle Knie",
    "data.reason.back": "Nachkontrolle Rücken",
    "data.reason.shoulder": "Nachkontrolle Schulter",
    "data.reason.wrist": "Nachkontrolle Handgelenk",
    "data.reason.ankle": "Nachkontrolle Sprunggelenk",

    /* --- the allergies chip --- */
    "data.allergy.latex": "Latex",
    "data.allergy.peanuts": "Erdnüsse",
    "data.allergy.dressings": "Pflaster",
    "data.allergy.shellfish": "Meeresfrüchte",
    "data.allergy.stings": "Bienenstiche",

    /* --- what the patient told the desk --- */
    "data.desknote.early":
      "Kommt direkt von der Arbeit und ist vielleicht ein paar Minuten früher da.",
    "data.desknote.wheelchair":
      "Nutzt einen Rollstuhl. Bitte den Raum im Erdgeschoss reservieren.",
    "data.desknote.parent": "Ihr Vater bringt sie.",
  },

  "fr-FR": {
    /* --- who works here --- */
    "data.role.gp": "Médecin généraliste",
    "data.role.physio": "Kinésithérapeute",
    "data.role.nurse": "Infirmière",
    "data.role.desk": "Accueil",

    /* --- what can be booked, and how long it runs --- */
    "data.type.routine": "Contrôle de routine",
    "data.type.routine.blurb": "Un point rapide sur un élément déjà noté dans votre dossier.",
    "data.type.newpatient": "Nouveau patient",
    "data.type.newpatient.blurb": "Votre première visite chez nous. Nous prévoyons plus de temps.",
    "data.type.physio": "Kinésithérapie",
    "data.type.physio.blurb": "Une séance complète avec Nadia.",
    "data.type.nurse": "Soins infirmiers",
    "data.type.nurse.blurb": "Pansements et vaccinations.",

    /* --- the reason line --- */
    "data.reason.annual": "Bilan annuel",
    "data.reason.review": "Visite de suivi",
    "data.reason.bp": "Contrôle de la tension",
    "data.reason.register": "Inscription d’un nouveau patient",
    "data.reason.dressing": "Changement de pansement",
    "data.reason.stitches": "Retrait des points",
    "data.reason.flu": "Vaccination contre la grippe",
    "data.reason.travel": "Vaccination voyage",
    "data.reason.child": "Contrôle de l’enfant",
    "data.reason.ear": "Contrôle de l’oreille",
    "data.reason.knee": "Suivi du genou",
    "data.reason.back": "Suivi du dos",
    "data.reason.shoulder": "Suivi de l’épaule",
    "data.reason.wrist": "Suivi du poignet",
    "data.reason.ankle": "Suivi de la cheville",

    /* --- the allergies chip --- */
    "data.allergy.latex": "Latex",
    "data.allergy.peanuts": "Arachides",
    "data.allergy.dressings": "Pansements adhésifs",
    "data.allergy.shellfish": "Crustacés",
    "data.allergy.stings": "Piqûres d’abeille",

    /* --- what the patient told the desk --- */
    "data.desknote.early":
      "Vient directement du travail et arrivera peut-être quelques minutes en avance.",
    "data.desknote.wheelchair":
      "Se déplace en fauteuil roulant. Merci de conserver la salle du rez-de-chaussée.",
    "data.desknote.parent": "C’est son père qui l’accompagne.",
  },

  "cs-CZ": {
    /* --- who works here --- */
    "data.role.gp": "Praktický lékař",
    "data.role.physio": "Fyzioterapeut",
    "data.role.nurse": "Zdravotní sestra",
    "data.role.desk": "Recepce",

    /* --- what can be booked, and how long it runs --- */
    "data.type.routine": "Běžná kontrola",
    "data.type.routine.blurb": "Krátká kontrola něčeho, co už u vás máme zaznamenané.",
    "data.type.newpatient": "Nový pacient",
    "data.type.newpatient.blurb": "Vaše první návštěva u nás. Vyhradíme si na ni víc času.",
    "data.type.physio": "Fyzioterapie",
    "data.type.physio.blurb": "Celé sezení, které vede Nadia.",
    "data.type.nurse": "Sestra",
    "data.type.nurse.blurb": "Převazy a očkování.",

    /* --- the reason line --- */
    "data.reason.annual": "Roční kontrola",
    "data.reason.review": "Kontrolní návštěva",
    "data.reason.bp": "Měření tlaku",
    "data.reason.register": "Registrace nového pacienta",
    "data.reason.dressing": "Převaz",
    "data.reason.stitches": "Vyndání stehů",
    "data.reason.flu": "Očkování proti chřipce",
    "data.reason.travel": "Cestovní očkování",
    "data.reason.child": "Dětská prohlídka",
    "data.reason.ear": "Kontrola ucha",
    "data.reason.knee": "Kontrola kolena",
    "data.reason.back": "Kontrola zad",
    "data.reason.shoulder": "Kontrola ramene",
    "data.reason.wrist": "Kontrola zápěstí",
    "data.reason.ankle": "Kontrola kotníku",

    /* --- the allergies chip --- */
    "data.allergy.latex": "Latex",
    "data.allergy.peanuts": "Arašídy",
    "data.allergy.dressings": "Náplasti",
    "data.allergy.shellfish": "Korýši",
    "data.allergy.stings": "Včelí bodnutí",

    /* --- what the patient told the desk --- */
    "data.desknote.early": "Přijde rovnou z práce, takže může dorazit o pár minut dřív.",
    "data.desknote.wheelchair": "Používá invalidní vozík. Ponechte prosím ordinaci v přízemí.",
    "data.desknote.parent": "Přivede ji její otec.",
  },

  "da-DK": {
    /* --- who works here --- */
    "data.role.gp": "Praktiserende læge",
    "data.role.physio": "Fysioterapeut",
    "data.role.nurse": "Praksissygeplejerske",
    "data.role.desk": "Reception",

    /* --- what can be booked, and how long it runs --- */
    "data.type.routine": "Rutinekontrol",
    "data.type.routine.blurb": "Et kort kig på noget, der allerede står i din journal.",
    "data.type.newpatient": "Ny patient",
    "data.type.newpatient.blurb": "Dit første besøg hos os. Vi sætter mere tid af til det.",
    "data.type.physio": "Fysioterapi",
    "data.type.physio.blurb": "En hel session hos Nadia.",
    "data.type.nurse": "Sygeplejerske",
    "data.type.nurse.blurb": "Forbindingsskift og vaccinationer.",

    /* --- the reason line --- */
    "data.reason.annual": "Årlig kontrol",
    "data.reason.review": "Opfølgning",
    "data.reason.bp": "Blodtrykskontrol",
    "data.reason.register": "Tilmelding som ny patient",
    "data.reason.dressing": "Forbindingsskift",
    "data.reason.stitches": "Fjernelse af sting",
    "data.reason.flu": "Influenzavaccination",
    "data.reason.travel": "Rejsevaccination",
    "data.reason.child": "Børneundersøgelse",
    "data.reason.ear": "Ørekontrol",
    "data.reason.knee": "Opfølgning på knæ",
    "data.reason.back": "Opfølgning på ryg",
    "data.reason.shoulder": "Opfølgning på skulder",
    "data.reason.wrist": "Opfølgning på håndled",
    "data.reason.ankle": "Opfølgning på ankel",

    /* --- the allergies chip --- */
    "data.allergy.latex": "Latex",
    "data.allergy.peanuts": "Jordnødder",
    "data.allergy.dressings": "Plaster",
    "data.allergy.shellfish": "Skaldyr",
    "data.allergy.stings": "Bistik",

    /* --- what the patient told the desk --- */
    "data.desknote.early":
      "Kommer direkte fra arbejde og er måske et par minutter tidligt på den.",
    "data.desknote.wheelchair": "Bruger kørestol. Behold venligst rummet i stueetagen.",
    "data.desknote.parent": "Hendes far følger hende.",
  },

  "zh-CN": {
    /* --- who works here --- */
    "data.role.gp": "全科医生",
    "data.role.physio": "物理治疗师",
    "data.role.nurse": "诊所护士",
    "data.role.desk": "前台",

    /* --- what can be booked, and how long it runs --- */
    "data.type.routine": "常规检查",
    "data.type.routine.blurb": "针对您记录中已有事项的一次简短复查。",
    "data.type.newpatient": "初诊",
    "data.type.newpatient.blurb": "您第一次来我们这里就诊，我们会多留一些时间。",
    "data.type.physio": "物理治疗",
    "data.type.physio.blurb": "与 Nadia 的一次完整疗程。",
    "data.type.nurse": "护理",
    "data.type.nurse.blurb": "换药与疫苗接种。",

    /* --- the reason line --- */
    "data.reason.annual": "年度检查",
    "data.reason.review": "复诊",
    "data.reason.bp": "血压测量",
    "data.reason.register": "新患者登记",
    "data.reason.dressing": "换药",
    "data.reason.stitches": "拆线",
    "data.reason.flu": "流感疫苗接种",
    "data.reason.travel": "旅行疫苗接种",
    "data.reason.child": "儿童检查",
    "data.reason.ear": "耳部检查",
    "data.reason.knee": "膝盖复诊",
    "data.reason.back": "腰背复诊",
    "data.reason.shoulder": "肩部复诊",
    "data.reason.wrist": "手腕复诊",
    "data.reason.ankle": "脚踝复诊",

    /* --- the allergies chip --- */
    "data.allergy.latex": "乳胶",
    "data.allergy.peanuts": "花生",
    "data.allergy.dressings": "医用胶布",
    "data.allergy.shellfish": "甲壳类海鲜",
    "data.allergy.stings": "蜂蜇",

    /* --- what the patient told the desk --- */
    "data.desknote.early": "直接从公司过来，可能会早到几分钟。",
    "data.desknote.wheelchair": "使用轮椅，请保留一楼的诊室。",
    "data.desknote.parent": "由她父亲陪同前来。",
  },

  "zh-TW": {
    /* --- who works here --- */
    "data.role.gp": "家庭醫師",
    "data.role.physio": "物理治療師",
    "data.role.nurse": "診所護理師",
    "data.role.desk": "櫃台",

    /* --- what can be booked, and how long it runs --- */
    "data.type.routine": "例行檢查",
    "data.type.routine.blurb": "針對您資料中既有事項的簡短複查。",
    "data.type.newpatient": "初診",
    "data.type.newpatient.blurb": "您首次來院看診，我們會預留較長的時間。",
    "data.type.physio": "物理治療",
    "data.type.physio.blurb": "與 Nadia 的完整一次療程。",
    "data.type.nurse": "護理",
    "data.type.nurse.blurb": "傷口換藥與疫苗接種。",

    /* --- the reason line --- */
    "data.reason.annual": "年度健檢",
    "data.reason.review": "回診追蹤",
    "data.reason.bp": "血壓量測",
    "data.reason.register": "新病患登記",
    "data.reason.dressing": "換藥",
    "data.reason.stitches": "拆線",
    "data.reason.flu": "流感疫苗接種",
    "data.reason.travel": "旅遊疫苗接種",
    "data.reason.child": "兒童健檢",
    "data.reason.ear": "耳部檢查",
    "data.reason.knee": "膝蓋回診",
    "data.reason.back": "背部回診",
    "data.reason.shoulder": "肩部回診",
    "data.reason.wrist": "手腕回診",
    "data.reason.ankle": "腳踝回診",

    /* --- the allergies chip --- */
    "data.allergy.latex": "乳膠",
    "data.allergy.peanuts": "花生",
    "data.allergy.dressings": "醫用膠布",
    "data.allergy.shellfish": "帶殼海鮮",
    "data.allergy.stings": "蜂螫",

    /* --- what the patient told the desk --- */
    "data.desknote.early": "直接從公司過來，可能會提早幾分鐘到。",
    "data.desknote.wheelchair": "使用輪椅，請保留一樓的診間。",
    "data.desknote.parent": "她的父親會陪她一起來。",
  },

  "ar-EG": {
    /* --- who works here --- */
    "data.role.gp": "طبيب عام",
    "data.role.physio": "أخصائي علاج طبيعي",
    "data.role.nurse": "ممرضة العيادة",
    "data.role.desk": "مكتب الاستقبال",

    /* --- what can be booked, and how long it runs --- */
    "data.type.routine": "فحص دوري",
    "data.type.routine.blurb": "نظرة سريعة على شيء مسجّل عندنا بالفعل.",
    "data.type.newpatient": "مريض جديد",
    "data.type.newpatient.blurb": "زيارتك الأولى معنا، ونخصّص لها وقتًا أطول.",
    "data.type.physio": "علاج طبيعي",
    "data.type.physio.blurb": "جلسة كاملة مع Nadia.",
    "data.type.nurse": "تمريض",
    "data.type.nurse.blurb": "تغيير الضمادات والتطعيمات.",

    /* --- the reason line --- */
    "data.reason.annual": "فحص سنوي",
    "data.reason.review": "زيارة متابعة",
    "data.reason.bp": "قياس ضغط الدم",
    "data.reason.register": "تسجيل مريض جديد",
    "data.reason.dressing": "تغيير ضمادة",
    "data.reason.stitches": "إزالة الغرز",
    "data.reason.flu": "تطعيم الإنفلونزا",
    "data.reason.travel": "تطعيم السفر",
    "data.reason.child": "فحص الأطفال",
    "data.reason.ear": "فحص الأذن",
    "data.reason.knee": "متابعة الركبة",
    "data.reason.back": "متابعة الظهر",
    "data.reason.shoulder": "متابعة الكتف",
    "data.reason.wrist": "متابعة الرسغ",
    "data.reason.ankle": "متابعة الكاحل",

    /* --- the allergies chip --- */
    "data.allergy.latex": "اللاتكس",
    "data.allergy.peanuts": "الفول السوداني",
    "data.allergy.dressings": "الضمادات اللاصقة",
    "data.allergy.shellfish": "المحار",
    "data.allergy.stings": "لسع النحل",

    /* --- what the patient told the desk --- */
    "data.desknote.early": "قادم من العمل مباشرة، وقد يصل قبل الموعد بدقائق.",
    "data.desknote.wheelchair": "يستخدم كرسيًا متحركًا. من فضلك احتفظ بالغرفة في الدور الأرضي.",
    "data.desknote.parent": "والدها هو من سيُحضرها.",
  },
} satisfies Record<LocaleTag, Record<string, string>>;
