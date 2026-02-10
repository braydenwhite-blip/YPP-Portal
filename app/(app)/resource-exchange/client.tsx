"use client";

import { useState } from "react";
import { createExchangeListing, requestExchangeItem, respondToExchangeRequest } from "@/lib/real-world-actions";

export function CreateListingForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createExchangeListing(formData);
      setOpen(false);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (!open) return <button className="button primary" onClick={() => setOpen(true)}>New Listing</button>;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form action={handleSubmit} style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius-lg)", maxWidth: 500, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <h3 style={{ marginBottom: 16 }}>Create Exchange Listing</h3>
        <div className="form-group">
          <label>Type *</label>
          <select name="type" required>
            <option value="OFFER">I&apos;m offering something</option>
            <option value="REQUEST">I&apos;m looking for something</option>
          </select>
        </div>
        <div className="form-group">
          <label>Title *</label>
          <input type="text" name="title" required placeholder="e.g., Beginner Guitar" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea name="description" rows={2} placeholder="Details about the item..." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label>Category *</label>
            <select name="category" required>
              <option value="">Choose...</option>
              {["Instrument", "Art Supplies", "Books", "Equipment", "Software", "Other"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Passion Area</label>
            <select name="passionArea">
              <option value="">Any</option>
              {["Art", "Music", "Writing", "Dance", "Theater", "Film", "Coding", "Science"].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Condition</label>
            <select name="condition">
              <option value="">N/A</option>
              <option value="New">New</option>
              <option value="Like New">Like New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
            </select>
          </div>
          <div className="form-group">
            <label>Est. Value ($)</label>
            <input type="number" name="estimatedValue" min="0" step="0.01" placeholder="0.00" />
          </div>
        </div>
        <div className="form-group">
          <label>Image URL (optional)</label>
          <input type="url" name="imageUrl" placeholder="https://..." />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="submit" className="button primary" disabled={loading}>{loading ? "Creating..." : "Create Listing"}</button>
          <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export function RequestItemButton({ listingId }: { listingId: string }) {
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  async function handleRequest() {
    const message = prompt("Add a message? (optional)") || "";
    setLoading(true);
    try {
      await requestExchangeItem(listingId, message || undefined);
      setRequested(true);
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  }

  if (requested) return <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Requested!</span>;

  return (
    <button className="button primary small" onClick={handleRequest} disabled={loading} style={{ fontSize: 11 }}>
      {loading ? "..." : "Request"}
    </button>
  );
}

export function RespondToRequest({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleRespond(action: "ACCEPTED" | "DECLINED") {
    setLoading(true);
    try { await respondToExchangeRequest(requestId, action); } catch (e: any) { alert(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button className="button primary small" onClick={() => handleRespond("ACCEPTED")} disabled={loading} style={{ fontSize: 11, padding: "2px 6px" }}>Accept</button>
      <button className="button secondary small" onClick={() => handleRespond("DECLINED")} disabled={loading} style={{ fontSize: 11, padding: "2px 6px" }}>Decline</button>
    </div>
  );
}
