/**
 * One of Adminium's own kit parts, drawn inside a desk screen: the refund (its
 * two steps, its words and its toast) and "Copy pay link". The kit is
 * Adminium's, loaded from the address the staff config gives; the parts speak
 * to Adminium over the person's own session, and Adminium asks their rights
 * again. Where no kit is served (an older Adminium, the website's demo) the
 * part is simply not drawn.
 */
import { useEffect, useRef } from "react";

import { useI18n } from "../../i18n/index.tsx";
import { useDeskPay } from "../../state/deskPay.ts";
import { useUi } from "../../state/ui.ts";
import type { StaffKit } from "../../staffConnection.ts";

interface Mounted {
  update(props: Record<string, unknown>): void;
  unmount(): void;
}
interface KitModule {
  mount(part: string, element: Element, props: Record<string, unknown>): Promise<Mounted>;
}

let loading: Promise<KitModule> | null = null;

/** The kit's module, loaded once, with its style sheets. */
function loadKit(kit: StaffKit): Promise<KitModule> {
  loading ??= (async () => {
    for (const href of kit.styles) {
      if (document.querySelector(`link[data-kit="${href}"]`) !== null) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset["kit"] = href;
      document.head.appendChild(link);
    }
    return (await import(/* @vite-ignore */ kit.entry)) as KitModule;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

export function KitPart({ part, props }: { part: "refund" | "pay-link"; props: Record<string, unknown> }) {
  const { locale, dir } = useI18n();
  const theme = useUi((s) => s.theme);
  const kit = useDeskPay((s) => s.kit);
  const csrfToken = useDeskPay((s) => s.csrfToken);
  const box = useRef<HTMLDivElement>(null);
  const mounted = useRef<Mounted | null>(null);
  const all = { ...props, locale, dir, theme, csrfToken: csrfToken ?? "" };
  const latest = useRef(all);
  latest.current = all;

  useEffect(() => {
    if (kit === null || box.current === null) return;
    let gone = false;
    void loadKit(kit)
      .then((module) => module.mount(part, box.current!, latest.current))
      .then((handle) => {
        if (gone) handle.unmount();
        else mounted.current = handle;
      })
      .catch((error: unknown) => console.warn(`[clinic] the kit's ${part} could not be drawn:`, error));
    return () => {
      gone = true;
      mounted.current?.unmount();
      mounted.current = null;
    };
  }, [kit, part]);

  useEffect(() => {
    mounted.current?.update(all);
  });

  if (kit === null) return null;
  return <div ref={box} data-kit-part={part} />;
}
