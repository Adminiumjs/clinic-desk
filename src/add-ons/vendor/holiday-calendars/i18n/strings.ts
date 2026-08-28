/*
 * VENDORED from add-ons/packages/holiday-calendars/src/i18n/strings.ts — synced by scripts/sync-add-ons.sh.
 * Never hand-edit this copy: edit the monorepo and re-run `sync-add-ons.sh sync`.
 * The add-on key is `holiday-calendars`; its manifest, tests and README live in the monorepo.
 */
/**
 * Every user-visible string this add-on has, in all eight locales.
 *
 * Same nested shape as every other add-on here — `{ locale: { key: value } }` —
 * because the host merges these into its own bundle and types the key union off
 * English. A locale missing a key is a COMPILE error at the foot of this file,
 * not a runtime fallback.
 *
 * Keys are namespaced under `addon.holiday-calendars.*`. Every add-on's strings
 * land in one flat bundle with the host's, so a bare `pick.year` would be a
 * collision waiting for the second calendar.
 *
 * ── WHAT IS *NOT* IN HERE, AND IT IS THE PRODUCT ────────────────────────────
 *
 * The holidays' own names. `Tag der Deutschen Einheit`, `Velký pátek`,
 * `Thanksgiving Day` and the other sixty are DATA and live in `daysets.ts`, in
 * the language of the country whose holiday it is. `daysets.ts` sets out the
 * whole argument beside the `NamedDay` type; the short version is that a
 * holiday's name is a proper noun belonging to a country, translating it
 * renames it rather than localising it, and `people-ops` resolves such a name
 * through `label()` — which falls back to the raw string — so a literal arrives
 * on that app's calendar with nothing added to any bundle.
 *
 * What IS in here is everything this add-on says ABOUT those days: the areas'
 * names as a picker lists them, what each set does and does not cover, which
 * countries have no set and why, the refusal, and who keeps the data current.
 *
 * ── A NOTE FOR TRANSLATORS, AND IT IS NOT OPTIONAL ──────────────────────────
 *
 * The English avoids a short list of commercial words on purpose. The list is
 * not spelled out here — it lives in `testing/lexicon.ts` as the guard that
 * fails the build when one of them appears, so there is one copy of it and it
 * is an executable one rather than a comment that drifts.
 *
 * Please keep the equivalent restraint in your language rather than reaching
 * for the marketing word, and where your language's natural term happens to
 * contain one of the forbidden English fragments as a substring, prefer the
 * plainer phrase — the release check reads bytes, not meaning, so an innocent
 * word with an unlucky spelling still trips it. Czech is the hardest case in
 * this bundle: the ordinary preposition `pro` is one of the banned runs, so the
 * Czech copy is written with `na`, `kvůli` and `jelikož` instead.
 *
 * ── AND ONE RULE THAT IS THIS ADD-ON'S OWN ──────────────────────────────────
 *
 * Nothing here may state or imply that a day-set is COMPLETE for a country when
 * it is not. Every `note.*` string says what its set leaves out, and a
 * translation that dropped that clause because it read as an apology would be
 * turning a limit somebody can work around into a false claim. That is the one
 * sentence in each of these six notes that has to survive translation intact.
 */

