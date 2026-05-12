import { NextResponse } from "next/server";

import { getLeadershipSession } from "@/lib/leadership-action-center/authorization";
import { CATEGORY_STYLES } from "@/lib/leadership-action-center/constants";
import { prisma } from "@/lib/prisma";

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(csvEscape).join(",");
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Round-trip-able CSV export of the Leadership Action Center. Columns
 * intentionally mirror the spreadsheet headers we auto-detect on import so
 * the file can be re-pasted into the import tool later without re-mapping.
 */
export async function GET() {
  const session = await getLeadershipSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.leadershipActionItem.findMany({
    where: { archivedAt: null },
    include: {
      primaryOwner: { select: { name: true, email: true } },
      meeting: { select: { title: true } },
      inputNeededFrom: {
        select: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: [
      { dueDate: { sort: "asc", nulls: "last" } },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
  });

  const headers = [
    "Category",
    "Item",
    "Deadline",
    "Primary Owners",
    "Get Input From",
    "Status",
    "Priority",
    "Needs Officer Discussion?",
    "Officer Discussion Date",
    "Meeting",
    "Operating Week",
    "Notes",
    "Last Updated",
  ];

  const rows: string[] = [csvRow(headers)];
  for (const item of items) {
    const primaryOwners: string[] = [];
    if (item.primaryOwner?.name) primaryOwners.push(item.primaryOwner.name);
    for (const name of item.ownerNames) if (name.trim()) primaryOwners.push(name);

    const inputNeeded: string[] = [];
    for (const link of item.inputNeededFrom) {
      if (link.user.name) inputNeeded.push(link.user.name);
      else if (link.user.email) inputNeeded.push(link.user.email);
    }
    for (const name of item.inputNeededNames) if (name.trim()) inputNeeded.push(name);

    rows.push(
      csvRow([
        CATEGORY_STYLES[item.category].label,
        item.title,
        formatDate(item.dueDate),
        primaryOwners.join("; "),
        inputNeeded.join("; "),
        item.status,
        item.priority,
        item.needsOfficerDiscussion ? "Yes" : "No",
        formatDate(item.officerDiscussionDate),
        item.meeting?.title ?? "",
        formatDate(item.weekStart),
        item.notes ?? "",
        item.updatedAt.toISOString(),
      ])
    );
  }

  const body = rows.join("\n") + "\n";
  const filename = `ypp-action-center-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
