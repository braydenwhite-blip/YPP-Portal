"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { all, createLowlight } from "lowlight";
import {
  STUDIO_RICH_NODE_TYPES,
  formatLessonDesignStudioUploadSize,
  parseLessonDesignStudioRichDocument,
  resolveLessonDesignStudioEmbed,
  type StudioRichMark,
  type StudioRichNode,
} from "@/lib/lesson-design-studio-rich-content";

const lowlight = createLowlight(all);

const EMPTY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const StudioImageNode = Node.create({
  name: STUDIO_RICH_NODE_TYPES.image,
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-studio-image]" }];
  },

  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    const imageSpec = [
      "img",
      {
        src: HTMLAttributes.url || "",
        alt: HTMLAttributes.alt || HTMLAttributes.caption || "",
        loading: "lazy",
      },
    ] as const satisfies DOMOutputSpec;

    if (HTMLAttributes.caption) {
      return [
        "figure",
        mergeAttributes({
          "data-studio-image": "true",
          class: "lds-rich-node-figure lds-rich-node-figure-image",
        }),
        imageSpec,
        [
          "figcaption",
          { class: "lds-rich-node-caption" },
          HTMLAttributes.caption,
        ],
      ] satisfies DOMOutputSpec;
    }

    return [
      "figure",
      mergeAttributes({
        "data-studio-image": "true",
        class: "lds-rich-node-figure lds-rich-node-figure-image",
      }),
      imageSpec,
    ] satisfies DOMOutputSpec;
  },
});

const StudioEmbedNode = Node.create({
  name: STUDIO_RICH_NODE_TYPES.embed,
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      provider: { default: "YOUTUBE" },
      src: { default: "" },
      url: { default: "" },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-studio-embed]" }];
  },

  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    const title = HTMLAttributes.title || "Embedded video";

    return [
      "figure",
      mergeAttributes({
        "data-studio-embed": "true",
        class: "lds-rich-node-figure lds-rich-node-figure-embed",
      }),
      [
        "div",
        { class: "lds-rich-node-embed-frame" },
        [
          "iframe",
          {
            src: HTMLAttributes.src || "",
            title,
            allow:
              "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
            allowfullscreen: "true",
            loading: "lazy",
            referrerpolicy: "strict-origin-when-cross-origin",
          },
        ],
      ],
      ["figcaption", { class: "lds-rich-node-caption" }, title],
    ] satisfies DOMOutputSpec;
  },
});

const StudioFileNode = Node.create({
  name: STUDIO_RICH_NODE_TYPES.file,
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      mimeType: { default: "" },
      size: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-studio-file]" }];
  },

  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    const sizeLabel = formatLessonDesignStudioUploadSize(
      typeof HTMLAttributes.size === "number" ? HTMLAttributes.size : null
    );

    return [
      "div",
      mergeAttributes({
        "data-studio-file": "true",
        class: "lds-rich-node-file",
      }),
      [
        "a",
        {
          href: HTMLAttributes.url || "#",
          target: "_blank",
          rel: "noopener noreferrer",
          class: "lds-rich-node-file-link",
        },
        ["span", { class: "lds-rich-node-file-title" }, HTMLAttributes.title || "Attachment"],
        [
          "span",
          { class: "lds-rich-node-file-meta" },
          [HTMLAttributes.mimeType || "File", sizeLabel].filter(Boolean).join(" • "),
        ],
      ],
    ] satisfies DOMOutputSpec;
  },
});

const StudioQuizNode = Node.create({
  name: STUDIO_RICH_NODE_TYPES.quiz,
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      question: { default: "" },
      options: { default: [] },
      correctIndex: { default: 0 },
      explanation: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-studio-quiz]" }];
  },

  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    const options = Array.isArray(HTMLAttributes.options)
      ? HTMLAttributes.options.filter((option): option is string => typeof option === "string")
      : [];
    const listItems = options.map(
      (option) => ["li", {}, option] as const satisfies DOMOutputSpec
    );
    const listSpec = [
      "ol",
      { class: "lds-rich-node-quiz-options" },
      ...listItems,
    ] as const satisfies DOMOutputSpec;

    if (HTMLAttributes.explanation) {
      return [
        "figure",
        mergeAttributes({
          "data-studio-quiz": "true",
          class: "lds-rich-node-figure lds-rich-node-figure-quiz",
        }),
        ["figcaption", { class: "lds-rich-node-quiz-label" }, "Quiz block"],
        [
          "div",
          { class: "lds-rich-node-quiz-question" },
          HTMLAttributes.question || "Quiz question",
        ],
        listSpec,
        [
          "p",
          { class: "lds-rich-node-quiz-explanation" },
          HTMLAttributes.explanation,
        ],
      ] satisfies DOMOutputSpec;
    }

    return [
      "figure",
      mergeAttributes({
        "data-studio-quiz": "true",
        class: "lds-rich-node-figure lds-rich-node-figure-quiz",
      }),
      ["figcaption", { class: "lds-rich-node-quiz-label" }, "Quiz block"],
      [
        "div",
        { class: "lds-rich-node-quiz-question" },
        HTMLAttributes.question || "Quiz question",
      ],
      listSpec,
    ] satisfies DOMOutputSpec;
  },
});

