import type {
  ActivityType,
  AtHomeAssignmentType,
  EnergyLevel,
} from "../types";

export interface ActivityTypeConfig {
  value: ActivityType;
  label: string;
  color: string;
  icon: string;
  defaultDuration: number;
}

export interface AtHomeTypeConfig {
  value: AtHomeAssignmentType;
  label: string;
  icon: string;
}

export interface EnergyLevelConfig {
  value: EnergyLevel;
  label: string;
  icon: string;
  color: string;
}

export interface ActivityTemplateData {
  title: string;
  type: ActivityType;
  durationMin: number;
  description: string;
}

export interface ActivityTemplateCategory {
  label: string;
  icon: string;
  templates: ActivityTemplateData[];
}

export const ACTIVITY_TYPE_CONFIG: ActivityTypeConfig[] = [
  { value: "WARM_UP", label: "Warm Up", color: "#f59e0b", icon: "☀", defaultDuration: 8 },
  { value: "INSTRUCTION", label: "Instruction", color: "#3b82f6", icon: "📚", defaultDuration: 15 },
  { value: "PRACTICE", label: "Practice", color: "#22c55e", icon: "✍", defaultDuration: 12 },
  { value: "DISCUSSION", label: "Discussion", color: "#8b3fe8", icon: "💬", defaultDuration: 10 },
  { value: "ASSESSMENT", label: "Assessment", color: "#ef4444", icon: "📋", defaultDuration: 8 },
  { value: "BREAK", label: "Break", color: "#6b7280", icon: "☕", defaultDuration: 5 },
  { value: "REFLECTION", label: "Reflection", color: "#ec4899", icon: "💭", defaultDuration: 6 },
  { value: "GROUP_WORK", label: "Group Work", color: "#14b8a6", icon: "👥", defaultDuration: 12 },
];

export const AT_HOME_TYPE_CONFIG: AtHomeTypeConfig[] = [
  { value: "REFLECTION_PROMPT", label: "Reflection Prompt", icon: "✍" },
  { value: "PRACTICE_TASK", label: "Practice Task", icon: "🎯" },
  { value: "QUIZ", label: "Quiz / Knowledge Check", icon: "📝" },
  { value: "PRE_READING", label: "Pre-Reading / Video", icon: "📖" },
];

export const ENERGY_LEVEL_CONFIG: EnergyLevelConfig[] = [
  { value: "LOW", label: "Low Energy", icon: "🧘", color: "#3b82f6" },
  { value: "MEDIUM", label: "Medium Energy", icon: "🎯", color: "#f59e0b" },
  { value: "HIGH", label: "High Energy", icon: "⚡", color: "#ef4444" },
];

export const FINANCIAL_TAGS = [
  "Budgeting",
  "Saving",
  "Credit",
  "Investing",
  "Banking",
  "Spending",
  "Insurance",
  "Taxes",
];

export const SEL_TAGS = [
  "Self-Awareness",
  "Self-Management",
  "Social Awareness",
  "Relationship Skills",
  "Decision Making",
];

export const DELIVERY_MODE_OPTIONS = [
  { value: "VIRTUAL", label: "Virtual" },
  { value: "IN_PERSON", label: "In Person" },
  { value: "HYBRID", label: "Hybrid" },
] as const;

export const DIFFICULTY_LEVEL_OPTIONS = [
  { value: "LEVEL_101", label: "Best for first-time learners" },
  { value: "LEVEL_201", label: "Great if you've tried the basics" },
  { value: "LEVEL_301", label: "Best if you can work more independently" },
  { value: "LEVEL_401", label: "Best if you're ready for advanced project work" },
] as const;

