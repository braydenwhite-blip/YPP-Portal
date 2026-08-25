/**
 * YPP Metrics Tracker — declarative catalog.
 *
 * Monthly metrics reset each month; cumulative / lifetime keep a running total.
 * Category ratings roll up from leaf metrics via paceStatus.
 */

import type { PaceStatus } from "@/lib/chapters/analytics-pace";

export type MetricsScope = "org" | "chapter_president" | "instructor";

export type MetricReset = "monthly" | "cumulative";

export type ChartKind = "line" | "bar" | "area" | "scatter";

export type MetricDef = {
  id: string;
  label: string;
  owner: string;
  /** Human target copy shown in the UI. */
  targetLabel: string;
  /** Numeric target for the current month (M1–M6 indexed by chapter age when known). */
  monthlyTargets: Array<number | null>;
  /** Display strings for the M1–M6 target table (e.g. "80%+", "No Target"). */
  targetDisplay?: Array<string | null>;
  reset: MetricReset;
  unit: "count" | "percent" | "currency" | "hours" | "text";
  chart: ChartKind;
  tracks?: string;
  why?: string;
  /** When true, no numeric target — shown as informational. */
  noTarget?: boolean;
};

export type CategoryDef = {
  id: string;
  label: string;
  scope: MetricsScope;
  owner: string;
  description: string;
  /** Callout notes shown on the category detail page. */
  notes?: string[];
  metrics: MetricDef[];
};

const M6 = (values: Array<number | null>): Array<number | null> => {
  const out = [...values];
  while (out.length < 6) out.push(out[out.length - 1] ?? null);
  return out.slice(0, 6);
};

export const ORG_METRICS: MetricDef[] = [
  {
    id: "revenue",
    label: "Revenue (sponsorship package + donations)",
    owner: "Sanvi Mehta",
    targetLabel: "$5,000/month",
    monthlyTargets: M6([5000, 5000, 5000, 5000, 5000, 5000]),
    reset: "monthly",
    unit: "currency",
    chart: "bar",
  },
  {
    id: "students_per_class",
    label: "Number of students per class",
    owner: "Brayden White",
    targetLabel: "15 students",
    monthlyTargets: M6([15, 15, 15, 15, 15, 15]),
    reset: "monthly",
    unit: "count",
    chart: "line",
  },
  {
    id: "classes_all_chapters",
    label: "Number of classes all chapters",
    owner: "Brayden White",
    targetLabel: "10 classes",
    monthlyTargets: M6([10, 10, 10, 10, 10, 10]),
    reset: "monthly",
    unit: "count",
    chart: "bar",
  },
  {
    id: "expansion",
    label: "Expansion",
    owner: "Sanvi Mehta",
    targetLabel: "",
    monthlyTargets: M6([null, null, null, null, null, null]),
    reset: "monthly",
    unit: "text",
    chart: "line",
    noTarget: true,
  },
  {
    id: "parent_engagement",
    label: "Specific Parent engagement committees per chapter",
    owner: "Sanvi Mehta",
    targetLabel: "10 members",
    monthlyTargets: M6([10, 10, 10, 10, 10, 10]),
    reset: "monthly",
    unit: "count",
    chart: "bar",
  },
  {
    id: "social_apply",
    label: "Social media engagement",
    owner: "Sanvi Mehta",
    targetLabel: "Have 25 people apply every month",
    monthlyTargets: M6([25, 25, 25, 25, 25, 25]),
    reset: "monthly",
    unit: "count",
    chart: "line",
  },
  {
    id: "instagram_followers",
    label: "Instagram followers increased",
    owner: "Sanvi Mehta",
    targetLabel: "5000 new followers every month",
    monthlyTargets: M6([5000, 5000, 5000, 5000, 5000, 5000]),
    reset: "monthly",
    unit: "count",
    chart: "area",
  },
  {
    id: "tiktok_followers",
    label: "TikTok followers increased",
    owner: "Sanvi Mehta",
    targetLabel: "5000 new followers every month",
    monthlyTargets: M6([5000, 5000, 5000, 5000, 5000, 5000]),
    reset: "monthly",
    unit: "count",
    chart: "area",
  },
  {
    id: "linkedin_recruit",
    label: "LinkedIn",
    owner: "Sanvi Mehta",
    targetLabel: "Need to have successfully recruited 30 people per month",
    monthlyTargets: M6([30, 30, 30, 30, 30, 30]),
    reset: "monthly",
    unit: "count",
    chart: "bar",
  },
  {
    id: "facebook_apply",
    label: "Facebook",
    owner: "Sanvi Mehta",
    targetLabel: "Get 30 people a month to apply to join YPP through Facebook",
    monthlyTargets: M6([30, 30, 30, 30, 30, 30]),
    reset: "monthly",
    unit: "count",
    chart: "bar",
  },
  {
    id: "chapter_expansion",
    label: "Chapter Expansion",
    owner: "Brayden White",
    targetLabel: "2 new chapters up and running/month",
    monthlyTargets: M6([2, 2, 2, 2, 2, 2]),
    reset: "monthly",
    unit: "count",
    chart: "bar",
  },
  {
    id: "newsletters",
    label: "Newsletters",
    owner: "Sanvi Mehta",
    targetLabel: "1 newsletter/week",
    monthlyTargets: M6([4, 4, 4, 4, 4, 4]),
    reset: "monthly",
    unit: "count",
    chart: "line",
  },
  {
    id: "mttr",
    label: "Mean time to fix errors",
    owner: "Anthea Zamir",
    targetLabel: "8 hours – 1 day",
    monthlyTargets: M6([24, 24, 24, 24, 24, 24]),
    reset: "monthly",
    unit: "hours",
    chart: "line",
  },
  {
    id: "timeliness",
    label: "Timeliness % without errors",
    owner: "Anthea Zamir",
    targetLabel: "95% of time",
    monthlyTargets: M6([95, 95, 95, 95, 95, 95]),
    reset: "monthly",
    unit: "percent",
    chart: "line",
  },
  {
    id: "referrals",
    label: "Referrals",
    owner: "Everyone",
    targetLabel: "Refer 10 people for positions at YPP",
    monthlyTargets: M6([10, 10, 10, 10, 10, 10]),
    reset: "monthly",
    unit: "count",
    chart: "bar",
  },
];

