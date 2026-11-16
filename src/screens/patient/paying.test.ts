/**
 * Back from paying one of their own visits, the row says what Adminium says
 * of that payment: paid, the bank confirming it, not finished, or its time to
 * pay ran out — and nothing at all while it cannot tell (a checkout still
 * open, or none started). Read again once a patient signed out on the way
 * looks themselves up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OwnVisit, PatientsPort, PayAttemptState } from "../../data/ports.ts";
import { setPatientsPort } from "../../state/patients.ts";
import { afterLookup, usePaying } from "./paying.ts";

const visit = (balance: number): OwnVisit => ({
  id: 7,
  ref: "RH-3961",
  clinician_id: 3,
  visit_type_id: 3,
  starts_at: "2026-07-14T13:00:00.000Z",
  minutes: 45,
  status: "seen",
  late_cancel: false,
  reason: null,
  balance,
  paid: 60 - balance,
  refunded: 0,
});

/** A port that answers the visit's balance and the payment's states, one per question. */
function portOf(balances: number[], states: PayAttemptState[]): { asked: string[] } {
  const asked: string[] = [];
  setPatientsPort({
    myVisits: async () => [visit(balances.length > 1 ? balances.shift()! : balances[0]!)],
    payState: async (id: number, of: string) => {
      asked.push(`${of}:${String(id)}`);
      return states.length > 1 ? states.shift()! : states[0]!;
    },
  } as unknown as PatientsPort);
  return { asked };
}

beforeEach(() => {
  usePaying.setState({ step: null, away: true, awayVisit: 7, rowState: null, paidNow: null });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a visit paid from My visits, read again after the patient looks themselves up", () => {
  it.each(["confirming", "failed", "expired"] as const)("says %s on the visit's row, read through the visits' own door", async (state) => {
    const { asked } = portOf([25], [state]);
    await afterLookup();
    expect(usePaying.getState()).toMatchObject({ rowState: { id: 7, state }, away: false, awayVisit: null, paidNow: null });
    expect(asked).toEqual(["visit:7"]);
  });

  it("says Paid once the visit owes nothing, without asking about the payment", async () => {
    const { asked } = portOf([0], ["paid"]);
    await afterLookup();
    expect(usePaying.getState()).toMatchObject({ paidNow: 7, rowState: null });
    expect(asked).toEqual([]);
  });

  it("asks again while the checkout is open, until the visit reads as paid", async () => {
    vi.useFakeTimers();
    const { asked } = portOf([25, 25, 0], ["open", "paid"]);
    const done = afterLookup();
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
    expect(usePaying.getState()).toMatchObject({ paidNow: 7, rowState: null });
    expect(asked).toEqual(["visit:7", "visit:7"]);
  });

  it("claims nothing when no payment was started", async () => {
    portOf([25], ["none"]);
    await afterLookup();
    expect(usePaying.getState()).toMatchObject({ rowState: null, paidNow: null });
  });

  it("does nothing for a patient who did not leave to pay", async () => {
    usePaying.setState({ awayVisit: null });
    const { asked } = portOf([25], ["failed"]);
    await afterLookup();
    expect([usePaying.getState().rowState, asked]).toEqual([null, []]);
  });
});
