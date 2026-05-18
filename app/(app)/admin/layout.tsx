import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-supabase";
import { canAccessAdminRoute } from "@/lib/admin-capabilities";

export const dynamic = "force-dynamic";

/**
 * Admin-subtype enforcement for the whole `/admin` area.
 *
 * The single ADMIN role is refined by subtypes (HIRING_ADMIN, MENTORSHIP_ADMIN,
 * INTAKE_ADMIN, CONTENT_ADMIN, COMMUNICATIONS_ADMIN, SUPER_ADMIN).
 * `lib/admin-capabilities.ts` maps every admin route to an owning domain;
 * applying it here means route access finally matches the sidebar — an admin
 * can no longer URL-hop into tools their subtype doesn't grant.
 *
 * Only ADMIN-role users are subtype-gated. Non-admin reviewers (HIRING_CHAIR,
 * CHAPTER_PRESIDENT) legitimately reach a few `/admin` pages; their access is
 * decided by each page's own role guard, so this layout lets them through.
 *
 * The request pathname comes from the `x-pathname` header set in `proxy.ts`
 * (layouts don't receive the pathname directly).
 */
export default async function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.roles.includes("ADMIN")) {
    const pathname = (await headers()).get("x-pathname");
    if (pathname && !canAccessAdminRoute(user.adminSubtypes, pathname)) {
      redirect("/");
    }
  }

  return <>{children}</>;
}
