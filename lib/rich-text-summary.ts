type RichTextNode = {
  content?: RichTextNode[];
  text?: string;
};

export function extractRichTextPlainText(content: string | null | undefined): string {
  if (!content) return "";

  try {
    const parsed = JSON.parse(content) as RichTextNode;
    const collected = collectText(parsed);
    return collected || normalizeWhitespace(content);
  } catch {
    return normalizeWhitespace(content);
  }
}

export function summarizeRichText(
  content: string | null | undefined,
  maxLength: number
): string {
  const plainText = extractRichTextPlainText(content);
  if (maxLength <= 0 || plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength).trimEnd()}...`;
}

function collectText(node: RichTextNode | null | undefined): string {
  if (!node) return "";

  const parts: string[] = [];

  if (typeof node.text === "string") {
    parts.push(node.text);
  }

  for (const child of node.content ?? []) {
    const childText = collectText(child);
    if (childText) {
      parts.push(childText);
    }
  }

  return normalizeWhitespace(parts.join(" "));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
