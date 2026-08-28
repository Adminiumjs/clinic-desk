/**
 * Area bundle: **chrome**.
 *
 * Owns the app shell (`app/App.tsx`), every shared component under
 * `components/`, the zustand store's own copy (toasts, validation), and the
 * `lib/` layer — including the counted-noun strings `lib/format.ts` composes.
 *
 * `en-US` is the source of truth: every key it carries becomes part of
 * `MessageKey`, and `messages/index.ts` makes a missing translation a COMPILE
 * error rather than a silent fallback.
 *
 * Plural keys carry `|`-separated variants in the locale's own CLDR order:
 *   en/de/fr/da  one|other
 *   cs           one|few|other
 *   zh-CN/zh-TW  other        (a single variant — no `|`)
 *   ar-EG        zero|one|two|few|many|other
 *
 * The voice is a good receptionist: warm, unhurried, short sentences, and
 * never a word that belongs in a hospital. The lexicon rules are hard and apply
 * to every locale: invoicing, accounts and payments rather than the b-word for
 * sending someone an invoice; "next steps" and "follow-up" rather than the
 * p-word for a course of treatment, and "policy" or the insurer's own name
 * rather than the p-word for cover; "open slot" and "at no charge" rather than
 * the f-word, which must not appear on its own anywhere; and no
 * product-ladder vocabulary of any kind.
 */
import type { LocaleTag } from "../locales.ts";

const EN = {
  /* --- brand + shell --- */
  "chrome.brand": "Rowan Health",
  "chrome.brand.desk": "Clinic desk",
  "chrome.brand.site": "Neighbourhood practice",
  "chrome.skipToContent": "Skip to content",
  "chrome.menu.open": "Open the menu",
  "chrome.menu.close": "Close the menu",

  /* --- patient search (clinic topbar) --- */
  "chrome.search.label": "Search patients by name",
  "chrome.search.placeholder": "Search patients…",
  "chrome.search.empty": "Nobody matches “{query}”.",
  "chrome.search.patients": "Patients",

  /* --- navigation --- */
  "chrome.nav.daysheet": "Day sheet",
  "chrome.nav.waiting": "Waiting room",
  "chrome.nav.patients": "Patients",
  "chrome.nav.accounts": "Accounts",
  "chrome.nav.recalls": "Recalls",
  "chrome.nav.settings": "Practice settings",
  "chrome.nav.book": "Book",
  "chrome.nav.myvisits": "My visits",
  "chrome.nav.findus": "Find us",

  /* --- demo dock --- */
  "chrome.dock.title": "Demo controls",
  "chrome.dock.persona": "Persona",
  "chrome.dock.patient": "Patient",
  "chrome.dock.clinic": "Clinic",
  "chrome.dock.clock": "Clock",
  "chrome.dock.advance": "+15 min",
  "chrome.dock.advance.label": "Move the demo clock on fifteen minutes",
  "chrome.dock.theme": "Theme",
  "chrome.dock.theme.light": "Switch to the light theme",
  "chrome.dock.theme.dark": "Switch to the dark theme",
  "chrome.dock.language": "Language",
  "chrome.dock.reset": "Reset the demo",
  "chrome.dock.collapse": "Hide the demo controls",
  "chrome.dock.expand": "Show the demo controls",

  /* --- utc notice --- */
  "chrome.utc.notice": "Dates shown in UTC",
  "chrome.utc.why":
    "This connection has no timezone set in Adminium, so dates render in UTC instead of the business's zone.",
  "chrome.zone.notice": "Dates shown in {zone}",
  "chrome.zone.why":
    "This zone came from the server running Adminium, not from anyone here. Confirm it on the connection (Connections → this database) if it is the business's zone.",

  /* --- footer --- */
  "chrome.footer.copy": "© 2026 Rowan Health. A demo clinic desk shipped with Adminium.",
  "chrome.footer.chip": "adminium.dev/demo/clinic-desk",

  /* --- generic actions --- */
  "chrome.action.open": "Open",
  "chrome.action.cancel": "Cancel",
  "chrome.action.close": "Close",
  "chrome.action.back": "Back",
  "chrome.action.done": "Done",
  "chrome.action.confirm": "Confirm",
  "chrome.action.keep": "Keep it",
  "chrome.action.pay": "Pay",
  "chrome.action.more": "More actions",

  /* --- counted nouns lib/format.ts composes --- */
  "chrome.mins": "{count} min|{count} min",
  "chrome.hrs": "{count} hr|{count} hr",
  "chrome.days": "{count} day|{count} days",
  "chrome.years": "{count} year old|{count} years old",
  "chrome.rel.today": "Today",
  "chrome.rel.yesterday": "Yesterday",
  "chrome.rel.tomorrow": "Tomorrow",
  "chrome.rel.daysAgo": "{count} day ago|{count} days ago",
  "chrome.rel.inDays": "in {count} day|in {count} days",

  /* --- the visit state machine, in words --- */
  "chrome.status.booked": "Booked",
  "chrome.status.checked_in": "Checked in",
  "chrome.status.roomed": "Roomed",
  "chrome.status.with_clinician": "With clinician",
  "chrome.status.ready": "Ready to go",
  "chrome.status.done": "Seen",
  "chrome.status.no_show": "Did not arrive",
  "chrome.status.cancelled": "Cancelled",
  "chrome.status.late": "Late cancellation",

  /* --- toasts --- */
  "chrome.toast.dismiss": "Dismiss",
  "chrome.toast.booked": "Booked. Your reference is {ref}.",
  "chrome.toast.paid": "Thank you — {amount} paid.",
  "chrome.toast.atdesk": "Noted. You can settle it when you arrive.",
  "chrome.toast.calendar": "In a real practice this would drop the visit into your calendar.",
  "chrome.toast.checkedIn": "{name} is checked in.",
  "chrome.toast.advanced": "{name}: {status}.",
  "chrome.toast.left": "{name} has left.",
  "chrome.toast.noShow": "{name} marked as did not arrive.",
  "chrome.toast.cancelled": "{ref} cancelled.",
  "chrome.toast.lateCancelled": "{ref} cancelled inside 24 hours.",
  "chrome.toast.payment": "{amount} taken from {name}.",
  "chrome.toast.prefilled": "Day sheet ready for {name}.",
  "chrome.toast.reschedule": "Pick a new time for {name}.",
  "chrome.toast.clock": "The clock now reads {time}.",
  "chrome.toast.reset": "Demo reset to Tuesday, 09:20.",
  "chrome.toast.closureAdded": "Recorded: the practice is shut on {date}.",
} as const satisfies Record<string, string>;

