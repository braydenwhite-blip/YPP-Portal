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
      <p>Print dialog should open automatically. If it doesn't, press Ctrl+P (Cmd+P on Mac).</p>
    </div>
  );
}
