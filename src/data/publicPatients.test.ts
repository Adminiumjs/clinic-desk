/**
 * The patients' pages over the public API, with a fake client that answers as
 * the server does: the catalogue's filtered entries leave the columns they
 * filter on out of their reply, and the own-visits entry offers no order.
 */
import { describe, expect, it } from "vitest";
import type { PublicClient } from "@adminiumjs/public-client";

import { publicPatientsPort } from "./publicPatients.ts";
import { TABLE_OF_REF } from "./tableOfRef.ts";

const ref = (actions: string[], expose: string[] = [], kind?: string) => ({ actions, expose, ...(kind === undefined ? {} : { kind }) });

function fakeClient(asked: { ref: string; opts: unknown }[]): PublicClient {
  const config = {
    timezone: "Europe/London",
    claim: { ref: "clinic_patients_claim" },
    refs: {
      clinic_settings: ref(["read"]),
      clinic_opening_hours: ref(["read"]),
      clinic_clinicians: ref(["read"], ["name", "bio"]),
      clinic_clinicians_names: ref(["read"], ["name"]),
      clinic_visit_types: ref(["read"]),
      clinic_clinician_visit_types: ref(["read"]),
      clinic_faqs: ref(["read"]),
      clinic_closures: ref(["read"]),
      clinic_appointments_availability: ref(["read"], [], "availability"),
      clinic_patients_claim: ref(["read"]),
      clinic_patients_verified: ref(["read", "update"]),
      clinic_appointments_claimed: ref(["create"]),
      clinic_appointments_verified: ref(["read", "update"]),
      clinic_registrations: ref(["create"]),
    },
  };
  const rows: Record<string, Record<string, unknown>[]> = {
    clinic_clinicians: [{ id: 1, name: "Dr Amara Osei", short_name: "Dr Osei", position: 1 }],
    clinic_clinicians_names: [{ id: 2, name: "Dr Left", short_name: "Dr Left" }],
    clinic_visit_types: [{ id: 3, name: "Routine check", minutes: 15, fee: 45, position: 1 }],
    clinic_faqs: [{ id: 4, question: "Parking?", answer: "On the street.", position: 1 }],
    clinic_closures: [{ id: 5, from_date: "2026-08-31", to_date: "2026-08-31", label: "Bank holiday", note: null, clinician_id: null }],
    clinic_appointments_verified: [
      { id: 7, starts_at: "2026-07-20T09:00:00.000Z", status: "seen" },
      { id: 8, starts_at: "2026-08-04T09:00:00.000Z", status: "booked" },
    ],
  };
  return {
    config: async () => config,
    list: async (name: string, opts: unknown) => {
      asked.push({ ref: name, opts });
      return { data: rows[name] ?? [] };
    },
  } as unknown as PublicClient;
}

describe("the patients' pages over the public API", () => {
  it("takes the catalogue's filtered rows as active and bookable, and leaves the names alone", async () => {
    const port = await publicPatientsPort(fakeClient([]), TABLE_OF_REF);
    const cat = await port.catalogue();
    expect(cat.clinicians[0]).toMatchObject({ active: true, bookable_online: true });
    expect(cat.visitTypes[0]).toMatchObject({ active: true, bookable_online: true });
    expect(cat.faqs[0]).toMatchObject({ active: true });
    expect(cat.closures[0]).toMatchObject({ active: true });
    expect(cat.names[0]).not.toHaveProperty("bookable_online", true);
  });

  it("asks for its own visits with no order the entry refuses, and shows the newest first", async () => {
    const asked: { ref: string; opts: unknown }[] = [];
    const port = await publicPatientsPort(fakeClient(asked), TABLE_OF_REF);
    const visits = await port.myVisits();
    expect(asked.find((a) => a.ref === "clinic_appointments_verified")?.opts).not.toHaveProperty("order");
    expect(visits.map((v) => v.id)).toEqual([8, 7]);
  });
});
