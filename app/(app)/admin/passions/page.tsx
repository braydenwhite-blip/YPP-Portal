import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PassionCategory } from "@prisma/client";
import {
  createPassionArea,
  getPassionAreasForAdmin,
  togglePassionArea,
  updatePassionArea,
} from "@/lib/passion-admin-actions";

async function togglePassionAction(formData: FormData) {
  "use server";
  const passionId = String(formData.get("passionId") || "");
  const nextActive = formData.get("nextActive") === "true";
  if (!passionId) throw new Error("Passion id is required");
  await togglePassionArea(passionId, nextActive);
}

export default async function AdminPassionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = (session.user as any).roles ?? [];
  const primaryRole = (session.user as any).primaryRole;
  const canManage =
    roles.includes("ADMIN") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    primaryRole === "ADMIN" ||
    primaryRole === "INSTRUCTOR" ||
    primaryRole === "CHAPTER_LEAD";
  if (!canManage) redirect("/world");

  const passions = await getPassionAreasForAdmin();

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Passion Taxonomy</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Define the canonical passion areas used by activities, incubator, and Passion World.
          </p>
        </div>
        <Link href="/world" className="button secondary">Open Passion World</Link>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi">{passions.length}</div>
          <div className="kpi-label">Total Areas</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#16a34a" }}>
            {passions.filter((passion) => passion.isActive).length}
          </div>
          <div className="kpi-label">Active</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#6b7280" }}>
            {passions.filter((passion) => !passion.isActive).length}
          </div>
          <div className="kpi-label">Inactive</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Add Passion Area</h3>
        <form action={createPassionArea} className="form-grid">
          <div className="grid two">
            <label className="form-row">
              Name
              <input className="input" name="name" required />
            </label>
            <label className="form-row">
              Category
              <select className="input" name="category" defaultValue={PassionCategory.OTHER}>
                {Object.values(PassionCategory).map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="form-row">
            Description
            <textarea className="input" name="description" rows={2} required />
          </label>
          <div className="grid three">
            <label className="form-row">
              Icon
              <input className="input" name="icon" placeholder="emoji or icon token" />
            </label>
            <label className="form-row">
              Color
              <input className="input" name="color" placeholder="#0ea5e9" />
            </label>
            <label className="form-row">
              Order
              <input className="input" name="order" type="number" min={0} defaultValue={0} />
            </label>
          </div>
          <label className="form-row">
            Related Area IDs (comma-separated)
            <input className="input" name="relatedAreaIds" placeholder="id1,id2" />
          </label>
          <button className="button primary" type="submit">Create / Upsert Passion Area</button>
        </form>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {passions.map((passion) => (
          <div key={passion.id} className="card" style={{ borderLeft: `4px solid ${passion.color || "#6b7280"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: "0 0 4px" }}>
                  {passion.icon ? `${passion.icon} ` : ""}{passion.name}
                </h3>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {passion.category.replace(/_/g, " ")} · Order {passion.order}
                </div>
              </div>
              <form action={togglePassionAction}>
                <input type="hidden" name="passionId" value={passion.id} />
                <input type="hidden" name="nextActive" value={String(!passion.isActive)} />
                <button className="button secondary small" type="submit">
                  {passion.isActive ? "Deactivate" : "Activate"}
                </button>
              </form>
            </div>

            <form action={updatePassionArea} className="form-grid">
              <input type="hidden" name="id" value={passion.id} />
              <input type="hidden" name="isActive" value={String(passion.isActive)} />
              <div className="grid two">
                <label className="form-row">
                  Name
                  <input className="input" name="name" defaultValue={passion.name} required />
                </label>
                <label className="form-row">
                  Category
                  <select className="input" name="category" defaultValue={passion.category}>
                    {Object.values(PassionCategory).map((category) => (
                      <option key={category} value={category}>
                        {category.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="form-row">
                Description
                <textarea className="input" name="description" rows={2} defaultValue={passion.description} required />
              </label>
              <div className="grid three">
                <label className="form-row">
                  Icon
                  <input className="input" name="icon" defaultValue={passion.icon || ""} />
                </label>
                <label className="form-row">
                  Color
                  <input className="input" name="color" defaultValue={passion.color || ""} />
                </label>
                <label className="form-row">
                  Order
                  <input className="input" name="order" type="number" min={0} defaultValue={passion.order} />
                </label>
              </div>
              <label className="form-row">
                Related Area IDs (comma-separated)
                <input className="input" name="relatedAreaIds" defaultValue={passion.relatedAreaIds.join(",")} />
              </label>
              <button className="button secondary small" type="submit">Save Changes</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
