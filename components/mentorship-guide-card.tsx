type MentorshipGuideItem = {
  label: string;
  meaning: string;
  howToUse: string;
};

type MentorshipGuideCardProps = {
  title: string;
  intro?: string;
  items: readonly MentorshipGuideItem[];
};

/**
 * Page-help for the mentor surfaces. Rendered as a collapsed disclosure so
 * the guidance is one click away without walling off the real content on
 * every visit. Native <details> — works without JS and is keyboard
 * accessible by default.
 */
export function MentorshipGuideCard({
  title,
  intro,
  items,
}: MentorshipGuideCardProps) {
  return (
    <details className="mentor-guide">
      <summary className="mentor-guide__summary">
        <span aria-hidden>{title}</span>
      </summary>
      <div className="mentor-guide__body">
        {intro && <p className="mentor-guide__intro">{intro}</p>}
        <div className="mentor-guide__items">
          {items.map((item) => (
            <div key={item.label} className="mentor-guide__item">
              <div className="mentor-guide__item-label">{item.label}</div>
              <p className="mentor-guide__item-line">
                <strong>What this means:</strong> {item.meaning}
              </p>
              <p className="mentor-guide__item-line">
                <strong>How to use it:</strong> {item.howToUse}
              </p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
