"use client";

import { useEffect, useState } from "react";

interface BootScreenProps {
  onComplete: () => void;
}

export function BootScreen({ onComplete }: BootScreenProps) {
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowCta(true), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="os-boot-screen">
      <div className="os-boot-logo">🎨</div>

      <div>
        <h1 className="os-boot-title">Lesson Design Studio</h1>
        <p className="os-boot-subtitle">
          Learn what makes a great lesson plan — then build yours. You'll leave this session with every lesson ready to go.
        </p>
      </div>

      <div className="os-boot-progress">
        <div className="os-boot-progress-fill" />
      </div>

      {showCta && (
        <button className="os-boot-cta" onClick={onComplete} type="button">
          Open Studio <span>→</span>
        </button>
      )}

      <p style={{ fontSize: 12, color: "var(--os-text-dim)", marginTop: -16 }}>
        Takes about 20 minutes · 5 phases
      </p>
    </div>
  );
}
