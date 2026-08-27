/**
 * Technology Manager hiring — portal form for the YPP tech team.
 * Uses Position type STAFF; accept grants RoleType.STAFF via chair approval.
 */

export const TECHNOLOGY_MANAGER_KIND = "TECHNOLOGY_MANAGER_V1";
/** Legacy metadata kind stored on older applications. */
export const LEGACY_SOCIAL_MEDIA_MANAGER_KIND = "SOCIAL_MEDIA_MANAGER_V1";

export const TECHNOLOGY_MANAGER_POSITION_TITLE = "Technology Manager";
export const TECHNOLOGY_MANAGER_TEAM_SLUG = "technology";

export const TECHNOLOGY_MANAGER_POSITION_DESCRIPTION = `As a Technology Manager on the Youth Passion Project tech team, you will play a key role in:

• Helping maintain and improve portal tools, automations, and internal workflows.
• Supporting instructors and chapters with technical setup, documentation, and troubleshooting.
• Brainstorming and implementing practical improvements that make YPP operations smoother.
• Partnering with leadership on launches, integrations, and quality checks before go-live.

We're looking for students who enjoy building, debugging, and improving systems — not necessarily professional engineers, but people who are curious, reliable, and excited to help YPP run better behind the scenes.`;

export const TECHNOLOGY_MANAGER_POSITION_REQUIREMENTS = `Eligibility: 9th–12th grade, must be enrolled in high school. Prior coding experience is helpful but not required.

Submit your school, grade, technical interests, relevant experience, portfolio or project links (if any), why you want to join, ideas for improving YPP systems, and weekly availability.`;

export type TechnologyManagerMetadata = {
  kind: typeof TECHNOLOGY_MANAGER_KIND | typeof LEGACY_SOCIAL_MEDIA_MANAGER_KIND;
  school: string;
  grade: string;
  platforms: string;
  experience: string;
  portfolioLinks?: string;
  contentIdeas: string;
  weeklyAvailability: string;
  additionalNotes?: string;
};

export function isTechnologyManagerPosition(title: string | null | undefined): boolean {
  const normalized = (title ?? "").trim().toLowerCase();
  return (
    normalized === TECHNOLOGY_MANAGER_POSITION_TITLE.toLowerCase() ||
    normalized === "social media manager"
  );
}

export function parseTechnologyManagerMetadata(
  raw: string | null | undefined
): TechnologyManagerMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TechnologyManagerMetadata>;
    const kind = parsed?.kind;
    if (
      kind !== TECHNOLOGY_MANAGER_KIND &&
      kind !== LEGACY_SOCIAL_MEDIA_MANAGER_KIND
    ) {
      return null;
    }
    if (
      !parsed.school ||
      !parsed.grade ||
      !parsed.platforms ||
      !parsed.experience ||
      !parsed.contentIdeas ||
      !parsed.weeklyAvailability
    ) {
      return null;
    }
    return {
      kind,
      school: parsed.school,
      grade: parsed.grade,
      platforms: parsed.platforms,
      experience: parsed.experience,
      portfolioLinks: parsed.portfolioLinks,
      contentIdeas: parsed.contentIdeas,
      weeklyAvailability: parsed.weeklyAvailability,
      additionalNotes: parsed.additionalNotes,
    };
  } catch {
    return null;
  }
}

export function gradeLabel(grade: string): string {
  const map: Record<string, string> = {
    "9": "9th grade",
    "10": "10th grade",
    "11": "11th grade",
    "12": "12th grade",
  };
  return map[grade] ?? grade;
}
