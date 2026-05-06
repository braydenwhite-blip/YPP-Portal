"use client";

/**
 * Hotspot — click-on-image beat with a mandatory accessible alternate list.
 *
 * Config shape (client-safe — correctRegionId stripped server-side):
 *   imageUrl: string
 *   regions: { id, label, shape: "rect", x, y, width, height }[]  (coords in [0,1])
 *   hint?: string
 *   altText?: string   — descriptive alt text for the image (falls back to beat.prompt)
 *
 * Response shape: { x: number; y: number }
 * The x/y values are the normalized center of the selected region.
 * Non-null when: any region has been selected.
 *
 * Visual side: image with absolutely-positioned overlay zones (aria-hidden,
 * tabIndex={-1}). Clicking an overlay selects that region. Overlays show hover
 * and selected states via CSS classes. cursor: crosshair on hover.
 *
 * Accessible alternate list (MANDATORY per plan §11 R7): a radiogroup alongside the
 * image where each region is a proper radio button. Screen-reader users answer
 * exclusively via this list. The overlays are visual affordances only and are
 * NOT in the tab order.
 *
 * Mobile: hit areas enlarged via CSS padding and min-height on both overlays
 * and list buttons. On pointer:coarse the overlays get extra padding.
 *
 * readOnly disables all buttons and overlays.
 */

import { useState, useCallback, useId } from "react";
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
  /** Accessible description of the image. Falls back to beat.prompt. */
  altText?: string;
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
  const imageAlt = config.altText ?? "";

  const [imgError, setImgError] = useState(false);
  const groupId = useId();

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
      {hint && (
        <p className="hotspot__hint" id={`${groupId}-hint`}>
          {hint}
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Image with absolutely-positioned click overlays                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="hotspot__image-container"
      >
        {imgError ? (
          <div
            className="hotspot__image-fallback"
            role="img"
            aria-label={imageAlt || beat.prompt}
          >
            <p>Image could not be loaded.</p>
            <p>Use the list below to select a region.</p>
          </div>
        ) : (
          <img
            src={config.imageUrl}
            alt={imageAlt}
            className="hotspot__image"
            onError={() => setImgError(true)}
          />
        )}

        {/* Visual overlay zones — aria-hidden; NOT in tab order.
            The min 44×44px hit area is enforced in CSS. On pointer:coarse
            (touch) the overlays are enlarged further. */}
        {!imgError && regions.map((region) => {
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
              }}
              onClick={() => handleSelect(region)}
            />
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Accessible alternate list — canonical input for screen-reader users */}
      {/* ------------------------------------------------------------------ */}
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-list-label`}
        aria-describedby={hint ? `${groupId}-hint` : undefined}
        aria-disabled={readOnly}
        className="hotspot__alt-group"
      >
        <p
          id={`${groupId}-list-label`}
          className="hotspot__alt-label"
        >
          Select a region:
        </p>

        <ul className="hotspot__alt-list" role="presentation">
          {regions.map((region) => {
            const isSelected = activeId === region.id;
            return (
              <li key={region.id} role="presentation">
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
                  {/* Visual check indicator */}
                  <span
                    className={[
                      "hotspot__alt-indicator",
                      isSelected ? "hotspot__alt-indicator--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden="true"
                  />
                  {region.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
