import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { Button, CardV2, PageHeaderV2, StatusBadge } from "@/components/ui-v2";
import { FieldLabel } from "@/components/field-help";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import {
  MENTORSHIP_RESOURCE_TYPE_META,
  getMentorshipResourceLibrary,
} from "@/lib/mentorship-hub";
import { createMentorshipResource } from "@/lib/mentorship-hub-actions";
import { EmptyStateEditorial } from "../_components/empty-state-editorial";

export const metadata = { title: "Resource Commons — Mentorship" };

const INPUT_CLASS =
  "w-full rounded-lg border border-line-soft px-3 py-2 text-[13.5px] text-ink";

const RESOURCE_COMMONS_GUIDE_ITEMS = [
  {
    label: "Search The Commons",
    meaning:
      "This is the library search for shared links, answer summaries, templates, and playbooks created through mentoring work.",
    howToUse:
      "Search here before making a new resource so you do not publish duplicates and so you can reuse good material faster.",
  },
  {
    label: "Publish A Resource",
    meaning:
      "This form turns useful mentoring knowledge into something the whole community can benefit from later.",
    howToUse:
      "Publish when you have a link, note set, checklist, or answer that would still be useful after the original conversation is over.",
  },
  {
    label: "Featured Resources",
    meaning:
      "Featured items are the strongest or most broadly helpful resources in the library.",
    howToUse:
      "Feature a resource when it deserves extra visibility for other mentors and students.",
  },
  {
    label: "Open and Reuse",
    meaning:
      "Each card is meant to be reused in real mentoring work, not just stored.",
    howToUse:
      "Open a resource when you need a shortcut, example, or teaching tool during feedback, sessions, or monthly reviews.",
  },
] as const;