export const ACTIVITY_TEMPLATE_CATEGORIES: ActivityTemplateCategory[] = [
  {
    label: "Engagement",
    icon: "⚡",
    templates: [
      {
        title: "Hook Question",
        type: "WARM_UP",
        durationMin: 8,
        description:
          "Pose an intriguing question or scenario to spark curiosity and activate prior knowledge.",
      },
      {
        title: "Think-Pair-Share",
        type: "DISCUSSION",
        durationMin: 10,
        description:
          "Students think independently, discuss with a partner, then share with the group.",
      },
      {
        title: "Gallery Walk",
        type: "GROUP_WORK",
        durationMin: 12,
        description:
          "Students rotate through stations, examine displayed work, and leave feedback.",
      },
      {
        title: "Icebreaker",
        type: "WARM_UP",
        durationMin: 5,
        description:
          "Quick interactive activity to build rapport and energize the room.",
      },
    ],
  },
  {
    label: "Instruction",
    icon: "📖",
    templates: [
      {
        title: "Mini Lesson",
        type: "INSTRUCTION",
        durationMin: 15,
        description:
          "Focused direct instruction on one concept with visual support and modeling.",
      },
      {
        title: "Demo + Explain",
        type: "INSTRUCTION",
        durationMin: 12,
        description:
          "Live demonstration with step-by-step explanation and think-aloud modeling.",
      },
      {
        title: "Video + Discussion",
        type: "INSTRUCTION",
        durationMin: 18,
        description:
          "Watch a short clip, then unpack it with guided discussion questions.",
      },
      {
        title: "I Do, We Do, You Do",
        type: "INSTRUCTION",
        durationMin: 20,
        description:
          "Gradual release: teacher models, class practices together, then students apply independently.",
      },
    ],
  },
  {
    label: "Practice",
    icon: "✍",
    templates: [
      {
        title: "Guided Practice",
        type: "PRACTICE",
        durationMin: 12,
        description:
          "Teacher-led practice with scaffolding that gradually releases responsibility.",
      },
      {
        title: "Independent Build",
        type: "PRACTICE",
        durationMin: 15,
        description:
          "Students work independently on an applied task while the teacher coaches.",
      },
      {
        title: "Partner Work",
        type: "PRACTICE",
        durationMin: 10,
        description:
          "Collaborative practice in pairs with clear roles and accountability.",
      },
      {
        title: "Skill Drill",
        type: "PRACTICE",
        durationMin: 8,
        description:
          "Rapid practice of a specific skill with immediate self-checking.",
      },
    ],
  },
  {
    label: "Assessment",
    icon: "📊",
    templates: [
      {
        title: "Exit Ticket",
        type: "ASSESSMENT",
        durationMin: 6,
        description:
          "Quick end-of-class check with one to three prompts that reveal understanding.",
      },
      {
        title: "Formative Check",
        type: "ASSESSMENT",
        durationMin: 8,
        description:
          "Mid-lesson comprehension check using quick response strategies or polling.",
      },
      {
        title: "Peer Review",
        type: "ASSESSMENT",
        durationMin: 10,
        description:
          "Students evaluate each other's work with a rubric or structured feedback prompts.",
      },
      {
        title: "Quiz Bowl",
        type: "ASSESSMENT",
        durationMin: 12,
        description:
          "Team-based competitive review game that checks key concepts from the lesson.",
      },
    ],
  },
  {
    label: "Closure",
    icon: "🎯",
    templates: [
      {
        title: "Reflection Journal",
        type: "REFLECTION",
        durationMin: 6,
        description:
          "Students write about what they learned and what questions still remain.",
      },
      {
        title: "Group Share-Out",
        type: "DISCUSSION",
        durationMin: 8,
        description:
          "Groups present key takeaways or solutions to the full class.",
      },
      {
        title: "Preview Next Session",
        type: "INSTRUCTION",
        durationMin: 5,
        description:
          "Brief teaser of the next lesson to connect today’s learning to what comes next.",
      },
      {
        title: "Muddiest Point",
        type: "REFLECTION",
        durationMin: 5,
        description:
          "Students name the most confusing part of the lesson so the teacher can follow up.",
      },
    ],
  },
];

export function getActivityTypeConfig(type: ActivityType) {
  return ACTIVITY_TYPE_CONFIG.find((item) => item.value === type) ?? ACTIVITY_TYPE_CONFIG[0];
}

export function getAtHomeTypeConfig(type: AtHomeAssignmentType) {
  return AT_HOME_TYPE_CONFIG.find((item) => item.value === type) ?? AT_HOME_TYPE_CONFIG[0];
}
