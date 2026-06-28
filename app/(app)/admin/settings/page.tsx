import { requireAdminPage } from "@/lib/page-guards";
import { getPortalSettings } from "@/lib/portal-settings";
import { PageHeaderV2 } from "@/components/ui-v2";

import PortalSettingsForm from "./PortalSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portal Settings | YPP" };

export default async function PortalSettingsPage() {
  await requireAdminPage();
  const settings = await getPortalSettings();

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-8">
      <PageHeaderV2
        eyebrow="Admin"
        title="Portal Settings"
        subtitle="Business-rule thresholds used across the portal. Any value left at its default falls back to the system default — changes take effect immediately."
      />
      <div className="mt-6">
        <PortalSettingsForm initial={settings} />
      </div>
    </div>
  );
}
