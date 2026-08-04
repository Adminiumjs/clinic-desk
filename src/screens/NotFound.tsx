/**
 * 404.
 *
 * Reachable from the public site's "Find us" link, which is deliberately a cut
 * feature rather than a dead button — the view exists, says honestly what this
 * demo covers, and offers the way back. Which way back depends on which side of
 * the practice the reader is standing on.
 */

import { Compass } from "lucide-react";

import { useI18n } from "../i18n/index.tsx";
import { useStore } from "../state/store.ts";
import { Button, Empty } from "../components/Primitives.tsx";

export default function NotFound() {
  const { t } = useI18n();
  const go = useStore((s) => s.go);
  const persona = useStore((s) => s.persona);
  const clinic = persona === "clinic";

  return (
    <div className="rh-screen rh-column">
      <Empty
        icon={<Compass size={22} aria-hidden="true" />}
        title={t("notfound.title")}
        body={t("notfound.body")}
        action={
          <Button onClick={() => go(clinic ? "daysheet" : "find")}>
            {t(clinic ? "notfound.action" : "notfound.actionPatient")}
          </Button>
        }
      />
    </div>
  );
}
