import { verifySession } from "@/lib/dal";
import { listPatients } from "@/app/actions/patients";
import { listSessions } from "@/app/actions/sessions";
import { PatientsClient } from "@/app/patients/PatientsClient";

export default async function PatientsPage() {
  await verifySession();

  const [{ data: patients }, { data: sessions }] = await Promise.all([
    listPatients(),
    listSessions(),
  ]);

  return <PatientsClient initialPatients={patients ?? []} initialSessions={sessions ?? []} />;
}
