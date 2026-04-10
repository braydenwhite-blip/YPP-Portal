import { describe, expect, it } from "vitest";
import {
  extractLessonDesignStudioRichText,
  getLessonDesignStudioRichPreview,
  resolveLessonDesignStudioEmbed,
} from "@/lib/lesson-design-studio-rich-content";

describe("lesson design studio rich content helpers", () => {
  it("falls back to readable plain text previews for rich JSON content", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Students watch a clip and discuss it." }],
        },
        {
          type: "studioQuiz",
          attrs: {
            question: "What is a smart budget first step?",
            options: ["Track spending", "Spend more", "Ignore receipts"],
            correctIndex: 0,
          },
        },
      ],
    });

    expect(extractLessonDesignStudioRichText(content)).toContain(
      "Students watch a clip and discuss it."
    );
    expect(getLessonDesignStudioRichPreview(content)).toContain(
      "What is a smart budget first step?"
    );
  });

  it("keeps legacy plain text content intact", () => {
    const content = "Warm up with a real spending scenario.";

    expect(extractLessonDesignStudioRichText(content)).toBe(content);
    expect(getLessonDesignStudioRichPreview(content)).toBe(content);
  });

  it("normalizes supported video URLs into safe embeds", () => {
    expect(resolveLessonDesignStudioEmbed("https://youtu.be/abc123xyz")).toMatchObject({
      provider: "YOUTUBE",
      src: "https://www.youtube.com/embed/abc123xyz",
    });

    expect(resolveLessonDesignStudioEmbed("https://vimeo.com/123456789")).toMatchObject({
      provider: "VIMEO",
      src: "https://player.vimeo.com/video/123456789",
    });
  });
});
