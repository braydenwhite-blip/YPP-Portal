import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getResourceExchangeListings, getMyExchangeListings } from "@/lib/real-world-actions";
import Link from "next/link";
import { CreateListingForm, RequestItemButton, RespondToRequest } from "./client";

export default async function ResourceExchangePage({
  searchParams,
}: {
  searchParams: { tab?: string; category?: string; type?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const tab = searchParams.tab || "browse";
  const { listings, userId } = await getResourceExchangeListings({
    category: searchParams.category,
    type: searchParams.type,
  });
  const myListings = tab === "my" ? await getMyExchangeListings() : [];

  const categories = ["Instrument", "Art Supplies", "Books", "Equipment", "Software", "Other"];
  const conditionColors: Record<string, string> = {
    New: "#16a34a",
    "Like New": "#3b82f6",
    Good: "#d97706",
    Fair: "#6b7280",
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Resource Exchange</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Share, trade, or request supplies and equipment with fellow students
          </p>
        </div>
        <CreateListingForm />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        <Link
          href="/resource-exchange?tab=browse"
          className="pill"
          style={{
            background: tab === "browse" ? "var(--ypp-purple)" : "var(--surface-alt)",
            color: tab === "browse" ? "white" : "var(--text-secondary)",
            textDecoration: "none", padding: "6px 12px", fontWeight: 600, fontSize: 12,
          }}
        >
          Browse All
        </Link>
        <Link
          href="/resource-exchange?tab=my"
          className="pill"
          style={{
            background: tab === "my" ? "var(--ypp-purple)" : "var(--surface-alt)",
            color: tab === "my" ? "white" : "var(--text-secondary)",
            textDecoration: "none", padding: "6px 12px", fontWeight: 600, fontSize: 12,
          }}
        >
          My Listings
        </Link>
      </div>

      {/* Category filters */}
      {tab === "browse" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <Link key={cat} href={`/resource-exchange?tab=browse&category=${cat}`} className="pill"
              style={{
                background: searchParams.category === cat ? "var(--ypp-purple-50)" : "var(--surface-alt)",
                color: searchParams.category === cat ? "var(--ypp-purple)" : "var(--text-secondary)",
                fontWeight: searchParams.category === cat ? 600 : 400, textDecoration: "none", fontSize: 12,
              }}
            >
              {cat}
            </Link>
          ))}
          <Link href={`/resource-exchange?tab=browse&type=OFFER`} className="pill"
            style={{
              background: searchParams.type === "OFFER" ? "#dcfce7" : "var(--surface-alt)",
              color: searchParams.type === "OFFER" ? "#16a34a" : "var(--text-secondary)",
              fontWeight: searchParams.type === "OFFER" ? 600 : 400, textDecoration: "none", fontSize: 12,
            }}
          >
            Offers
          </Link>
          <Link href={`/resource-exchange?tab=browse&type=REQUEST`} className="pill"
            style={{
              background: searchParams.type === "REQUEST" ? "#fef3c7" : "var(--surface-alt)",
              color: searchParams.type === "REQUEST" ? "#d97706" : "var(--text-secondary)",
              fontWeight: searchParams.type === "REQUEST" ? 600 : 400, textDecoration: "none", fontSize: 12,
            }}
          >
            Requests
          </Link>
          {(searchParams.category || searchParams.type) && (
            <Link href="/resource-exchange?tab=browse" style={{ fontSize: 12, color: "var(--ypp-purple)", alignSelf: "center" }}>Clear</Link>
          )}
        </div>
      )}

      {/* Browse */}
      {tab === "browse" && (
        listings.length > 0 ? (
          <div className="grid three">
            {listings.map((listing) => {
              const isOffer = listing.type === "OFFER";
              const isOwn = listing.userId === userId;
              return (
                <div key={listing.id} className="card" style={{ borderTop: `3px solid ${isOffer ? "#16a34a" : "#d97706"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span className="pill" style={{ fontSize: 10, fontWeight: 600, background: isOffer ? "#dcfce7" : "#fef3c7", color: isOffer ? "#16a34a" : "#d97706" }}>
                      {isOffer ? "OFFERING" : "LOOKING FOR"}
                    </span>
                    <span className="pill" style={{ fontSize: 10 }}>{listing.category}</span>
                  </div>
                  <h4 style={{ margin: "4px 0" }}>{listing.title}</h4>
                  {listing.description && (
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 8px" }}>
                      {listing.description.length > 100 ? listing.description.slice(0, 100) + "..." : listing.description}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {listing.condition && <span style={{ fontSize: 11, color: conditionColors[listing.condition] || "var(--text-secondary)" }}>{listing.condition}</span>}
                    {listing.passionArea && <span className="pill" style={{ fontSize: 10 }}>{listing.passionArea}</span>}
                    {listing.estimatedValue && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>~${listing.estimatedValue}</span>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{listing.user.name}</span>
                    {!isOwn && <RequestItemButton listingId={listing.id} />}
                    {isOwn && <span style={{ fontSize: 11, color: "var(--ypp-purple)" }}>Your listing</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card"><p style={{ color: "var(--text-secondary)" }}>No listings found. Be the first to share!</p></div>
        )
      )}

      {/* My Listings */}
      {tab === "my" && (
        myListings.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {myListings.map((listing) => (
              <div key={listing.id} className="card" style={{ borderLeft: `4px solid ${listing.type === "OFFER" ? "#16a34a" : "#d97706"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div>
                    <span className="pill" style={{ fontSize: 10, fontWeight: 600, background: listing.type === "OFFER" ? "#dcfce7" : "#fef3c7", color: listing.type === "OFFER" ? "#16a34a" : "#d97706" }}>
                      {listing.type === "OFFER" ? "OFFERING" : "LOOKING FOR"}
                    </span>
                    <span className="pill" style={{ fontSize: 10, marginLeft: 4 }}>{listing.status}</span>
                  </div>
                </div>
                <h4 style={{ margin: "4px 0 8px" }}>{listing.title}</h4>
                {listing.requests.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Requests ({listing.requests.length})</div>
                    {listing.requests.map((req) => (
                      <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", marginBottom: 4 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{req.requester.name}</span>
                          {req.message && <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>&quot;{req.message}&quot;</span>}
                        </div>
                        {req.status === "PENDING" ? (
                          <RespondToRequest requestId={req.id} />
                        ) : (
                          <span className="pill" style={{ fontSize: 10, background: req.status === "ACCEPTED" ? "#dcfce7" : "#fee2e2", color: req.status === "ACCEPTED" ? "#16a34a" : "#ef4444" }}>{req.status}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No requests yet</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card"><p style={{ color: "var(--text-secondary)" }}>You haven&apos;t listed anything yet.</p></div>
        )
      )}
    </div>
  );
}
