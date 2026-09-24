/**
 * The waiting list: who wants an earlier time, longest wait first — the
 * order the patients' page ranks them in, so the number here is the place a
 * patient was told.
 *
 * Each row shows the first time that fits (from the server's free times, see
 * `waitlist/useFits.ts`). "Take it" asks whether the desk rang them before
 * booking it; "Choose a time" opens the day sheet ready to place them;
 * "Take off" removes them from the list.
 */
import { useMemo } from "react";

import { useI18n } from "../i18n/index.tsx";
import { today as todayOf } from "../lib/clock.ts";
import { useNow } from "../lib/useNow.ts";
import { waitingInOrder } from "../lib/waitlist.ts";
import { useDesk } from "../state/desk.ts";
import { Screen, ScreenHead, dashedNote } from "./deskwork/parts.tsx";
import { WaitRow } from "./waitlist/WaitRow.tsx";
import { useFits } from "./waitlist/useFits.ts";

export default function Waitlist() {
  const { t } = useI18n();
  useNow();
  const today = todayOf();
  const waiting = useDesk((s) => s.waiting);
  const list = useMemo(() => waitingInOrder(Object.values(waiting)), [waiting]);
  const fits = useFits(list);

  return (
    <Screen name="Waitlist">
      <ScreenHead kicker={t("nav.waitlist")} title={t("wlist.title")} lede={t("wlist.lede")} ledeWidth="54ch" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length > 0 && (
          <ol aria-label={t("nav.waitlist")} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((entry, i) => (
              <li key={entry.id}>
                <WaitRow entry={entry} position={i + 1} fit={fits.get(entry.id)} today={today} />
              </li>
            ))}
          </ol>
        )}
        {list.length === 0 && <div style={dashedNote}>{t("wlist.empty")}</div>}
      </div>
    </Screen>
  );
}
