import crypto from "crypto";
import { headers } from "next/headers";

import { getPublicAppUrl } from "@/lib/public-app-url";
import { createServiceClient } from "@/lib/supabase/server";

const DEFAULT_LOCAL_FALLBACK = "http://localhost:3000";

async function getHeaderValue(headerName: string) {
  const headerStore = await headers();
  const value = headerStore.get(headerName)?.split(",")[0]?.trim();
  return value || "";
}

function hostHeaderLooksLoopback(host: string) {
  const [name] = host.split(":");
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "0.0.0.0" ||
    name.startsWith("127.")
  );
}

/**
 * Canonical origin for auth redirects and notification email links.
 *
 * Prefer env / Vercel-derived URLs from {@link getPublicAppUrl} so server jobs
 * (cron, internal fetches) never pick `Host: localhost` over `VERCEL_URL`.
 * Request headers are only used when the app URL is still the local default.
 */
export async function getBaseUrl() {
  const canonical = getPublicAppUrl();
  if (canonical !== DEFAULT_LOCAL_FALLBACK) {
    return canonical;
  }

  const forwardedHost = await getHeaderValue("x-forwarded-host");
  const host = forwardedHost || (await getHeaderValue("host"));
  if (!host) {
    return canonical;
  }

  const deployed = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (deployed && hostHeaderLooksLoopback(host)) {
    return canonical;
  }

  const forwardedProto = await getHeaderValue("x-forwarded-proto");
  const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * Restrict post-auth redirects to same-origin paths (used in `/auth/callback` as `next`).
 */
export function sanitizeAuthNextPath(raw: string | undefined | null): string {
  const v = (raw ?? "/").trim();
  if (!v || v === "/") return "/";
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("://") || v.includes("\\")) {
    return "/";
  }
  return v;
}

export async function buildAuthRedirectUrl(nextPath: string) {
  const baseUrl = await getBaseUrl();
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(sanitizeAuthNextPath(nextPath))}`;
}

type PortalUserMetadataParams = {
  chapterId?: string | null;
  name: string;
  portalArchived: boolean;
  primaryRole: string;
  prismaUserId?: string;
  roles: string[];
};

export function buildPortalUserMetadata(params: PortalUserMetadataParams) {
  return {
    name: params.name,
    primaryRole: params.primaryRole,
    chapterId: params.chapterId ?? null,
    prismaUserId: params.prismaUserId,
    portalArchived: params.portalArchived,
    roles: params.roles,
  };
}

type EnsureSupabaseAuthUserParams = {
  chapterId?: string | null;
  email: string;
  existingSupabaseAuthId?: string | null;
  name: string;
  portalArchived: boolean;
  primaryRole: string;
  prismaUserId?: string;
  roles: string[];
};

export async function ensureSupabaseAuthUser(params: EnsureSupabaseAuthUserParams) {
  const supabaseAdmin = createServiceClient();
  const metadata = buildPortalUserMetadata(params);

  if (params.existingSupabaseAuthId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(params.existingSupabaseAuthId, {
      email: params.email,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      throw new Error(error.message || "Could not update the authentication account.");
    }

    return params.existingSupabaseAuthId;
  }

  const temporaryPassword = `Setup-${crypto.randomUUID()}1a`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (error?.message?.includes("already been registered")) {
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      throw new Error(listError.message || "Could not look up the authentication account.");
    }

    const existingAuthUser = listData?.users?.find(
      (candidate: { email?: string | null; id: string }) =>
        candidate.email?.toLowerCase() === params.email.toLowerCase()
    );

    if (existingAuthUser) {
      const { error: syncError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
        email: params.email,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (syncError) {
        throw new Error(syncError.message || "Could not update the authentication account.");
      }

      return existingAuthUser.id;
    }
  }

  if (error || !data.user?.id) {
    throw new Error(error?.message || "Could not create the authentication account.");
  }

  return data.user.id;
}

type UpdateSupabasePortalUserParams = {
  chapterId?: string | null;
  email: string;
  name: string;
  portalArchived: boolean;
  primaryRole: string;
  prismaUserId?: string;
  roles: string[];
  supabaseAuthId: string;
};

export async function updateSupabasePortalUser(params: UpdateSupabasePortalUserParams) {
  const supabaseAdmin = createServiceClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(params.supabaseAuthId, {
    email: params.email,
    email_confirm: true,
    user_metadata: buildPortalUserMetadata(params),
  });

  if (error) {
    throw new Error(error.message || "Could not update the authentication account.");
  }
}

export async function generateSupabaseRecoveryLink(email: string, nextPath = "/reset-password") {
  const supabaseAdmin = createServiceClient();
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: await buildAuthRedirectUrl(nextPath),
    },
  });

  const actionLink = data?.properties?.action_link;

  if (error || !actionLink) {
    throw new Error(error?.message || "Could not generate the setup link.");
  }

  return actionLink;
}
