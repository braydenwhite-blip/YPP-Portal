"use client";

/**
 * Hotspot — click-on-image beat with a mandatory accessible alternate list.
 *
 * Config shape (client-safe — correctRegionId stripped server-side):
 *   imageUrl: string
 *   regions: { id, label, shape: "rect", x, y, width, height }[]  (coords in [0,1])
 *   hint?: string
 *
 * Response shape: { x: number; y: number }
 * The x/y values are the normalized center of the selected region.
 * Non-null when: any region has been selected.
 *
 * Visual side: image with absolutely-positioned overlay zones (aria-hidden,
 * tabIndex={-1}). Clicking an overlay selects that region.
 *
 * Accessible alternate list (MANDATORY per plan §11 R7): a <ul> alongside the
 * image where each region is a role="radio" button. Screen-reader users answer
 * exclusively via this list. The overlays are visual affordances only and are
 * NOT in the tab order.
 *
 * readOnly disables all buttons and overlays.
 */

import { useState, useCallback } from "react";
import type { ClientBeat } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

type HotspotRegion = {
  id: string;
  label: string;
  shape: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
};

type HotspotConfig = {
  imageUrl: string;
  regions: HotspotRegion[];
  hint?: string;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  beat: ClientBeat & { config: unknown };
  response: { x: number; y: number } | null;
  onResponseChange: (next: { x: number; y: number } | null) => void;
  readOnly: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the normalized center point of a region. */
function regionCenter(region: HotspotRegion): { x: number; y: number } {
  return {
    x: region.x + region.width / 2,
    y: region.y + region.height / 2,
  };
}

/** Determines which region id, if any, matches the current response center. */
function selectedRegionId(
  response: { x: number; y: number } | null,
  regions: HotspotRegion[]
): string | null {
  if (!response) return null;
  for (const region of regions) {
    const center = regionCenter(region);
    // Floating-point equality via small epsilon to guard rounding.
    if (
      Math.abs(center.x - response.x) < 1e-9 &&
      Math.abs(center.y - response.y) < 1e-9
    ) {
      return region.id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Hotspot({ beat, response, onResponseChange, readOnly }: Props) {
  const config = beat.config as HotspotConfig;
  const regions = config.regions ?? [];
  const hint = config.hint;

  const [imgError, setImgError] = useState(false);

  // Derive the selected region id from the current response on every render.
  // We don't need local state for the selection — the response prop is the
  // source of truth (lifted state pattern used across all beats).
  const activeId = selectedRegionId(response, regions);

  const handleSelect = useCallback(
    (region: HotspotRegion) => {
      if (readOnly) return;
      onResponseChange(regionCenter(region));
    },
    [readOnly, onResponseChange]
  );

  return (
    <div
      className={["hotspot", readOnly ? "hotspot--readonly" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Image with absolutely-positioned click overlays                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="hotspot__image-container"
        style={{ position: "relative", display: "inline-block" }}
      >
        {imgError ? (
          <div className="hotspot__image-fallback" role="img" aria-label={beat.prompt}>
            Image could not be loaded. Use the list below to answer.
          </div>
        ) : (
          <img
            src={config.imageUrl}
            alt=""
            className="hotspot__image"
            onError={() => setImgError(true)}
            style={{ display: "block", maxWidth: "100%", height: "auto" }}
          />
        )}

        {/* Visual overlay zones — aria-hidden; NOT in tab order */}
        {regions.map((region) => {
          const isSelected = activeId === region.id;
          return (
            <div
              key={region.id}
              aria-hidden="true"
              tabIndex={-1}
              className={[
                "hotspot__overlay",
                isSelected ? "hotspot__overlay--selected" : "",
                readOnly ? "hotspot__overlay--readonly" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                position: "absolute",
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.width * 100}%`,
                height: `${region.height * 100}%`,
                cursor: readOnly ? "default" : "pointer",
                pointerEvents: readOnly ? "none" : "auto",
                boxSizing: "border-box",
              }}
              onClick={() => handleSelect(region)}
            />
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Accessible alternate list — canonical input for screen-reader users */}
      {/* ------------------------------------------------------------------ */}
      <ul
        className="hotspot__alt-list"
        aria-label={beat.prompt}
        role="radiogroup"
        aria-disabled={readOnly}
      >
        {regions.map((region) => {
          const isSelected = activeId === region.id;
          return (
            <li key={region.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-disabled={readOnly}
                disabled={readOnly}
                className={[
                  "hotspot__alt-option",
                  isSelected ? "hotspot__alt-option--selected" : "",
                  readOnly ? "hotspot__alt-option--readonly" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => handleSelect(region)}
              >
                {region.label}
              </button>
            </li>
          );
        })}
      </ul>

      {hint && (
        <p className="hotspot__hint" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
}
