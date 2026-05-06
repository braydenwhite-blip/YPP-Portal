/**
 * Skeleton matching the cockpit's above-the-fold shape (snapshot bar +
 * consensus card + signal panel). Skeletons cover the matrix and feed if
 * the payload streams late, never the snapshot — per §1.5 of the plan.
 */

export default function FinalReviewLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--cockpit-canvas, #f7f5fb)" }}>
      <div
        style={{
          height: 72,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "var(--cockpit-surface, #fff)",
          borderBottom: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        }}
      >
        <div className="cockpit-skel" style={{ width: 40, height: 40, borderRadius: "50%" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="cockpit-skel" style={{ width: "40%", height: 16, borderRadius: 6 }} />
          <div className="cockpit-skel" style={{ width: "30%", height: 12, borderRadius: 6 }} />
        </div>
        <div className="cockpit-skel" style={{ width: 96, height: 36, borderRadius: 8 }} />
      </div>
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="cockpit-skel" style={{ height: 120, borderRadius: 16 }} />
          <div className="cockpit-skel" style={{ height: 200, borderRadius: 16 }} />
          <div className="cockpit-skel" style={{ height: 200, borderRadius: 16 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="cockpit-skel" style={{ height: 220, borderRadius: 16 }} />
          <div className="cockpit-skel" style={{ height: 160, borderRadius: 16 }} />
        </div>
      </div>
    </div>
  );
}
