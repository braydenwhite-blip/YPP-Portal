"use client";

import type { ReactNode } from "react";

interface OsWindowProps {
  title?: string;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export function OsWindow({
  title,
  children,
  className = "",
  bodyClassName = "",
  noPadding = false,
}: OsWindowProps) {
  return (
    <div className={`os-window ${className}`}>
      <div className="os-window-titlebar">
        <TrafficLights />
        {title && <span className="os-window-title">{title}</span>}
        {/* spacer to balance traffic lights */}
        <div style={{ width: 42 }} />
      </div>
      <div className={noPadding ? "" : `os-window-body ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

export function TrafficLights() {
  return (
    <div className="os-traffic-lights">
      <div className="os-traffic-dot red" />
      <div className="os-traffic-dot yellow" />
      <div className="os-traffic-dot green" />
    </div>
  );
}
