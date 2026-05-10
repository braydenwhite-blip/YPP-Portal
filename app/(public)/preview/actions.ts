"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PREVIEW_COOKIE_MAX_AGE_SECONDS,
  PREVIEW_COOKIE_NAME,
  PREVIEW_FLASH_COOKIE_NAME,
  comparePreviewPasscode,
  signPreviewToken,
} from "@/lib/public-gate";

function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

/**
 * Server action wired to the /preview passcode form. Verifies the
 * supplied passcode against PORTAL_PREVIEW_PASSCODE in constant time,
 * issues a signed HTTP-only cookie on match, and bounces the user back
 * to their original destination.
 */
export async function enterPreviewModeAction(formData: FormData): Promise<void> {
  const rawPasscode = formData.get("passcode");
  const next = safeNextPath(formData.get("next"));
  const passcode = typeof rawPasscode === "string" ? rawPasscode.trim() : "";

  if (!passcode || !comparePreviewPasscode(passcode)) {
    const cookieStore = await cookies();
    cookieStore.set(PREVIEW_FLASH_COOKIE_NAME, "invalid", {
      path: "/preview",
      maxAge: 30,
      httpOnly: true,
      sameSite: "lax",
    });
    const params = new URLSearchParams();
    if (next !== "/") params.set("next", next);
    params.set("error", "1");
    redirect(`/preview${params.size ? `?${params.toString()}` : ""}`);
  }

  const token = await signPreviewToken();
  const cookieStore = await cookies();
  cookieStore.set(PREVIEW_COOKIE_NAME, token, {
    path: "/",
    maxAge: PREVIEW_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  cookieStore.set(PREVIEW_FLASH_COOKIE_NAME, "", {
    path: "/preview",
    maxAge: 0,
  });

  redirect(next);
}

export async function exitPreviewModeAction(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const cookieStore = await cookies();
  cookieStore.set(PREVIEW_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
  redirect(next);
}