interface StudioRichEditorProps {
  value: string | null;
  onChange: (json: string) => void;
  readOnly?: boolean;
  uploadEntityId: string;
  uploadEntityType?: string;
  placeholder?: string;
}

function getInitialDocument(value: string | null): JSONContent {
  return parseLessonDesignStudioRichDocument(value) ?? EMPTY_DOCUMENT;
}

export function StudioRichEditor({
  value,
  onChange,
  readOnly = false,
  uploadEntityId,
  uploadEntityType = "LESSON_DESIGN_STUDIO_ACTIVITY",
  placeholder = "Describe the student experience, teacher moves, and any media that should live inside this block.",
}: StudioRichEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">(readOnly ? "preview" : "edit");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const statusId = useId();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      StudioImageNode,
      StudioEmbedNode,
      StudioFileNode,
      StudioQuizNode,
    ],
    content: getInitialDocument(value),
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "lds-rich-editor-content",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(JSON.stringify(nextEditor.getJSON()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (readOnly) {
      setMode("preview");
    }
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;

    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(getInitialDocument(value));
    if (current !== next) {
      editor.commands.setContent(getInitialDocument(value));
    }
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor || readOnly) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Paste a link URL", previous ?? "");
    if (url === null) return;

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }, [editor, readOnly]);

  const handleUpload = useCallback(
    async (file: File, kind: "image" | "file") => {
      if (!editor || readOnly) return;

      setIsUploading(true);
      setStatusMessage(kind === "image" ? "Uploading image…" : "Uploading attachment…");

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "OTHER");
        formData.append("entityId", uploadEntityId);
        formData.append("entityType", uploadEntityType);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as {
          error?: string;
          url?: string;
          originalName?: string;
          size?: number;
        };

        if (!response.ok || !payload.url) {
          throw new Error(payload.error || "Upload failed");
        }

        if (kind === "image") {
          editor
            .chain()
            .focus()
            .insertContent({
              type: STUDIO_RICH_NODE_TYPES.image,
              attrs: {
                url: payload.url,
                alt: payload.originalName || file.name,
                caption: "",
              },
            })
            .run();
        } else {
          editor
            .chain()
            .focus()
            .insertContent({
              type: STUDIO_RICH_NODE_TYPES.file,
              attrs: {
                url: payload.url,
                title: payload.originalName || file.name,
                mimeType: file.type || "File",
                size: payload.size ?? file.size,
              },
            })
            .run();
        }

        setStatusMessage(kind === "image" ? "Image added." : "Attachment added.");
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "Upload failed. Try again."
        );
      } finally {
        setIsUploading(false);
      }
    },
    [editor, readOnly, uploadEntityId, uploadEntityType]
  );

  const insertVideoEmbed = useCallback(() => {
    if (!editor || readOnly) return;
    const url = window.prompt("Paste a YouTube or Vimeo URL");
    if (url === null) return;

    const embed = resolveLessonDesignStudioEmbed(url);
    if (!embed) {
      setStatusMessage("Use a valid YouTube or Vimeo link.");
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: STUDIO_RICH_NODE_TYPES.embed,
        attrs: embed,
      })
      .run();
    setStatusMessage(`${embed.provider === "YOUTUBE" ? "YouTube" : "Vimeo"} embed added.`);
  }, [editor, readOnly]);

  const insertQuizBlock = useCallback(() => {
    if (!editor || readOnly) return;

    const question = window.prompt("Quiz question");
    if (question === null || !question.trim()) return;

    const correctOption = window.prompt("Correct answer");
    if (correctOption === null || !correctOption.trim()) return;

    const distractorOne = window.prompt("Distractor answer 1");
    if (distractorOne === null || !distractorOne.trim()) return;

    const distractorTwo = window.prompt("Distractor answer 2");
    if (distractorTwo === null || !distractorTwo.trim()) return;

    const optionalDistractor =
      window.prompt("Distractor answer 3 (optional)")?.trim() ?? "";
    const explanation = window.prompt("Explanation (optional)")?.trim() ?? "";

    editor
      .chain()
      .focus()
      .insertContent({
        type: STUDIO_RICH_NODE_TYPES.quiz,
        attrs: {
          question: question.trim(),
          options: [
            correctOption.trim(),
            distractorOne.trim(),
            distractorTwo.trim(),
            optionalDistractor,
          ].filter(Boolean),
          correctIndex: 0,
          explanation,
        },
      })
      .run();
    setStatusMessage("Quiz block added.");
  }, [editor, readOnly]);

  const insertCodeBlock = useCallback(() => {
    if (!editor || readOnly) return;
    const language = window.prompt("Code language", "plaintext")?.trim() || "plaintext";
    editor.chain().focus().setCodeBlock({ language }).run();
    setStatusMessage(`Code block ready in ${language}.`);
  }, [editor, readOnly]);

  if (!editor) {
    return null;
  }

  return (
    <div className="lds-rich-editor">
      <div className="lds-rich-editor-toolbar">
        <div className="lds-rich-editor-toolbar-group" role="toolbar" aria-label="Format text">
          <ToolbarButton
            label="Bold"
            active={editor.isActive("bold")}
            disabled={readOnly || mode === "preview"}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="Italic"
            active={editor.isActive("italic")}
            disabled={readOnly || mode === "preview"}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="H2"
            active={editor.isActive("heading", { level: 2 })}
            disabled={readOnly || mode === "preview"}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            label="H3"
            active={editor.isActive("heading", { level: 3 })}
            disabled={readOnly || mode === "preview"}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <ToolbarButton
            label="Bullets"
            active={editor.isActive("bulletList")}
            disabled={readOnly || mode === "preview"}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="Numbers"
            active={editor.isActive("orderedList")}
            disabled={readOnly || mode === "preview"}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="Link"
            active={editor.isActive("link")}
            disabled={readOnly || mode === "preview"}
            onClick={setLink}
          />
        </div>

        <div className="lds-rich-toolbar-divider" aria-hidden="true" />

        <div className="lds-rich-editor-toolbar-group" role="toolbar" aria-label="Insert blocks">
          <ToolbarButton
            label="Code"
            disabled={readOnly || mode === "preview"}
            onClick={insertCodeBlock}
          />
          <ToolbarButton
            label="Image"
            disabled={readOnly || mode === "preview" || isUploading}
            onClick={() => imageInputRef.current?.click()}
          />
          <ToolbarButton
            label="Video"
            disabled={readOnly || mode === "preview"}
            onClick={insertVideoEmbed}
          />
          <ToolbarButton
            label="File"
            disabled={readOnly || mode === "preview" || isUploading}
            onClick={() => fileInputRef.current?.click()}
          />
          <ToolbarButton
            label="Quiz"
            disabled={readOnly || mode === "preview"}
            onClick={insertQuizBlock}
          />
        </div>

        <div className="lds-rich-editor-toolbar-spacer" />

        <div className="lds-rich-editor-toolbar-group">
          <ToolbarButton
            label={mode === "edit" ? "Preview" : "Edit"}
            disabled={readOnly && mode === "preview"}
            onClick={() => setMode((current) => (current === "edit" ? "preview" : "edit"))}
          />
        </div>
      </div>

      <div className="lds-rich-editor-status-row">
        <p className="lds-rich-editor-note">
          Add media, quick checks, and richer teaching notes directly inside the activity description.
        </p>
        <p id={statusId} className="lds-rich-editor-status" aria-live="polite">
          {statusMessage ?? (mode === "preview" ? "Preview mode" : "Edit mode")}
        </p>
      </div>

      <input
        ref={imageInputRef}
        className="lds-rich-upload-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          await handleUpload(file, "image");
        }}
      />
      <input
        ref={fileInputRef}
        className="lds-rich-upload-input"
        type="file"
        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          await handleUpload(file, "file");
        }}
      />

      {mode === "edit" ? (
        <div className="lds-rich-editor-surface" onClick={() => editor.commands.focus()}>
          <EditorContent editor={editor} aria-describedby={statusId} />
        </div>
      ) : (
        <div className="lds-rich-editor-surface preview" aria-describedby={statusId}>
          <StudioRichContent
            content={value}
            emptyState="This activity does not have a rich description yet."
          />
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`lds-rich-toolbar-button${active ? " active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

interface StudioRichContentProps {
  content: string | null | undefined;
  className?: string;
  emptyState?: string;
  interactiveQuiz?: boolean;
}

export function StudioRichContent({
  content,
  className,
  emptyState = "",
  interactiveQuiz = false,
}: StudioRichContentProps) {
  const document = parseLessonDesignStudioRichDocument(content);

  if (!document) {
    return emptyState ? <p className="lds-rich-content-empty">{emptyState}</p> : null;
  }

  return (
    <div className={["lds-rich-content", className].filter(Boolean).join(" ")}>
      {(document.content ?? []).map((node, index) =>
        renderRichNode(node, `rich-node-${index}`, interactiveQuiz)
      )}
    </div>
  );
}

function renderRichNode(
  node: StudioRichNode,
  key: string,
  interactiveQuiz: boolean
): ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key}>
          {renderRichChildren(node.content ?? [], `${key}-child`, interactiveQuiz)}
        </p>
      );
    case "heading": {
      const level = Math.min(
        6,
        Math.max(1, Number(node.attrs?.level) || 2)
      ) as 1 | 2 | 3 | 4 | 5 | 6;
      const Tag = `h${level}` as const;
      return (
        <Tag key={key}>
          {renderRichChildren(node.content ?? [], `${key}-child`, interactiveQuiz)}
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul key={key}>
          {renderRichChildren(node.content ?? [], `${key}-item`, interactiveQuiz)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key}>
          {renderRichChildren(node.content ?? [], `${key}-item`, interactiveQuiz)}
        </ol>
      );
    case "listItem":
      return (
        <li key={key}>
          {renderRichChildren(node.content ?? [], `${key}-child`, interactiveQuiz)}
        </li>
      );
    case "hardBreak":
      return <br key={key} />;
    case "text":
      return applyMarksToText(node.text ?? "", node.marks ?? [], key);
    case "codeBlock": {
      const language =
        typeof node.attrs?.language === "string" ? node.attrs.language : "plaintext";
      return (
        <pre key={key} className="lds-rich-content-code-block">
          <code>{extractCodeBlockText(node)}</code>
          <span className="lds-rich-content-code-language">{language}</span>
        </pre>
      );
    }
    case STUDIO_RICH_NODE_TYPES.image: {
      const url = typeof node.attrs?.url === "string" ? node.attrs.url : "";
      const alt =
        typeof node.attrs?.alt === "string" ? node.attrs.alt : "Lesson studio image";
      const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption : "";
      if (!url) return null;

      return (
        <figure key={key} className="lds-rich-content-figure">
          <img
            src={url}
            alt={alt}
            loading="lazy"
            className="lds-rich-content-image"
          />
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      );
    }
    case STUDIO_RICH_NODE_TYPES.embed: {
      const src =
        typeof node.attrs?.src === "string"
          ? node.attrs.src
          : resolveLessonDesignStudioEmbed(
              typeof node.attrs?.url === "string" ? node.attrs.url : ""
            )?.src ?? "";
      const title =
        typeof node.attrs?.title === "string" && node.attrs.title.trim()
          ? node.attrs.title
          : "Embedded video";

      if (!src) return null;

      return (
        <figure key={key} className="lds-rich-content-figure embed">
          <div className="lds-rich-content-embed-frame">
            <iframe
              src={src}
              title={title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <figcaption>{title}</figcaption>
        </figure>
      );
    }
    case STUDIO_RICH_NODE_TYPES.file: {
      const url = typeof node.attrs?.url === "string" ? node.attrs.url : "";
      const title =
        typeof node.attrs?.title === "string" && node.attrs.title.trim()
          ? node.attrs.title
          : "Attachment";
      const mimeType = typeof node.attrs?.mimeType === "string" ? node.attrs.mimeType : "";
      const size =
        typeof node.attrs?.size === "number" ? node.attrs.size : Number(node.attrs?.size);
      const meta = [mimeType, formatLessonDesignStudioUploadSize(size)]
        .filter(Boolean)
        .join(" • ");

      return (
        <a
          key={key}
          className="lds-rich-content-file"
          href={url || "#"}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="lds-rich-content-file-title">{title}</span>
          {meta ? <span className="lds-rich-content-file-meta">{meta}</span> : null}
        </a>
      );
    }
    case STUDIO_RICH_NODE_TYPES.quiz: {
      const question =
        typeof node.attrs?.question === "string" ? node.attrs.question : "";
      const options = Array.isArray(node.attrs?.options)
        ? node.attrs.options.filter((option): option is string => typeof option === "string")
        : [];
      const correctIndex =
        typeof node.attrs?.correctIndex === "number" ? node.attrs.correctIndex : 0;
      const explanation =
        typeof node.attrs?.explanation === "string" ? node.attrs.explanation : "";

      return (
        <StudioQuizCard
          key={key}
          question={question}
          options={options}
          correctIndex={correctIndex}
          explanation={explanation}
          interactive={interactiveQuiz}
        />
      );
    }
    default:
      return (
        <Fragment key={key}>
          {renderRichChildren(node.content ?? [], `${key}-child`, interactiveQuiz)}
        </Fragment>
      );
  }
}

function renderRichChildren(
  nodes: StudioRichNode[],
  keyPrefix: string,
  interactiveQuiz: boolean
) {
  return nodes.map((child, index) =>
    renderRichNode(child, `${keyPrefix}-${index}`, interactiveQuiz)
  );
}

function applyMarksToText(text: string, marks: StudioRichMark[], key: string) {
  return marks.reduce<ReactNode>((content, mark, index) => {
    const nextKey = `${key}-${mark.type}-${index}`;
    if (mark.type === "bold") {
      return <strong key={nextKey}>{content}</strong>;
    }
    if (mark.type === "italic") {
      return <em key={nextKey}>{content}</em>;
    }
    if (mark.type === "code") {
      return <code key={nextKey}>{content}</code>;
    }
    if (mark.type === "link") {
      const href =
        typeof mark.attrs?.href === "string" ? mark.attrs.href : "#";
      return (
        <a key={nextKey} href={href} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    }
    return <Fragment key={nextKey}>{content}</Fragment>;
  }, <Fragment key={key}>{text}</Fragment>);
}

function extractCodeBlockText(node: StudioRichNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  return (node.content ?? []).map(extractCodeBlockText).join("");
}

function StudioQuizCard({
  question,
  options,
  correctIndex,
  explanation,
  interactive,
}: {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  interactive: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const quizId = useId();
  const isCorrect = selectedIndex === correctIndex;

  if (!interactive) {
    return (
      <div className="lds-rich-quiz-card">
        <span className="lds-rich-quiz-label">Quiz block</span>
        <strong>{question || "Quiz question"}</strong>
        <ol className="lds-rich-quiz-options static">
          {options.map((option, index) => (
            <li key={`${quizId}-${index}`}>{option}</li>
          ))}
        </ol>
        {explanation ? <p className="lds-rich-quiz-feedback">{explanation}</p> : null}
      </div>
    );
  }

  return (
    <div className="lds-rich-quiz-card">
      <span className="lds-rich-quiz-label">Knowledge check</span>
      <strong>{question || "Quiz question"}</strong>
      <div className="lds-rich-quiz-options">
        {options.map((option, index) => (
          <button
            key={`${quizId}-${index}`}
            type="button"
            className={`lds-rich-quiz-option${
              selectedIndex === index ? " selected" : ""
            }${isRevealed && index === correctIndex ? " correct" : ""}${
              isRevealed && selectedIndex === index && index !== correctIndex
                ? " incorrect"
                : ""
            }`}
            onClick={() => {
              setSelectedIndex(index);
              setIsRevealed(false);
            }}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="lds-rich-quiz-actions">
        <button
          type="button"
          className="button secondary"
          disabled={selectedIndex === null}
          onClick={() => setIsRevealed(true)}
        >
          Check answer
        </button>
      </div>
      {isRevealed ? (
        <p
          className={`lds-rich-quiz-feedback${isCorrect ? " success" : " error"}`}
          role="status"
        >
          {isCorrect
            ? explanation || "Correct."
            : explanation || `Not quite. The correct answer is ${options[correctIndex]}.`}
        </p>
      ) : null}
    </div>
  );
}
