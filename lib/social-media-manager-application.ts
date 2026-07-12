/**
 * Social Media Manager hiring — portal form that replaces the Google Form
 * (https://forms.gle/1ksByiw669EcHuZk8). Uses Position type STAFF; accept
 * grants RoleType.STAFF via the existing chair-approval path.
 */

export const SOCIAL_MEDIA_MANAGER_KIND = "SOCIAL_MEDIA_MANAGER_V1";
export const SOCIAL_MEDIA_MANAGER_POSITION_TITLE = "Social Media Manager";
export const SOCIAL_MEDIA_MANAGER_TEAM_SLUG = "social-media";

export const SOCIAL_MEDIA_MANAGER_POSITION_DESCRIPTION = `As a Social Media Manager on the Youth Passion Project social media team, you will play a key role in:

• Creating and curating content for platforms like Instagram, TikTok, and more.
• Engaging with our online community, including responding to comments, messages, and encouraging discussion.
• Promoting events, initiatives, and success stories related to the Youth Passion Project.
• Brainstorming and implementing creative strategies to grow our social media presence and ensure it resonates with young people.

We're looking for individuals who are passionate about social media, creativity, and youth empowerment. Ideal candidates should have experience with social media management, be familiar with different platforms and trends, and be excited about contributing ideas to a positive, youth-driven project.`;

export const SOCIAL_MEDIA_MANAGER_POSITION_REQUIREMENTS = `Eligibility: 9th–12th grade, must be enrolled in high school. No previous experience needed.

Submit your school, grade, platform experience, portfolio links (if any), why you want to join, content ideas, and weekly availability.`;

export type SocialMediaManagerMetadata = {
  kind: typeof SOCIAL_MEDIA_MANAGER_KIND;
  school: string;
  grade: string;
  platforms: string;
  experience: string;
  portfolioLinks?: string;
  contentIdeas: string;
  weeklyAvailability: string;
  additionalNotes?: string;
};

export function isSocialMediaManagerPosition(title: string | null | undefined): boolean {
  return title?.trim() === SOCIAL_MEDIA_MANAGER_POSITION_TITLE;
}

export function parseSocialMediaManagerMetadata(
  raw: string | null | undefined
): SocialMediaManagerMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SocialMediaManagerMetadata>;
    if (
      parsed?.kind !== SOCIAL_MEDIA_MANAGER_KIND ||
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
      kind: SOCIAL_MEDIA_MANAGER_KIND,
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
