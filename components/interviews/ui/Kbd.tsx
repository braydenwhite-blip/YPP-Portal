import type { ReactNode } from "react";

type KbdProps = {
  children: ReactNode;
  className?: string;
};

export function Kbd({ children, className }: KbdProps) {
  return <kbd className={`iv-kbd${className ? ` ${className}` : ""}`}>{children}</kbd>;
}

type KbdGroupProps = {
  keys: ReactNode[];
  className?: string;
};

export function KbdGroup({ keys, className }: KbdGroupProps) {
  return (
    <span className={`iv-kbd-group${className ? ` ${className}` : ""}`}>
      {keys.map((key, index) => (
        <span key={index} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          {index > 0 ? <span className="iv-kbd-plus">+</span> : null}
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </span>
  );
}