export const strings = {
  "en-US": {
    // ── host chrome this add-on owns ──────────────────────────────────────
    "addon.holiday-calendars.line": "Checked public-holiday day-sets for a handful of countries, carried inside the add-on. Choose a country and a year, look at the days, and import them.",
    "addon.holiday-calendars.what": "This gives the business a checked list of public holidays for the countries it works in, so leave balances and closed days come off one calendar instead of somebody typing dates in twice a year. Nothing is fetched from anywhere: the day-sets are data inside the add-on.",
    "addon.holiday-calendars.disconnect.goes": "The country picker and the import button go, and so does the panel they sit in.",
    "addon.holiday-calendars.disconnect.stays": "Every day already imported stays exactly where it is, and so does every day written in here by hand. The list belongs to the business; this add-on only helps fill it.",
    "addon.holiday-calendars.noCompany": "Holiday Calendars connects to no outside company. It needs no account anywhere, it calls nothing, and every day it knows about is already in the add-on.",
    "addon.holiday-calendars.act.1": "{when} · a year of holidays imported",
    "addon.holiday-calendars.act.2": "{when} · a day of the business's own written in",

    // ── the settings the manifest declares ────────────────────────────────
    "addon.holiday-calendars.setting.days": "Days the business is closed",
    "addon.holiday-calendars.setting.daysHint": "Edited in this add-on's own panel below, where the days can be looked at before they are taken.",

    // ── the areas, as the picker lists them ───────────────────────────────
    "addon.holiday-calendars.area.us": "United States",
    "addon.holiday-calendars.area.de": "Germany",
    "addon.holiday-calendars.area.fr": "France",
    "addon.holiday-calendars.area.fr-alsace-moselle": "France — Alsace-Moselle",
    "addon.holiday-calendars.area.cz": "Czechia",
    "addon.holiday-calendars.area.dk": "Denmark",
    "addon.holiday-calendars.area.cn": "China",
    "addon.holiday-calendars.area.tw": "Taiwan",
    "addon.holiday-calendars.area.eg": "Egypt",

    // ── what each set covers, and what it leaves out ──────────────────────
    "addon.holiday-calendars.note.us": "The eleven federal holidays. Individual states add their own, and many employers close on days that are not on this list.",
    "addon.holiday-calendars.note.de": "The nine days that are holidays in every German state. Ten of the sixteen states add more, several of them differing from one town to the next, and none of those are here.",
    "addon.holiday-calendars.note.fr": "The eleven days named in the labour code, as they stand across most of the country.",
    "addon.holiday-calendars.note.fr-alsace-moselle": "The eleven national days, and the two more kept in Bas-Rhin, Haut-Rhin and Moselle: Good Friday, and 26 December.",
    "addon.holiday-calendars.note.cz": "The state holidays and the other holidays, thirteen in all, as the act lists them.",
    "addon.holiday-calendars.note.dk": "The ten Danish church holidays. Great Prayer Day is not among them — it stopped being one in 2024. Christmas Eve and New Year's Eve are ordinary working days in law, whatever a workplace does about them.",

    // ── where each set came from ──────────────────────────────────────────
    "addon.holiday-calendars.from.us": "Taken from the federal holiday statute, weekday rules and all.",
    "addon.holiday-calendars.from.de": "Taken from the sixteen state holiday acts, reduced to the days common to every one of them.",
    "addon.holiday-calendars.from.fr": "Taken from article L3133-1 of the labour code.",
    "addon.holiday-calendars.from.fr-alsace-moselle": "Taken from the labour code, and from the local law that keeps two further days in the three départements.",
    "addon.holiday-calendars.from.cz": "Taken from the Czech act on state holidays and other holidays.",
    "addon.holiday-calendars.from.dk": "Taken from the Danish church holidays, as they stand after the 2024 change.",

    // ── the countries this add-on refuses to guess ────────────────────────
    "addon.holiday-calendars.announced.title": "Countries with no set here",
    "addon.holiday-calendars.announced.lead": "These countries have no calendar anybody can work out in advance. Their governments announce one, year by year. A guessed list would look exactly like a checked one once it was on a rota, so there is none.",
    "addon.holiday-calendars.announced.cn": "The State Council publishes each year's arrangement in the autumn, together with the weekends that are worked to bridge the breaks.",
    "addon.holiday-calendars.announced.tw": "The calendar is published a year at a time, with its make-up days and its shifted weekends.",
    "addon.holiday-calendars.announced.eg": "Islamic dates follow the moon and are settled by sighting, and several national days are moved to the nearest Thursday by decree each year.",

    // ── the picker ────────────────────────────────────────────────────────
    "addon.holiday-calendars.pick.area": "Country or area",
    "addon.holiday-calendars.pick.year": "Year",
    "addon.holiday-calendars.pick.preview": "{count} days",
    "addon.holiday-calendars.pick.import": "Import this year",
    "addon.holiday-calendars.pick.reviewed": "Last checked {date}.",
    "addon.holiday-calendars.pick.noSubstitutes": "Where a day falls at the weekend nothing extra is added. Whether the business moves the day off is the business's decision, not the state's.",

    // ── what is held now ──────────────────────────────────────────────────
    "addon.holiday-calendars.held.title": "Days the business is closed",
    "addon.holiday-calendars.held.none": "Nothing yet. Choose a country and a year above, look at what would arrive, and take it.",
    "addon.holiday-calendars.held.own": "Written in here",
    "addon.holiday-calendars.held.remove": "Remove",
    "addon.holiday-calendars.held.removeSet": "Remove this year",

    // ── the refusal ───────────────────────────────────────────────────────
    "addon.holiday-calendars.refuse.title": "Some of these days are already written in by hand",
    "addon.holiday-calendars.refuse.body": "Nothing was taken. Each day below falls on a date somebody here has already written down, and this add-on will not decide which of the two names a rota should show. Remove the hand-written one and import again, or keep it and leave this year out.",
    "addon.holiday-calendars.refuse.row": "{date} — written in here: {yours} · in this set: {theirs}",

    // ── what an import did ────────────────────────────────────────────────
    "addon.holiday-calendars.done.added": "{count} days taken.",
    "addon.holiday-calendars.done.replaced": "{count} days taken, over the top of what this year held before. Nothing written in by hand was touched.",

    // ── a day of the business's own ──────────────────────────────────────
    "addon.holiday-calendars.own.title": "A day of the business's own",
    "addon.holiday-calendars.own.note": "A business closes for reasons no country decrees — a stocktake, a move, a training afternoon. Days written in here sit beside the imported ones, and no import ever removes them.",
    "addon.holiday-calendars.own.date": "Date",
    "addon.holiday-calendars.own.name": "What to call it",
    "addon.holiday-calendars.own.add": "Write it in",
    "addon.holiday-calendars.own.badDate": "That is not a date on the calendar.",
    "addon.holiday-calendars.own.badName": "Give the day a name, so whoever reads the rota knows why it is shut.",
    "addon.holiday-calendars.own.duplicate": "A day of the business's own is already written in on that date.",

    // ── who keeps this current ────────────────────────────────────────────
    "addon.holiday-calendars.maint.owner": "the Adminium add-ons maintainers",
    "addon.holiday-calendars.maint.line": "Kept by {owner}. Last read through on {last}; the next yearly read is due {next}.",
    "addon.holiday-calendars.maint.corrections": "A date wrong? Open an issue on the add-ons repository and it will be put right.",
  },

  "de-DE": {
    "addon.holiday-calendars.line": "Geprüfte Feiertagslisten für einige Länder, direkt im Add-on mitgeliefert. Land und Jahr auswählen, die Tage ansehen, übernehmen.",
    "addon.holiday-calendars.what": "Damit hat der Betrieb eine geprüfte Liste der gesetzlichen Feiertage der Länder, in denen er arbeitet — Urlaubskonten und Schließtage kommen aus demselben Kalender, statt zweimal jährlich von Hand eingetippt zu werden. Es wird nichts abgerufen: die Tage liegen als Daten im Add-on.",
    "addon.holiday-calendars.disconnect.goes": "Die Länderauswahl und die Übernahme-Schaltfläche verschwinden, und mit ihnen die Seite, auf der sie stehen.",
    "addon.holiday-calendars.disconnect.stays": "Jeder bereits übernommene Tag bleibt genau da, wo er ist, ebenso jeder von Hand eingetragene. Die Liste gehört dem Betrieb; das Add-on hilft nur beim Füllen.",
    "addon.holiday-calendars.noCompany": "Holiday Calendars verbindet sich mit keinem fremden Unternehmen. Es braucht nirgends ein Konto, es ruft nichts auf, und jeder Tag, den es kennt, steckt bereits im Add-on.",
    "addon.holiday-calendars.act.1": "{when} · ein Jahr Feiertage übernommen",
    "addon.holiday-calendars.act.2": "{when} · einen eigenen Tag des Betriebs eingetragen",

    "addon.holiday-calendars.setting.days": "Tage, an denen der Betrieb zu ist",
    "addon.holiday-calendars.setting.daysHint": "Wird unten im eigenen Bereich des Add-ons gepflegt, wo sich die Tage vor der Übernahme ansehen lassen.",

    "addon.holiday-calendars.area.us": "Vereinigte Staaten",
    "addon.holiday-calendars.area.de": "Deutschland",
    "addon.holiday-calendars.area.fr": "Frankreich",
    "addon.holiday-calendars.area.fr-alsace-moselle": "Frankreich — Elsass-Mosel",
    "addon.holiday-calendars.area.cz": "Tschechien",
    "addon.holiday-calendars.area.dk": "Dänemark",
    "addon.holiday-calendars.area.cn": "China",
    "addon.holiday-calendars.area.tw": "Taiwan",
    "addon.holiday-calendars.area.eg": "Ägypten",

    "addon.holiday-calendars.note.us": "Die elf bundesweiten Feiertage. Einzelne Bundesstaaten haben eigene, und viele Arbeitgeber schließen an Tagen, die hier nicht stehen.",
    "addon.holiday-calendars.note.de": "Die neun Tage, die in jedem Bundesland Feiertag sind. Zehn der sechzehn Länder haben weitere, manche davon von Ort zu Ort verschieden, und keiner davon steht hier.",
    "addon.holiday-calendars.note.fr": "Die elf im Arbeitsgesetzbuch genannten Tage, so wie sie im größten Teil des Landes gelten.",
    "addon.holiday-calendars.note.fr-alsace-moselle": "Die elf landesweiten Tage und die zwei weiteren, die im Elsass und im Departement Mosel gelten: Karfreitag und der 26. Dezember.",
    "addon.holiday-calendars.note.cz": "Die staatlichen und die übrigen Feiertage, dreizehn an der Zahl, so wie das Gesetz sie aufzählt.",
    "addon.holiday-calendars.note.dk": "Die zehn dänischen kirchlichen Feiertage. Der große Bettag gehört nicht dazu — er ist seit 2024 keiner mehr. Heiligabend und Silvester sind rechtlich gewöhnliche Arbeitstage, was auch immer ein Betrieb daraus macht.",

    "addon.holiday-calendars.from.us": "Aus dem Bundesfeiertagsgesetz übernommen, samt seiner Wochentagsregeln.",
    "addon.holiday-calendars.from.de": "Aus den sechzehn Feiertagsgesetzen der Länder übernommen, zusammengezogen auf die Tage, die in allen gelten.",
    "addon.holiday-calendars.from.fr": "Aus Artikel L3133-1 des französischen Arbeitsgesetzbuchs übernommen.",
    "addon.holiday-calendars.from.fr-alsace-moselle": "Aus dem Arbeitsgesetzbuch übernommen und aus dem örtlichen Recht, das in den drei Departements zwei weitere Tage erhält.",
    "addon.holiday-calendars.from.cz": "Aus dem tschechischen Gesetz über die staatlichen und die übrigen Feiertage übernommen.",
    "addon.holiday-calendars.from.dk": "Aus den dänischen kirchlichen Feiertagen übernommen, so wie sie nach der Änderung von 2024 gelten.",

    "addon.holiday-calendars.announced.title": "Länder ohne Liste",
    "addon.holiday-calendars.announced.lead": "Diese Länder haben keinen Kalender, den sich jemand im Voraus ausrechnen könnte. Ihre Regierungen geben ihn Jahr für Jahr bekannt. Eine geratene Liste sähe auf der Schichtliste genauso aus wie eine geprüfte, also gibt es keine.",
    "addon.holiday-calendars.announced.cn": "Der Staatsrat gibt die Regelung des kommenden Jahres im Herbst bekannt, samt der Wochenenden, an denen zum Ausgleich gearbeitet wird.",
    "addon.holiday-calendars.announced.tw": "Der Kalender erscheint jahrweise, mit seinen Ersatztagen und seinen verschobenen Wochenenden.",
    "addon.holiday-calendars.announced.eg": "Die islamischen Termine richten sich nach dem Mond und werden durch Sichtung festgestellt, und mehrere staatliche Tage werden jedes Jahr per Erlass auf den nächsten Donnerstag gelegt.",

    "addon.holiday-calendars.pick.area": "Land oder Gebiet",
    "addon.holiday-calendars.pick.year": "Jahr",
    "addon.holiday-calendars.pick.preview": "{count} Tage",
    "addon.holiday-calendars.pick.import": "Dieses Jahr übernehmen",
    "addon.holiday-calendars.pick.reviewed": "Zuletzt geprüft am {date}.",
    "addon.holiday-calendars.pick.noSubstitutes": "Fällt ein Tag auf ein Wochenende, kommt nichts hinzu. Ob der Betrieb den freien Tag verschiebt, entscheidet der Betrieb und nicht der Staat.",

    "addon.holiday-calendars.held.title": "Tage, an denen der Betrieb zu ist",
    "addon.holiday-calendars.held.none": "Noch nichts. Wählen Sie oben Land und Jahr, sehen Sie sich an, was käme, und übernehmen Sie es.",
    "addon.holiday-calendars.held.own": "Hier eingetragen",
    "addon.holiday-calendars.held.remove": "Entfernen",
    "addon.holiday-calendars.held.removeSet": "Dieses Jahr entfernen",

    "addon.holiday-calendars.refuse.title": "Einige dieser Tage stehen schon von Hand in der Liste",
    "addon.holiday-calendars.refuse.body": "Es wurde nichts übernommen. Jeder Tag unten fällt auf ein Datum, das hier jemand bereits eingetragen hat, und dieses Add-on entscheidet nicht, welcher der beiden Namen auf der Schichtliste stehen soll. Entfernen Sie den handschriftlichen Eintrag und übernehmen Sie erneut, oder behalten Sie ihn und lassen Sie dieses Jahr aus.",
    "addon.holiday-calendars.refuse.row": "{date} — hier eingetragen: {yours} · in dieser Liste: {theirs}",

    "addon.holiday-calendars.done.added": "{count} Tage übernommen.",
    "addon.holiday-calendars.done.replaced": "{count} Tage übernommen, über das gelegt, was dieses Jahr vorher enthielt. An den von Hand eingetragenen Tagen wurde nichts angerührt.",

    "addon.holiday-calendars.own.title": "Ein eigener Tag des Betriebs",
    "addon.holiday-calendars.own.note": "Ein Betrieb schließt aus Gründen, die kein Staat verordnet — Inventur, Umzug, ein Schulungsnachmittag. Hier eingetragene Tage stehen neben den übernommenen, und keine Übernahme entfernt sie je.",
    "addon.holiday-calendars.own.date": "Datum",
    "addon.holiday-calendars.own.name": "Wie er heißen soll",
    "addon.holiday-calendars.own.add": "Eintragen",
    "addon.holiday-calendars.own.badDate": "Dieses Datum gibt es im Kalender nicht.",
    "addon.holiday-calendars.own.badName": "Geben Sie dem Tag einen Namen, damit auf der Schichtliste steht, warum zu ist.",
    "addon.holiday-calendars.own.duplicate": "An diesem Datum steht bereits ein eigener Tag des Betriebs.",

    "addon.holiday-calendars.maint.owner": "die Add-on-Betreuer von Adminium",
    "addon.holiday-calendars.maint.line": "Betreut durch {owner}. Zuletzt durchgesehen am {last}; die nächste jährliche Durchsicht steht am {next} an.",
    "addon.holiday-calendars.maint.corrections": "Ein Datum falsch? Melden Sie es im Add-on-Repository, dann wird es berichtigt.",
  },

  "fr-FR": {
    "addon.holiday-calendars.line": "Des listes de jours fériés vérifiées, pour quelques pays, embarquées dans l'add-on. Choisissez un pays et une année, regardez les jours, reprenez-les.",
    "addon.holiday-calendars.what": "L'établissement dispose ainsi d'une liste vérifiée des jours fériés des pays où il travaille : les soldes de congés et les jours de fermeture sortent du même calendrier au lieu d'être saisis à la main deux fois par an. Rien n'est téléchargé : les jours sont des données à l'intérieur de l'add-on.",
    "addon.holiday-calendars.disconnect.goes": "Le sélecteur de pays et le bouton de reprise disparaissent, ainsi que le panneau qui les porte.",
    "addon.holiday-calendars.disconnect.stays": "Chaque jour déjà repris reste exactement où il est, et chaque jour saisi ici à la main aussi. La liste appartient à l'établissement ; l'add-on aide seulement à la remplir.",
    "addon.holiday-calendars.noCompany": "Holiday Calendars ne se connecte à aucune société extérieure. Il n'a besoin d'aucun compte nulle part, il n'appelle rien, et chaque jour qu'il connaît est déjà dans l'add-on.",
    "addon.holiday-calendars.act.1": "{when} · une année de jours fériés reprise",
    "addon.holiday-calendars.act.2": "{when} · un jour à nous saisi",

    "addon.holiday-calendars.setting.days": "Jours de fermeture de l'établissement",
    "addon.holiday-calendars.setting.daysHint": "Se règle plus bas, dans le panneau de l'add-on, où les jours se regardent avant d'être repris.",

    "addon.holiday-calendars.area.us": "États-Unis",
    "addon.holiday-calendars.area.de": "Allemagne",
    "addon.holiday-calendars.area.fr": "France",
    "addon.holiday-calendars.area.fr-alsace-moselle": "France — Alsace-Moselle",
    "addon.holiday-calendars.area.cz": "Tchéquie",
    "addon.holiday-calendars.area.dk": "Danemark",
    "addon.holiday-calendars.area.cn": "Chine",
    "addon.holiday-calendars.area.tw": "Taïwan",
    "addon.holiday-calendars.area.eg": "Égypte",

    "addon.holiday-calendars.note.us": "Les onze jours fériés fédéraux. Chaque État en ajoute, et beaucoup d'employeurs ferment des jours qui ne figurent pas ici.",
    "addon.holiday-calendars.note.de": "Les neuf jours fériés dans chacun des Länder allemands. Dix des seize en ajoutent, certains variant d'une commune à l'autre, et aucun de ceux-là n'est ici.",
    "addon.holiday-calendars.note.fr": "Les onze jours nommés par le code du travail, tels qu'ils valent dans la plus grande partie du pays.",
    "addon.holiday-calendars.note.fr-alsace-moselle": "Les onze jours nationaux, et les deux de plus conservés en Bas-Rhin, Haut-Rhin et Moselle : le Vendredi saint et le 26 décembre.",
    "addon.holiday-calendars.note.cz": "Les fêtes d'État et les autres fêtes, treize en tout, telles que la loi les énumère.",
    "addon.holiday-calendars.note.dk": "Les dix fêtes religieuses danoises. Le grand jour de prière n'en fait pas partie : il a cessé d'en être une en 2024. Le 24 et le 31 décembre sont des jours ouvrables au regard de la loi, quoi qu'en fasse un établissement.",

    "addon.holiday-calendars.from.us": "Repris de la loi fédérale sur les jours fériés, règles de jour de semaine comprises.",
    "addon.holiday-calendars.from.de": "Repris des seize lois régionales sur les jours fériés, ramenées aux jours communs à toutes.",
    "addon.holiday-calendars.from.fr": "Repris de l'article L3133-1 du code du travail.",
    "addon.holiday-calendars.from.fr-alsace-moselle": "Repris du code du travail et du droit local qui conserve deux jours de plus dans les trois départements.",
    "addon.holiday-calendars.from.cz": "Repris de la loi tchèque sur les fêtes d'État et les autres fêtes.",
    "addon.holiday-calendars.from.dk": "Repris des fêtes religieuses danoises, telles qu'elles valent après la modification de 2024.",

    "addon.holiday-calendars.announced.title": "Pays sans liste ici",
    "addon.holiday-calendars.announced.lead": "Ces pays n'ont pas de calendrier calculable à l'avance. Leurs gouvernements l'annoncent, année après année. Une liste devinée aurait, sur un tableau de service, exactement l'air d'une liste vérifiée : il n'y en a donc aucune.",
    "addon.holiday-calendars.announced.cn": "Le Conseil des affaires de l'État publie à l'automne le calendrier de l'année suivante, avec les week-ends travaillés qui servent à relier les congés.",
    "addon.holiday-calendars.announced.tw": "Le calendrier paraît année par année, avec ses jours de rattrapage et ses week-ends déplacés.",
    "addon.holiday-calendars.announced.eg": "Les dates islamiques suivent la lune et sont arrêtées par observation, et plusieurs journées nationales changent de date chaque année, par décret, afin de tomber un jeudi.",

    "addon.holiday-calendars.pick.area": "Pays ou territoire",
    "addon.holiday-calendars.pick.year": "Année",
    "addon.holiday-calendars.pick.preview": "{count} jours",
    "addon.holiday-calendars.pick.import": "Reprendre cette année",
    "addon.holiday-calendars.pick.reviewed": "Dernière vérification le {date}.",
    "addon.holiday-calendars.pick.noSubstitutes": "Quand un jour tombe le week-end, rien n'est ajouté. Décaler le jour chômé, c'est à l'établissement d'en décider, pas à l'État.",

    "addon.holiday-calendars.held.title": "Jours de fermeture de l'établissement",
    "addon.holiday-calendars.held.none": "Rien pour l'instant. Choisissez un pays et une année ci-dessus, regardez ce qui arriverait, et reprenez-le.",
    "addon.holiday-calendars.held.own": "Saisi ici",
    "addon.holiday-calendars.held.remove": "Retirer",
    "addon.holiday-calendars.held.removeSet": "Retirer cette année",

    "addon.holiday-calendars.refuse.title": "Certains de ces jours sont déjà saisis à la main",
    "addon.holiday-calendars.refuse.body": "Rien n'a été repris. Chacun des jours ci-dessous tombe à une date que quelqu'un a déjà saisie ici, et cet add-on ne décide pas lequel des deux noms doit figurer sur le tableau de service. Retirez la saisie manuelle et reprenez, ou gardez-la et laissez cette année de côté.",
    "addon.holiday-calendars.refuse.row": "{date} — saisi ici : {yours} · dans cette liste : {theirs}",

    "addon.holiday-calendars.done.added": "{count} jours repris.",
    "addon.holiday-calendars.done.replaced": "{count} jours repris, par-dessus ce que cette année contenait. Rien de ce qui avait été saisi à la main n'a été touché.",

    "addon.holiday-calendars.own.title": "Un jour à vous",
    "addon.holiday-calendars.own.note": "Un établissement ferme pour des raisons qu'aucun État ne décrète — un inventaire, un déménagement, un après-midi de formation. Les jours saisis ici voisinent avec ceux qui ont été repris, et aucune reprise ne les enlève.",
    "addon.holiday-calendars.own.date": "Date",
    "addon.holiday-calendars.own.name": "Comment l'appeler",
    "addon.holiday-calendars.own.add": "Saisir",
    "addon.holiday-calendars.own.badDate": "Cette date n'existe pas au calendrier.",
    "addon.holiday-calendars.own.badName": "Donnez un nom au jour, pour que le tableau de service dise pourquoi c'est fermé.",
    "addon.holiday-calendars.own.duplicate": "Un jour à vous est déjà saisi à cette date.",

    "addon.holiday-calendars.maint.owner": "les mainteneurs des add-ons Adminium",
    "addon.holiday-calendars.maint.line": "Tenu à jour par {owner}. Dernière relecture le {last} ; la relecture annuelle suivante est attendue le {next}.",
    "addon.holiday-calendars.maint.corrections": "Une date fausse ? Signalez-la sur le dépôt des add-ons, elle sera corrigée.",
  },

  "cs-CZ": {
    "addon.holiday-calendars.line": "Ověřené seznamy státních svátků několika zemí, uložené přímo v add-onu. Vyberte zemi a rok, podívejte se na dny a převezměte je.",
    "addon.holiday-calendars.what": "Podnik tak má ověřený seznam svátků zemí, kde pracuje: zůstatky dovolené i zavírací dny vycházejí z jednoho kalendáře, místo aby je někdo dvakrát ročně přepisoval ručně. Nic se nestahuje — dny jsou uložené jako data uvnitř add-onu.",
    "addon.holiday-calendars.disconnect.goes": "Výběr země i tlačítko převzetí zmizí a s nimi i panel, na kterém stojí.",
    "addon.holiday-calendars.disconnect.stays": "Každý už převzatý den zůstává přesně tam, kde je, a stejně tak každý den zapsaný zde ručně. Seznam patří podniku; add-on jen pomáhá ho naplnit.",
    "addon.holiday-calendars.noCompany": "Holiday Calendars se nepřipojuje k žádné cizí firmě. Nikde nepotřebuje účet, nic nevolá a každý den, který zná, už je uvnitř add-onu.",
    "addon.holiday-calendars.act.1": "{when} · převzat rok svátků",
    "addon.holiday-calendars.act.2": "{when} · zapsán vlastní den podniku",

    "addon.holiday-calendars.setting.days": "Dny, kdy má podnik zavřeno",
    "addon.holiday-calendars.setting.daysHint": "Nastavuje se níže, ve vlastním panelu add-onu, kde si dny lze před převzetím ověřit.",

    "addon.holiday-calendars.area.us": "Spojené státy americké",
    "addon.holiday-calendars.area.de": "Německo",
    "addon.holiday-calendars.area.fr": "Francie",
    "addon.holiday-calendars.area.fr-alsace-moselle": "Francie — Alsasko a Mosela",
    "addon.holiday-calendars.area.cz": "Česko",
    "addon.holiday-calendars.area.dk": "Dánsko",
    "addon.holiday-calendars.area.cn": "Čína",
    "addon.holiday-calendars.area.tw": "Tchaj-wan",
    "addon.holiday-calendars.area.eg": "Egypt",

    "addon.holiday-calendars.note.us": "Jedenáct federálních svátků. Jednotlivé státy mají vlastní a mnoho zaměstnavatelů zavírá i ve dnech, které tu nejsou.",
    "addon.holiday-calendars.note.de": "Devět dnů, které jsou svátkem v každé německé spolkové zemi. Deset ze šestnácti zemí má další, některé se liší obec od obce, a žádný z nich tu není.",
    "addon.holiday-calendars.note.fr": "Jedenáct dnů uvedených ve francouzském zákoníku práce, tak jak platí ve většině země.",
    "addon.holiday-calendars.note.fr-alsace-moselle": "Jedenáct celostátních dnů a dva další, které zůstávají v departementech Dolní Rýn, Horní Rýn a Mosela: Velký pátek a druhý svátek vánoční.",
    "addon.holiday-calendars.note.cz": "Státní svátky a ostatní svátky, třináct celkem, tak jak je zákon vyjmenovává.",
    "addon.holiday-calendars.note.dk": "Deset dánských církevních svátků. Velký modlitební den mezi ně nepatří — přestal jím být v roce 2024. Štědrý večer a Silvestr jsou podle zákona běžné pracovní dny, ať s nimi podnik naloží jakkoli.",

    "addon.holiday-calendars.from.us": "Převzato z federálního zákona o svátcích, včetně jeho pravidel o dnech v týdnu.",
    "addon.holiday-calendars.from.de": "Převzato ze šestnácti zemských zákonů o svátcích, zúženo na dny společné všem.",
    "addon.holiday-calendars.from.fr": "Převzato z článku L3133-1 francouzského zákoníku práce.",
    "addon.holiday-calendars.from.fr-alsace-moselle": "Převzato ze zákoníku práce a z místního práva, které ve třech departementech zachovává dva dny navíc.",
    "addon.holiday-calendars.from.cz": "Převzato z českého zákona o státních svátcích a ostatních svátcích.",
    "addon.holiday-calendars.from.dk": "Převzato z dánských církevních svátků, tak jak platí po změně z roku 2024.",

    "addon.holiday-calendars.announced.title": "Země, ke kterým tu seznam není",
    "addon.holiday-calendars.announced.lead": "Tyto země nemají kalendář, který by šlo dopředu spočítat. Jejich vlády ho vyhlašují rok po roce. Uhodnutý seznam by na rozpisu směn vypadal úplně stejně jako ověřený, a tak tu žádný není.",
    "addon.holiday-calendars.announced.cn": "Státní rada vyhlašuje uspořádání příštího roku na podzim, včetně víkendů, které se odpracují, aby volno drželo pohromadě.",
    "addon.holiday-calendars.announced.tw": "Kalendář vychází vždy na jeden rok, s náhradními dny a s přesunutými víkendy.",
    "addon.holiday-calendars.announced.eg": "Islámské termíny se řídí měsícem a určují se pozorováním, a několik státních dnů se každý rok výnosem přesouvá na nejbližší čtvrtek.",

    "addon.holiday-calendars.pick.area": "Země nebo oblast",
    "addon.holiday-calendars.pick.year": "Rok",
    "addon.holiday-calendars.pick.preview": "{count} dnů",
    "addon.holiday-calendars.pick.import": "Převzít tento rok",
    "addon.holiday-calendars.pick.reviewed": "Naposledy ověřeno {date}.",
    "addon.holiday-calendars.pick.noSubstitutes": "Padne-li den na víkend, nic dalšího se nepřidává. Zda podnik volno přesune, rozhoduje podnik, ne stát.",

    "addon.holiday-calendars.held.title": "Dny, kdy má podnik zavřeno",
    "addon.holiday-calendars.held.none": "Zatím nic. Vyberte nahoře zemi a rok, podívejte se, co by přišlo, a převezměte to.",
    "addon.holiday-calendars.held.own": "Zapsáno zde",
    "addon.holiday-calendars.held.remove": "Odebrat",
    "addon.holiday-calendars.held.removeSet": "Odebrat tento rok",

    "addon.holiday-calendars.refuse.title": "Některé z těchto dnů už jsou zapsané ručně",
    "addon.holiday-calendars.refuse.body": "Nic se nepřevzalo. Každý den níže padá na datum, které tu už někdo zapsal, a add-on nerozhoduje, který ze dvou názvů má stát v rozpisu směn. Odeberte ruční zápis a převezměte znovu, nebo si ho nechte a tento rok vynechte.",
    "addon.holiday-calendars.refuse.row": "{date} — zapsáno zde: {yours} · v tomto seznamu: {theirs}",

    "addon.holiday-calendars.done.added": "Převzato {count} dnů.",
    "addon.holiday-calendars.done.replaced": "Převzato {count} dnů, přes to, co tento rok obsahoval dřív. Ručně zapsaných dnů se to nedotklo.",

    "addon.holiday-calendars.own.title": "Vlastní den podniku",
    "addon.holiday-calendars.own.note": "Podnik zavírá z důvodů, které žádný stát nenařizuje — inventura, stěhování, odpoledne školení. Dny zapsané zde stojí vedle převzatých a žádné převzetí je neodstraní.",
    "addon.holiday-calendars.own.date": "Datum",
    "addon.holiday-calendars.own.name": "Jak se bude jmenovat",
    "addon.holiday-calendars.own.add": "Zapsat",
    "addon.holiday-calendars.own.badDate": "Takové datum v kalendáři není.",
    "addon.holiday-calendars.own.badName": "Pojmenujte den, ať je v rozpisu směn vidět, kvůli čemu je zavřeno.",
    "addon.holiday-calendars.own.duplicate": "K tomuto datu už je vlastní den podniku zapsaný.",

    "addon.holiday-calendars.maint.owner": "správci add-onů Adminium",
    "addon.holiday-calendars.maint.line": "Udržuje {owner}. Naposledy zkontrolováno {last}; další roční kontrola má být {next}.",
    "addon.holiday-calendars.maint.corrections": "Špatné datum? Založte hlášení v repozitáři add-onů a bude opraveno.",
  },

  "da-DK": {
    "addon.holiday-calendars.line": "Kontrollerede helligdagslister for en håndfuld lande, lagt ind i selve tilføjelsen. Vælg land og år, se dagene efter, og hent dem ind.",
    "addon.holiday-calendars.what": "Virksomheden får en kontrolleret liste over helligdage i de lande, det arbejder i, så ferieregnskab og lukkedage kommer fra den samme kalender i stedet for at blive tastet ind i hånden to gange om året. Der hentes intet udefra: dagene ligger som data inde i tilføjelsen.",
    "addon.holiday-calendars.disconnect.goes": "Landevælgeren og knappen, der henter dagene ind, forsvinder, og det gør panelet, de sidder i, også.",
    "addon.holiday-calendars.disconnect.stays": "Hver dag, der allerede er hentet ind, bliver præcis, hvor den er, og det samme gør hver dag, nogen selv har skrevet ind. Listen tilhører virksomheden; tilføjelsen hjælper kun med at fylde den.",
    "addon.holiday-calendars.noCompany": "Holiday Calendars forbinder sig ikke til noget udefrakommende firma. Den skal ikke bruge en konto nogen steder, den kalder ingenting, og hver dag, den kender, ligger allerede inde i tilføjelsen.",
    "addon.holiday-calendars.act.1": "{when} · et år med helligdage hentet ind",
    "addon.holiday-calendars.act.2": "{when} · en af virksomhedens egne dage skrevet ind",

    "addon.holiday-calendars.setting.days": "Dage hvor virksomheden holder lukket",
    "addon.holiday-calendars.setting.daysHint": "Rettes nedenfor i tilføjelsens eget panel, hvor dagene kan ses efter, før de hentes ind.",

    "addon.holiday-calendars.area.us": "USA",
    "addon.holiday-calendars.area.de": "Tyskland",
    "addon.holiday-calendars.area.fr": "Frankrig",
    "addon.holiday-calendars.area.fr-alsace-moselle": "Frankrig — Alsace-Moselle",
    "addon.holiday-calendars.area.cz": "Tjekkiet",
    "addon.holiday-calendars.area.dk": "Danmark",
    "addon.holiday-calendars.area.cn": "Kina",
    "addon.holiday-calendars.area.tw": "Taiwan",
    "addon.holiday-calendars.area.eg": "Egypten",

    "addon.holiday-calendars.note.us": "De elleve føderale helligdage. De enkelte delstater har deres egne, og mange arbejdsgivere lukker på dage, der ikke står her.",
    "addon.holiday-calendars.note.de": "De ni dage, der er helligdag i hver eneste tyske delstat. Ti af de seksten har flere, nogle af dem forskellige fra by til by, og ingen af dem står her.",
    "addon.holiday-calendars.note.fr": "De elleve dage, den franske arbejdslov nævner, sådan som de gælder i størstedelen af landet.",
    "addon.holiday-calendars.note.fr-alsace-moselle": "De elleve landsdækkende dage og de to yderligere, der er bevaret i Bas-Rhin, Haut-Rhin og Moselle: langfredag og den 26. december.",
    "addon.holiday-calendars.note.cz": "Statshelligdagene og de øvrige helligdage, tretten i alt, sådan som loven remser dem op.",
    "addon.holiday-calendars.note.dk": "De ti danske helligdage. Store bededag er ikke iblandt dem — den holdt op med at være helligdag i 2024. Juleaftensdag og nytårsaftensdag er efter loven almindelige arbejdsdage, uanset hvad en virksomhed gør ved det.",

    "addon.holiday-calendars.from.us": "Hentet fra den føderale helligdagslov, ugedagsreglerne med.",
    "addon.holiday-calendars.from.de": "Hentet fra de seksten delstaters helligdagslove, skåret ned til de dage, der gælder i dem alle.",
    "addon.holiday-calendars.from.fr": "Hentet fra artikel L3133-1 i den franske arbejdslov.",
    "addon.holiday-calendars.from.fr-alsace-moselle": "Hentet fra arbejdsloven og fra den lokale ret, der bevarer to dage mere i de tre departementer.",
    "addon.holiday-calendars.from.cz": "Hentet fra den tjekkiske lov om statshelligdage og øvrige helligdage.",
    "addon.holiday-calendars.from.dk": "Hentet fra de danske helligdage, sådan som de ser ud efter ændringen i 2024.",

    "addon.holiday-calendars.announced.title": "Lande uden liste her",
    "addon.holiday-calendars.announced.lead": "De her lande har ingen kalender, nogen kan regne ud på forhånd. Deres regeringer melder den ud år for år. En gættet liste ville se nøjagtig ud som en kontrolleret, når den først stod på en vagtseddel, så der er ingen.",
    "addon.holiday-calendars.announced.cn": "Statsrådet melder næste års ordning ud om efteråret, sammen med de weekender, der arbejdes for at binde fridagene sammen.",
    "addon.holiday-calendars.announced.tw": "Kalenderen udkommer et år ad gangen, med sine erstatningsdage og sine flyttede weekender.",
    "addon.holiday-calendars.announced.eg": "De islamiske datoer følger månen og fastslås ved observation, og flere nationale dage flyttes hvert år ved dekret til den nærmeste torsdag.",

    "addon.holiday-calendars.pick.area": "Land eller område",
    "addon.holiday-calendars.pick.year": "År",
    "addon.holiday-calendars.pick.preview": "{count} dage",
    "addon.holiday-calendars.pick.import": "Hent dette år ind",
    "addon.holiday-calendars.pick.reviewed": "Sidst kontrolleret den {date}.",
    "addon.holiday-calendars.pick.noSubstitutes": "Falder en dag i en weekend, lægges der ikke noget oveni. Om virksomheden rykker fridagen, er virksomhedens afgørelse og ikke statens.",

    "addon.holiday-calendars.held.title": "Dage hvor virksomheden holder lukket",
    "addon.holiday-calendars.held.none": "Ingenting endnu. Vælg land og år ovenfor, se hvad der ville komme, og hent det ind.",
    "addon.holiday-calendars.held.own": "Skrevet ind her",
    "addon.holiday-calendars.held.remove": "Fjern",
    "addon.holiday-calendars.held.removeSet": "Fjern dette år",

    "addon.holiday-calendars.refuse.title": "Nogle af dagene står allerede skrevet ind i hånden",
    "addon.holiday-calendars.refuse.body": "Der blev ikke hentet noget ind. Hver dag nedenfor falder på en dato, nogen her allerede har skrevet ind, og tilføjelsen afgør ikke, hvilket af de to navne der skal stå på vagtsedlen. Fjern det håndskrevne og hent ind igen, eller behold det og lad året være.",
    "addon.holiday-calendars.refuse.row": "{date} — skrevet ind her: {yours} · i denne liste: {theirs}",

    "addon.holiday-calendars.done.added": "{count} dage hentet ind.",
    "addon.holiday-calendars.done.replaced": "{count} dage hentet ind, hen over det, året indeholdt før. Der blev ikke rørt ved noget, der var skrevet ind i hånden.",

    "addon.holiday-calendars.own.title": "En af virksomhedens egne dage",
    "addon.holiday-calendars.own.note": "En virksomhed lukker af grunde, ingen stat bestemmer — status, en flytning, en eftermiddag med oplæring. Dage, der skrives ind her, står ved siden af de hentede, og ingen hentning fjerner dem.",
    "addon.holiday-calendars.own.date": "Dato",
    "addon.holiday-calendars.own.name": "Hvad den skal hedde",
    "addon.holiday-calendars.own.add": "Skriv den ind",
    "addon.holiday-calendars.own.badDate": "Den dato findes ikke i kalenderen.",
    "addon.holiday-calendars.own.badName": "Giv dagen et navn, så vagtsedlen siger, hvorfor der er lukket.",
    "addon.holiday-calendars.own.duplicate": "Der står allerede en af virksomhedens egne dage på den dato.",

    "addon.holiday-calendars.maint.owner": "de folk, der passer Adminiums tilføjelser",
    "addon.holiday-calendars.maint.line": "Passet af {owner}. Sidst læst igennem den {last}; den næste årlige gennemlæsning skal ske den {next}.",
    "addon.holiday-calendars.maint.corrections": "En forkert dato? Opret en sag i tilføjelsernes arkiv, så bliver den rettet.",
  },

  "zh-CN": {
    "addon.holiday-calendars.line": "少数几个国家的法定假日清单，经过核对，直接随附在此加载项里。选好国家和年份，看一眼这些日子，再取用。",
    "addon.holiday-calendars.what": "这样，单位就有一份经过核对的假日清单，覆盖它开展业务的国家：休假余额和停业日都取自同一份日历，不必每年手工录入两次。全程不向外获取任何东西——这些日子就是加载项里的数据。",
    "addon.holiday-calendars.disconnect.goes": "国家选择器和取用按钮会消失，承载它们的面板也一并消失。",
    "addon.holiday-calendars.disconnect.stays": "已经取用的每一天都留在原处，手工写入的每一天也一样。这份清单属于单位；加载项只是帮忙把它填起来。",
    "addon.holiday-calendars.noCompany": "Holiday Calendars 不与任何外部公司相连。它在任何地方都不需要账户，不发出任何调用，它知道的每一天都已经在加载项里。",
    "addon.holiday-calendars.act.1": "{when} · 取用了一年的假日",
    "addon.holiday-calendars.act.2": "{when} · 写入了单位自己的一天",

    "addon.holiday-calendars.setting.days": "单位停业的日子",
    "addon.holiday-calendars.setting.daysHint": "在下方加载项自己的面板里维护，取用之前可以先把日子看清楚。",

    "addon.holiday-calendars.area.us": "美国",
    "addon.holiday-calendars.area.de": "德国",
    "addon.holiday-calendars.area.fr": "法国",
    "addon.holiday-calendars.area.fr-alsace-moselle": "法国 — 阿尔萨斯-摩泽尔",
    "addon.holiday-calendars.area.cz": "捷克",
    "addon.holiday-calendars.area.dk": "丹麦",
    "addon.holiday-calendars.area.cn": "中国",
    "addon.holiday-calendars.area.tw": "台湾",
    "addon.holiday-calendars.area.eg": "埃及",

    "addon.holiday-calendars.note.us": "十一个联邦假日。各州另有自己的假日，许多雇主停业的日子也不在这份清单上。",
    "addon.holiday-calendars.note.de": "在德国每一个联邦州都放假的九天。十六个州里有十个另有假日，其中几个还因城镇而异，那些都不在这里。",
    "addon.holiday-calendars.note.fr": "法国劳动法典列出的十一天，按其在全国大部分地区的适用情况。",
    "addon.holiday-calendars.note.fr-alsace-moselle": "十一个全国性的日子，加上下莱茵、上莱茵和摩泽尔三省保留的另外两天：耶稣受难日和十二月二十六日。",
    "addon.holiday-calendars.note.cz": "国家节日与其他节日，共十三天，按法律列举的次序。",
    "addon.holiday-calendars.note.dk": "丹麦的十个教会假日。大祈祷日不在其中——它从二〇二四年起不再是假日。平安夜和除夕在法律上是普通工作日，无论单位怎么安排。",

    "addon.holiday-calendars.from.us": "取自联邦假日法律，连同其中关于星期几的规则。",
    "addon.holiday-calendars.from.de": "取自十六个州的假日法律，收窄为各州共有的日子。",
    "addon.holiday-calendars.from.fr": "取自法国劳动法典第 L3133-1 条。",
    "addon.holiday-calendars.from.fr-alsace-moselle": "取自劳动法典，以及在那三个省保留另外两天的地方法。",
    "addon.holiday-calendars.from.cz": "取自捷克关于国家节日与其他节日的法律。",
    "addon.holiday-calendars.from.dk": "取自丹麦教会假日，按二〇二四年修改后的情况。",

    "addon.holiday-calendars.announced.title": "此处没有清单的国家",
    "addon.holiday-calendars.announced.lead": "这些国家的假日无法事先推算。它们的政府一年一年地公布。猜出来的清单一旦排进班表，看起来和核对过的一模一样，所以这里一份也没有。",
    "addon.holiday-calendars.announced.cn": "国务院在秋天公布次年的放假安排，其中还包括为连休而调休上班的周末。",
    "addon.holiday-calendars.announced.tw": "日历一年一发布，带着补假的日子和调整过的周末。",
    "addon.holiday-calendars.announced.eg": "伊斯兰教的日期依月相而定，须经观月确认；另有几个国家纪念日每年由法令挪到最近的星期四。",

    "addon.holiday-calendars.pick.area": "国家或地区",
    "addon.holiday-calendars.pick.year": "年份",
    "addon.holiday-calendars.pick.preview": "{count} 天",
    "addon.holiday-calendars.pick.import": "取用这一年",
    "addon.holiday-calendars.pick.reviewed": "最近一次核对：{date}。",
    "addon.holiday-calendars.pick.noSubstitutes": "假日碰上周末时，这里不会另外补一天。要不要把休息日挪开，由单位决定，不由国家决定。",

    "addon.holiday-calendars.held.title": "单位停业的日子",
    "addon.holiday-calendars.held.none": "还没有。在上面选好国家和年份，看看会来些什么，再取用。",
    "addon.holiday-calendars.held.own": "在这里写入",
    "addon.holiday-calendars.held.remove": "移除",
    "addon.holiday-calendars.held.removeSet": "移除这一年",

    "addon.holiday-calendars.refuse.title": "其中有几天已经手工写入过了",
    "addon.holiday-calendars.refuse.body": "什么也没有取用。下面每一天所落的日期，这里已经有人写过了，而这个加载项不会替你决定班表上该显示哪一个名字。删掉手写的那条再取用一次，或者留着它、这一年就先不取。",
    "addon.holiday-calendars.refuse.row": "{date} — 这里写的是：{yours} · 这份清单里是：{theirs}",

    "addon.holiday-calendars.done.added": "取用了 {count} 天。",
    "addon.holiday-calendars.done.replaced": "取用了 {count} 天，覆盖了这一年原先的内容。手工写入的日子一个也没有动。",

    "addon.holiday-calendars.own.title": "单位自己的一天",
    "addon.holiday-calendars.own.note": "单位停业的理由不都由国家规定——盘点、搬迁、一个下午的培训。在这里写入的日子与取用来的并列，任何一次取用都不会把它们删掉。",
    "addon.holiday-calendars.own.date": "日期",
    "addon.holiday-calendars.own.name": "叫什么名字",
    "addon.holiday-calendars.own.add": "写入",
    "addon.holiday-calendars.own.badDate": "日历上没有这一天。",
    "addon.holiday-calendars.own.badName": "给这一天起个名字，让看班表的人知道为什么关门。",
    "addon.holiday-calendars.own.duplicate": "那一天已经写入过单位自己的日子了。",

    "addon.holiday-calendars.maint.owner": "Adminium 加载项的维护者",
    "addon.holiday-calendars.maint.line": "由{owner}维护。最近一次通读：{last}；下一次年度通读应在 {next}。",
    "addon.holiday-calendars.maint.corrections": "日期有误？在加载项仓库里提一个问题，它会被改正。",
  },

  "zh-TW": {
    "addon.holiday-calendars.line": "少數幾個國家的國定假日清單，經過核對，直接隨附在這個外掛裡。選好國家和年份，看一眼這些日子，再取用。",
    "addon.holiday-calendars.what": "這樣，單位就有一份核對過的假日清單，涵蓋它營業的國家：休假餘額和停業日都取自同一份日曆，不必每年手動輸入兩次。全程不向外取得任何東西——這些日子就是外掛裡的資料。",
    "addon.holiday-calendars.disconnect.goes": "國家選擇器和取用按鈕會消失，承載它們的面板也一併消失。",
    "addon.holiday-calendars.disconnect.stays": "已經取用的每一天都留在原處，手動寫入的每一天也一樣。這份清單屬於單位；外掛只是幫忙把它填起來。",
    "addon.holiday-calendars.noCompany": "Holiday Calendars 不與任何外部公司相連。它在任何地方都不需要帳號，不發出任何呼叫，它知道的每一天都已經在外掛裡。",
    "addon.holiday-calendars.act.1": "{when} · 取用了一年的假日",
    "addon.holiday-calendars.act.2": "{when} · 寫入了單位自己的一天",

    "addon.holiday-calendars.setting.days": "單位停業的日子",
    "addon.holiday-calendars.setting.daysHint": "在下方外掛自己的面板裡維護，取用之前可以先把日子看清楚。",

    "addon.holiday-calendars.area.us": "美國",
    "addon.holiday-calendars.area.de": "德國",
    "addon.holiday-calendars.area.fr": "法國",
    "addon.holiday-calendars.area.fr-alsace-moselle": "法國 — 亞爾薩斯-摩澤爾",
    "addon.holiday-calendars.area.cz": "捷克",
    "addon.holiday-calendars.area.dk": "丹麥",
    "addon.holiday-calendars.area.cn": "中國",
    "addon.holiday-calendars.area.tw": "臺灣",
    "addon.holiday-calendars.area.eg": "埃及",

    "addon.holiday-calendars.note.us": "十一個聯邦假日。各州另有自己的假日，許多雇主停業的日子也不在這份清單上。",
    "addon.holiday-calendars.note.de": "在德國每一個聯邦邦都放假的九天。十六個邦裡有十個另有假日，其中幾個還因城鎮而異，那些都不在這裡。",
    "addon.holiday-calendars.note.fr": "法國勞動法典列出的十一天，依其在全國大部分地區的適用情形。",
    "addon.holiday-calendars.note.fr-alsace-moselle": "十一個全國性的日子，加上下萊茵、上萊茵和摩澤爾三省保留的另外兩天：耶穌受難日和十二月二十六日。",
    "addon.holiday-calendars.note.cz": "國定節日與其他節日，共十三天，依法律列舉的次序。",
    "addon.holiday-calendars.note.dk": "丹麥的十個教會假日。大祈禱日不在其中——它從二〇二四年起不再是假日。平安夜和除夕在法律上是普通工作日，無論單位怎麼安排。",

    "addon.holiday-calendars.from.us": "取自聯邦假日法律，連同其中關於星期幾的規則。",
    "addon.holiday-calendars.from.de": "取自十六個邦的假日法律，收窄為各邦共有的日子。",
    "addon.holiday-calendars.from.fr": "取自法國勞動法典第 L3133-1 條。",
    "addon.holiday-calendars.from.fr-alsace-moselle": "取自勞動法典，以及在那三個省保留另外兩天的地方法。",
    "addon.holiday-calendars.from.cz": "取自捷克關於國定節日與其他節日的法律。",
    "addon.holiday-calendars.from.dk": "取自丹麥教會假日，依二〇二四年修改後的情形。",

    "addon.holiday-calendars.announced.title": "此處沒有清單的國家",
    "addon.holiday-calendars.announced.lead": "這些國家的假日無法事先推算。它們的政府一年一年地公布。猜出來的清單一旦排進班表，看起來和核對過的一模一樣，所以這裡一份也沒有。",
    "addon.holiday-calendars.announced.cn": "國務院在秋天公布次年的放假安排，其中還包括為連假而調整上班的週末。",
    "addon.holiday-calendars.announced.tw": "行事曆一年發布一次，帶著補假的日子和調整過的週末。",
    "addon.holiday-calendars.announced.eg": "伊斯蘭教的日期依月相而定，須經觀月確認；另有幾個國家紀念日每年由法令挪到最近的星期四。",

    "addon.holiday-calendars.pick.area": "國家或地區",
    "addon.holiday-calendars.pick.year": "年份",
    "addon.holiday-calendars.pick.preview": "{count} 天",
    "addon.holiday-calendars.pick.import": "取用這一年",
    "addon.holiday-calendars.pick.reviewed": "最近一次核對：{date}。",
    "addon.holiday-calendars.pick.noSubstitutes": "假日碰上週末時，這裡不會另外補一天。要不要把休息日挪開，由單位決定，不由國家決定。",

    "addon.holiday-calendars.held.title": "單位停業的日子",
    "addon.holiday-calendars.held.none": "還沒有。在上面選好國家和年份，看看會來些什麼，再取用。",
    "addon.holiday-calendars.held.own": "在這裡寫入",
    "addon.holiday-calendars.held.remove": "移除",
    "addon.holiday-calendars.held.removeSet": "移除這一年",

    "addon.holiday-calendars.refuse.title": "其中有幾天已經手動寫入過了",
    "addon.holiday-calendars.refuse.body": "什麼也沒有取用。下面每一天所落的日期，這裡已經有人寫過了，而這個外掛不會替你決定班表上該顯示哪一個名字。刪掉手寫的那條再取用一次，或者留著它、這一年就先不取。",
    "addon.holiday-calendars.refuse.row": "{date} — 這裡寫的是：{yours} · 這份清單裡是：{theirs}",

    "addon.holiday-calendars.done.added": "取用了 {count} 天。",
    "addon.holiday-calendars.done.replaced": "取用了 {count} 天，覆蓋了這一年原先的內容。手動寫入的日子一個也沒有動。",

    "addon.holiday-calendars.own.title": "單位自己的一天",
    "addon.holiday-calendars.own.note": "單位停業的理由不都由國家規定——盤點、搬遷、一個下午的訓練。在這裡寫入的日子與取用來的並列，任何一次取用都不會把它們刪掉。",
    "addon.holiday-calendars.own.date": "日期",
    "addon.holiday-calendars.own.name": "叫什麼名字",
    "addon.holiday-calendars.own.add": "寫入",
    "addon.holiday-calendars.own.badDate": "日曆上沒有這一天。",
    "addon.holiday-calendars.own.badName": "給這一天取個名字，讓看班表的人知道為什麼關門。",
    "addon.holiday-calendars.own.duplicate": "那一天已經寫入過單位自己的日子了。",

    "addon.holiday-calendars.maint.owner": "Adminium 外掛的維護者",
    "addon.holiday-calendars.maint.line": "由{owner}維護。最近一次通讀：{last}；下一次年度通讀應在 {next}。",
    "addon.holiday-calendars.maint.corrections": "日期有誤？在外掛的儲存庫裡提一個問題，它會被改正。",
  },

  "ar-EG": {
    "addon.holiday-calendars.line": "قوائم عطلات رسمية مُراجَعة لعدد قليل من البلدان، محمولة داخل الإضافة نفسها. اختر بلدًا وسنة، وانظر إلى الأيام، ثم خذها.",
    "addon.holiday-calendars.what": "بهذا يصير لدى المنشأة قائمة مُراجَعة بالعطلات الرسمية في البلدان التي يعمل فيها، فتخرج أرصدة الإجازات وأيام الغلق من التقويم نفسه بدل أن يكتبها أحد بيده مرتين في السنة. ولا يُجلَب شيء من الخارج: الأيام بيانات داخل الإضافة.",
    "addon.holiday-calendars.disconnect.goes": "يختفي مُنتقي البلد وزر الأخذ، وتختفي معهما اللوحة التي يقفان عليها.",
    "addon.holiday-calendars.disconnect.stays": "كل يوم سبق أخذه يبقى في مكانه تمامًا، وكذلك كل يوم كُتب هنا باليد. القائمة ملك المنشأة؛ والإضافة تساعد على ملئها فحسب.",
    "addon.holiday-calendars.noCompany": "لا تتصل Holiday Calendars بأي شركة خارجية. لا تحتاج إلى حساب في أي مكان، ولا تستدعي شيئًا، وكل يوم تعرفه موجود أصلًا داخل الإضافة.",
    "addon.holiday-calendars.act.1": "{when} · أُخذت سنة من العطلات",
    "addon.holiday-calendars.act.2": "{when} · كُتب يوم خاص بالمنشأة",

    "addon.holiday-calendars.setting.days": "الأيام التي تغلق فيها المنشأة",
    "addon.holiday-calendars.setting.daysHint": "يُضبط في لوحة الإضافة نفسها بالأسفل، حيث يمكن النظر إلى الأيام قبل أخذها.",

    "addon.holiday-calendars.area.us": "الولايات المتحدة",
    "addon.holiday-calendars.area.de": "ألمانيا",
    "addon.holiday-calendars.area.fr": "فرنسا",
    "addon.holiday-calendars.area.fr-alsace-moselle": "فرنسا — الألزاس والموزيل",
    "addon.holiday-calendars.area.cz": "التشيك",
    "addon.holiday-calendars.area.dk": "الدنمارك",
    "addon.holiday-calendars.area.cn": "الصين",
    "addon.holiday-calendars.area.tw": "تايوان",
    "addon.holiday-calendars.area.eg": "مصر",

    "addon.holiday-calendars.note.us": "العطلات الاتحادية الإحدى عشرة. ولكل ولاية عطلاتها، وكثير من أصحاب العمل يغلقون في أيام ليست في هذه القائمة.",
    "addon.holiday-calendars.note.de": "الأيام التسعة التي تُعَد عطلة في كل ولاية ألمانية. وعشر من الولايات الست عشرة تضيف أيامًا أخرى، بعضها يختلف من بلدة إلى بلدة، ولا شيء منها هنا.",
    "addon.holiday-calendars.note.fr": "الأيام الأحد عشر التي يسميها قانون العمل الفرنسي، كما تسري في معظم أنحاء البلاد.",
    "addon.holiday-calendars.note.fr-alsace-moselle": "الأيام الأحد عشر الوطنية، ويومان آخران محفوظان في الراين الأدنى والراين الأعلى والموزيل: الجمعة العظيمة، والسادس والعشرون من ديسمبر.",
    "addon.holiday-calendars.note.cz": "أعياد الدولة والأعياد الأخرى، ثلاثة عشر في المجموع، كما يعددها القانون.",
    "addon.holiday-calendars.note.dk": "أعياد الكنيسة الدنماركية العشرة. ويوم الصلاة الكبير ليس منها — إذ لم يعد عطلة منذ عام ٢٠٢٤. أما ليلة عيد الميلاد وليلة رأس السنة فيومان عاديان في نظر القانون، مهما فعلت المنشأة بهما.",

    "addon.holiday-calendars.from.us": "مأخوذة من قانون العطلات الاتحادي، بقواعده الخاصة بأيام الأسبوع.",
    "addon.holiday-calendars.from.de": "مأخوذة من قوانين العطلات في الولايات الست عشرة، مختصرةً إلى الأيام المشتركة بينها جميعًا.",
    "addon.holiday-calendars.from.fr": "مأخوذة من المادة L3133-1 من قانون العمل الفرنسي.",
    "addon.holiday-calendars.from.fr-alsace-moselle": "مأخوذة من قانون العمل، ومن القانون المحلي الذي يحفظ يومين إضافيين في المحافظات الثلاث.",
    "addon.holiday-calendars.from.cz": "مأخوذة من القانون التشيكي الخاص بأعياد الدولة والأعياد الأخرى.",
    "addon.holiday-calendars.from.dk": "مأخوذة من أعياد الكنيسة الدنماركية، كما صارت بعد تعديل عام ٢٠٢٤.",

    "addon.holiday-calendars.announced.title": "بلدان بلا قائمة هنا",
    "addon.holiday-calendars.announced.lead": "هذه البلدان ليس لها تقويم يستطيع أحد حسابه مقدمًا. حكوماتها تعلنه سنة بعد سنة. والقائمة المُخمَّنة تبدو على جدول المناوبات مثل المُراجَعة تمامًا، فلا توجد هنا قائمة أصلًا.",
    "addon.holiday-calendars.announced.cn": "يعلن مجلس الدولة ترتيب السنة التالية في الخريف، ومعه أيام نهاية الأسبوع التي يُعمَل فيها لوصل الإجازات.",
    "addon.holiday-calendars.announced.tw": "يصدر التقويم سنةً سنة، بأيام التعويض وبنهايات الأسبوع المنقولة.",
    "addon.holiday-calendars.announced.eg": "المواعيد الهجرية تتبع القمر وتُثبَت بالرؤية، وعدة أعياد قومية تُنقَل كل سنة بقرار إلى أقرب خميس.",

    "addon.holiday-calendars.pick.area": "البلد أو المنطقة",
    "addon.holiday-calendars.pick.year": "السنة",
    "addon.holiday-calendars.pick.preview": "{count} يومًا",
    "addon.holiday-calendars.pick.import": "خذ هذه السنة",
    "addon.holiday-calendars.pick.reviewed": "آخر مراجعة في {date}.",
    "addon.holiday-calendars.pick.noSubstitutes": "إذا وقع يوم في نهاية الأسبوع فلا يُضاف شيء. وتحريك يوم الراحة قرار المنشأة، لا قرار الدولة.",

    "addon.holiday-calendars.held.title": "الأيام التي تغلق فيها المنشأة",
    "addon.holiday-calendars.held.none": "لا شيء بعد. اختر بلدًا وسنة بالأعلى، وانظر ما الذي سيأتي، ثم خذه.",
    "addon.holiday-calendars.held.own": "مكتوب هنا",
    "addon.holiday-calendars.held.remove": "احذفه",
    "addon.holiday-calendars.held.removeSet": "احذف هذه السنة",

    "addon.holiday-calendars.refuse.title": "بعض هذه الأيام مكتوب هنا باليد من قبل",
    "addon.holiday-calendars.refuse.body": "لم يُؤخَذ شيء. كل يوم بالأسفل يقع في تاريخ سبق أن كتبه أحد هنا، وهذه الإضافة لا تقرر أي الاسمين ينبغي أن يظهر على جدول المناوبات. احذف المكتوب باليد وخذ السنة من جديد، أو أبقِه واترك هذه السنة.",
    "addon.holiday-calendars.refuse.row": "{date} — المكتوب هنا: {yours} · وفي هذه القائمة: {theirs}",

    "addon.holiday-calendars.done.added": "أُخذ {count} يومًا.",
    "addon.holiday-calendars.done.replaced": "أُخذ {count} يومًا، فوق ما كانت هذه السنة تحمله قبلًا. ولم يُمَس شيء مما كُتب باليد.",

    "addon.holiday-calendars.own.title": "يوم خاص بالمنشأة",
    "addon.holiday-calendars.own.note": "تغلق المنشأة لأسباب لا تقررها دولة — جرد، أو انتقال، أو ظهر تدريب. والأيام المكتوبة هنا تقف بجوار المأخوذة، ولا يزيلها أي أخذ.",
    "addon.holiday-calendars.own.date": "التاريخ",
    "addon.holiday-calendars.own.name": "بأي اسم يُسمَّى",
    "addon.holiday-calendars.own.add": "اكتبه",
    "addon.holiday-calendars.own.badDate": "ليس هذا تاريخًا في التقويم.",
    "addon.holiday-calendars.own.badName": "سَمِّ اليوم، ليعرف قارئ جدول المناوبات سبب الغلق.",
    "addon.holiday-calendars.own.duplicate": "يوجد في هذا التاريخ يوم خاص بالمنشأة مكتوب من قبل.",

    "addon.holiday-calendars.maint.owner": "القائمون على إضافات Adminium",
    "addon.holiday-calendars.maint.line": "يتولاها {owner}. آخر قراءة في {last}؛ والقراءة السنوية التالية مستحقة في {next}.",
    "addon.holiday-calendars.maint.corrections": "تاريخ خاطئ؟ افتح بلاغًا في مستودع الإضافات وسيُصحَّح.",
  },
} as const;

