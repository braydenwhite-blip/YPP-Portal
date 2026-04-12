import {
  buildLessonDesignStudioHref,
  type StudioEntryContext,
} from "@/lib/lesson-design-studio";

interface OpenLessonDesignStudioArgs {
  entryContext?: StudioEntryContext;
  draftId?: string | null;
  notice?: string | null;
}

export function openLessonDesignStudio(
  args?: OpenLessonDesignStudioArgs
) {
  const href = buildLessonDesignStudioHref(args);

  if (typeof window !== "undefined") {
    window.location.assign(href);
  }

  return href;
}
