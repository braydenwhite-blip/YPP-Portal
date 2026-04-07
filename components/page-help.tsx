type PageHelpProps = {
  title?: string;
  purpose: string;
  firstStep: string;
  nextStep: string;
};

export default function PageHelp({
  title = "How to use this page",
  purpose,
  firstStep,
  nextStep,
}: PageHelpProps) {
  return (
    <details className="page-help">
      <summary className="page-help-summary">
        <span className="page-help-icon" aria-hidden="true">
          ?
        </span>
        <span>{title}</span>
      </summary>
      <div className="page-help-body">
        <div>
          <p className="page-help-label">What this page is for</p>
          <p>{purpose}</p>
        </div>
        <div>
          <p className="page-help-label">What to do first</p>
          <p>{firstStep}</p>
        </div>
        <div>
          <p className="page-help-label">What happens next</p>
          <p>{nextStep}</p>
        </div>
      </div>
    </details>
  );
}
