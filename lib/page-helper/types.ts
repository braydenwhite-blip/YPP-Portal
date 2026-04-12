import type { NavRole } from "@/lib/navigation/types";

export type PageHelperRole = NavRole | "PUBLIC" | "AUTHENTICATED";

export type PageHelperPlacement = "bottom-right" | "bottom-left";

export interface PageHelperContent {
  purpose: string;
  firstStep: string;
  nextStep: string;
}

export interface PageHelperEntry {
  pattern: string;
  title: string;
  content: PageHelperContent;
  roleOverrides?: Partial<Record<PageHelperRole, PageHelperContent>>;
  hidden?: boolean;
  placement?: PageHelperPlacement;
}

export interface ResolvePageHelperInput {
  pathname: string;
  primaryRole?: PageHelperRole | null;
  roles?: string[] | null;
}

export interface ResolvedPageHelper {
  pattern: string;
  title: string;
  content: PageHelperContent;
  hidden: boolean;
  placement: PageHelperPlacement;
}
