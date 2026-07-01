import type { ReactNode } from "react";

import skin from "@/components/ui-v2/portal-skin.module.css";
import {
  SimpleActionStrip,
  SimpleSurface,
  type SimpleAction,
} from "@/components/command-center/simple";

/**
 * Shared calm layout for hiring / application review surfaces — same column
 * width and portal skin as Home, Meetings, and Actions.
 */
export function ApplicationReviewShell({
  header,
  actions,
  children,
  maxWidth = 1100,
}: {
  header?: ReactNode;
  actions?: SimpleAction[];
  children?: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div className={`${skin.portalSkin} ${skin.fadeIn}`}>
      <SimpleSurface maxWidth={maxWidth} header={header} actions={actions}>
        {children}
      </SimpleSurface>
    </div>
  );
}

export { SimpleActionStrip };