export default async function CuratedResourcesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; passionId?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const passionId = params.passionId?.trim() ?? "";

  const roles = session.user.roles ?? [];
  const canPublish =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("ADMIN");

  const resources = await getMentorshipResourceLibrary({
    q: q || undefined,
    passionId: passionId || undefined,
  });

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Mentor console"
        title="Resource Commons"
        subtitle="Search shared links, playbooks, answer summaries, and templates that came out of real mentoring work."
        backHref="/mentorship"
        backLabel="Mentorship"
      />

      <MentorshipGuideCard
        title="How To Use The Resource Commons"
        intro="This area stores the mentoring knowledge that should outlive one conversation and help the next person faster."
        items={RESOURCE_COMMONS_GUIDE_ITEMS}
      />

      <CardV2 padding="md">
        <form method="GET" className="grid items-end gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel
              label="Search the commons"
              help={{
                title: "Search The Commons",
                guidance:
                  "Search by title, keywords, or a type of problem you are trying to solve.",
                example: "Try 'pitch checklist', 'coding roadmap', or 'audition warmup'.",
              }}
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              className={INPUT_CLASS}
              placeholder="Search by title, description, or body..."
            />
          </div>
          <div>
            <FieldLabel
              label="Passion area"
              help={{
                title: "Passion Area Filter",
                guidance: "This narrows the library to a specific subject area.",
                example: "Use Design or Coding to only see resources in that area.",
              }}
            />
            <div className="flex gap-2">
              <input
                type="text"
                name="passionId"
                defaultValue={passionId}
                className={INPUT_CLASS}
                placeholder="coding, music, visual-arts..."
              />
              <Button type="submit" variant="secondary" size="sm">
                Filter
              </Button>
            </div>
          </div>
        </form>
      </CardV2>

      {canPublish && (
        <CardV2 padding="md">
          <h2 className="m-0 mb-3 text-[13.5px] font-bold text-ink">Publish a resource</h2>
          <form action={createMentorshipResource} className="flex flex-col gap-4">
            <div>
              <FieldLabel
                label="Title"
                required
                help={{
                  title: "Resource Title",
                  guidance:
                    "Give the resource a short, specific name so people know what it helps with before opening it.",
                  example: "Pitch deck checklist",
                }}
              />
              <input
                name="title"
                className={INPUT_CLASS}
                placeholder="Pitch deck checklist"
                required
              />
            </div>
            <div>
              <FieldLabel
                label="Type"
                help={{
                  title: "Resource Type",
                  guidance: "This classifies the resource so the library stays organized.",
                  example:
                    "Use Link for an outside URL, Template for something people should copy, or Answer for a polished response.",
                }}
              />
              <select name="type" className={INPUT_CLASS} defaultValue="LINK">
                {Object.entries(MENTORSHIP_RESOURCE_TYPE_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel
                label="URL (optional)"
                help={{
                  title: "URL",
                  guidance: "Add a link when the resource lives somewhere else online.",
                  example: "A shared document, video, article, or website.",
                }}
              />
              <input type="url" name="url" className={INPUT_CLASS} placeholder="https://..." />
            </div>
            <div>
              <FieldLabel
                label="Passion area (optional)"
                help={{
                  title: "Passion Area",
                  guidance:
                    "This makes the resource easier to find for people working in the same area.",
                  example: "coding, music, design",
                }}
              />
              <input
                name="passionId"
                className={INPUT_CLASS}
                placeholder="coding, music, design..."
              />
            </div>
            <div>
              <FieldLabel
                label="Description"
                help={{
                  title: "Description",
                  guidance: "Describe why this resource matters and when someone should use it.",
                  example:
                    "A quick checklist for students getting ready to present their first pitch deck.",
                }}
              />
              <textarea
                name="description"
                className={INPUT_CLASS}
                rows={3}
                placeholder="Why is this worth sharing?"
              />
            </div>
            <div>
              <FieldLabel
                label="Body (optional)"
                help={{
                  title: "Body",
                  guidance:
                    "Paste the actual notes, checklist, summary, or playbook here when the resource should be readable inside the portal.",
                  example:
                    "Step 1: start with the audience problem. Step 2: explain your solution. Step 3: show proof.",
                }}
              />
              <textarea
                name="body"
                className={INPUT_CLASS}
                rows={4}
                placeholder="Paste notes, prompts, or a playbook here."
              />
            </div>
            <div>
              <FieldLabel
                label="Feature this resource"
                help={{
                  title: "Feature This Resource",
                  guidance: "Featuring gives the resource extra prominence in the commons.",
                  example:
                    "Choose featured when this is a resource many people should see early, not only something useful in one special case.",
                }}
              />
              <select name="isFeatured" className={INPUT_CLASS} defaultValue="false">
                <option value="false">Standard resource</option>
                <option value="true">Feature it</option>
              </select>
            </div>
            <div>
              <Button type="submit" variant="primary" size="sm">
                Publish Resource
              </Button>
            </div>
          </form>
        </CardV2>
      )}

      {resources.length === 0 ? (
        <div>
          <EmptyStateEditorial
            title="No resources published yet."
            body="This library fills up when mentors publish links, playbooks, and promoted answers from real support work."
          />
          <p className="m-0 px-2 text-[13px] text-ink-muted">
            Good places to create new resources: the{" "}
            <Link href="/mentorship/feedback" className="font-semibold text-brand-700 hover:underline">
              Feedback Portal
            </Link>{" "}
            and{" "}
            <Link href="/mentorship/ask" className="font-semibold text-brand-700 hover:underline">
              Ask a Mentor
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 px-1 text-[13px] text-ink-muted">
            <strong className="text-ink">
              {resources.length} published resource{resources.length === 1 ? "" : "s"}
            </strong>
            {q ? ` matching “${q}”` : ""}
            {passionId ? ` in ${passionId}` : ""}.
          </p>

          {resources.map((resource) => (
            <CardV2 key={resource.id} padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <StatusBadge tone="neutral">
                      {MENTORSHIP_RESOURCE_TYPE_META[resource.type].label}
                    </StatusBadge>
                    {resource.isFeatured && <StatusBadge tone="success">Featured</StatusBadge>}
                    {resource.passionId && (
                      <StatusBadge tone="brand">{resource.passionId}</StatusBadge>
                    )}
                  </div>
                  <h3 className="m-0 text-[15px] font-semibold text-ink">{resource.title}</h3>
                  <p className="m-0 mt-1 text-[12px] text-ink-muted">
                    Shared by {resource.createdBy.name}
                    {resource.request
                      ? ` · From ${resource.request.kind.replace(/_/g, " ").toLowerCase()}`
                      : ""}
                  </p>
                  {resource.description && (
                    <p className="m-0 mt-2.5 text-[14px] text-ink">{resource.description}</p>
                  )}
                  {resource.body && (
                    <p className="m-0 mt-2.5 text-[13px] text-ink-muted">
                      {resource.body.length > 260
                        ? `${resource.body.slice(0, 259)}…`
                        : resource.body}
                    </p>
                  )}
                </div>
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-brand-700 no-underline transition-colors hover:bg-brand-50"
                  >
                    Open →
                  </a>
                )}
              </div>
            </CardV2>
          ))}
        </div>
      )}
    </div>
  );
}
