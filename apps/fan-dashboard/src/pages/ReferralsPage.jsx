import { useEffect, useState } from "react";
import { membershipApi } from "../lib/api.js";

const STATUS_META = {
  pending:   { label: "Pending",   class: "ref-pill--pending"   },
  confirmed: { label: "Confirmed", class: "ref-pill--confirmed" },
  rewarded:  { label: "Rewarded",  class: "ref-pill--rewarded"  },
  expired:   { label: "Expired",   class: "ref-pill--expired"   },
};

export default function ReferralsPage() {
  const [code, setCode] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [redeemInput, setRedeemInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareSupported] = useState(() => !!navigator?.share);

  function load() {
    Promise.all([membershipApi.myReferralCode(), membershipApi.myReferrals()])
      .then(([codeRes, referralsRes]) => {
        setCode(codeRes.data?.referralCode ?? null);
        setReferrals(referralsRes.data ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareCode() {
    if (!code) return;
    navigator.share({ title: "Join me on Sócio Coxa", text: `Use my referral code ${code} when signing up to Coxa ID and we both earn bonus fan points! 🏆`, url: window.location.origin });
  }

  async function handleRedeem(e) {
    e.preventDefault();
    if (!redeemInput.trim()) return;
    setRedeeming(true); setError(null); setSuccess(null);
    try {
      await membershipApi.redeemCode(redeemInput.trim().toUpperCase());
      setSuccess("Code applied! Your friend will be rewarded once your membership is confirmed. 🎉");
      setRedeemInput("");
    } catch (err) { setError(err.message); }
    finally { setRedeeming(false); }
  }

  const rewardedCount = referrals.filter((r) => r.status === "rewarded").length;
  const pendingCount  = referrals.filter((r) => r.status === "pending" || r.status === "confirmed").length;
  const totalPoints   = rewardedCount * 1000;

  return (
    <div className="fan-home rpage">
      {/* Header */}
      <div className="rpage-header">
        <div className="rpage-header__icon">🤝</div>
        <h1 className="rpage-header__title">Referral Programme</h1>
        <p className="rpage-header__desc">
          Share your unique code. Earn <strong>1,000 pts</strong> for every friend who becomes a Sócio Coxa member.
        </p>
      </div>

      {/* Stats row */}
      <div className="rpage-stats">
        <div className="rpage-stat">
          <span className="rpage-stat__value">{referrals.length}</span>
          <span className="rpage-stat__label">Invited</span>
        </div>
        <div className="rpage-stat-divider" />
        <div className="rpage-stat">
          <span className="rpage-stat__value">{rewardedCount}</span>
          <span className="rpage-stat__label">Joined</span>
        </div>
        <div className="rpage-stat-divider" />
        <div className="rpage-stat rpage-stat--highlight">
          <span className="rpage-stat__value">{totalPoints.toLocaleString()}</span>
          <span className="rpage-stat__label">Pts earned</span>
        </div>
        {pendingCount > 0 && (
          <>
            <div className="rpage-stat-divider" />
            <div className="rpage-stat">
              <span className="rpage-stat__value">{pendingCount}</span>
              <span className="rpage-stat__label">Pending</span>
            </div>
          </>
        )}
      </div>

      {error && <div className="mpage-alert mpage-alert--error" style={{ margin: "0 0 0.75rem" }}>{error}</div>}
      {success && <div className="mpage-alert mpage-alert--success" style={{ margin: "0 0 0.75rem" }}>{success}</div>}

      {/* My referral code card */}
      <div className="rpage-code-card">
        <div className="rpage-code-card__label">Your referral code</div>
        {loading ? (
          <div className="rpage-code-card__skeleton" />
        ) : code ? (
          <>
            <div className="rpage-code-card__code">{code}</div>
            <div className="rpage-code-card__actions">
              <button type="button" className="rpage-code-btn rpage-code-btn--copy" onClick={copyCode}>
                {copied ? "✓ Copied!" : "📋 Copy code"}
              </button>
              {shareSupported && (
                <button type="button" className="rpage-code-btn rpage-code-btn--share" onClick={shareCode}>
                  📤 Share
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="rpage-code-card__empty">Generating your code…</p>
        )}
        <p className="rpage-code-card__hint">
          Share this code with friends. They enter it during sign-up and you both benefit once they join.
        </p>
      </div>

      {/* Redeem a code */}
      <div className="rpage-section">
        <h2 className="rpage-section__title">Were you referred?</h2>
        <p className="rpage-section__desc">Enter a friend's code to link the referral — they earn points when you become a member.</p>
        <form onSubmit={handleRedeem} className="rpage-redeem-form">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            maxLength={16}
            className="rpage-redeem-input"
            autoCapitalize="characters"
          />
          <button
            type="submit"
            className="rpage-redeem-btn"
            disabled={redeeming || !redeemInput.trim()}
          >
            {redeeming ? "Applying…" : "Apply"}
          </button>
        </form>
      </div>

      {/* Referral history */}
      <div className="rpage-section">
        <h2 className="rpage-section__title">Your referrals</h2>
        {loading ? (
          <p className="rpage-section__desc">Loading…</p>
        ) : referrals.length === 0 ? (
          <div className="rpage-empty">
            <span className="rpage-empty__icon">👋</span>
            <p>No referrals yet. Share your code to start earning bonus points!</p>
          </div>
        ) : (
          <ul className="rpage-list">
            {referrals.map((r) => {
              const meta = STATUS_META[r.status] ?? { label: r.status, class: "ref-pill--pending" };
              return (
                <li key={r.id} className="rpage-list__item">
                  <div className="rpage-list__avatar">
                    {(r.refereeName?.[0] ?? r.referralCode?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="rpage-list__body">
                    <span className="rpage-list__name">{r.refereeName ?? "Friend"}</span>
                    <span className="rpage-list__date">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className="rpage-list__right">
                    <span className={`ref-pill ${meta.class}`}>{meta.label}</span>
                    {r.status === "rewarded" && <span className="rpage-list__pts">+1,000 pts</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
