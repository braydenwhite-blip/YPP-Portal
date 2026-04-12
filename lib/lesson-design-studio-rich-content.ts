export const STUDIO_RICH_NODE_TYPES = {
  image: "studioImage",
  embed: "studioEmbed",
  file: "studioFile",
  quiz: "studioQuiz",
} as const;

export interface StudioRichMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface StudioRichNode {
  type: string;
  content?: StudioRichNode[];
  text?: string;
  marks?: StudioRichMark[];
  attrs?: Record<string, unknown>;
}

export interface StudioRichDoc extends StudioRichNode {
  type: "doc";
}

export interface StudioEmbedAttrs {
  provider: "YOUTUBE" | "VIMEO";
  src: string;
  url: string;
  title: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStudioRichNode(value: unknown): value is StudioRichNode {
  return isRecord(value) && typeof value.type === "string";
}

export function isStudioRichDocument(value: unknown): value is StudioRichDoc {
  return (
    isStudioRichNode(value) &&
    value.type === "doc" &&
    (!("content" in value) ||
      value.content === undefined ||
      Array.isArray(value.content))
  );
}

function buildTextNode(text: string): StudioRichNode {
  return { type: "text", text };
}

function buildParagraphNode(text: string): StudioRichNode {
  const parts = text.split("\n");
  const content: StudioRichNode[] = [];

  parts.forEach((part, index) => {
    if (part.length > 0) {
      content.push(buildTextNode(part));
    }

    if (index < parts.length - 1) {
      content.push({ type: "hardBreak" });
    }
  });

  return {
    type: "paragraph",
    content: content.length > 0 ? content : [buildTextNode("")],
  };
}

function buildPlainTextDocument(value: string): StudioRichDoc {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    type: "doc",
    content:
      paragraphs.length > 0
        ? paragraphs.map(buildParagraphNode)
        : [buildParagraphNode(value.trim())],
  };
}

export function parseLessonDesignStudioRichDocument(
  value: string | null | undefined
): StudioRichDoc | null {
  if (!value || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (isStudioRichDocument(parsed)) {
      return parsed;
    }
  } catch {
    return buildPlainTextDocument(value);
  }

  return buildPlainTextDocument(value);
}

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string {
  const value = attrs?.[key];
  return typeof value === "string" ? value : "";
}

function readStringListAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string[] {
  const value = attrs?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function extractLessonDesignStudioRichText(
  value: string | null | undefined
): string {
  const document = parseLessonDesignStudioRichDocument(value);
  if (!document) return "";

  return extractNodeText(document)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function extractNodeText(node: StudioRichNode): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(extractNodeText).filter(Boolean).join("\n\n");
    case "paragraph":
    case "heading":
      return (node.content ?? []).map(extractNodeText).join("");
    case "bulletList":
    case "orderedList":
      return (node.content ?? []).map(extractNodeText).join("\n");
    case "listItem":
      return `• ${(node.content ?? []).map(extractNodeText).join("")}`.trimEnd();
    case "hardBreak":
      return "\n";
    case "text":
      return node.text ?? "";
    case "codeBlock":
      return (node.content ?? []).map(extractNodeText).join("");
    case STUDIO_RICH_NODE_TYPES.image: {
      const caption = readStringAttr(node.attrs, "caption");
      const alt = readStringAttr(node.attrs, "alt");
      return caption || alt;
    }
    case STUDIO_RICH_NODE_TYPES.embed: {
      const title = readStringAttr(node.attrs, "title");
      const url = readStringAttr(node.attrs, "url");
      return title || url;
    }
    case STUDIO_RICH_NODE_TYPES.file: {
      const title = readStringAttr(node.attrs, "title");
      const url = readStringAttr(node.attrs, "url");
      return title || url;
    }
    case STUDIO_RICH_NODE_TYPES.quiz: {
      const question = readStringAttr(node.attrs, "question");
      const options = readStringListAttr(node.attrs, "options");
      return [question, ...options.map((option) => `- ${option}`)]
        .filter(Boolean)
        .join("\n");
    }
    default:
      return (node.content ?? []).map(extractNodeText).join("");
  }
}

export function getLessonDesignStudioRichPreview(
  value: string | null | undefined,
  options?: {
    maxLength?: number;
    fallback?: string;
  }
): string {
  const fallback =
    options?.fallback ??
    "Add the student move, prompt, or facilitation beat for this block.";
  const maxLength = options?.maxLength ?? 160;
  const plainText = extractLessonDesignStudioRichText(value);

  if (!plainText) {
    return fallback;
  }

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function formatLessonDesignStudioUploadSize(size: number | null | undefined) {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return null;
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${Math.round(size)} B`;
}

export function resolveLessonDesignStudioEmbed(url: string): StudioEmbedAttrs | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be"
    ) {
      const videoId =
        host === "youtu.be"
          ? parsed.pathname.split("/").filter(Boolean)[0]
          : parsed.searchParams.get("v") ||
            parsed.pathname.match(/\/(embed|shorts)\/([^/?#]+)/)?.[2] ||
            "";

      if (!videoId) return null;

      return {
        provider: "YOUTUBE",
        src: `https://www.youtube.com/embed/${videoId}`,
        url: parsed.toString(),
        title: "YouTube video",
      };
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const videoId =
        parsed.pathname.match(/\/(?:video\/)?(\d+)/)?.[1] ?? "";
      if (!videoId) return null;

      return {
        provider: "VIMEO",
        src: `https://player.vimeo.com/video/${videoId}`,
        url: parsed.toString(),
        title: "Vimeo video",
      };
    }
  } catch {
    return null;
  }

  return null;
}
