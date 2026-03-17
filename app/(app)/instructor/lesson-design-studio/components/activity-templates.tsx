"use client";

type ActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

interface TemplateData {
  title: string;
  type: ActivityType;
  durationMin: number;
  description: string;
}

interface ActivityTemplatesProps {
  open: boolean;
  onClose: () => void;
  onInsert: (template: TemplateData) => void;
}

const TYPE_COLORS: Record<ActivityType, string> = {
  WARM_UP: "#f59e0b",
  INSTRUCTION: "#3b82f6",
  PRACTICE: "#22c55e",
  DISCUSSION: "#8b5cf6",
  ASSESSMENT: "#ef4444",
  BREAK: "#6b7280",
  REFLECTION: "#ec4899",
  GROUP_WORK: "#14b8a6",
};

const TYPE_LABELS: Record<ActivityType, string> = {
  WARM_UP: "Warm Up",
  INSTRUCTION: "Instruction",
  PRACTICE: "Practice",
  DISCUSSION: "Discussion",
  ASSESSMENT: "Assessment",
  BREAK: "Break",
  REFLECTION: "Reflection",
  GROUP_WORK: "Group Work",
};

interface Category {
  label: string;
  icon: string;
  templates: TemplateData[];
}

const CATEGORIES: Category[] = [
  {
    label: "Engagement",
    icon: "\u26A1",
    templates: [
      { title: "Hook Question", type: "WARM_UP", durationMin: 8, description: "Pose an intriguing question or scenario to spark curiosity and activate prior knowledge" },
      { title: "Think-Pair-Share", type: "DISCUSSION", durationMin: 10, description: "Students think independently, discuss with a partner, then share with the group" },
      { title: "Gallery Walk", type: "GROUP_WORK", durationMin: 12, description: "Students rotate through stations examining displayed work and leaving feedback" },
      { title: "Icebreaker", type: "WARM_UP", durationMin: 5, description: "Quick interactive activity to build rapport and energize the room" },
    ],
  },
  {
    label: "Instruction",
    icon: "\uD83D\uDCD6",
    templates: [
      { title: "Mini Lesson", type: "INSTRUCTION", durationMin: 15, description: "Focused direct instruction on a single concept with visual aids" },
      { title: "Demo + Explain", type: "INSTRUCTION", durationMin: 12, description: "Live demonstration with step-by-step explanation and think-aloud modeling" },
      { title: "Video + Discussion", type: "INSTRUCTION", durationMin: 18, description: "Watch a short video clip followed by guided discussion questions" },
      { title: "I Do, We Do, You Do", type: "INSTRUCTION", durationMin: 20, description: "Gradual release: teacher models, class practices together, students work independently" },
    ],
  },
  {
    label: "Practice",
    icon: "\u270F\uFE0F",
    templates: [
      { title: "Guided Practice", type: "PRACTICE", durationMin: 12, description: "Teacher-led practice with scaffolding, gradually releasing responsibility to students" },
      { title: "Independent Build", type: "PRACTICE", durationMin: 15, description: "Students work independently on an applied task with teacher circulating for support" },
      { title: "Partner Work", type: "PRACTICE", durationMin: 10, description: "Collaborative practice in pairs with structured roles and shared accountability" },
      { title: "Skill Drill", type: "PRACTICE", durationMin: 8, description: "Rapid-fire practice of a specific skill with immediate self-checking" },
    ],
  },
  {
    label: "Assessment",
    icon: "\uD83D\uDCCA",
    templates: [
      { title: "Exit Ticket", type: "ASSESSMENT", durationMin: 6, description: "Quick end-of-class check: students answer 1-3 questions to show understanding" },
      { title: "Formative Check", type: "ASSESSMENT", durationMin: 8, description: "Mid-lesson comprehension check using thumbs up/down, whiteboard responses, or polls" },
      { title: "Peer Review", type: "ASSESSMENT", durationMin: 10, description: "Students evaluate each other\u2019s work using a rubric or structured feedback form" },
      { title: "Quiz Bowl", type: "ASSESSMENT", durationMin: 12, description: "Team-based competitive review game testing key concepts from the lesson" },
    ],
  },
  {
    label: "Closure",
    icon: "\uD83C\uDFAF",
    templates: [
      { title: "Reflection Journal", type: "REFLECTION", durationMin: 6, description: "Students write a brief reflection on what they learned and questions they still have" },
      { title: "Group Share-Out", type: "DISCUSSION", durationMin: 8, description: "Each group presents key takeaways or solutions to the full class" },
      { title: "Preview Next Session", type: "INSTRUCTION", durationMin: 5, description: "Brief teaser of next lesson\u2019s topic to build anticipation and connect concepts" },
      { title: "Muddiest Point", type: "REFLECTION", durationMin: 5, description: "Students identify the most confusing concept from today\u2019s lesson for follow-up" },
    ],
  },
];