export const CP_CATEGORIES: CategoryDef[] = [
  {
    id: "partnerships",
    label: "Partnerships",
    scope: "chapter_president",
    owner: "Chapter President",
    description: "Confirmed partners and whether they are actively contributing.",
    notes: [
      "A partner counts as confirmed if the organization has agreed to work with YPP and has a concrete next step.",
      "If a partner has not been active for more than 2 months, it no longer counts as a confirmed partner.",
    ],
    metrics: [
      {
        id: "cp_confirmed_partners",
        label: "Confirmed",
        owner: "Chapter President",
        targetLabel: "Current confirmed partners",
        tracks: "Organizations that agreed to work with YPP and have a next step",
        why: "Shows partnerships that have moved beyond plain interest",
        monthlyTargets: M6([2, 5, 8, 8, 10, 10]),
        targetDisplay: ["2+", "5+", "8+", "8+", "10+", "10+"],
        reset: "monthly",
        unit: "count",
        chart: "line",
      },
      {
        id: "cp_partner_activity",
        label: "Partner Activity",
        owner: "Chapter President",
        targetLabel: "80%+ of confirmed partners active that month",
        tracks:
          "% of confirmed partners actively hosting, promoting, recruiting for, or supporting YPP programming that month",
        why: "Shows whether confirmed partnerships are actually contributing",
        monthlyTargets: M6([80, 80, 80, 80, 80, 80]),
        targetDisplay: ["80%+", "80%+", "80%+", "80%+", "80%+", "80%+"],
        reset: "monthly",
        unit: "percent",
        chart: "bar",
      },
    ],
  },
  {
    id: "instructor_team",
    label: "Instructor Team",
    scope: "chapter_president",
    owner: "Chapter President",
    description: "Pipeline size, accepted instructors, and real contribution.",
    metrics: [
      {
        id: "cp_applicants",
        label: "Applicants",
        owner: "Chapter President",
        targetLabel: "Cumulative instructor applications",
        tracks: "People who submit an instructor application",
        why: "Shows size of recruiting pipeline",
        monthlyTargets: M6([10, 20, 30, 40, 50, 60]),
        targetDisplay: ["10+", "20+", "30+", "40+", "50+", "60+"],
        reset: "cumulative",
        unit: "count",
        chart: "area",
      },
      {
        id: "cp_accepted_instructors",
        label: "Accepted Instructors",
        owner: "Chapter President",
        targetLabel: "Current accepted instructors",
        tracks: "Applicants approved through the YPP interview process",
        why: "Shows how many instructors have been approved",
        monthlyTargets: M6([5, 10, 15, 18, 22, 25]),
        targetDisplay: ["5+", "10+", "15+", "18+", "22+", "25+"],
        reset: "monthly",
        unit: "count",
        chart: "line",
      },
      {
        id: "cp_instructor_activity",
        label: "Instructor Activity",
        owner: "Chapter President",
        targetLabel: "80%+ trained and contributing ≥1 hour",
        tracks:
          "% of accepted instructors who are trained and contribute at least 1 hour to Hours of Instruction that month",
        why: "Shows how many instructors are actually contributing",
        monthlyTargets: M6([null, 80, 80, 80, 80, 80]),
        targetDisplay: ["No Target", "80%+", "80%+", "80%+", "80%+", "80%+"],
        reset: "monthly",
        unit: "percent",
        chart: "bar",
      },
    ],
  },
  {
    id: "student_growth",
    label: "Student Growth",
    scope: "chapter_president",
    owner: "Chapter President",
    description: "Lifetime reach and average class size.",
    notes: ["Average Class Size is calculated and displayed but does not need a target."],
    metrics: [
      {
        id: "cp_lifetime_students",
        label: "Lifetime Students Served",
        owner: "Chapter President",
        targetLabel: "Unique students who attended one session",
        tracks: "Unique students who have attended one session in the chapter",
        why: "Total chapter reach",
        monthlyTargets: M6([0, 50, 100, 150, 200, 250]),
        targetDisplay: ["0", "50+", "100+", "150+", "200+", "250+"],
        reset: "cumulative",
        unit: "count",
        chart: "area",
      },
      {
        id: "cp_avg_class_size",
        label: "Average Class Size",
        owner: "Chapter President",
        targetLabel: "Displayed — no fixed target",
        tracks: "Average # of students across the chapter’s classes",
        why: "Shows how many students each class is reaching",
        monthlyTargets: M6([null, null, null, null, null, null]),
        targetDisplay: ["—", "—", "—", "—", "—", "—"],
        reset: "monthly",
        unit: "count",
        chart: "scatter",
        noTarget: true,
      },
    ],
  },
  {
    id: "programming",
    label: "Programming",
    scope: "chapter_president",
    owner: "Chapter President",
    description: "Instructional hours and special programming.",
    metrics: [
      {
        id: "cp_hours_instruction",
        label: "Hours of Instruction",
        owner: "Chapter President",
        targetLabel: "Student-facing instructional hours",
        tracks: "Total student-facing instructional hours delivered across the chapter during the month",
        why: "Shows total recurring programming delivered",
        monthlyTargets: M6([null, 15, 25, 40, 55, 65]),
        targetDisplay: ["X", "15+", "25+", "40+", "55+", "65+"],
        reset: "monthly",
        unit: "hours",
        chart: "bar",
      },
      {
        id: "cp_hours_events",
        label: "Hours of Events/Special Programming",
        owner: "Chapter President",
        targetLabel: "One-time events and workshops",
        tracks: "Hours of one-time events, workshops, and special programs held during the month",
        why: "Shows programming outside normal classes",
        monthlyTargets: M6([0, 2, 3, 3, 3, 3]),
        targetDisplay: ["0", "2+", "3+", "3+", "3+", "3+"],
        reset: "monthly",
        unit: "hours",
        chart: "bar",
      },
    ],
  },
  {
    id: "quality",
    label: "Quality",
    scope: "chapter_president",
    owner: "Chapter President",
    description: "Completion, repeat enrollment, and satisfaction.",
    metrics: [
      {
        id: "cp_course_completion",
        label: "Course Completion",
        owner: "Chapter President",
        targetLabel: "% who complete the class they started",
        tracks: "% of students who complete the class they started",
        why: "Shows whether students stay through the course",
        monthlyTargets: M6([null, 70, 75, 75, 80, 80]),
        targetDisplay: ["No Target", "70%+", "75%+", "75%+", "80%+", "80%+"],
        reset: "monthly",
        unit: "percent",
        chart: "line",
      },
      {
        id: "cp_repeat_enrollment",
        label: "Repeat Enrollment",
        owner: "Chapter President",
        targetLabel: "% who sign up for another YPP class",
        tracks: "% of students who later sign up for another YPP class",
        why: "Shows whether students want to continue with YPP",
        monthlyTargets: M6([null, 25, 35, 40, 45, 50]),
        targetDisplay: ["No Target", "25%+", "35%+", "40%+", "45%+", "50%+"],
        reset: "monthly",
        unit: "percent",
        chart: "line",
      },
      {
        id: "cp_satisfaction",
        label: "Overall Satisfaction Rate",
        owner: "Chapter President",
        targetLabel: "80%+ satisfied",
        tracks:
          "% of student, parent, and partner survey responses that report being satisfied with YPP",
        why: "Shows overall satisfaction with the chapter experience",
        monthlyTargets: M6([80, 80, 80, 80, 80, 80]),
        targetDisplay: ["80%+", "80%+", "80%+", "80%+", "80%+", "80%+"],
        reset: "monthly",
        unit: "percent",
        chart: "bar",
      },
    ],
  },
];

