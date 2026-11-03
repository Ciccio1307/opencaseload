import { verifySession } from "@/lib/dal";
import { listPatients } from "@/app/actions/patients";
import { listSessions } from "@/app/actions/sessions";
import { DashboardClient } from "@/app/DashboardClient";

export default async function DashboardPage() {
  await verifySession();

  const [{ data: patients }, { data: sessions }] = await Promise.all([
    listPatients(),
    listSessions(),
  ]);

  return <DashboardClient initialPatients={patients ?? []} initialSessions={sessions ?? []} />;
}
