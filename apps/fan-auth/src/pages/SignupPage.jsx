import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "../lib/api.js";
import { analytics } from "@coxa/analytics";

const TIER_BY_LEVEL = { 1: "bronze", 2: "bronze", 3: "silver", 4: "gold", 5: "platinum", 6: "diamond" };

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:5176";
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? "coxa-club-001";
const API_URL = import.meta.env.VITE_API_URL ?? "";

const TIER_COLORS = {
  bronze: "#cd7f32",
  silver: "#adb5bd",
  gold: "#f4b942",
  platinum: "#9bc3e0",
  diamond: "#7ee8fa",
};

const STEPS = [
  { id: "account", label: "Account", icon: "👤" },
  { id: "plan", label: "Plan", icon: "🏆" },
  { id: "invite", label: "Invite", icon: "🎟" },
];

function formatBrl(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}

async function fetchPlans() {
  const res = await fetch(`${API_URL}/api/v1/membership/plans`, {
    headers: { "x-tenant-id": TENANT_ID },
  });
  const data = await res.json().catch(() => ({}));
  return data.data ?? [];
}

export default function SignupPage() {
  const [step, setStep] = useState(0); // 0=account 1=plan 2=invite
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);

  // Step 1 — account fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 2 — plan selection
  const [selectedPlan, setSelectedPlan] = useState(null); // null = skip
  const [paymentFreq, setPaymentFreq] = useState("monthly");

  // Step 3 — referral
  const [referralCode, setReferralCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === 1 && plans.length === 0) {
      setPlansLoading(true);
      fetchPlans()
        .then(setPlans)
        .catch(() => {})
        .finally(() => setPlansLoading(false));
    }
  }, [step, plans.length]);

  function validateAccount() {
    if (!fullName.trim()) return "Full name is required";
    if (!email.trim()) return "Email is required";
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
  }

  function handleNextStep() {
    setError("");
    if (step === 0) {
      const err = validateAccount();
      if (err) { setError(err); return; }
      analytics.track("signup_step_completed", { step: "account", app: "fan-auth" });
    }
    if (step === 1) {
      analytics.track("signup_step_completed", {
        step: "plan",
        selectedPlan: selectedPlan ?? "none",
        paymentFreq,
        app: "fan-auth",
      });
    }
    setStep((s) => s + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.signup({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(selectedPlan && { onboardingPlanCode: selectedPlan }),
        ...(referralCode.trim() && { referralCode: referralCode.trim().toUpperCase() }),
      });
      const token = res.data.token;
      localStorage.setItem("coxa_fan_token", token);
      analytics.track("fan_registered", {
        method: "email",
        selectedPlan: selectedPlan ?? "none",
        paymentFreq,
        hasReferral: Boolean(referralCode.trim()),
        app: "fan-auth",
      });
      if (res.data.fanProfileId) {
        analytics.identify(res.data.fanProfileId, {
          email: email.trim().toLowerCase(),
          name: fullName.trim(),
        });
      }
      window.location.replace(`${DASHBOARD_URL}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      analytics.track("fan_registration_failed", { error: err.message, app: "fan-auth" });
      setError(err.message);
      setLoading(false);
    }
  }

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fan-auth-layout">
      {/* Hero */}
      <div className="fan-auth-hero">
        <div className="fan-auth-hero__logo">C</div>
        <p className="fan-auth-hero__title">Coxa ID</p>
        <p className="fan-auth-hero__tagline">One account for everything Coxa</p>
      </div>

      <div className="auth-card onboarding-card">
        {/* Stepper */}
        <div className="onboarding-stepper">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`onboarding-stepper__step${i === step ? " active" : ""}${i < step ? " done" : ""}`}
            >
              <span className="onboarding-stepper__dot">
                {i < step ? "✓" : s.icon}
              </span>
              <span className="onboarding-stepper__label">{s.label}</span>
            </div>
          ))}
          <div className="onboarding-stepper__bar">
            <div className="onboarding-stepper__fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {error && <div className="auth-alert auth-alert--error">{error}</div>}

        {/* ── Step 0: Account ── */}
        {step === 0 && (
          <div className="onboarding-step">
            <h2 className="onboarding-step__title">Create your Coxa ID</h2>
            <p className="onboarding-step__desc">Your one account for tickets, shop, rewards and Sócio Coxa membership.</p>
            <form
              id="signup-form"
              onSubmit={(e) => { e.preventDefault(); handleNextStep(); }}
              noValidate
              className="onboarding-form"
            >
              <div className="field-group">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="João da Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="field-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="joao@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="field-group">
                <label htmlFor="password">Password</label>
                <div className="password-field">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <input
                    type="checkbox"
                    id="toggle-password"
                    className="password-toggle-check"
                    checked={showPassword}
                    onChange={() => setShowPassword((v) => !v)}
                  />
                  <label
                    htmlFor="toggle-password"
                    className="password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </label>
                </div>
              </div>
              <div className="field-group">
                <label htmlFor="confirm">Confirm password</label>
                <div className="password-field">
                  <input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <input
                    type="checkbox"
                    id="toggle-confirm"
                    className="password-toggle-check"
                    checked={showConfirm}
                    onChange={() => setShowConfirm((v) => !v)}
                  />
                  <label
                    htmlFor="toggle-confirm"
                    className="password-toggle"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </label>
                </div>
              </div>
              <button type="submit" className="btn-next">
                Continue <span>→</span>
              </button>
            </form>
          </div>
        )}

        {/* ── Step 1: Plan ── */}
        {step === 1 && (
          <div className="onboarding-step">
            <h2 className="onboarding-step__title">Join Sócio Coxa</h2>
            <p className="onboarding-step__desc">Choose your membership tier and unlock priority access, exclusive benefits and fan score.</p>

            {plansLoading ? (
              <p className="onboarding-loading">Loading plans…</p>
            ) : (
              <>
                <div className="plan-cards-scroll">
                  {plans.map((plan) => {
                    const tierKey = TIER_BY_LEVEL[plan.tierLevel] ?? "bronze";
                    const accent = TIER_COLORS[tierKey] ?? TIER_COLORS.bronze;
                    const isSelected = selectedPlan === plan.planCode;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        className={`plan-card${isSelected ? " plan-card--selected" : ""}`}
                        style={{ "--tier-color": accent }}
                        onClick={() => {
                          const nextSelected = isSelected ? null : plan.planCode;
                          setSelectedPlan(nextSelected);
                          if (nextSelected) {
                            analytics.track("signup_plan_selected", {
                              planCode: plan.planCode,
                              tierLevel: plan.tierLevel,
                              app: "fan-auth",
                            });
                          }
                        }}
                      >
                        <div className="plan-card__accent" />
                        <div className="plan-card__body">
                          <div className="plan-card__name">{plan.name}</div>
                          <div className="plan-card__price">
                            <span className="plan-card__amount">{formatBrl(plan.monthlyPriceCents)}</span>
                            <span className="plan-card__period">/mês</span>
                          </div>
                          {plan.annualPriceCents > 0 && (
                            <div className="plan-card__annual">
                              {formatBrl(plan.annualPriceCents)}/ano
                            </div>
                          )}
                          {plan.benefits?.slice(0, 2).map((b, i) => (
                            <div key={i} className="plan-card__benefit">✓ {b}</div>
                          ))}
                        </div>
                        {isSelected && (
                          <div className="plan-card__check">✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedPlan && (
                  <div className="plan-freq-toggle">
                    <button
                      type="button"
                      className={`plan-freq-btn${paymentFreq === "monthly" ? " active" : ""}`}
                      onClick={() => setPaymentFreq("monthly")}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      className={`plan-freq-btn${paymentFreq === "annual" ? " active" : ""}`}
                      onClick={() => setPaymentFreq("annual")}
                    >
                      Annual <span className="plan-freq-badge">Save ~17%</span>
                    </button>
                  </div>
                )}

                <div className="onboarding-nav">
                  <button type="button" className="btn-skip" onClick={() => { setSelectedPlan(null); setStep(2); }}>
                    Skip for now
                  </button>
                  <button type="button" className="btn-next" onClick={() => setStep(2)}>
                    {selectedPlan ? "Continue" : "Skip"} <span>→</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Referral + Submit ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} noValidate className="onboarding-step">
            <h2 className="onboarding-step__title">Got a referral code?</h2>
            <p className="onboarding-step__desc">If a friend referred you, enter their code. They earn 1,000 bonus points when you join!</p>

            <div className="referral-input-wrap">
              <input
                type="text"
                placeholder="e.g. DEMOFAN1"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={16}
                className="referral-input"
                autoCapitalize="characters"
              />
            </div>

            {selectedPlan && (
              <div className="onboarding-summary">
                <div className="onboarding-summary__row">
                  <span>Plan selected</span>
                  <strong>{plans.find((p) => p.planCode === selectedPlan)?.name ?? selectedPlan}</strong>
                </div>
                <div className="onboarding-summary__row">
                  <span>Billing</span>
                  <strong>{paymentFreq}</strong>
                </div>
              </div>
            )}

            <div className="onboarding-nav">
              <button type="button" className="btn-skip" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button type="submit" className="btn-next btn-next--cta" disabled={loading}>
                {loading ? "Creating…" : "Create account 🎉"}
              </button>
            </div>
          </form>
        )}

        <div className="auth-footer" style={{ marginTop: "1.25rem" }}>
          Already have a Coxa ID? <Link to="/">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