export const INSTRUCTOR_CATEGORIES: CategoryDef[] = [
  {
    id: "instructor_quality",
    label: "Quality",
    scope: "instructor",
    owner: "Instructor",
    description: "Completion, repeat enrollment, and satisfaction for the instructor’s classes.",
    metrics: [
      {
        id: "ins_course_completion",
        label: "Course Completion",
        owner: "Instructor",
        targetLabel: "80%+",
        tracks: "% of students who completed the instructor’s class",
        monthlyTargets: M6([80, 80, 80, 80, 80, 80]),
        targetDisplay: ["80%+", "80%+", "80%+", "80%+", "80%+", "80%+"],
        reset: "monthly",
        unit: "percent",
        chart: "bar",
      },
      {
        id: "ins_repeat_enrollment",
        label: "Repeat Enrollment",
        owner: "Instructor",
        targetLabel: "See monthly targets",
        tracks: "% of eligible students who sign up for another YPP class",
        monthlyTargets: M6([null, 25, 35, 40, 45, 50]),
        targetDisplay: ["No Target", "25%+", "35%+", "40%+", "45%+", "50%+"],
        reset: "monthly",
        unit: "percent",
        chart: "line",
      },
      {
        id: "ins_satisfaction",
        label: "Overall Satisfaction Rate",
        owner: "Instructor",
        targetLabel: "80%+",
        tracks:
          "% of student, parent, and partner survey responses satisfied with the instructor’s programming",
        monthlyTargets: M6([80, 80, 80, 80, 80, 80]),
        targetDisplay: ["80%+", "80%+", "80%+", "80%+", "80%+", "80%+"],
        reset: "monthly",
        unit: "percent",
        chart: "bar",
      },
    ],
  },
  {
    id: "teaching_impact",
    label: "Teaching Impact",
    scope: "instructor",
    owner: "Instructor",
    description: "Hours taught, students reached, and special programming.",
    metrics: [
      {
        id: "ins_hours_instructed",
        label: "Hours Instructed",
        owner: "Instructor",
        targetLabel: "4+ hours/month",
        tracks: "Hours the instructor actually taught students that month",
        monthlyTargets: M6([4, 4, 4, 4, 4, 4]),
        targetDisplay: ["4+", "4+", "4+", "4+", "4+", "4+"],
        reset: "monthly",
        unit: "hours",
        chart: "bar",
      },
      {
        id: "ins_unique_students",
        label: "Unique Students Taught",
        owner: "Instructor",
        targetLabel: "15+ students/month",
        tracks: "Unique students the instructor taught that month",
        monthlyTargets: M6([15, 15, 15, 15, 15, 15]),
        targetDisplay: ["15+", "15+", "15+", "15+", "15+", "15+"],
        reset: "monthly",
        unit: "count",
        chart: "line",
      },
      {
        id: "ins_special_hours",
        label: "Hours of Events/Special Programs Led",
        owner: "Instructor",
        targetLabel: "Cumulative special programming hours",
        tracks: "Hours of additional workshops or special programming led by the instructor",
        monthlyTargets: M6([0, 1, 1, 2, 2, 3]),
        targetDisplay: ["0", "1+", "1+", "2+", "2+", "3+"],
        reset: "cumulative",
        unit: "hours",
        chart: "area",
      },
    ],
  },
  {
    id: "ypp_growth_impact",
    label: "YPP Growth Impact",
    scope: "instructor",
    owner: "Instructor",
    description: "Referrals and contribution to chapter growth.",
    metrics: [
      {
        id: "ins_student_referrals",
        label: "Lifetime Student Referrals",
        owner: "Instructor",
        targetLabel: "Students personally brought in who attend",
        tracks: "Students personally brought into YPP who actually attend",
        monthlyTargets: M6([0, 2, 4, 6, 8, 10]),
        targetDisplay: ["0", "2+", "4+", "6+", "8+", "10+"],
        reset: "cumulative",
        unit: "count",
        chart: "area",
      },
      {
        id: "ins_instructor_referrals",
        label: "Lifetime Instructor Referrals",
        owner: "Instructor",
        targetLabel: "Referrals who become active instructors",
        tracks: "Instructor referrals who eventually become active YPP instructors",
        monthlyTargets: M6([0, 0, 1, 1, 2, 2]),
        targetDisplay: ["0", "0+", "1+", "1+", "2+", "2+"],
        reset: "cumulative",
        unit: "count",
        chart: "bar",
      },
      {
        id: "ins_pct_new_students",
        label: "% of Chapter New-Student Growth",
        owner: "Instructor",
        targetLabel: "5% of chapter new students",
        tracks: "% of the chapter’s new students that came through this instructor",
        monthlyTargets: M6([0, 5, 5, 5, 5, 5]),
        targetDisplay: ["0", "5%", "5%", "5%", "5%", "5%"],
        reset: "monthly",
        unit: "percent",
        chart: "scatter",
      },
      {
        id: "ins_pct_new_instructors",
        label: "% of Chapter New-Instructor Growth",
        owner: "Instructor",
        targetLabel: "Share of new active instructors",
        tracks: "% of the chapter’s new active instructors that came through this instructor",
        monthlyTargets: M6([null, null, null, null, null, null]),
        targetDisplay: ["—", "—", "—", "—", "—", "—"],
        reset: "monthly",
        unit: "percent",
        chart: "scatter",
        noTarget: true,
      },
    ],
  },
];

