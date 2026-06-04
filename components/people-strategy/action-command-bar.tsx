import type { ReactNode } from "react";

/**
 * Shared command-bar header for the People Strategy / Action Tracker surfaces.
 * Lays out an eyebrow label, a strong page title, a subtitle, an optional
 * "last updated"-style meta line, and a right-aligned slot for primary actions
 * (e.g. New Action, Export CSV) in one clean, professional row. Purely
 * presentational — callers pass already-resolved strings/nodes.
 */
export function ActionCommandBar({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ps-command-bar">
      <div className="ps-command-headings">
        {eyebrow ? <p className="ps-command-eyebrow">{eyebrow}</p> : null}
        <h1 className="ps-command-title">{title}</h1>
        {subtitle ? <p className="ps-command-subtitle">{subtitle}</p> : null}
        {meta ? <p className="ps-command-meta">{meta}</p> : null}
      </div>
      {actions ? <div className="ps-command-actions">{actions}</div> : null}
    </header>
  );
}

export default ActionCommandBar;
