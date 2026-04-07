import crypto from "crypto";
import { headers } from "next/headers";

import { createServiceClient } from "@/lib/supabase/server";

function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") || "";
}

function isLoopbackHost(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function getHeaderValue(headerName: string) {
  const value = headers().get(headerName)?.split(",")[0]?.trim();
  return value || "";
}

export function getBaseUrl() {
  const publicAppUrl = normalizeUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (publicAppUrl) return publicAppUrl;

  const publicSiteUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (publicSiteUrl) return publicSiteUrl;

  const siteUrl = normalizeUrl(process.env.SITE_URL);
  if (siteUrl) return siteUrl;

  const forwardedHost = getHeaderValue("x-forwarded-host");
  const host = forwardedHost || getHeaderValue("host");
  const forwardedProto = getHeaderValue("x-forwarded-proto");

  if (host) {
    const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
    return `${protocol}://${host}`;
  }

  const nextAuthUrl = normalizeUrl(process.env.NEXTAUTH_URL);
  if (nextAuthUrl && !isLoopbackHost(nextAuthUrl)) return nextAuthUrl;

  const vercelProductionUrl = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelProductionUrl) {
    return /^https?:\/\//i.test(vercelProductionUrl)
      ? vercelProductionUrl
      : `https://${vercelProductionUrl}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  if (nextAuthUrl) return nextAuthUrl;

  return "http://localhost:3000";
}

export function buildAuthRedirectUrl(nextPath: string) {
  return `${getBaseUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`;
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
      redirectTo: buildAuthRedirectUrl(nextPath),
    },
  });

  const actionLink = data?.properties?.action_link;

  if (error || !actionLink) {
    throw new Error(error?.message || "Could not generate the setup link.");
  }

  return actionLink;
}
