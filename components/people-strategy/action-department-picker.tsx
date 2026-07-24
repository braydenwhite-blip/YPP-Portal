"use client";

import { type CSSProperties } from "react";

import { cn } from "@/components/ui-v2/cn";
import type { ActionDepartmentOption } from "@/lib/people-strategy/action-departments";
import { groupActionDepartments } from "@/lib/people-strategy/action-departments";

const DEPT_CHIP_COLORS: Record<string, string> = {
  leadership: "#7c3aed",
  instruction: "#6b21c8",
  chapters: "#d97706",
  technology: "#4f46e5",
  tech: "#4f46e5",
  fundraising: "#0f766e",
  communications: "#db2777",
  "social-media": "#e11d48",
};

function chipStyle(slug: string | null, active: boolean): CSSProperties {
  const color = (slug && DEPT_CHIP_COLORS[slug]) || "#6b21c8";
  if (active) {
    return {
      borderColor: color,
      background: color,
      color: "#fff",
      boxShadow: `0 4px 14px ${color}40`,
    };
  }
  return {
    borderColor: `${color}55`,
    background: `${color}10`,
    color: "#3a3a52",
  };
}

type BaseProps = {
  id?: string;
  label?: string;
  hint?: string;
  departments: ActionDepartmentOption[];
  allowEmpty?: boolean;
  required?: boolean;
  compact?: boolean;
  /** `simple` = one dropdown (+ pills when multi). `chips` = full chip grid. */
  variant?: "simple" | "chips";
};

type SinglePickerProps = BaseProps & {
  multiple?: false;
  value: string;
  onChange: (departmentId: string) => void;
};

type MultiPickerProps = BaseProps & {
  multiple: true;
  value: string[];
  onChange: (departmentIds: string[]) => void;
};

const calmSelectClass =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

function departmentById(
  departments: ActionDepartmentOption[],
  id: string
): ActionDepartmentOption | undefined {
  return departments.find((department) => department.id === id);
}

