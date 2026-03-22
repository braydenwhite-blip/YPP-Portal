"use client";

import { useState } from "react";

interface Props {
  mode: "download-button" | "copy-letter-button";
  svgData?: string;
  recipientName?: string;
  tier?: string;
  letterText?: string;
}

export default function AwardCeremonyClient({ mode, svgData, recipientName, tier, letterText }: Props) {
  const [copied, setCopied] = useState(false);

  if (mode === "download-button" && svgData) {
    function handleDownload() {
      const blob = new Blob([svgData!], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `YPP-Certificate-${tier ?? "Award"}-${(recipientName ?? "").replace(/\s+/g, "-")}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }

    return (
      <button className="button primary small" onClick={handleDownload}>
        Download SVG
      </button>
    );
  }

  if (mode === "copy-letter-button" && letterText) {
    async function handleCopy() {
      try {
        await navigator.clipboard.writeText(letterText!);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Fallback: select the text
        const el = document.createElement("textarea");
        el.value = letterText!;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }

    return (
      <button className="button secondary small" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy Letter"}
      </button>
    );
  }

  return null;
}
