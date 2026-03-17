"use client";

interface AnnotationCalloutProps {
  note: string;
  sentiment: "positive" | "negative";
}

export function AnnotationCallout({ note, sentiment }: AnnotationCalloutProps) {
  return (
    <div className="os-annotation">
      <div className={`os-annotation-bubble ${sentiment}`}>
        <span className="os-annotation-icon">
          {sentiment === "positive" ? "✓" : "✗"}
        </span>
        <span>{note}</span>
      </div>
    </div>
  );
}
