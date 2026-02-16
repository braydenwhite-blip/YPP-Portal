import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { UploadCategory as PrismaUploadCategory } from "@prisma/client";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const VALID_CATEGORIES = [
  "PROFILE_PHOTO",
  "ASSIGNMENT_SUBMISSION",
  "TRAINING_EVIDENCE",
  "APPLICATION_RESUME",
  "OTHER",
] as const;

type UploadCategory = (typeof VALID_CATEGORIES)[number];

const PRISMA_UPLOAD_CATEGORY_MAP: Record<UploadCategory, PrismaUploadCategory> = {
  PROFILE_PHOTO: "PROFILE_PHOTO",
  ASSIGNMENT_SUBMISSION: "ASSIGNMENT_SUBMISSION",
  TRAINING_EVIDENCE: "TRAINING_EVIDENCE",
  APPLICATION_RESUME: "OTHER",
  OTHER: "OTHER",
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 uploads per user per 10 minutes
  const rl = checkRateLimit(`upload:${session.user.id}`, 20, 10 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many upload requests. Please try again later." }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as string;
    const entityId = formData.get("entityId") as string | null;
    const entityType = formData.get("entityType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(category as UploadCategory)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const requestedCategory = category as UploadCategory;
    const prismaCategory = PRISMA_UPLOAD_CATEGORY_MAP[requestedCategory];
    const resolvedEntityType =
      requestedCategory === "APPLICATION_RESUME"
        ? entityType || "APPLICATION_RESUME"
        : entityType || null;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Use JPG, PNG, WebP, GIF, PDF, or DOC." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Sanitize original filename
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Generate a unique filename
    const ext = originalName.split(".").pop() || "bin";
    const filename = `${randomUUID()}.${ext}`;

    // Save to uploads directory
    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    const url = `/uploads/${filename}`;

    // Save metadata to database
    const upload = await prisma.fileUpload.create({
      data: {
        filename,
        originalName,
        mimeType: file.type,
        size: file.size,
        url,
        category: prismaCategory,
        userId: session.user.id,
        entityId: entityId || null,
        entityType: resolvedEntityType,
      },
    });

    // If this is a profile photo, update the user's profile
    if (category === "PROFILE_PHOTO") {
      await prisma.userProfile.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, avatarUrl: url },
        update: { avatarUrl: url },
      });
    }

    return NextResponse.json({
      id: upload.id,
      url: upload.url,
      originalName: upload.originalName,
      size: upload.size,
    });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const entityId = searchParams.get("entityId");
  const entityType = searchParams.get("entityType");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (category && VALID_CATEGORIES.includes(category as UploadCategory)) {
    const requestedCategory = category as UploadCategory;
    where.category = PRISMA_UPLOAD_CATEGORY_MAP[requestedCategory];
    if (requestedCategory === "APPLICATION_RESUME") {
      where.entityType = "APPLICATION_RESUME";
    }
  }
  if (entityId) where.entityId = entityId;
  if (entityType) where.entityType = entityType;

  const uploads = await prisma.fileUpload.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(uploads);
}