/** English defines the keys; the other seven must carry every one of them. */
export type StringKey = keyof (typeof strings)["en-US"];

export type LocaleTag = keyof typeof strings;

export const LOCALE_TAGS = Object.keys(strings) as LocaleTag[];

/**
 * Parity, enforced at COMPILE time rather than by a test that might not run.
 *
 * The annotation is the assertion: a locale missing a key, or grown one English
 * has not got, stops this line compiling.
 */
const _parity: { [L in LocaleTag]: Record<StringKey, string> } = strings;
void _parity;

/**
 * ── THE LATIN DIGITS IN THESE STRINGS THAT ARE NOT QUANTITIES ───────────────
 *
 * Every host in this wave runs the same rule over an Arabic page: a run of
 * Latin digits that is not inside an identifier is an unformatted number, and a
 * defect. Some of an add-on's own strings legitimately carry one anyway, and
 * when they do THE ADD-ON IS THE ONLY THING THAT KNOWS WHY.
 *
 * It travels with the strings rather than with the host because a host that
 * held one add-on's allowance would turn red the day a second host vendored the
 * same add-on without it — which is what happened to Design Studio's specimen
 * telephone number, and is the defect AC20/D21 exists to prevent.
 *
 * THIS BUNDLE DECLARES NONE, AND THAT IS A CLAIM RATHER THAN A GAP. The Arabic
 * copy here writes every figure it needs in words or in Arabic-Indic digits —
 * `عام ٢٠٢٤`, `الأيام الأحد عشر` — so every Latin digit that can reach an
 * Arabic page from this add-on is a number it computed, and every one of those
 * goes through the formatter in `t.ts`.
 *
 * The one thing that is neither is a HOLIDAY'S OWN NAME: `Victoire 1945` is a
 * French proper noun and its digits are part of it, in the same way a
 * consignment number's are. Those names are not in this bundle at all — they
 * are data in `daysets.ts` — and the panel renders them through the `Typed`
 * atom, which declares `dir="auto"` so a host's guard reads them as somebody
 * else's words rather than as a quantity this add-on failed to format.
 */
export const NOT_A_QUANTITY: readonly { phrase: string; why: string }[] = [];
