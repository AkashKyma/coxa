import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { membershipApi, formatBrl } from "../lib/api.js";

const TIER_META = {
  bronze:   { color: "#cd7f32", bg: "rgba(205,127,50,0.1)",  label: "Bronze",   icon: "🥉" },
  silver:   { color: "#8a9aaa", bg: "rgba(138,154,170,0.1)", label: "Silver",   icon: "🥈" },
  gold:     { color: "#d4960a", bg: "rgba(212,150,10,0.1)",  label: "Gold",     icon: "🥇" },
  platinum: { color: "#5b8db8", bg: "rgba(91,141,184,0.1)",  label: "Platinum", icon: "💎" },
  diamond:  { color: "#3bbfea", bg: "rgba(59,191,234,0.1)",  label: "Diamond",  icon: "💠" },
};

const SCORE_COMPONENTS = [
  { key: "attendanceScore", label: "Match attendance", icon: "🏟", max: 30000 },
  { key: "tenureScore",     label: "Membership tenure", icon: "📅", max: 20000 },
  { key: "spendingScore",   label: "Spending",           icon: "🛍", max: 20000 },
  { key: "referralScore",   label: "Referrals",          icon: "🤝", max: 15000 },
  { key: "engagementScore", label: "Engagement",         icon: "📣", max: 10000 },
  { key: "donationScore",   label: "Donations",          icon: "❤️", max:  5000 },
];

const TIER_THRESHOLDS = [
  { tier: "bronze",   min: 0,      label: "Bronze" },
  { tier: "silver",   min: 5001,   label: "Silver" },
  { tier: "gold",     min: 15001,  label: "Gold" },
  { tier: "platinum", min: 35001,  label: "Platinum" },
  { tier: "diamond",  min: 60001,  label: "Diamond" },
];

function nextTierInfo(total) {
  const idx = [...TIER_THRESHOLDS].reverse().findIndex((t) => total >= t.min);
  const currentIdx = TIER_THRESHOLDS.length - 1 - idx;
  const next = TIER_THRESHOLDS[currentIdx + 1];
  if (!next) return null;
  return { label: next.label, needed: next.min - total, min: next.min };
}

