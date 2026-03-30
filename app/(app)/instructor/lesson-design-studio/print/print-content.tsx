"use client";

import { useEffect } from "react";

export function PrintContent() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="cbs-print-auto-trigger">
      <div className="cbs-print-auto-card">
        <span className="cbs-print-auto-badge">Preparing print view</span>
        <p>
          The print dialog should open automatically. If it does not, press
          Ctrl+P (Cmd+P on Mac).
        </p>
      </div>
    </div>
  );
}
