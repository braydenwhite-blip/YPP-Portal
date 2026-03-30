"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { PositionType, ApplicationFormFieldType } from "@prisma/client";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Admin access required");
  return session;
}

export async function getFormTemplates(roleType?: PositionType) {
  return prisma.applicationFormTemplate.findMany({
    where: roleType ? { roleType } : undefined,
    include: { fields: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveTemplate(roleType: PositionType) {
  return prisma.applicationFormTemplate.findFirst({
    where: { roleType, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function createFormTemplate(formData: FormData) {
  await requireAdmin();

  const name = formData.get("name") as string;
  const roleType = formData.get("roleType") as PositionType;

  if (!name?.trim()) throw new Error("Template name is required");
  if (!roleType) throw new Error("Role type is required");

  const template = await prisma.applicationFormTemplate.create({
    data: { name: name.trim(), roleType },
  });

  revalidatePath("/admin/form-templates");
  return template;
}

export async function updateFormTemplate(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const isActive = formData.get("isActive") === "true";

  if (!id) throw new Error("Template ID required");

  await prisma.applicationFormTemplate.update({
    where: { id },
    data: {
      ...(name ? { name: name.trim() } : {}),
      isActive,
    },
  });

  revalidatePath("/admin/form-templates");
}

export async function deleteFormTemplate(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  if (!id) throw new Error("Template ID required");

  await prisma.applicationFormTemplate.delete({ where: { id } });
  revalidatePath("/admin/form-templates");
}

export async function addFormField(formData: FormData) {
  await requireAdmin();

  const templateId = formData.get("templateId") as string;
  const label = formData.get("label") as string;
  const fieldType = formData.get("fieldType") as ApplicationFormFieldType;
  const required = formData.get("required") !== "false";
  const placeholder = (formData.get("placeholder") as string) || null;
  const helpText = (formData.get("helpText") as string) || null;
  const options = (formData.get("options") as string) || null;

  if (!templateId || !label?.trim() || !fieldType) {
    throw new Error("Missing required fields");
  }

  // Get max sort order
  const maxField = await prisma.applicationFormField.findFirst({
    where: { templateId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (maxField?.sortOrder ?? -1) + 1;

  await prisma.applicationFormField.create({
    data: {
      templateId,
      label: label.trim(),
      fieldType,
      required,
      placeholder,
      helpText,
      options,
      sortOrder,
    },
  });

  revalidatePath("/admin/form-templates");
}

export async function updateFormField(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const label = formData.get("label") as string;
  const required = formData.get("required") !== "false";
  const placeholder = (formData.get("placeholder") as string) || null;
  const helpText = (formData.get("helpText") as string) || null;
  const options = (formData.get("options") as string) || null;

  if (!id) throw new Error("Field ID required");

  await prisma.applicationFormField.update({
    where: { id },
    data: {
      ...(label ? { label: label.trim() } : {}),
      required,
      placeholder,
      helpText,
      options,
    },
  });

  revalidatePath("/admin/form-templates");
}

export async function removeFormField(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  if (!id) throw new Error("Field ID required");

  await prisma.applicationFormField.delete({ where: { id } });
  revalidatePath("/admin/form-templates");
}

export async function reorderFormFields(templateId: string, fieldIds: string[]) {
  await requireAdmin();

  await prisma.$transaction(
    fieldIds.map((id, index) =>
      prisma.applicationFormField.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath("/admin/form-templates");
}