export default function MembershipPage() {
  const [membership, setMembership] = useState(null);
  const [score, setScore] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("status");
  const successTimer = useRef(null);

  function showSuccess(msg) {
    setSuccess(msg);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(null), 4000);
  }

  function load() {
    setLoading(true);
    Promise.all([
      membershipApi.myMembership().catch(() => null),
      membershipApi.myScore().catch(() => null),
      membershipApi.listPlans().catch(() => ({ data: [] })),
    ])
      .then(([memRes, scoreRes, plansRes]) => {
        setMembership(memRes?.data ?? null);
        setScore(scoreRes?.data?.score ?? null);
        setPlans(plansRes?.data ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleJoin(planCode, paymentFrequency) {
    setBusy(true); setError(null); setSuccess(null);
    try {
      await membershipApi.join({ planCode, paymentFrequency, idempotencyKey: `join-${planCode}-${Date.now()}` });
      showSuccess("Welcome to Sócio Coxa! 🎉 Your membership is now active.");
      setTab("status");
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function handleRenew() {
    setBusy(true); setError(null); setSuccess(null);
    try {
      await membershipApi.renew({ idempotencyKey: `renew-${Date.now()}` });
      showSuccess("Membership renewed successfully! ✅");
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function handleCancel() {
    setBusy(true); setError(null); setSuccess(null); setConfirmCancel(false);
    try {
      await membershipApi.cancel({ reason: "fan_request" });
      showSuccess("Membership cancelled. We hope to see you back soon.");
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function handleUpgrade(planCode, planName) {
    setBusy(true); setError(null); setSuccess(null);
    try {
      await membershipApi.upgrade({ newPlanCode: planCode, idempotencyKey: `upgrade-${planCode}-${Date.now()}` });
      showSuccess(`Upgraded to ${planName}! 🚀`);
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const hasMembership = membership?.membership?.status === "active";
  const currentPlanCode = membership?.membership?.planCode;
  const currentPlanName = plans.find((p) => p.planCode === currentPlanCode)?.name ?? currentPlanCode;
  const currentTier = score?.tier ?? "bronze";
  const tierMeta = TIER_META[currentTier] ?? TIER_META.bronze;
  const totalScore = score?.totalScore ?? 0;
  const nextTier = nextTierInfo(totalScore);

  if (loading) {
    return (
      <div className="fan-home">
        <div className="mpage-loading">
          <div className="mpage-loading__spinner" />
          <p>Loading membership…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fan-home mpage">
      {/* Hero card */}
      <div className="mpage-hero" style={{ "--tier-color": tierMeta.color, "--tier-bg": tierMeta.bg }}>
        <div className="mpage-hero__glow" />
        <div className="mpage-hero__content">
          <div className="mpage-hero__left">
            <span className="mpage-hero__icon">{tierMeta.icon}</span>
            <div>
              <div className="mpage-hero__tier-name">{tierMeta.label} Member</div>
              <div className="mpage-hero__score-row">
                <span className="mpage-hero__score">{totalScore.toLocaleString()}</span>
                <span className="mpage-hero__score-unit">pts</span>
              </div>
            </div>
          </div>
          <div className="mpage-hero__right">
            {hasMembership ? (
              <div className="mpage-status-pill mpage-status-pill--active">Active</div>
            ) : (
              <div className="mpage-status-pill mpage-status-pill--inactive">Not a member</div>
            )}
          </div>
        </div>

        {/* Next tier progress */}
        {nextTier && (
          <div className="mpage-tier-progress">
            <div className="mpage-tier-progress__bar">
              <div
                className="mpage-tier-progress__fill"
                style={{ width: `${Math.round((totalScore / nextTier.min) * 100)}%` }}
              />
            </div>
            <span className="mpage-tier-progress__label">
              {nextTier.needed.toLocaleString()} pts to {nextTier.label}
            </span>
          </div>
        )}

        {hasMembership && (
          <div className="mpage-hero__plan-row">
            <span className="mpage-hero__plan-label">Plan</span>
            <span className="mpage-hero__plan-name">{currentPlanName}</span>
            {membership?.membership?.memberNumber && (
              <span className="mpage-hero__member-no">#{membership.membership.memberNumber}</span>
            )}
          </div>
        )}
      </div>

      {error && <div className="mpage-alert mpage-alert--error">{error}</div>}
      {success && <div className="mpage-alert mpage-alert--success">{success}</div>}

      {/* Tab bar */}
      <div className="mpage-tabs">
        {[
          { id: "status", label: "Score & Benefits" },
          { id: "plans",  label: hasMembership ? "Change Plan" : "Join Now" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mpage-tab${tab === t.id ? " mpage-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Score breakdown tab */}
      {tab === "status" && (
        <>
          <div className="mpage-section">
            <h2 className="mpage-section__title">Score breakdown</h2>
            <div className="mpage-score-breakdown">
              {SCORE_COMPONENTS.map(({ key, label, icon, max }) => {
                const val = score?.[key] ?? 0;
                const pct = Math.min(100, Math.round((val / max) * 100));
                return (
                  <div key={key} className="mpage-score-row">
                    <div className="mpage-score-row__meta">
                      <span className="mpage-score-row__icon">{icon}</span>
                      <span className="mpage-score-row__label">{label}</span>
                      <span className="mpage-score-row__value">{val.toLocaleString()}</span>
                    </div>
                    <div className="mpage-score-row__track">
                      <div
                        className="mpage-score-row__fill"
                        style={{ width: `${pct}%`, background: tierMeta.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          {hasMembership && (
            <div className="mpage-actions">
              <button type="button" className="mpage-btn mpage-btn--primary" disabled={busy} onClick={handleRenew}>
                {busy ? "Please wait…" : "Renew membership"}
              </button>
              {!confirmCancel ? (
                <button type="button" className="mpage-btn mpage-btn--danger" disabled={busy} onClick={() => setConfirmCancel(true)}>
                  Cancel membership
                </button>
              ) : (
                <div className="mpage-confirm-cancel">
                  <p>Are you sure? You will lose your tier benefits immediately.</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" className="mpage-btn mpage-btn--danger" disabled={busy} onClick={handleCancel}>
                      {busy ? "Cancelling…" : "Yes, cancel"}
                    </button>
                    <button type="button" className="mpage-btn" disabled={busy} onClick={() => setConfirmCancel(false)}>
                      Keep membership
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasMembership && (
            <div className="mpage-cta">
              <p>Become a Sócio Coxa and unlock priority tickets, exclusive discounts and fan rewards.</p>
              <button type="button" className="mpage-btn mpage-btn--primary" onClick={() => setTab("plans")}>
                See membership plans →
              </button>
            </div>
          )}

          {/* Referral quick link */}
          <Link to="/membership/referrals" className="mpage-referral-banner">
            <span className="mpage-referral-banner__icon">🤝</span>
            <div className="mpage-referral-banner__text">
              <strong>Refer a friend</strong>
              <span>Earn 1,000 pts per member who joins with your code</span>
            </div>
            <span className="mpage-referral-banner__arrow">›</span>
          </Link>
        </>
      )}

      {/* Plans tab */}
      {tab === "plans" && (
        <div className="mpage-plans">
          {plans.length === 0 ? (
            <p className="mpage-empty">No plans available right now. Please check back later.</p>
          ) : (
            plans.map((plan) => {
              const TIER_BY_LEVEL = { 1: "bronze", 2: "bronze", 3: "silver", 4: "gold", 5: "platinum", 6: "diamond" };
              const tierKey = TIER_BY_LEVEL[plan.tierLevel] ?? "bronze";
              const meta = TIER_META[tierKey] ?? TIER_META.bronze;
              const isCurrent = plan.planCode === currentPlanCode;
              const currentPlanLevel = plans.find((p) => p.planCode === currentPlanCode)?.tierLevel ?? 0;
              const isUpgrade = hasMembership && !isCurrent && (plan.tierLevel ?? 0) > currentPlanLevel;
              return (
                <div
                  key={plan.id}
                  className={`mpage-plan-card${isCurrent ? " mpage-plan-card--current" : ""}`}
                  style={{ "--tier-color": meta.color, "--tier-bg": meta.bg }}
                >
                  <div className="mpage-plan-card__stripe" />
                  <div className="mpage-plan-card__header">
                    <span className="mpage-plan-card__icon">{meta.icon}</span>
                    <div>
                      <div className="mpage-plan-card__name">{plan.name}</div>
                      {plan.description && <div className="mpage-plan-card__desc">{plan.description}</div>}
                    </div>
                    {isCurrent && <span className="mpage-plan-card__current-badge">Current</span>}
                  </div>

                  <div className="mpage-plan-card__pricing">
                    <div className="mpage-plan-card__price">
                      <span className="mpage-plan-card__amount">{formatBrl(plan.monthlyPriceCents)}</span>
                      <span className="mpage-plan-card__period">/mês</span>
                    </div>
                    {plan.annualPriceCents > 0 && (
                      <span className="mpage-plan-card__annual">{formatBrl(plan.annualPriceCents)}/ano</span>
                    )}
                  </div>

                  {plan.benefits?.length > 0 && (
                    <ul className="mpage-plan-card__benefits">
                      {plan.benefits.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  )}

                  {!hasMembership && (
                    <div className="mpage-plan-card__actions">
                      <button type="button" className="mpage-btn mpage-btn--tier" disabled={busy} onClick={() => handleJoin(plan.planCode, "monthly")}>
                        Join monthly
                      </button>
                      {plan.annualPriceCents > 0 && (
                        <button type="button" className="mpage-btn mpage-btn--ghost" disabled={busy} onClick={() => handleJoin(plan.planCode, "annual")}>
                          Join annual
                        </button>
                      )}
                    </div>
                  )}
                  {isUpgrade && (
                    <div className="mpage-plan-card__actions">
                      <button type="button" className="mpage-btn mpage-btn--tier" disabled={busy} onClick={() => handleUpgrade(plan.planCode, plan.name)}>
                        Upgrade to {plan.name}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
