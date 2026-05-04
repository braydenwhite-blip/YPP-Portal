import type { ReactNode } from "react";

export type MetaListItem = {
  label: string;
  value: ReactNode;
};

type MetaListProps = {
  items: MetaListItem[];
  className?: string;
};

export function MetaList({ items, className }: MetaListProps) {
  return (
    <dl className={`iv-meta-list${className ? ` ${className}` : ""}`}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "contents" }}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
