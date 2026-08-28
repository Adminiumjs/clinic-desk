/**
 * Ref → table for this app.
 *
 * App-specific by nature: it is one of exactly two things a repo supplies to
 * the shared hosted-mode machinery (the other is the side→persona line in
 * `main.tsx`). Kept in its own module rather than beside that line so
 * `refCoverage.test.ts` can check it against `REQUIRED` — an unmapped ref is
 * invisible until a hosted build asks for it.
 */
export const TABLE_OF_REF = {
  visitTypes: "visit_types",
  clinicians: "clinicians",
  appointments: "appointments",
  /*
   * The days the practice does not work. Added the same hour as the `closures`
   * entry in `REQUIRED`, because the two are one decision: a ref this app reads
   * and this map does not carry throws `UNKNOWN_REF` on the first hosted load,
   * in production, in a repo whose suite is green. `refCoverage.test.ts` is
   * what makes forgetting one half a red suite instead.
   */
  closures: "closures",
} as const;
