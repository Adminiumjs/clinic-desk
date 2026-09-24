/**
 * Patients: the list (a server search, never the whole table) and one
 * patient's page. Which one shows is the store's `patientId`, so the header's
 * search and the day sheet can open a patient's page too.
 */
import { useUi } from "../state/ui.ts";
import PatientList from "./patients/PatientList.tsx";
import PatientPage from "./patients/PatientPage.tsx";

export default function Patients() {
  const patientId = useUi((s) => s.patientId);
  return patientId === null ? <PatientList /> : <PatientPage key={patientId} id={patientId} />;
}
