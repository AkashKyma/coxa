import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { Sparkles, Users, Tag, Percent, Gift, Truck, Search, Brain, RefreshCw, Trophy, Medal } from "lucide-react";
import { useClubAnalytics } from "../../lib/useClubAnalytics.js";
import { VisualSegmentBuilder } from "@coxa/ui-analytics";

const OFFER_TYPE_ICONS = {
  discount_percent: Percent,
  discount_fixed: Percent,
  bundle: Gift,
  bonus_points: Sparkles,
  free_shipping: Truck,
};

function OfferCard({ offer, segmentMatch }) {
  const Icon = OFFER_TYPE_ICONS[offer.offerType] ?? Tag;
  return (
    <div className="card card--bordered offer-card">
      <div className="offer-card__header">
        <div className="offer-card__icon">
          <Icon size={17} strokeWidth={2} />
        </div>
        <div className="offer-card__meta-col">
          <div className="offer-card__title">{offer.title}</div>
          {segmentMatch ? (
            <span className="badge badge--purple" style={{ marginTop: "0.2rem" }}>
              <Users size={10} strokeWidth={2.5} />
              {segmentMatch}
            </span>
          ) : (
            <span className="badge badge--gray">All fans (fallback)</span>
          )}
        </div>
      </div>
      {offer.description && <p className="offer-card__desc">{offer.description}</p>}
      <div className="offer-card__foot">
        <span className="badge">{offer.offerType.replace(/_/g, " ")}</span>
        {offer.offerType === "discount_percent" && offer.value > 0 && (
          <span className="badge badge--green">{offer.value}% off</span>
        )}
        {offer.offerType === "bonus_points" && offer.value > 0 && (
          <span className="badge badge--green">{offer.value} pts</span>
        )}
        {offer.productHint && (
          <span className="text-muted text-xs">{offer.productHint}</span>
        )}
      </div>
    </div>
  );
}

