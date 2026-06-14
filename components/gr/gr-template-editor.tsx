"use client";

import React, { useState, useTransition } from "react";
import { 
  addGRTemplateGoal, 
  updateGRTemplateGoal, 
  removeGRTemplateGoal, 
  setGRTemplateSuccessCriteria,
  addGRTemplateComment,
  resolveGRTemplateComment
} from "@/lib/gr-actions";

// Match the structural return type of getGRTemplateDetail safely
interface TemplateEditorProps {
  template: {
    id: string;
    title: string;
    roleType: string;
    officerPosition: string | null;
    roleMission: string;
    version: number;
    goals?: Array<{ id: string; title: string; description: string; timePhase: string; sortOrder: number }>;
    successCriteria?: Array<{ id: string; timePhase: string; criteria: string }>;
    comments?: Array<{ id: string; body: string; createdAt: Date; author: { name: string | null; email: string | null } }>;
    resources?: Array<{ id: string; resource?: { title: string; url: string } | null }>;
  } | null;
}

export default function GRTemplateEditor({ template }: TemplateEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [commentText, setCommentText] = useState("");

  // Safety fallback arrays to guarantee .map() never reads undefined
  const goals = template?.goals ?? [];
  const successCriteria = template?.successCriteria ?? [];
  const comments = template?.comments ?? [];
  const resources = template?.resources ?? [];

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template?.id || !commentText.trim()) return;

    const formData = new FormData();
    formData.set("templateId", template.id);
    formData.set("body", commentText.trim());

    startTransition(async () => {
      await addGRTemplateComment(formData);
      setCommentText("");
    });
  };

  if (!template) {
    return <div className="p-4 text-amber-600 font-medium">No valid template context loaded.</div>;
  }

  return (
    <div className="space-y-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      {/* Framework Parameters Header */}
      <div className="border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">{template.title}</h2>
          <span className="bg-slate-100 text-slate-700 text-xs font-mono px-2 py-1 rounded">
            v{template.version}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">Role Framework Target: <span className="font-semibold text-slate-700">{template.roleType}</span></p>
        <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 italic">
          &ldquo;{template.roleMission || "No mission target statement configured."}&rdquo;
        </div>
      </div>

      {/* SECTION 1: Blueprinted Core Goals */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Core Goals Framework ({goals.length})</h3>
        {goals.length === 0 ? (
          <p className="text-sm text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-dashed border-slate-200">
            No developmental blueprint goals added to this template framework yet.
          </p>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <div key={goal.id} className="p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition shadow-xs flex justify-between items-start">
                <div>
                  <span className="inline-block bg-indigo-50 text-indigo-700 font-semibold text-xs px-2 py-0.5 rounded-sm mb-1.5 uppercase">
                    {goal.timePhase}
                  </span>
                  <h4 className="font-medium text-slate-900 text-sm">{goal.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{goal.description}</p>
                </div>
                <input type="hidden" name="goalId" value={goal.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Phase Success Criteria */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Phase Evaluation Success Criteria</h3>
        {successCriteria.length === 0 ? (
          <p className="text-sm text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-dashed border-slate-200">
            No verification or criteria matrices linked to current intervals.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {successCriteria.map((criteria) => (
              <div key={criteria.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-tight">{criteria.timePhase}</span>
                <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{criteria.criteria}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: Linked Reference Library Assets */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Linked Playbooks & Resource Libraries</h3>
        {resources.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No asset links attached to this structural container.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {resources.map((item) => item.resource && (
              <a 
                key={item.id} 
                href={item.resource.url} 
                target="_blank" 
                rel="noreferrer" 
                className="inline-flex items-center text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md font-medium transition"
              >
                📎 {item.resource.title}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4: Unresolved Engineering Drafting Comments */}
      <div className="border-t border-slate-100 pt-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Drafting Feedback & Action Items</h3>
        
        {comments.length > 0 && (
          <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2">
            {comments.map((comment) => (
              <div key={comment.id} className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg flex justify-between items-start text-xs">
                <div>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <span className="font-semibold text-slate-700">{comment.author?.name || "System Architect"}</span>
                    <span>•</span>
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed">{comment.body}</p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("commentId", comment.id);
                    startTransition(() => resolveGRTemplateComment(fd));
                  }}
                  className="text-amber-700 hover:text-amber-900 font-semibold uppercase tracking-wider text-[10px] bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add structural note or action directive..."
            className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending || !commentText.trim()}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            Comment
          </button>
        </form>
      </div>
    </div>
  );
}