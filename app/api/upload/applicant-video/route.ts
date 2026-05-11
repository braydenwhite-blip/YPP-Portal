import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { uploadFile } from "@/lib/storage";
import { getSession } from "@/lib/auth-supabase";
import {
  APPLICANT_VIDEO_ALLOWED_MIME_TYPES,
  APPLICANT_VIDEO_MAX_SIZE_BYTES,
  APPLICANT_VIDEO_STORAGE_PREFIX,
  isApplicantVideoFileAllowed,
  sanitizeUploadFilename,
} from "@/lib/applicant-video-upload";

export const runtime = "nodejs";

function getRequestKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "anonymous";
  }

  return request.headers.get("x-real-ip") || "anonymous";
}

function getBlobUploadMode() {
  return process.env.BLOB_READ_WRITE_TOKEN ? "client" : "server";
}

export async function GET() {
  // Sensitive size / mode info — only authenticated users see it. Without
  // auth this advertised the env config (mode + max size) to anyone.
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    mode: getBlobUploadMode(),
    maxSizeBytes: APPLICANT_VIDEO_MAX_SIZE_BYTES,
  });
}

export async function POST(request: NextRequest) {
  // Authentication: this endpoint accepts files up to 500MB and returns a
  // public URL anyone can hot-link. Previously it had only IP-based rate
  // limiting, leaving YPP storage open to anyone on the public internet
  // (trivially evaded behind NAT/proxies). Require a session.
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to upload a video." }, { status: 401 });
  }

  // Per-user rate limit AND per-IP rate limit. A logged-in attacker rotating
  // requests is bounded by their userId; an unauthenticated rate-limit alone
  // (IP) was bypassable. We keep the IP limit as defense-in-depth.
  const userRateLimit = checkRateLimit(
    `applicant-video-upload:user:${session.user.id}`,
    20,
    15 * 60 * 1000
  );
  if (!userRateLimit.success) {
    return NextResponse.json(
      { error: "Too many upload attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }
  const ipRateLimit = checkRateLimit(
    `applicant-video-upload:ip:${getRequestKey(request)}`,
    60,
    15 * 60 * 1000
  );
  if (!ipRateLimit.success) {
    return NextResponse.json(
      { error: "Too many upload attempts from this network. Please try again later." },
      { status: 429 }
    );
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    if (getBlobUploadMode() !== "client") {
      return NextResponse.json(
        { error: "Client uploads are not configured in this environment." },
        { status: 503 }
      );
    }

    try {
      const body = (await request.json()) as HandleUploadBody;
      const json = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: [...APPLICANT_VIDEO_ALLOWED_MIME_TYPES],
          maximumSizeInBytes: APPLICANT_VIDEO_MAX_SIZE_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        }),
        onUploadCompleted: async () => {},
      });

      return NextResponse.json(json);
    } catch (error) {
      console.error("[ApplicantVideoUpload] Client upload setup failed:", error);
      return NextResponse.json(
        { error: "We couldn't start the video upload. Please try again." },
        { status: 500 }
      );
    }
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No video file was provided." }, { status: 400 });
    }

    if (!isApplicantVideoFileAllowed(file)) {
      return NextResponse.json(
        { error: "Please upload an MP4, MOV, or WebM video." },
        { status: 400 }
      );
    }

    if (file.size > APPLICANT_VIDEO_MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Video is too large. Maximum size is 500MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadFile({
      file: buffer,
      filename: `${APPLICANT_VIDEO_STORAGE_PREFIX}-${sanitizeUploadFilename(file.name)}`,
      contentType: file.type || "video/mp4",
    });

    if (!uploadResult.success || !uploadResult.url) {
      return NextResponse.json(
        { error: uploadResult.error || "Upload failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: uploadResult.url,
      originalName: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("[ApplicantVideoUpload] Server upload failed:", error);
    return NextResponse.json(
      { error: "We couldn't upload that video. Please try again." },
      { status: 500 }
    );
  }
}
