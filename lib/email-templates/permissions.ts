/**
 * Who may edit persistent email templates.
 *
 * Restricted to ADMIN-role users who also hold the COMMUNICATIONS_ADMIN subtype
 * (SUPER_ADMIN supersedes, as everywhere else). The `/admin/email-templates`
 * route is additionally gated by `lib/admin-capabilities.ts`; this helper is the
 * defense-in-depth check used inside the API handlers and pages.
 */
import { hasAnyAdminSubtype } from "@/lib/admin-subtypes";

export interface TemplateEditorSessionUser {
  roles: string[];
  adminSubtypes: Array<string | null | undefined>;
}

export function canEditEmailTemplates(
  user: TemplateEditorSessionUser | null | undefined
): boolean {
  if (!user) return false;
  if (!user.roles.includes("ADMIN")) return false;
  return hasAnyAdminSubtype(user.adminSubtypes, ["SUPER_ADMIN", "COMMUNICATIONS_ADMIN"]);
}
