/**
 * The practice's patients, as Adminium is told of them (`people`).
 *
 * A patient (`patients`) is a person: their address is the one the outbox
 * writes to and the one their emailed code goes to; their name is the one the
 * desk keeps; their language is the one they asked to be written to in. A
 * mail's first name is the first word of the name.
 *
 * There is no consent column. "Remind me by email" (`remind_email`) is the
 * patient's switch for visit reminders, which the outbox reads as its opt-in;
 * it is not a yes to a newsletter, and the practice sends none. Nor is there a
 * customer column: everyone on file is a patient the practice cares for.
 *
 * A patient is also copied before they are one, or beside their record:
 *
 *   - a registration (the patients' pages' "Register") keeps the name, address
 *     and mobile they typed, and links to the patient the desk accepted it as,
 *     or found it to be;
 *   - a first visit booked online keeps the name, address and mobile typed for
 *     it, and links to the patient once the desk accepts it (a patient found
 *     before booking leaves these empty).
 *
 * Each copy is declared, so that finding, exporting and erasing a person
 * reaches it. A patient's record and their visits are the practice's health
 * records, which the law keeps (`keep` on their tables): an erasure leaves
 * those as they are, and blanks the copies on a registration.
 */
export const PEOPLE = [
  {
    table: "patients",
    kind: "people",
    email: "email",
    name: "name",
    firstName: "firstWordOfName",
    language: "language",
    copies: [
      { table: "registrations", column: "name", holds: "name", via: "patient_id" },
      { table: "registrations", column: "email", holds: "email", via: "patient_id" },
      { table: "registrations", column: "mobile", holds: "phone", via: "patient_id" },
      { table: "appointments", column: "new_name", holds: "name", via: "patient_id" },
      { table: "appointments", column: "new_email", holds: "email", via: "patient_id" },
      { table: "appointments", column: "new_mobile", holds: "phone", via: "patient_id" },
    ],
  },
];
