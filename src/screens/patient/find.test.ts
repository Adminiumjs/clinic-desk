import { describe, expect, it } from "vitest";

import type { Catalogue } from "../../data/ports.ts";
import type { Clinician, VisitType } from "../../data/types.ts";
import { typesOffered } from "./Find.tsx";

const type = (id: number, over: Partial<VisitType> = {}): VisitType => ({
  id, name: `Type ${String(id)}`, short_name: "", minutes: 20, fee: 40, color: "", icon: "", bookable_online: true, new_patients_only: false, active: true, position: id, ...over,
});
const clinician = (id: number, over: Partial<Clinician> = {}): Clinician => ({
  id, name: `Dr ${String(id)}`, short_name: "", role_label: "", color: "", photo: null, bio: null, bookable_online: true, active: true, position: id, staff_email: null, ...over,
});
const catalogue = (visitTypes: VisitType[], clinicians: Clinician[], links: [number, number][]): Catalogue => ({
  settings: null, hours: [], clinicians, names: [], visitTypes, faqs: [], closures: [],
  links: links.map(([clinician_id, visit_type_id], i) => ({ id: i + 1, clinician_id, visit_type_id })),
});

describe("the visit types Find a time offers", () => {
  it("leaves out a type no clinician who can be booked online does", () => {
    const cat = catalogue([type(1), type(2), type(3)], [clinician(10), clinician(11, { bookable_online: false })], [[10, 1], [11, 2]]);
    // 2 is done only by someone not bookable online; 3 by nobody.
    expect(typesOffered(cat, true).map((t) => t.id)).toEqual([1]);
  });

  it("still keeps new-patient types to a first visit, and hidden types hidden", () => {
    const cat = catalogue([type(1, { new_patients_only: true }), type(2, { bookable_online: false }), type(3)], [clinician(10)], [[10, 1], [10, 2], [10, 3]]);
    expect(typesOffered(cat, true).map((t) => t.id)).toEqual([1, 3]);
    expect(typesOffered(cat, false).map((t) => t.id)).toEqual([3]);
  });
});
