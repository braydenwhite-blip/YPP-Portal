import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOnboardingConfig } from "@/lib/chapter-onboarding-actions";
import { OnboardingConfigPanel } from "./onboarding-config-panel";
import Link from "next/link";

export default async function OnboardingSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const steps = await getOnboardingConfig();

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Onboarding Steps</h1>
          <p className="subtitle">
            Customize the welcome experience for new chapter members
          </p>
        </div>
        <Link href="/chapter/settings" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
          ← Back to Settings
        </Link>
      </div>

      <OnboardingConfigPanel steps={steps} />
    </main>
  );
}
