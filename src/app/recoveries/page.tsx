import { verifySession } from "@/lib/dal";
import { listPatients } from "@/app/actions/patients";
import { listSessions } from "@/app/actions/sessions";
import { RecoveriesClient } from "@/app/recoveries/RecoveriesClient";

export default async function RecoveriesPage() {
  await verifySession();

  const [{ data: patients }, { data: sessions }] = await Promise.all([
    listPatients(),
    listSessions(),
  ]);

  return <RecoveriesClient initialPatients={patients ?? []} initialSessions={sessions ?? []} />;
}