function SimpleDepartmentPicker(props: SinglePickerProps | MultiPickerProps) {
  const {
    id,
    label = "Department",
    hint,
    departments,
    allowEmpty = true,
    required = false,
    compact = false,
  } = props;

  const selectClass = compact ? calmSelectClass : "ps-select";

  const selectedIds: string[] = props.multiple
    ? props.value
    : props.value
      ? [props.value]
      : [];

  function removeDepartment(departmentId: string) {
    if (props.multiple) {
      props.onChange(selectedIds.filter((id) => id !== departmentId));
      return;
    }
    props.onChange("");
  }

  function addDepartment(departmentId: string) {
    if (!departmentId) return;
    if (props.multiple) {
      if (selectedIds.includes(departmentId)) return;
      props.onChange([...selectedIds, departmentId]);
      return;
    }
    props.onChange(departmentId);
  }

  if (!props.multiple) {
    const groups = groupActionDepartments(departments);
    return (
      <div className="ps-field" id={id}>
        <label className="ps-label" htmlFor={id ? `${id}-select` : undefined}>
          {label}
          {required ? <span className="ps-required"> *</span> : null}
        </label>
        {hint ? <p className="m-0 mb-2 text-[12.5px] text-ink-muted">{hint}</p> : null}
        <select
          id={id ? `${id}-select` : undefined}
          className={selectClass}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        >
          {allowEmpty ? <option value="">No department</option> : null}
          {groups.map((group) => (
            <optgroup key={group.key} label={`Function: ${group.label}`}>
              {group.items.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    );
  }

  const available = departments.filter((department) => !selectedIds.includes(department.id));

  return (
    <div className="ps-field" id={id}>
      <span className="ps-label">
        {label}
        {required ? <span className="ps-required"> *</span> : null}
      </span>
      {hint ? <p className="m-0 mb-2 text-[12.5px] text-ink-muted">{hint}</p> : null}

      {selectedIds.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedIds.map((departmentId) => {
            const department = departmentById(departments, departmentId);
            if (!department) return null;
            return (
              <span
                key={departmentId}
                className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-muted px-2.5 py-1 text-[12.5px] font-semibold text-ink"
              >
                {department.name}
                <button
                  type="button"
                  className="m-0 border-0 bg-transparent p-0 text-[14px] leading-none text-ink-muted hover:text-ink"
                  aria-label={`Remove ${department.name}`}
                  onClick={() => removeDepartment(departmentId)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="m-0 mb-2 text-[12.5px] text-ink-muted">Optional — skip if no team yet.</p>
      )}

      {available.length > 0 ? (
        <select
          id={id ? `${id}-select` : undefined}
          className={selectClass}
          value=""
          aria-label={selectedIds.length > 0 ? "Add another team" : "Pick a team"}
          onChange={(e) => addDepartment(e.target.value)}
        >
          <option value="">{selectedIds.length > 0 ? "Add another team…" : "Pick a team…"}</option>
          {available.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      ) : selectedIds.length > 0 ? (
        <p className="m-0 text-[12.5px] text-ink-muted">All teams selected.</p>
      ) : null}

      {allowEmpty && selectedIds.length > 0 ? (
        <button
          type="button"
          className="mt-2 text-[12.5px] font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          onClick={() => props.onChange([])}
        >
          Clear teams
        </button>
      ) : null}
    </div>
  );
}

function ChipDepartmentPicker(props: SinglePickerProps | MultiPickerProps) {
  const {
    id,
    label = "Department",
    hint = "Pick a department under its Function (e.g. Operations → Technology).",
    departments,
    allowEmpty = true,
    required = false,
    compact = false,
  } = props;

  if (departments.length === 0) return null;

  const selectedIds: string[] = props.multiple
    ? props.value
    : props.value
      ? [props.value]
      : [];

  function isActive(departmentId: string) {
    return selectedIds.includes(departmentId);
  }

  function toggleDepartment(departmentId: string) {
    if (props.multiple) {
      const active = isActive(departmentId);
      if (active) {
        if (!allowEmpty && selectedIds.length <= 1) return;
        props.onChange(selectedIds.filter((id) => id !== departmentId));
      } else {
        props.onChange([...selectedIds, departmentId]);
      }
      return;
    }

    const active = props.value === departmentId;
    props.onChange(active && allowEmpty ? "" : departmentId);
  }

  function clearAll() {
    if (props.multiple) {
      props.onChange([]);
    } else {
      props.onChange("");
    }
  }

  const noneActive = selectedIds.length === 0;

  return (
    <div className="ps-field" id={id}>
      <span className="ps-label">
        {label}
        {required ? <span className="ps-required"> *</span> : null}
      </span>
      {hint ? (
        <p className={cn("m-0 text-[12.5px] text-ink-muted", compact ? "mb-2" : "mb-2.5")}>{hint}</p>
      ) : null}

      <div className={cn("flex flex-wrap gap-1.5", compact ? "gap-2" : "gap-1.5")} role="group" aria-label="Teams">
        {departments.map((department) => {
          const active = isActive(department.id);
          return (
            <button
              key={department.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleDepartment(department.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
                active ? "scale-[1.02]" : "hover:-translate-y-px hover:shadow-sm"
              )}
              style={chipStyle(department.slug, active)}
            >
              {department.name}
            </button>
          );
        })}

        {allowEmpty ? (
          <button
            type="button"
            aria-pressed={noneActive}
            onClick={clearAll}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              noneActive
                ? "border-line-strong bg-surface-muted text-ink"
                : "border-line-soft bg-surface text-ink-muted hover:border-line hover:text-ink"
            )}
          >
            {props.multiple ? "No teams yet" : "No team yet"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Department tagging for Action Tracker forms. Defaults to a single dropdown
 * (multi: dropdown + removable pills). Pass `variant="chips"` for the legacy grid.
 */
export function ActionDepartmentPicker(props: SinglePickerProps | MultiPickerProps) {
  const { departments, variant = "simple" } = props;

  if (departments.length === 0) return null;
  if (variant === "chips") return <ChipDepartmentPicker {...props} />;
  return <SimpleDepartmentPicker {...props} />;
}