export const SCOPE_META: Record<
  MetricsScope,
  { label: string; blurb: string; icon: string }
> = {
  org: {
    label: "Organization",
    blurb: "Network-wide growth, ops, and outreach metrics with named owners.",
    icon: "🌐",
  },
  chapter_president: {
    label: "Chapter President",
    blurb: "Partnerships, instructors, students, programming, and quality by chapter month.",
    icon: "🏢",
  },
  instructor: {
    label: "Instructor",
    blurb: "Quality, teaching impact, and growth contribution for each instructor.",
    icon: "🎓",
  },
};

export function categoriesForScope(scope: MetricsScope): CategoryDef[] {
  if (scope === "org") {
    return [
      {
        id: "org_tracker",
        label: "Org Action Tracker",
        scope: "org",
        owner: "Leadership",
        description: "Named owners, monthly targets, and status across growth and ops.",
        metrics: ORG_METRICS,
      },
    ];
  }
  if (scope === "chapter_president") return CP_CATEGORIES;
  return INSTRUCTOR_CATEGORIES;
}

export function findCategory(scope: MetricsScope, categoryId: string): CategoryDef | null {
  return categoriesForScope(scope).find((c) => c.id === categoryId) ?? null;
}

export type MetricPoint = { month: string; actual: number; target: number | null };

export type MetricSnapshot = {
  def: MetricDef;
  actual: number;
  target: number | null;
  status: PaceStatus | "informational";
  percentOfTarget: number | null;
  series: MetricPoint[];
};

export type CategorySnapshot = {
  def: CategoryDef;
  status: PaceStatus;
  percentOfTarget: number;
  metrics: MetricSnapshot[];
};

export type ScopeSnapshot = {
  scope: MetricsScope;
  label: string;
  blurb: string;
  icon: string;
  status: PaceStatus;
  categories: CategorySnapshot[];
};

/** DB-backed metric row with id for admin edit/archive. */
export type EditableMetricSnapshot = MetricSnapshot & {
  rowId: string;
};

export type EditableCategorySnapshot = Omit<CategorySnapshot, "metrics"> & {
  metrics: EditableMetricSnapshot[];
};

export type EditableScopeSnapshot = Omit<ScopeSnapshot, "categories"> & {
  categories: EditableCategorySnapshot[];
};
