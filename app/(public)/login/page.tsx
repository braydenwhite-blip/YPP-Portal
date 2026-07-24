import { Suspense } from "react";

import BrandLockup from "@/components/brand-lockup";
import {
  canUseLocalPasswordFallback,
  hasSupabasePublicEnv,
} from "@/lib/supabase/config";

import { LoginPageContent } from "./login-page-content";

/**
 * Server entry — reads auth setup flags here so SSR and the client render the
 * same login banner / magic-link availability (avoids hydration mismatch).
 */
export default function LoginPage() {
  const localPasswordFallbackEnabled = canUseLocalPasswordFallback();
  const hasSupabasePublicAuth = hasSupabasePublicEnv();

  return (
    <Suspense
      fallback={
        <div className="login-shell">
          <div
            className="login-card login-card--brand"
            style={{ justifySelf: "center", textAlign: "center", padding: "48px 32px" }}
          >
            <BrandLockup height={52} className="brand-lockup" reloadOnClick />
          </div>
        </div>
      }
    >
      <LoginPageContent
        localPasswordFallbackEnabled={localPasswordFallbackEnabled}
        hasSupabasePublicAuth={hasSupabasePublicAuth}
      />
    </Suspense>
  );
}