export function ActivityTemplates({ open, onClose, onInsert }: ActivityTemplatesProps) {
  if (!open) return null;

  function handleCardClick(template: TemplateData) {
    onInsert(template);
    onClose();
  }

  return (
    <div className="cbs-templates-overlay" onClick={onClose}>
      <div
        className="cbs-templates-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="cbs-templates-header">
          <h2 className="cbs-templates-title">Activity Templates</h2>
          <button className="cbs-templates-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="cbs-templates-body">
          {CATEGORIES.map((category) => (
            <section key={category.label} className="cbs-templates-category">
              <h3 className="cbs-templates-category-header">
                <span className="cbs-templates-category-icon">{category.icon}</span>
                {category.label}
              </h3>

              <div className="cbs-templates-grid">
                {category.templates.map((template) => {
                  const color = TYPE_COLORS[template.type];
                  return (
                    <button
                      key={template.title}
                      className="cbs-templates-card"
                      onClick={() => handleCardClick(template)}
                    >
                      <div className="cbs-templates-card-top">
                        <span
                          className="cbs-templates-badge"
                          style={{ background: color + "22", color }}
                        >
                          {TYPE_LABELS[template.type]}
                        </span>
                        <span className="cbs-templates-duration">
                          {template.durationMin}m
                        </span>
                      </div>
                      <div className="cbs-templates-card-title">{template.title}</div>
                      <div className="cbs-templates-card-desc">{template.description}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <style jsx>{`
        .cbs-templates-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
        }

        .cbs-templates-modal {
          width: 720px;
          max-width: 92vw;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          background: rgba(28, 28, 34, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7), 0 8px 24px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          color: #f2f2f7;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
        }

        .cbs-templates-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          flex-shrink: 0;
        }

        .cbs-templates-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .cbs-templates-close {
          background: none;
          border: none;
          color: rgba(242, 242, 247, 0.5);
          font-size: 24px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
          transition: color 220ms ease;
        }

        .cbs-templates-close:hover {
          color: #f2f2f7;
        }

        .cbs-templates-body {
          overflow-y: auto;
          padding: 16px 24px 24px;
          flex: 1;
        }

        .cbs-templates-category {
          margin-bottom: 24px;
        }

        .cbs-templates-category:last-child {
          margin-bottom: 0;
        }

        .cbs-templates-category-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(242, 242, 247, 0.5);
          margin: 0 0 12px;
        }

        .cbs-templates-category-icon {
          font-size: 16px;
        }

        .cbs-templates-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .cbs-templates-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          padding: 14px 16px;
          background: rgba(48, 48, 56, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          color: #f2f2f7;
          font-family: inherit;
          transition: background 180ms ease, border-color 180ms ease, transform 120ms ease;
        }

        .cbs-templates-card:hover {
          background: rgba(60, 60, 70, 0.8);
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .cbs-templates-card:active {
          transform: translateY(0);
        }

        .cbs-templates-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .cbs-templates-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          letter-spacing: 0.02em;
        }

        .cbs-templates-duration {
          font-size: 12px;
          color: rgba(242, 242, 247, 0.4);
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }

        .cbs-templates-card-title {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.3;
        }

        .cbs-templates-card-desc {
          font-size: 12px;
          line-height: 1.45;
          color: rgba(242, 242, 247, 0.45);
        }

        @media (max-width: 600px) {
          .cbs-templates-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default ActivityTemplates;
