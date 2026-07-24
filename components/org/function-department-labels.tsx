import { formatFunctionDepartment } from "@/lib/org/functions-departments";

/** Two-field Function / Department display — never dash-joined. */
export function FunctionDepartmentLabels({
  functionName,
  departmentName,
  className,
}: {
  functionName?: string | null;
  departmentName?: string | null;
  className?: string;
}) {
  const { functionLabel, departmentLabel } = formatFunctionDepartment({
    functionName,
    departmentName,
  });

  if (!functionLabel && !departmentLabel) return null;

  return (
    <div className={className ?? "flex flex-col gap-0.5 text-[13px]"}>
      {functionLabel ? (
        <p className="m-0 text-ink-muted">
          <span className="font-semibold text-ink-muted">Function:</span>{" "}
          <span className="font-semibold text-ink">{functionLabel}</span>
        </p>
      ) : null}
      {departmentLabel ? (
        <p className="m-0 text-ink-muted">
          <span className="font-semibold text-ink-muted">Department:</span>{" "}
          <span className="font-semibold text-ink">{departmentLabel}</span>
        </p>
      ) : null}
    </div>
  );
}
