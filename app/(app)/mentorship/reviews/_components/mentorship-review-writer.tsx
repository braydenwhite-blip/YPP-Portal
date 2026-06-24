"use client";

import { useState, useRef } from "react";
import { CardV2 } from "@/components/ui-v2";

interface Mentee {
  id: string;
  name: string;
  team: string;
}

interface ReviewData {
  menteeId: string;
  overallRating: string;
  overallComments: string;
  planOfAction: string;
  goalRatings: Array<{
    goalId: string;
    goalTitle: string;
    rating: string;
    comments: string;
  }>;
}

export function MentorshipReviewWriter() {
  const [selectedMentee, setSelectedMentee] = useState<string>("");
  const [reviewData, setReviewData] = useState<ReviewData>({
    menteeId: "",
    overallRating: "",
    overallComments: "",
    planOfAction: "",
    goalRatings: [],
  });
  const [importedText, setImportedText] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock mentees - in production this would come from an API
  const mentees: Mentee[] = [
    { id: "1", name: "Sarah Greene", team: "Marketing Team" },
    { id: "2", name: "James Diaz", team: "Product Team" },
    { id: "3", name: "Katie Wu", team: "Design Team" },
  ];

  const handleMenteeChange = (menteeId: string) => {
    setSelectedMentee(menteeId);
    setReviewData({ ...reviewData, menteeId });
  };

  const handlePDFImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    // In production, you would use a PDF parsing library like pdf.js
    // For now, we'll simulate importing text
    try {
      const text = await simulatePDFImport(file);
      setImportedText(text);
      
      // Parse the imported text and populate review fields
      // This is a simplified example - real implementation would parse PDF structure
      setReviewData({
        ...reviewData,
        overallComments: text.substring(0, 500),
        planOfAction: "Imported from PDF - review and edit as needed",
      });
    } catch {
      alert("Failed to import PDF. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  const simulatePDFImport = async (file: File): Promise<string> => {
    // Simulate PDF parsing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    return `Imported review content from ${file.name}. This would contain the parsed text from the PDF including goal ratings, comments, and overall assessment.`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // In production, this would save to the database
    // TODO: Implement actual submission logic
    alert("Review submitted successfully! It will be sent to the chair for approval.");
    
    // Reset form
    setSelectedMentee("");
    setReviewData({
      menteeId: "",
      overallRating: "",
      overallComments: "",
      planOfAction: "",
      goalRatings: [],
    });
    setImportedText("");
  };

  const handleSaveDraft = () => {
    // TODO: Implement draft saving logic
    alert("Draft saved successfully!");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Quick Actions */}
      <CardV2 padding="md" className="border border-line-soft bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="m-0 mb-1 text-[16px] font-bold text-ink">Quick Actions</h3>
            <p className="m-0 text-[13px] text-ink-muted">
              Start a new review or import an existing one from PDF
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="button secondary small"
              disabled={isImporting}
            >
              {isImporting ? "Importing..." : "📄 Import from PDF"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handlePDFImport}
              style={{ display: "none" }}
            />
            <a href="/mentorship/reviews" className="button secondary small">
              View Review Inbox
            </a>
          </div>
        </div>
      </CardV2>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Review Form */}
          <div className="flex flex-col gap-6">
            {/* Select Mentee */}
            <CardV2 padding="md" className="border border-line-soft bg-surface">
              <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">1. Select Mentee</h3>
              <select
                value={selectedMentee}
                onChange={(e) => handleMenteeChange(e.target.value)}
                className="w-full rounded-lg border border-line-soft bg-surface px-4 py-2.5 text-[14px] text-ink"
                required
              >
                <option value="">Choose a mentee...</option>
                {mentees.map((mentee) => (
                  <option key={mentee.id} value={mentee.id}>
                    {mentee.name} - {mentee.team}
                  </option>
                ))}
              </select>
            </CardV2>

            {/* Goal Ratings */}
            {selectedMentee && (
              <CardV2 padding="md" className="border border-line-soft bg-surface">
                <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">2. Rate Goals</h3>
                <div className="flex flex-col gap-4">
                  {[
                    { id: "1", title: "Improve public speaking" },
                    { id: "2", title: "Complete product certification" },
                    { id: "3", title: "Lead design sprint" },
                  ].map((goal) => (
                    <div key={goal.id} className="rounded-lg border border-line-soft bg-surface-muted p-4">
                      <p className="m-0 mb-2 text-[13px] font-semibold text-ink">{goal.title}</p>
                      <div className="flex flex-wrap gap-2">
                        {["Needs Work", "In Progress", "On Track", "Exceeding"].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => {
                              const newRatings = reviewData.goalRatings.filter(
                                (r) => r.goalId !== goal.id
                              );
                              setReviewData({
                                ...reviewData,
                                goalRatings: [
                                  ...newRatings,
                                  { goalId: goal.id, goalTitle: goal.title, rating, comments: "" },
                                ],
                              });
                            }}
                            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                              reviewData.goalRatings.find((r) => r.goalId === goal.id)?.rating === rating
                                ? "bg-brand-600 text-white"
                                : "bg-surface border border-line-soft text-ink-muted hover:border-brand-400"
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardV2>
            )}

            {/* Overall Assessment */}
            {selectedMentee && (
              <CardV2 padding="md" className="border border-line-soft bg-surface">
                <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">3. Overall Assessment</h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="m-0 mb-2 block text-[13px] font-semibold text-ink">
                      Overall Rating
                    </label>
                    <select
                      value={reviewData.overallRating}
                      onChange={(e) => setReviewData({ ...reviewData, overallRating: e.target.value })}
                      className="w-full rounded-lg border border-line-soft bg-surface px-4 py-2.5 text-[14px] text-ink"
                      required
                    >
                      <option value="">Select rating...</option>
                      <option value="needs-work">Needs Work</option>
                      <option value="in-progress">In Progress</option>
                      <option value="on-track">On Track</option>
                      <option value="exceeding">Exceeding</option>
                    </select>
                  </div>

                  <div>
                    <label className="m-0 mb-2 block text-[13px] font-semibold text-ink">
                      Overall Comments
                    </label>
                    <textarea
                      value={reviewData.overallComments}
                      onChange={(e) => setReviewData({ ...reviewData, overallComments: e.target.value })}
                      placeholder="Summarize the mentee's performance this month..."
                      rows={4}
                      className="w-full rounded-lg border border-line-soft bg-surface px-4 py-2.5 text-[14px] text-ink"
                      required
                    />
                  </div>

                  <div>
                    <label className="m-0 mb-2 block text-[13px] font-semibold text-ink">
                      Plan of Action
                    </label>
                    <textarea
                      value={reviewData.planOfAction}
                      onChange={(e) => setReviewData({ ...reviewData, planOfAction: e.target.value })}
                      placeholder="What should the mentee focus on next month?"
                      rows={3}
                      className="w-full rounded-lg border border-line-soft bg-surface px-4 py-2.5 text-[14px] text-ink"
                      required
                    />
                  </div>
                </div>
              </CardV2>
            )}

            {/* Imported Content Preview */}
            {importedText && (
              <CardV2 padding="md" className="border border-line-soft bg-surface">
                <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">Imported Content</h3>
                <div className="rounded-lg bg-surface-muted p-4">
                  <p className="m-0 text-[13px] text-ink-muted whitespace-pre-wrap">{importedText}</p>
                </div>
                <p className="m-0 mt-2 text-[12px] text-ink-muted">
                  Review the imported content above and edit the fields as needed.
                </p>
              </CardV2>
            )}

            {/* Submit Actions */}
            {selectedMentee && (
              <CardV2 padding="md" className="border border-line-soft bg-surface">
                <div className="flex flex-wrap gap-3">
                  <button type="submit" className="button primary">
                    Submit for Chair Approval
                  </button>
                  <button type="button" onClick={handleSaveDraft} className="button secondary">
                    Save Draft
                  </button>
                  <a href="/mentorship/reviews" className="button secondary">
                    Cancel
                  </a>
                </div>
                <p className="m-0 mt-3 text-[12px] text-ink-muted">
                  Drafts stay editable. Submitting routes the review to the chair for approval and locks editing.
                </p>
              </CardV2>
            )}
          </div>

          {/* Right Sidebar - Help */}
          <div className="flex flex-col gap-5">
            <CardV2 padding="md" className="border border-line-soft bg-surface">
              <h3 className="m-0 mb-3 text-[14px] font-bold text-ink">How to Write Reviews</h3>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">1</span>
                  <div>
                    <p className="m-0 text-[13px] font-semibold text-ink">Select Mentee</p>
                    <p className="m-0 text-[12px] text-ink-muted">Choose who you're reviewing</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">2</span>
                  <div>
                    <p className="m-0 text-[13px] font-semibold text-ink">Rate Goals</p>
                    <p className="m-0 text-[12px] text-ink-muted">Score each goal based on their reflection</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">3</span>
                  <div>
                    <p className="m-0 text-[13px] font-semibold text-ink">Write Assessment</p>
                    <p className="m-0 text-[12px] text-ink-muted">Add comments and next steps</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">4</span>
                  <div>
                    <p className="m-0 text-[13px] font-semibold text-ink">Submit</p>
                    <p className="m-0 text-[12px] text-ink-muted">Chair will review before releasing</p>
                  </div>
                </div>
              </div>
            </CardV2>

            <CardV2 padding="md" className="border border-line-soft bg-surface">
              <h3 className="m-0 mb-3 text-[14px] font-bold text-ink">PDF Import</h3>
              <p className="m-0 mb-3 text-[13px] text-ink-muted">
                Already have a review written in a document? Import it and we'll help you convert it to the YPP format.
              </p>
              <ul className="m-0 flex flex-col gap-2 text-[13px] text-ink-muted">
                <li>• Supports PDF files</li>
                <li>• Automatically extracts text content</li>
                <li>• Review and edit before submitting</li>
              </ul>
            </CardV2>

            <CardV2 padding="md" className="border border-line-soft bg-surface">
              <h3 className="m-0 mb-2 text-[14px] font-bold text-ink">Rating Guide</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">Needs Work</span>
                  <span className="text-[12px] text-ink-muted">Significant support needed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">In Progress</span>
                  <span className="text-[12px] text-ink-muted">Making progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">On Track</span>
                  <span className="text-[12px] text-ink-muted">Meeting expectations</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-700">Exceeding</span>
                  <span className="text-[12px] text-ink-muted">Outstanding performance</span>
                </div>
              </div>
            </CardV2>
          </div>
        </div>
      </form>
    </div>
  );
}