import type { ReactNode } from "react";

type SectionHeaderProps = {
  kicker?: string;
  title: ReactNode;
  helper?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function SectionHeader({ kicker, title, helper, right, className }: SectionHeaderProps) {
  return (
    <div className={`iv-section-header${className ? ` ${className}` : ""}`}>
      <div className="iv-section-header-text">
        {kicker ? <span className="iv-section-header-kicker">{kicker}</span> : null}
        <h2 className="iv-section-header-title">{title}</h2>
        {helper ? <p className="iv-section-header-helper">{helper}</p> : null}
      </div>
      {right ? <div className="iv-section-header-right">{right}</div> : null}
    </div>
  );
}
