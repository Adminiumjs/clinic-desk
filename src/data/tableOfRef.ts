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
} as const;
