import { prisma } from "@/lib/prisma";

export const activeEnrollmentStatuses = ["ENROLLED", "COMPLETED"];
export const nowPlus = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d; };
export async function actionLead(chapterId?: string | null) {
  const u = await (prisma as any).user.findFirst({ where: { OR: [{ roles: { some: { role: "CHAPTER_PRESIDENT" } } }, { roles: { some: { role: "ADMIN" } } }] } }).catch(() => null);
  return u?.id ?? "system";
}