export default function PersonalizationDashboardPage() {
  const { track } = useClubAnalytics();
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [nboQuery, setNboQuery] = useState("");
  const [nboResult, setNboResult] = useState(null);
  const [nboLoading, setNboLoading] = useState(false);
  const [nboError, setNboError] = useState(null);
  const [mlScores, setMlScores] = useState(null);

  // Visual Segment Builder
  const [savedSegments, setSavedSegments] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderSaveMsg, setBuilderSaveMsg] = useState("");

  function loadSavedSegments() {
    api.listSegments()
      .then((r) => setSavedSegments(r.data?.segments ?? r.data ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    api.listOffers({ status: "active" })
      .then((r) => setOffers(r.data ?? []))
      .catch(() => {})
      .finally(() => setOffersLoading(false));

    loadSavedSegments();
  }, []);

  async function handleNboLookup(e) {
    e.preventDefault();
    if (!nboQuery.trim()) return;
    setNboLoading(true);
    setNboError(null);
    setNboResult(null);
    try {
      const query = nboQuery.trim();
      const isEmail = query.includes("@");

      // v2: top-3 ML-ranked offers — Phase 4
      let res;
      try {
        res = await (isEmail ? api.nextBestOffers(null, query) : api.nextBestOffers(query, null));
      } catch {
        // fallback to v1 if v2 is not available
        res = isEmail
          ? await api.nextBestOfferByEmail(query)
          : await api.nextBestOffer(query);
        // normalise v1 response to v2 shape
        if (res.data?.offer) {
          res = { data: { offers: [{ ...res.data.offer, rank: 1, confidence: null, matchedSegment: res.data.matchedSegment }], fanContext: res.data.fanContext } };
        }
      }
      setNboResult(res.data);

      // Load ML scores if we have a fan profile ID
      const fanProfileId = res.data?.fanContext?.profileId ?? (!isEmail ? query : null);
      if (fanProfileId) {
        api.getMlScores(fanProfileId)
          .then((r) => setMlScores(r.data))
          .catch(() => setMlScores(null));
      }

      track("nbo_simulated", {
        queryType: isEmail ? "email" : "profileId",
        offerCount: res.data?.offers?.length ?? 1,
        topOfferId: res.data?.offers?.[0]?.id ?? res.data?.offer?.id,
      });
    } catch (err) {
      setNboError(err.message);
    } finally {
      setNboLoading(false);
    }
  }

  // Build segment→offer mapping from live offers
  const segmentOfferMap = offers.reduce((acc, offer) => {
    if (offer.segmentName) acc[offer.segmentName] = offer;
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <Sparkles size={22} strokeWidth={2} />
          <div>
            <h1>Offers &amp; Next Best Offer</h1>
            <p className="page-header__sub">Offer catalog and segment-to-offer mapping</p>
          </div>
        </div>
        <div className="page-header__actions">
          <Link to="/personalization/offers" className="btn btn--secondary btn--sm">
            Manage offers
          </Link>
        </div>
      </div>

      <div className="page-grid page-grid--2col">
        {/* Left: Offer catalog */}
        <div>
          <div className="section-title mb-3">
            Offer catalog
            <Link to="/personalization/offers/new" className="btn btn--ghost btn--sm" style={{ marginLeft: "0.75rem" }}>
              + New offer
            </Link>
          </div>
          {offersLoading ? (
            <p style={{ color: "var(--coxa-text-muted)" }}>Loading…</p>
          ) : offers.length === 0 ? (
            <div className="empty-state" style={{ padding: "1.5rem 0" }}>
              <p>No active offers yet.</p>
              <Link to="/personalization/offers/new" className="btn btn--secondary btn--sm mt-2">
                Create first offer
              </Link>
            </div>
          ) : (
            <div className="offer-list">
              {offers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  segmentMatch={offer.segmentName}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: NBO Simulator + segment mapping */}
        <div>
          <div className="card mb-4">
            <div className="card__header">
              <Search size={15} strokeWidth={2} />
              <h2>NBO simulator</h2>
            </div>
            <p className="text-muted text-sm mb-3">
              Enter a fan profile ID or email to preview the top-3 ML-ranked offers that would be served.
            </p>
            <form onSubmit={handleNboLookup} className="inline-form">
              <input
                type="text"
                className="input"
                placeholder="Profile ID or fan@email.com"
                value={nboQuery}
                onChange={(e) => setNboQuery(e.target.value)}
              />
              <button type="submit" className="btn btn--primary" disabled={nboLoading}>
                {nboLoading ? "…" : "Compute"}
              </button>
            </form>

            {nboError && <div className="alert alert--error mt-2">{nboError}</div>}

            {nboResult && (
              <div className="mt-3">
                {/* Top-3 Ranked Offers (v2) */}
                {(nboResult.offers ?? (nboResult.offer ? [{ ...nboResult.offer, rank: 1 }] : [])).length > 0 ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                      <Trophy size={12} strokeWidth={2} />
                      Top {(nboResult.offers ?? [nboResult.offer]).length} ranked offers — ML-scored
                    </div>
                    {(nboResult.offers ?? [{ ...nboResult.offer, rank: 1, matchedSegment: nboResult.matchedSegment }]).map((offer, idx) => {
                      const rankColors = ["#f59e0b", "#9ca3af", "#cd7c2e"];
                      const rankLabels = ["1st", "2nd", "3rd"];
                      return (
                        <div key={offer.id ?? idx} style={{ marginBottom: 10, position: "relative" }}>
                          {/* Rank badge */}
                          <div style={{
                            position: "absolute", top: -4, right: -4, zIndex: 2,
                            background: rankColors[idx] ?? "#94a3b8", color: "#fff",
                            fontSize: 10, fontWeight: 800, borderRadius: 8, padding: "2px 7px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          }}>
                            {rankLabels[idx] ?? `#${idx + 1}`}
                          </div>
                          <OfferCard offer={offer} segmentMatch={offer.matchedSegment} />
                          {/* Confidence & propensity backing */}
                          {offer.confidence != null && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, paddingLeft: 4 }}>
                              <Medal size={10} strokeWidth={2} color="#7c3aed" />
                              <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>
                                {Math.round(offer.confidence * 100)}% confidence
                              </span>
                              {offer.propensityScore != null && (
                                <span style={{ fontSize: 11, color: "#64748b" }}>
                                  · propensity {Math.round(offer.propensityScore * 100)}%
                                </span>
                              )}
                              {offer.abVariant && (
                                <span style={{ fontSize: 11, background: "#ddd6fe", color: "#5b21b6", borderRadius: 6, padding: "1px 6px", fontWeight: 600 }}>
                                  A/B: {offer.abVariant}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <dl className="detail-list detail-list--compact mt-2">
                      <div className="detail-list__row">
                        <dt>Segments</dt>
                        <dd>{nboResult.fanContext?.segmentNames?.join(", ") || "None"}</dd>
                      </div>
                      <div className="detail-list__row">
                        <dt>Loyalty pts</dt>
                        <dd>{(nboResult.fanContext?.balance ?? 0).toLocaleString()}</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <p className="text-muted text-sm mt-2">No active offer matched this fan.</p>
                )}

                {/* ML Propensity Scores */}
                {mlScores && (
                  <div style={{ marginTop: 12, padding: "12px 14px", background: "#f5f3ff", borderRadius: 10, border: "1.5px solid #ddd6fe" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>
                      <Brain size={13} strokeWidth={2} />
                      ML Propensity Signals
                    </div>
                    {[
                      { label: "Ticket Propensity", v: mlScores.ticketPropensity, color: "#3b82f6" },
                      { label: "Retail Propensity", v: mlScores.retailPropensity, color: "#059669" },
                      { label: "Churn Risk",        v: mlScores.churnRiskScore,   color: "#dc2626" },
                    ].map(({ label, v, color }) => (
                      <div key={label} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                          <span style={{ color: "#64748b" }}>{label}</span>
                          <span style={{ fontWeight: 700, color }}>{Math.round((v ?? 0) * 100)}%</span>
                        </div>
                        <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3 }}>
                          <div style={{ width: `${Math.round((v ?? 0) * 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      Best channel: <strong style={{ color: "#7c3aed", textTransform: "capitalize" }}>{mlScores.nextBestChannel ?? "—"}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card__header">
              <Users size={15} strokeWidth={2} />
              <h2>Segment → offer mapping</h2>
              <span className="badge badge--gray">{savedSegments.length}</span>
            </div>
            {savedSegments.length === 0 ? (
              <div className="empty-state" style={{ padding: "1.5rem 0" }}>
                <p>No segments yet.</p>
                <button type="button" className="btn btn--secondary btn--sm mt-2" onClick={() => setShowBuilder(true)}>
                  Build first segment
                </button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Segment</th>
                      <th>Matched offer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedSegments.map((seg) => {
                      const matched = segmentOfferMap[seg.name];
                      return (
                        <tr key={seg._id ?? seg.id}>
                          <td>{seg.name}</td>
                          <td>
                            {matched ? (
                              <span className="badge badge--green">{matched.title}</span>
                            ) : (
                              <span className="badge badge--gray">Default (fallback)</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── VISUAL SEGMENT BUILDER ────────────────────────────────────────── */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Visual Segment Builder</h2>
            <span className="badge badge--purple" style={{ fontSize: 11 }}>MongoDB · Live fan data</span>
            {savedSegments.length > 0 && (
              <span className="badge badge--gray">{savedSegments.length} saved</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={loadSavedSegments}>
              <RefreshCw size={12} strokeWidth={2} style={{ marginRight: 4 }} /> Refresh
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setShowBuilder((v) => !v)}
            >
              {showBuilder ? "Hide builder" : "Open visual builder"}
            </button>
          </div>
        </div>

        {builderSaveMsg && (
          <div className="alert alert--success" style={{ fontSize: 13, marginBottom: 14 }}>
            {builderSaveMsg}
          </div>
        )}

        {/* Saved segments table */}
        {savedSegments.length > 0 && (
          <div className="table-wrapper" style={{ marginBottom: 20 }}>
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Segment name</th>
                  <th>Fan count</th>
                  <th>Mapped offer</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {savedSegments.map((seg) => {
                  const matched = segmentOfferMap[seg.name];
                  return (
                    <tr key={seg._id ?? seg.id}>
                      <td style={{ fontWeight: 600 }}>{seg.name}</td>
                      <td>{seg.lastRunCount != null ? seg.lastRunCount.toLocaleString() : "—"}</td>
                      <td>
                        {matched ? (
                          <span className="badge badge--green">{matched.title}</span>
                        ) : (
                          <span className="badge badge--gray">No offer mapped</span>
                        )}
                      </td>
                      <td style={{ color: "#9ca3af", fontSize: 12 }}>
                        {seg.createdAt ? new Date(seg.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Inline builder panel */}
        {showBuilder && (
          <div style={{ border: "1.5px solid #e0e7ff", borderRadius: 14, padding: "20px 22px", background: "#f8faff" }}>
            <VisualSegmentBuilder
              apiBase="/api/v1/cdp"
              onSave={async (name, query, count) => {
                await api.createSegment({ name, rules: query, queryBuilderFormat: true, lastRunCount: count });
                loadSavedSegments();
                setShowBuilder(false);
                setBuilderSaveMsg(`Segment "${name}" saved — ${count.toLocaleString()} fans matched.`);
                setTimeout(() => setBuilderSaveMsg(""), 5000);
              }}
              onCancel={() => setShowBuilder(false)}
            />
          </div>
        )}

        {!showBuilder && savedSegments.length === 0 && (
          <div className="empty-state">
            <p style={{ fontSize: 13 }}>No segments yet. Build your first audience segment from your fan data.</p>
            <button type="button" className="btn btn--secondary btn--sm mt-2" onClick={() => setShowBuilder(true)}>
              Build your first segment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