/*
 * The seven translated bundles below are full translations, not spreads: every
 * key English defines is written out in the same order, so a diff between two
 * locales lines up row for row. French carries its typographic apostrophes and
 * the no-break space (` `) that belongs before `:` and inside `« »`.
 * Traditional Chinese is translated from the English, never converted from the
 * Simplified bundle. Proper nouns — Rowan Health, Adminium, the demo URL — are
 * carried through untouched.
 */
export const chrome = {
  "en-US": EN,

  "de-DE": {
    /* --- brand + shell --- */
    "chrome.brand": "Rowan Health",
    "chrome.brand.desk": "Praxisempfang",
    "chrome.brand.site": "Praxis im Viertel",
    "chrome.skipToContent": "Zum Inhalt springen",
    "chrome.menu.open": "Menü öffnen",
    "chrome.menu.close": "Menü schließen",

    /* --- patient search (clinic topbar) --- */
    "chrome.search.label": "Patienten nach Namen suchen",
    "chrome.search.placeholder": "Patienten suchen…",
    "chrome.search.empty": "Zu „{query}“ passt niemand.",
    "chrome.search.patients": "Patienten",

    /* --- navigation --- */
    "chrome.nav.daysheet": "Tagesliste",
    "chrome.nav.waiting": "Wartezimmer",
    "chrome.nav.patients": "Patienten",
    "chrome.nav.accounts": "Konten",
    "chrome.nav.recalls": "Kontrolltermine",
    "chrome.nav.settings": "Praxiseinstellungen",
    "chrome.nav.book": "Termin buchen",
    "chrome.nav.myvisits": "Meine Termine",
    "chrome.nav.findus": "Anfahrt",

    /* --- demo dock --- */
    "chrome.dock.title": "Demo-Steuerung",
    "chrome.dock.persona": "Rolle",
    "chrome.dock.patient": "Patient",
    "chrome.dock.clinic": "Praxis",
    "chrome.dock.clock": "Uhr",
    "chrome.dock.advance": "+15 Min.",
    "chrome.dock.advance.label": "Die Demo-Uhr um fünfzehn Minuten vorstellen",
    "chrome.dock.theme": "Design",
    "chrome.dock.theme.light": "Zum hellen Design wechseln",
    "chrome.dock.theme.dark": "Zum dunklen Design wechseln",
    "chrome.dock.language": "Sprache",
    "chrome.dock.reset": "Demo zurücksetzen",
    "chrome.dock.collapse": "Demo-Steuerung ausblenden",
    "chrome.dock.expand": "Demo-Steuerung einblenden",

    /* --- utc notice --- */
    "chrome.utc.notice": "Datumsangaben in UTC",
    "chrome.utc.why":
      "Für diese Verbindung ist in Adminium keine Zeitzone hinterlegt; Datumsangaben erscheinen daher in UTC statt in der Zeitzone des Unternehmens.",
    "chrome.zone.notice": "Datumsangaben in {zone}",
    "chrome.zone.why":
      "Diese Zeitzone stammt vom Server, auf dem Adminium läuft, und wurde hier von niemandem gewählt. Bestätigen Sie sie an der Verbindung (Verbindungen → diese Datenbank), wenn es die Zeitzone des Unternehmens ist.",

    /* --- footer --- */
    "chrome.footer.copy":
      "© 2026 Rowan Health. Ein Demo-Praxisempfang, der mit Adminium ausgeliefert wird.",
    "chrome.footer.chip": "adminium.dev/demo/clinic-desk",

    /* --- generic actions --- */
    "chrome.action.open": "Öffnen",
    "chrome.action.cancel": "Abbrechen",
    "chrome.action.close": "Schließen",
    "chrome.action.back": "Zurück",
    "chrome.action.done": "Fertig",
    "chrome.action.confirm": "Bestätigen",
    "chrome.action.keep": "Behalten",
    "chrome.action.pay": "Bezahlen",
    "chrome.action.more": "Weitere Aktionen",

    /* --- counted nouns lib/format.ts composes --- */
    "chrome.mins": "{count} Min.|{count} Min.",
    "chrome.hrs": "{count} Std.|{count} Std.",
    "chrome.days": "{count} Tag|{count} Tage",
    "chrome.years": "{count} Jahr|{count} Jahre",
    "chrome.rel.today": "Heute",
    "chrome.rel.yesterday": "Gestern",
    "chrome.rel.tomorrow": "Morgen",
    "chrome.rel.daysAgo": "vor {count} Tag|vor {count} Tagen",
    "chrome.rel.inDays": "in {count} Tag|in {count} Tagen",

    /* --- the visit state machine, in words --- */
    "chrome.status.booked": "Gebucht",
    "chrome.status.checked_in": "Angemeldet",
    "chrome.status.roomed": "Im Zimmer",
    "chrome.status.with_clinician": "In Behandlung",
    "chrome.status.ready": "Kann gehen",
    "chrome.status.done": "Abgeschlossen",
    "chrome.status.no_show": "Nicht erschienen",
    "chrome.status.cancelled": "Abgesagt",
    "chrome.status.late": "Kurzfristig abgesagt",

    /* --- toasts --- */
    "chrome.toast.dismiss": "Ausblenden",
    "chrome.toast.booked": "Gebucht. Ihre Referenz ist {ref}.",
    "chrome.toast.paid": "Vielen Dank — {amount} bezahlt.",
    "chrome.toast.atdesk": "Vermerkt. Sie können bei Ihrer Ankunft bezahlen.",
    "chrome.toast.calendar":
      "In einer echten Praxis würde der Termin jetzt in Ihrem Kalender landen.",
    "chrome.toast.checkedIn": "{name} ist angemeldet.",
    "chrome.toast.advanced": "{name}: {status}.",
    "chrome.toast.left": "{name} hat die Praxis verlassen.",
    "chrome.toast.noShow": "{name} als nicht erschienen vermerkt.",
    "chrome.toast.cancelled": "{ref} wurde abgesagt.",
    "chrome.toast.lateCancelled": "{ref} innerhalb von 24 Stunden abgesagt.",
    "chrome.toast.payment": "{amount} von {name} eingenommen.",
    "chrome.toast.prefilled": "Tagesliste für {name} bereit.",
    "chrome.toast.reschedule": "Neue Uhrzeit für {name} auswählen.",
    "chrome.toast.clock": "Die Uhr zeigt jetzt {time}.",
    "chrome.toast.reset": "Demo auf Dienstag, 09:20 Uhr zurückgesetzt.",
    "chrome.toast.closureAdded": "Eingetragen: Die Praxis ist am {date} geschlossen.",
  },

  "fr-FR": {
    /* --- brand + shell --- */
    "chrome.brand": "Rowan Health",
    "chrome.brand.desk": "Accueil du cabinet",
    "chrome.brand.site": "Cabinet de proximité",
    "chrome.skipToContent": "Aller au contenu",
    "chrome.menu.open": "Ouvrir le menu",
    "chrome.menu.close": "Fermer le menu",

    /* --- patient search (clinic topbar) --- */
    "chrome.search.label": "Rechercher un patient par son nom",
    "chrome.search.placeholder": "Rechercher un patient…",
    "chrome.search.empty": "Personne ne correspond à « {query} ».",
    "chrome.search.patients": "Patients",

    /* --- navigation --- */
    "chrome.nav.daysheet": "Feuille du jour",
    "chrome.nav.waiting": "Salle d’attente",
    "chrome.nav.patients": "Patients",
    "chrome.nav.accounts": "Comptes",
    "chrome.nav.recalls": "Rappels",
    "chrome.nav.settings": "Réglages du cabinet",
    "chrome.nav.book": "Prendre rendez-vous",
    "chrome.nav.myvisits": "Mes rendez-vous",
    "chrome.nav.findus": "Nous trouver",

    /* --- demo dock --- */
    "chrome.dock.title": "Commandes de la démo",
    "chrome.dock.persona": "Rôle",
    "chrome.dock.patient": "Patient",
    "chrome.dock.clinic": "Cabinet",
    "chrome.dock.clock": "Horloge",
    "chrome.dock.advance": "+15 min",
    "chrome.dock.advance.label":
      "Avancer l’horloge de la démo de quinze minutes",
    "chrome.dock.theme": "Thème",
    "chrome.dock.theme.light": "Passer au thème clair",
    "chrome.dock.theme.dark": "Passer au thème sombre",
    "chrome.dock.language": "Langue",
    "chrome.dock.reset": "Réinitialiser la démo",
    "chrome.dock.collapse": "Masquer les commandes de la démo",
    "chrome.dock.expand": "Afficher les commandes de la démo",

    /* --- utc notice --- */
    "chrome.utc.notice": "Dates affichées en UTC",
    "chrome.utc.why":
      "Aucun fuseau horaire n'est défini pour cette connexion dans Adminium ; les dates s'affichent donc en UTC plutôt que dans le fuseau de l'entreprise.",
    "chrome.zone.notice": "Dates affichées en {zone}",
    "chrome.zone.why":
      "Ce fuseau vient du serveur qui exécute Adminium ; personne ne l'a choisi ici. Confirmez-le sur la connexion (Connexions → cette base de données) s'il s'agit du fuseau de l'entreprise.",

    /* --- footer --- */
    "chrome.footer.copy":
      "© 2026 Rowan Health. Un accueil de cabinet en démonstration, livré avec Adminium.",
    "chrome.footer.chip": "adminium.dev/demo/clinic-desk",

    /* --- generic actions --- */
    "chrome.action.open": "Ouvrir",
    "chrome.action.cancel": "Annuler",
    "chrome.action.close": "Fermer",
    "chrome.action.back": "Retour",
    "chrome.action.done": "Terminé",
    "chrome.action.confirm": "Confirmer",
    "chrome.action.keep": "Conserver",
    "chrome.action.pay": "Payer",
    "chrome.action.more": "Autres actions",

    /* --- counted nouns lib/format.ts composes --- */
    "chrome.mins": "{count} min|{count} min",
    "chrome.hrs": "{count} h|{count} h",
    "chrome.days": "{count} jour|{count} jours",
    "chrome.years": "{count} an|{count} ans",
    "chrome.rel.today": "Aujourd’hui",
    "chrome.rel.yesterday": "Hier",
    "chrome.rel.tomorrow": "Demain",
    "chrome.rel.daysAgo": "il y a {count} jour|il y a {count} jours",
    "chrome.rel.inDays": "dans {count} jour|dans {count} jours",

    /* --- the visit state machine, in words --- */
    "chrome.status.booked": "Réservé",
    "chrome.status.checked_in": "Enregistré",
    "chrome.status.roomed": "En salle",
    "chrome.status.with_clinician": "En consultation",
    "chrome.status.ready": "Peut partir",
    "chrome.status.done": "Terminé",
    "chrome.status.no_show": "Absence",
    "chrome.status.cancelled": "Annulé",
    "chrome.status.late": "Annulation tardive",

    /* --- toasts --- */
    "chrome.toast.dismiss": "Fermer",
    "chrome.toast.booked": "C’est réservé. Votre référence est {ref}.",
    "chrome.toast.paid": "Merci — {amount} réglé.",
    "chrome.toast.atdesk": "C’est noté. Vous pourrez régler à votre arrivée.",
    "chrome.toast.calendar":
      "Dans un vrai cabinet, le rendez-vous serait ajouté à votre agenda.",
    "chrome.toast.checkedIn": "Arrivée de {name} enregistrée.",
    "chrome.toast.advanced": "{name} : {status}.",
    "chrome.toast.left": "{name} a quitté le cabinet.",
    "chrome.toast.noShow": "Absence de {name} enregistrée.",
    "chrome.toast.cancelled": "{ref} a été annulé.",
    "chrome.toast.lateCancelled": "{ref} annulé à moins de 24 heures.",
    "chrome.toast.payment": "{amount} encaissé auprès de {name}.",
    "chrome.toast.prefilled": "Feuille du jour prête pour {name}.",
    "chrome.toast.reschedule": "Choisissez un nouvel horaire pour {name}.",
    "chrome.toast.clock": "L’horloge indique maintenant {time}.",
    "chrome.toast.reset": "Démo réinitialisée à mardi, 09:20.",
    "chrome.toast.closureAdded": "Enregistré : le cabinet est fermé le {date}.",
  },

  "cs-CZ": {
    /* --- brand + shell --- */
    "chrome.brand": "Rowan Health",
    "chrome.brand.desk": "Recepce ordinace",
    "chrome.brand.site": "Ordinace v sousedství",
    "chrome.skipToContent": "Přejít k obsahu",
    "chrome.menu.open": "Otevřít nabídku",
    "chrome.menu.close": "Zavřít nabídku",

    /* --- patient search (clinic topbar) --- */
    "chrome.search.label": "Hledat pacienty podle jména",
    "chrome.search.placeholder": "Hledat pacienty…",
    "chrome.search.empty": "Výrazu „{query}“ neodpovídá nikdo.",
    "chrome.search.patients": "Pacienti",

    /* --- navigation --- */
    "chrome.nav.daysheet": "Denní přehled",
    "chrome.nav.waiting": "Čekárna",
    "chrome.nav.patients": "Pacienti",
    "chrome.nav.accounts": "Účty",
    "chrome.nav.recalls": "Kontroly",
    "chrome.nav.settings": "Nastavení ordinace",
    "chrome.nav.book": "Objednat se",
    "chrome.nav.myvisits": "Moje návštěvy",
    "chrome.nav.findus": "Kde nás najdete",

    /* --- demo dock --- */
    "chrome.dock.title": "Ovládání ukázky",
    "chrome.dock.persona": "Role",
    "chrome.dock.patient": "Pacient",
    "chrome.dock.clinic": "Ordinace",
    "chrome.dock.clock": "Hodiny",
    "chrome.dock.advance": "+15 min",
    "chrome.dock.advance.label": "Posunout hodiny ukázky o patnáct minut",
    "chrome.dock.theme": "Motiv",
    "chrome.dock.theme.light": "Přepnout na světlý motiv",
    "chrome.dock.theme.dark": "Přepnout na tmavý motiv",
    "chrome.dock.language": "Jazyk",
    "chrome.dock.reset": "Resetovat ukázku",
    "chrome.dock.collapse": "Skrýt ovládání ukázky",
    "chrome.dock.expand": "Zobrazit ovládání ukázky",

    /* --- utc notice --- */
    "chrome.utc.notice": "Data se zobrazují v UTC",
    "chrome.utc.why":
      "Toto připojení nemá v Adminiu nastavené časové pásmo, data se proto zobrazují v UTC místo v pásmu firmy.",
    "chrome.zone.notice": "Data se zobrazují v {zone}",
    "chrome.zone.why":
      "Toto pásmo pochází ze serveru, na kterém běží Adminium, nikdo je zde nezvolil. Pokud jde o pásmo firmy, potvrďte je u připojení (Připojení → tato databáze).",

    /* --- footer --- */
    "chrome.footer.copy":
      "© 2026 Rowan Health. Ukázková recepce ordinace dodávaná s Adminium.",
    "chrome.footer.chip": "adminium.dev/demo/clinic-desk",

    /* --- generic actions --- */
    "chrome.action.open": "Otevřít",
    "chrome.action.cancel": "Zrušit",
    "chrome.action.close": "Zavřít",
    "chrome.action.back": "Zpět",
    "chrome.action.done": "Hotovo",
    "chrome.action.confirm": "Potvrdit",
    "chrome.action.keep": "Ponechat",
    "chrome.action.pay": "Zaplatit",
    "chrome.action.more": "Další akce",

    /* --- counted nouns lib/format.ts composes --- */
    "chrome.mins": "{count} min|{count} min|{count} min",
    "chrome.hrs": "{count} hod.|{count} hod.|{count} hod.",
    "chrome.days": "{count} den|{count} dny|{count} dní",
    "chrome.years": "{count} rok|{count} roky|{count} let",
    "chrome.rel.today": "Dnes",
    "chrome.rel.yesterday": "Včera",
    "chrome.rel.tomorrow": "Zítra",
    "chrome.rel.daysAgo":
      "před {count} dnem|před {count} dny|před {count} dny",
    "chrome.rel.inDays": "za {count} den|za {count} dny|za {count} dní",

    /* --- the visit state machine, in words --- */
    "chrome.status.booked": "Objednáno",
    "chrome.status.checked_in": "Ohlášeno",
    "chrome.status.roomed": "V ordinaci",
    "chrome.status.with_clinician": "U lékaře",
    "chrome.status.ready": "Může odejít",
    "chrome.status.done": "Vyřízeno",
    "chrome.status.no_show": "Nedostavil(a) se",
    "chrome.status.cancelled": "Zrušeno",
    "chrome.status.late": "Pozdní zrušení",

    /* --- toasts --- */
    "chrome.toast.dismiss": "Zavřít",
    "chrome.toast.booked": "Objednáno. Vaše referenční číslo je {ref}.",
    "chrome.toast.paid": "Děkujeme — {amount} zaplaceno.",
    "chrome.toast.atdesk": "Poznamenáno. Zaplatit můžete při příchodu.",
    "chrome.toast.calendar":
      "Ve skutečné ordinaci by se návštěva teď přidala do vašeho kalendáře.",
    "chrome.toast.checkedIn": "{name} je ohlášen(a).",
    "chrome.toast.advanced": "{name}: {status}.",
    "chrome.toast.left": "{name} už odešel(a).",
    "chrome.toast.noShow": "{name} se nedostavil(a).",
    "chrome.toast.cancelled": "{ref} zrušeno.",
    "chrome.toast.lateCancelled": "{ref} zrušeno méně než 24 hodin předem.",
    "chrome.toast.payment": "Od {name} přijato {amount}.",
    "chrome.toast.prefilled": "Denní přehled pro {name} je připraven.",
    "chrome.toast.reschedule": "Vyberte pro {name} nový čas.",
    "chrome.toast.clock": "Hodiny nyní ukazují {time}.",
    "chrome.toast.reset": "Ukázka resetována na úterý, 9:20.",
    "chrome.toast.closureAdded": "Uloženo: {date} má ordinace zavřeno.",
  },

  "da-DK": {
    /* --- brand + shell --- */
    "chrome.brand": "Rowan Health",
    "chrome.brand.desk": "Klinikreception",
    "chrome.brand.site": "Klinik i nabolaget",
    "chrome.skipToContent": "Gå til indhold",
    "chrome.menu.open": "Åbn menuen",
    "chrome.menu.close": "Luk menuen",

    /* --- patient search (clinic topbar) --- */
    "chrome.search.label": "Søg efter patienter på navn",
    "chrome.search.placeholder": "Søg efter patienter…",
    "chrome.search.empty": "Ingen passer på »{query}«.",
    "chrome.search.patients": "Patienter",

    /* --- navigation --- */
    "chrome.nav.daysheet": "Dagsoversigt",
    "chrome.nav.waiting": "Venteværelse",
    "chrome.nav.patients": "Patienter",
    "chrome.nav.accounts": "Konti",
    "chrome.nav.recalls": "Indkaldelser",
    "chrome.nav.settings": "Klinikkens indstillinger",
    "chrome.nav.book": "Book tid",
    "chrome.nav.myvisits": "Mine besøg",
    "chrome.nav.findus": "Find os",

    /* --- demo dock --- */
    "chrome.dock.title": "Demo-kontroller",
    "chrome.dock.persona": "Rolle",
    "chrome.dock.patient": "Patient",
    "chrome.dock.clinic": "Klinik",
    "chrome.dock.clock": "Ur",
    "chrome.dock.advance": "+15 min",
    "chrome.dock.advance.label": "Ryk demo-uret femten minutter frem",
    "chrome.dock.theme": "Tema",
    "chrome.dock.theme.light": "Skift til lyst tema",
    "chrome.dock.theme.dark": "Skift til mørkt tema",
    "chrome.dock.language": "Sprog",
    "chrome.dock.reset": "Nulstil demoen",
    "chrome.dock.collapse": "Skjul demo-kontrollerne",
    "chrome.dock.expand": "Vis demo-kontrollerne",

    /* --- utc notice --- */
    "chrome.utc.notice": "Datoer vises i UTC",
    "chrome.utc.why":
      "Denne forbindelse har ingen tidszone angivet i Adminium, så datoer vises i UTC i stedet for virksomhedens tidszone.",
    "chrome.zone.notice": "Datoer vises i {zone}",
    "chrome.zone.why":
      "Denne tidszone kom fra serveren, der kører Adminium — ingen her har valgt den. Bekræft den på forbindelsen (Forbindelser → denne database), hvis det er virksomhedens tidszone.",

    /* --- footer --- */
    "chrome.footer.copy":
      "© 2026 Rowan Health. En demo-klinikreception, der følger med Adminium.",
    "chrome.footer.chip": "adminium.dev/demo/clinic-desk",

    /* --- generic actions --- */
    "chrome.action.open": "Åbn",
    "chrome.action.cancel": "Annuller",
    "chrome.action.close": "Luk",
    "chrome.action.back": "Tilbage",
    "chrome.action.done": "Færdig",
    "chrome.action.confirm": "Bekræft",
    "chrome.action.keep": "Behold den",
    "chrome.action.pay": "Betal",
    "chrome.action.more": "Flere handlinger",

    /* --- counted nouns lib/format.ts composes --- */
    "chrome.mins": "{count} min|{count} min",
    "chrome.hrs": "{count} t|{count} t",
    "chrome.days": "{count} dag|{count} dage",
    "chrome.years": "{count} år|{count} år",
    "chrome.rel.today": "I dag",
    "chrome.rel.yesterday": "I går",
    "chrome.rel.tomorrow": "I morgen",
    "chrome.rel.daysAgo": "for {count} dag siden|for {count} dage siden",
    "chrome.rel.inDays": "om {count} dag|om {count} dage",

    /* --- the visit state machine, in words --- */
    "chrome.status.booked": "Booket",
    "chrome.status.checked_in": "Meldt ankommet",
    "chrome.status.roomed": "Vist ind",
    "chrome.status.with_clinician": "Hos behandleren",
    "chrome.status.ready": "Klar til at gå",
    "chrome.status.done": "Afsluttet",
    "chrome.status.no_show": "Udeblevet",
    "chrome.status.cancelled": "Aflyst",
    "chrome.status.late": "Sent afbud",

    /* --- toasts --- */
    "chrome.toast.dismiss": "Luk",
    "chrome.toast.booked": "Booket. Din reference er {ref}.",
    "chrome.toast.paid": "Tak — {amount} betalt.",
    "chrome.toast.atdesk": "Noteret. Du kan betale, når du ankommer.",
    "chrome.toast.calendar":
      "I en rigtig klinik ville besøget nu blive lagt i din kalender.",
    "chrome.toast.checkedIn": "{name} er meldt ankommet.",
    "chrome.toast.advanced": "{name}: {status}.",
    "chrome.toast.left": "{name} er gået.",
    "chrome.toast.noShow": "{name} er registreret som udeblevet.",
    "chrome.toast.cancelled": "{ref} er aflyst.",
    "chrome.toast.lateCancelled": "{ref} aflyst inden for 24 timer.",
    "chrome.toast.payment": "{amount} modtaget fra {name}.",
    "chrome.toast.prefilled": "Dagsoversigten er klar til {name}.",
    "chrome.toast.reschedule": "Vælg et nyt tidspunkt til {name}.",
    "chrome.toast.clock": "Uret viser nu {time}.",
    "chrome.toast.reset": "Demoen er nulstillet til tirsdag kl. 09.20.",
    "chrome.toast.closureAdded": "Registreret: klinikken holder lukket den {date}.",
  },

  "zh-CN": {
    /* --- brand + shell --- */
    "chrome.brand": "Rowan Health",
    "chrome.brand.desk": "诊所前台",
    "chrome.brand.site": "社区诊所",
    "chrome.skipToContent": "跳到主要内容",
    "chrome.menu.open": "打开菜单",
    "chrome.menu.close": "关闭菜单",

    /* --- patient search (clinic topbar) --- */
    "chrome.search.label": "按姓名搜索患者",
    "chrome.search.placeholder": "搜索患者…",
    "chrome.search.empty": "没有人符合“{query}”。",
    "chrome.search.patients": "患者",

    /* --- navigation --- */
    "chrome.nav.daysheet": "今日日程",
    "chrome.nav.waiting": "候诊区",
    "chrome.nav.patients": "患者",
    "chrome.nav.accounts": "账户",
    "chrome.nav.recalls": "复诊提醒",
    "chrome.nav.settings": "诊所设置",
    "chrome.nav.book": "预约",
    "chrome.nav.myvisits": "我的就诊",
    "chrome.nav.findus": "到院路线",

    /* --- demo dock --- */
    "chrome.dock.title": "演示控制",
    "chrome.dock.persona": "身份",
    "chrome.dock.patient": "患者",
    "chrome.dock.clinic": "诊所",
    "chrome.dock.clock": "时钟",
    "chrome.dock.advance": "+15 分钟",
    "chrome.dock.advance.label": "把演示时钟拨快十五分钟",
    "chrome.dock.theme": "主题",
    "chrome.dock.theme.light": "切换到浅色主题",
    "chrome.dock.theme.dark": "切换到深色主题",
    "chrome.dock.language": "语言",
    "chrome.dock.reset": "重置演示",
    "chrome.dock.collapse": "隐藏演示控制",
    "chrome.dock.expand": "显示演示控制",

    /* --- utc notice --- */
    "chrome.utc.notice": "日期以 UTC 显示",
    "chrome.utc.why": "此连接在 Adminium 中未设置时区，日期因此以 UTC 显示，而非商家所在时区。",
    "chrome.zone.notice": "日期以 {zone} 显示",
    "chrome.zone.why":
      "此时区来自运行 Adminium 的服务器，并非有人在此选择。若它确实是该商家的时区，请在连接上确认（连接 → 此数据库）。",

    /* --- footer --- */
    "chrome.footer.copy":
      "© 2026 Rowan Health。随 Adminium 一同提供的诊所前台演示。",
    "chrome.footer.chip": "adminium.dev/demo/clinic-desk",

    /* --- generic actions --- */
    "chrome.action.open": "打开",
    "chrome.action.cancel": "取消",
    "chrome.action.close": "关闭",
    "chrome.action.back": "返回",
    "chrome.action.done": "完成",
    "chrome.action.confirm": "确认",
    "chrome.action.keep": "保留",
    "chrome.action.pay": "支付",
    "chrome.action.more": "更多操作",

    /* --- counted nouns lib/format.ts composes --- */
    "chrome.mins": "{count} 分钟",
    "chrome.hrs": "{count} 小时",
    "chrome.days": "{count} 天",
    "chrome.years": "{count} 岁",
    "chrome.rel.today": "今天",
    "chrome.rel.yesterday": "昨天",
    "chrome.rel.tomorrow": "明天",
    "chrome.rel.daysAgo": "{count} 天前",
    "chrome.rel.inDays": "{count} 天后",

    /* --- the visit state machine, in words --- */
    "chrome.status.booked": "已预约",
    "chrome.status.checked_in": "已报到",
    "chrome.status.roomed": "已入诊室",
    "chrome.status.with_clinician": "就诊中",
    "chrome.status.ready": "可以离开",
    "chrome.status.done": "已完成",
    "chrome.status.no_show": "未到诊",
    "chrome.status.cancelled": "已取消",
    "chrome.status.late": "临时取消",

    /* --- toasts --- */
    "chrome.toast.dismiss": "关闭",
    "chrome.toast.booked": "已预约。您的预约编号是 {ref}。",
    "chrome.toast.paid": "谢谢，已支付 {amount}。",
    "chrome.toast.atdesk": "已记下。您可以到院时再付。",
    "chrome.toast.calendar": "在真实的诊所里，这次就诊会被加入您的日历。",
    "chrome.toast.checkedIn": "{name} 已报到。",
    "chrome.toast.advanced": "{name}：{status}。",
    "chrome.toast.left": "{name} 已离开。",
    "chrome.toast.noShow": "{name} 已标记为未到诊。",
    "chrome.toast.cancelled": "{ref} 已取消。",
    "chrome.toast.lateCancelled": "{ref} 在 24 小时内取消。",
    "chrome.toast.payment": "已向 {name} 收取 {amount}。",
    "chrome.toast.prefilled": "{name} 的今日日程已就绪。",
    "chrome.toast.reschedule": "为 {name} 选择新的时间。",
    "chrome.toast.clock": "时钟现在显示 {time}。",
    "chrome.toast.reset": "演示已重置为周二 09:20。",
    "chrome.toast.closureAdded": "已记录：{date} 诊所休诊。",
  },

  "zh-TW": {
    /* --- brand + shell --- */
    "chrome.brand": "Rowan Health",
    "chrome.brand.desk": "診所櫃台",
    "chrome.brand.site": "社區診所",
    "chrome.skipToContent": "跳至主要內容",
    "chrome.menu.open": "開啟選單",
    "chrome.menu.close": "關閉選單",

    /* --- patient search (clinic topbar) --- */
    "chrome.search.label": "依姓名搜尋病患",
    "chrome.search.placeholder": "搜尋病患…",
    "chrome.search.empty": "找不到符合「{query}」的人。",
    "chrome.search.patients": "病患",

    /* --- navigation --- */
    "chrome.nav.daysheet": "今日行程",
    "chrome.nav.waiting": "候診區",
    "chrome.nav.patients": "病患",
    "chrome.nav.accounts": "帳戶",
    "chrome.nav.recalls": "回診提醒",
    "chrome.nav.settings": "診所設定",
    "chrome.nav.book": "預約",
    "chrome.nav.myvisits": "我的就診",
    "chrome.nav.findus": "如何前往",

    /* --- demo dock --- */
    "chrome.dock.title": "示範控制",
    "chrome.dock.persona": "身分",
    "chrome.dock.patient": "病患",
    "chrome.dock.clinic": "診所",
    "chrome.dock.clock": "時鐘",
    "chrome.dock.advance": "+15 分鐘",
    "chrome.dock.advance.label": "將示範時鐘往前調十五分鐘",
    "chrome.dock.theme": "佈景主題",
    "chrome.dock.theme.light": "切換為淺色佈景主題",
    "chrome.dock.theme.dark": "切換為深色佈景主題",
    "chrome.dock.language": "語言",
    "chrome.dock.reset": "重設示範",
    "chrome.dock.collapse": "隱藏示範控制",
    "chrome.dock.expand": "顯示示範控制",

    /* --- utc notice --- */
    "chrome.utc.notice": "日期以 UTC 顯示",
    "chrome.utc.why": "此連線在 Adminium 中未設定時區，日期因此以 UTC 顯示，而非商家所在時區。",
    "chrome.zone.notice": "日期以 {zone} 顯示",
    "chrome.zone.why":
      "此時區來自執行 Adminium 的伺服器，並非有人在此選擇。若它確實是該商家的時區，請在連線上確認（連線 → 此資料庫）。",

    /* --- footer --- */
    "chrome.footer.copy":
      "© 2026 Rowan Health。隨 Adminium 一同提供的診所櫃台示範。",
    "chrome.footer.chip": "adminium.dev/demo/clinic-desk",

    /* --- generic actions --- */
    "chrome.action.open": "開啟",
    "chrome.action.cancel": "取消",
    "chrome.action.close": "關閉",
    "chrome.action.back": "返回",
    "chrome.action.done": "完成",
    "chrome.action.confirm": "確認",
    "chrome.action.keep": "保留",
    "chrome.action.pay": "付款",
    "chrome.action.more": "更多操作",

    /* --- counted nouns lib/format.ts composes --- */
    "chrome.mins": "{count} 分鐘",
    "chrome.hrs": "{count} 小時",
    "chrome.days": "{count} 天",
    "chrome.years": "{count} 歲",
    "chrome.rel.today": "今天",
    "chrome.rel.yesterday": "昨天",
    "chrome.rel.tomorrow": "明天",
    "chrome.rel.daysAgo": "{count} 天前",
    "chrome.rel.inDays": "{count} 天後",

    /* --- the visit state machine, in words --- */
    "chrome.status.booked": "已預約",
    "chrome.status.checked_in": "已報到",
    "chrome.status.roomed": "已進診間",
    "chrome.status.with_clinician": "看診中",
    "chrome.status.ready": "可以離開",
    "chrome.status.done": "已看診",
    "chrome.status.no_show": "未到診",
    "chrome.status.cancelled": "已取消",
    "chrome.status.late": "臨時取消",

    /* --- toasts --- */
    "chrome.toast.dismiss": "關閉",
    "chrome.toast.booked": "已預約。您的預約編號是 {ref}。",
    "chrome.toast.paid": "謝謝，已付款 {amount}。",
    "chrome.toast.atdesk": "已記下。您可以到診時再付款。",
    "chrome.toast.calendar": "在真實的診所裡，這次就診會加入您的行事曆。",
    "chrome.toast.checkedIn": "{name} 已報到。",
    "chrome.toast.advanced": "{name}：{status}。",
    "chrome.toast.left": "{name} 已離開。",
    "chrome.toast.noShow": "{name} 已標記為未到診。",
    "chrome.toast.cancelled": "{ref} 已取消。",
    "chrome.toast.lateCancelled": "{ref} 在 24 小時內取消。",
    "chrome.toast.payment": "已向 {name} 收取 {amount}。",
    "chrome.toast.prefilled": "{name} 的今日行程已就緒。",
    "chrome.toast.reschedule": "為 {name} 選擇新的時間。",
    "chrome.toast.clock": "時鐘現在顯示 {time}。",
    "chrome.toast.reset": "示範已重設為週二 09:20。",
    "chrome.toast.closureAdded": "已記錄：{date} 診所休診。",
  },

  "ar-EG": {
    /* --- brand + shell --- */
    "chrome.brand": "Rowan Health",
    "chrome.brand.desk": "استقبال العيادة",
    "chrome.brand.site": "عيادة الحي",
    "chrome.skipToContent": "انتقل إلى المحتوى",
    "chrome.menu.open": "افتح القائمة",
    "chrome.menu.close": "أغلق القائمة",

    /* --- patient search (clinic topbar) --- */
    "chrome.search.label": "ابحث عن المرضى بالاسم",
    "chrome.search.placeholder": "ابحث عن مريض…",
    "chrome.search.empty": "لا يوجد أحد يطابق «{query}».",
    "chrome.search.patients": "المرضى",

    /* --- navigation --- */
    "chrome.nav.daysheet": "جدول اليوم",
    "chrome.nav.waiting": "غرفة الانتظار",
    "chrome.nav.patients": "المرضى",
    "chrome.nav.accounts": "الحسابات",
    "chrome.nav.recalls": "المتابعات",
    "chrome.nav.settings": "إعدادات العيادة",
    "chrome.nav.book": "احجز موعدًا",
    "chrome.nav.myvisits": "زياراتي",
    "chrome.nav.findus": "مكان العيادة",

    /* --- demo dock --- */
    "chrome.dock.title": "أدوات العرض التجريبي",
    "chrome.dock.persona": "الدور",
    "chrome.dock.patient": "مريض",
    "chrome.dock.clinic": "العيادة",
    "chrome.dock.clock": "الساعة",
    "chrome.dock.advance": "+15 دقيقة",
    "chrome.dock.advance.label": "قدِّم ساعة العرض خمس عشرة دقيقة",
    "chrome.dock.theme": "المظهر",
    "chrome.dock.theme.light": "التبديل إلى المظهر الفاتح",
    "chrome.dock.theme.dark": "التبديل إلى المظهر الداكن",
    "chrome.dock.language": "اللغة",
    "chrome.dock.reset": "إعادة ضبط العرض",
    "chrome.dock.collapse": "إخفاء أدوات العرض",
    "chrome.dock.expand": "إظهار أدوات العرض",

    /* --- utc notice --- */
    "chrome.utc.notice": "التواريخ معروضة بتوقيت UTC",
    "chrome.utc.why":
      "لا توجد منطقة زمنية محدّدة لهذا الاتصال في Adminium، لذا تُعرض التواريخ بتوقيت UTC بدلاً من المنطقة الزمنية للنشاط التجاري.",
    "chrome.zone.notice": "التواريخ معروضة بتوقيت {zone}",
    "chrome.zone.why":
      "جاءت هذه المنطقة الزمنية من الخادم الذي يشغّل Adminium ، ولم يخترها أحد هنا. أكّدها على الاتصال (الاتصالات → هذه قاعدة البيانات) إذا كانت منطقة النشاط التجاري.",

    /* --- footer --- */
    "chrome.footer.copy":
      "© 2026 Rowan Health. استقبال عيادة تجريبي يأتي مع Adminium.",
    "chrome.footer.chip": "adminium.dev/demo/clinic-desk",

    /* --- generic actions --- */
    "chrome.action.open": "فتح",
    "chrome.action.cancel": "إلغاء",
    "chrome.action.close": "إغلاق",
    "chrome.action.back": "رجوع",
    "chrome.action.done": "تم",
    "chrome.action.confirm": "تأكيد",
    "chrome.action.keep": "احتفظ به",
    "chrome.action.pay": "ادفع",
    "chrome.action.more": "إجراءات أخرى",

    /* --- counted nouns lib/format.ts composes --- */
    "chrome.mins":
      "{count} دقيقة|دقيقة واحدة|دقيقتان|{count} دقائق|{count} دقيقة|{count} دقيقة",
    "chrome.hrs":
      "{count} ساعة|ساعة واحدة|ساعتان|{count} ساعات|{count} ساعة|{count} ساعة",
    "chrome.days":
      "{count} يوم|يوم واحد|يومان|{count} أيام|{count} يومًا|{count} يوم",
    "chrome.years":
      "{count} سنة|سنة واحدة|سنتان|{count} سنوات|{count} سنة|{count} سنة",
    "chrome.rel.today": "اليوم",
    "chrome.rel.yesterday": "أمس",
    "chrome.rel.tomorrow": "غدًا",
    "chrome.rel.daysAgo":
      "منذ {count} يوم|منذ يوم واحد|منذ يومين|منذ {count} أيام|منذ {count} يومًا|منذ {count} يوم",
    "chrome.rel.inDays":
      "بعد {count} يوم|بعد يوم واحد|بعد يومين|بعد {count} أيام|بعد {count} يومًا|بعد {count} يوم",

    /* --- the visit state machine, in words --- */
    "chrome.status.booked": "محجوز",
    "chrome.status.checked_in": "تم التسجيل",
    "chrome.status.roomed": "في الغرفة",
    "chrome.status.with_clinician": "مع الطبيب",
    "chrome.status.ready": "جاهز للمغادرة",
    "chrome.status.done": "انتهت الزيارة",
    "chrome.status.no_show": "لم يحضر",
    "chrome.status.cancelled": "ملغى",
    "chrome.status.late": "إلغاء متأخر",

    /* --- toasts --- */
    "chrome.toast.dismiss": "إغلاق",
    "chrome.toast.booked": "تم الحجز. رقم حجزك هو {ref}.",
    "chrome.toast.paid": "شكرًا لك — تم دفع {amount}.",
    "chrome.toast.atdesk": "تم التسجيل. يمكنك الدفع عند وصولك.",
    "chrome.toast.calendar":
      "في عيادة حقيقية، كانت الزيارة ستُضاف إلى تقويمك.",
    "chrome.toast.checkedIn": "تم تسجيل حضور {name}.",
    "chrome.toast.advanced": "{name}: {status}.",
    "chrome.toast.left": "تم تسجيل مغادرة {name}.",
    "chrome.toast.noShow": "تم تسجيل {name} كمتغيّب.",
    "chrome.toast.cancelled": "تم إلغاء {ref}.",
    "chrome.toast.lateCancelled": "تم إلغاء {ref} خلال أقل من 24 ساعة.",
    "chrome.toast.payment": "تم تحصيل {amount} من {name}.",
    "chrome.toast.prefilled": "جدول اليوم جاهز لـ {name}.",
    "chrome.toast.reschedule": "اختر موعدًا جديدًا لـ {name}.",
    "chrome.toast.clock": "الساعة الآن {time}.",
    "chrome.toast.reset": "تمت إعادة ضبط العرض إلى الثلاثاء، 09:20.",
    "chrome.toast.closureAdded": "تم التسجيل: العيادة مغلقة في {date}.",
  },
} satisfies Record<LocaleTag, Record<string, string>>;
