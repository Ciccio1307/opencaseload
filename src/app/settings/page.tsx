import { verifySession } from "@/lib/dal";
import { SettingsClient } from "@/app/settings/SettingsClient";

export default async function SettingsPage() {
  await verifySession();
  return <SettingsClient />;
}
