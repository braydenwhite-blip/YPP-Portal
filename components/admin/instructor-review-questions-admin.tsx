"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import {
  deleteInstructorReviewQuestion,
  reorderInstructorReviewQuestions,
  upsertInstructorReviewQuestion,
  type InstructorReviewQuestionRow,
} from "@/lib/instructor-feedback-actions";

export function InstructorReviewQuestionsAdmin({
  initialQuestions,
}: {
  initialQuestions: InstructorReviewQuestionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState("");
  const [optionsText, setOptionsText] = useState("1\n2\n3\n4\n5");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialQuestions);

  useEffect(() => {
    setRows(initialQuestions);
  }, [initialQuestions]);

  function startEdit(row: InstructorReviewQuestionRow) {
    setEditingId(row.id);
    setPrompt(row.prompt);
    setCategory(row.category ?? "");
    setOptionsText(row.options.join("\n"));
  }

  function resetForm() {
    setEditingId(null);
    setPrompt("");
    setCategory("");
    setOptionsText("1\n2\n3\n4\n5");
  }

  function save() {
    setError(null);
    const options = optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    startTransition(async () => {
      try {
        await upsertInstructorReviewQuestion({
          id: editingId ?? undefined,
          prompt,
          category: category.trim() || null,
          options,
          isActive: true,
          sortOrder: editingId
            ? rows.find((q) => q.id === editingId)?.sortOrder ?? 0
            : (rows.length + 1) * 10,
        });
        resetForm();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save question.");
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Delete this question?")) return;
    startTransition(async () => {
      try {
        await deleteInstructorReviewQuestion(id);
        if (editingId === id) resetForm();
        setRows((prev) => prev.filter((q) => q.id !== id));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete question.");
      }
    });
  }

  function move(id: string, direction: -1 | 1) {
    const index = rows.findIndex((q) => q.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= rows.length) return;
    const reordered = [...rows];
    const [item] = reordered.splice(index, 1);
    reordered.splice(next, 0, item);
    setRows(reordered);
    startTransition(async () => {
      try {
        await reorderInstructorReviewQuestions({
          orderedIds: reordered.map((q) => q.id),
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reorder questions.");
        setRows(initialQuestions);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-8">
      <header className="mb-6">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">
          Admin
        </p>
        <h1 className="m-0 mt-1 text-[24px] font-semibold text-ink">
          Mentorship review questions
        </h1>
        <p className="m-0 mt-2 text-[14px] text-ink-muted">
          Mentors see these questions when writing monthly Goal Reviews for any mentee. Create,
          edit, delete, reorder, and change answer choices here — nothing is hardcoded.
        </p>
      </header>

      <ul className="m-0 list-none divide-y divide-line-card overflow-hidden rounded-[14px] border border-line-card bg-surface p-0">
        {rows.map((row, index) => (
          <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="m-0 text-[14px] font-semibold text-ink">{row.prompt}</p>
              <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
                {row.category ?? "Uncategorized"} · {row.options.length} options
                {row.isActive ? "" : " · inactive"}
              </p>
              <p className="m-0 mt-1 text-[12px] text-ink-muted">{row.options.join(" · ")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending || index === 0}
                onClick={() => move(row.id, -1)}
              >
                Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending || index === rows.length - 1}
                onClick={() => move(row.id, 1)}
              >
                Down
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(row)}>
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await upsertInstructorReviewQuestion({
                        id: row.id,
                        prompt: row.prompt,
                        category: row.category,
                        options: row.options,
                        isActive: !row.isActive,
                        sortOrder: row.sortOrder,
                      });
                      router.refresh();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Could not update question."
                      );
                    }
                  });
                }}
              >
                {row.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => remove(row.id)}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="p-4 text-[13px] text-ink-muted">No questions yet — add one below.</li>
        ) : null}
      </ul>

      <section className="mt-6 rounded-[14px] border border-line-card bg-surface p-4 sm:p-5">
        <h2 className="m-0 text-[15px] font-semibold text-ink">
          {editingId ? "Edit question" : "Add question"}
        </h2>
        <div className="mt-3 grid gap-3">
          <label className="block text-[12px] font-semibold text-ink-muted">
            Prompt
            <input
              className="mt-1 w-full rounded-[10px] border border-line px-3 py-2 text-[14px] text-ink"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <label className="block text-[12px] font-semibold text-ink-muted">
            Category
            <input
              className="mt-1 w-full rounded-[10px] border border-line px-3 py-2 text-[14px] text-ink"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
          <label className="block text-[12px] font-semibold text-ink-muted">
            Answer options (one per line)
            <textarea
              className="mt-1 w-full resize-y rounded-[10px] border border-line px-3 py-2 text-[14px] text-ink"
              rows={5}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
            />
          </label>
          {error ? <p className="m-0 text-[13px] text-danger-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" disabled={pending} onClick={save}>
              {pending ? "Saving…" : editingId ? "Update question" : "Add question"}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
