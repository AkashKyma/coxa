import { useState } from "react";
import { authApi } from "../lib/api.js";

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:5174";

const CLUB_SIZES = [
  { value: "small", label: "Small (< 50 staff)" },
  { value: "medium", label: "Medium (50–200 staff)" },
  { value: "large", label: "Large (200–1000 staff)" },
  { value: "professional", label: "Professional / Elite" },
];

const SPORTS = ["Football", "Basketball", "Volleyball", "Rugby", "Cricket", "Other"];

export default function SignupPage() {
  const [step, setStep] = useState(1); // 1 = your account, 2 = your club
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    // Step 1 — User
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    jobTitle: "",
    // Step 2 — Club
    clubName: "",
    country: "",
    city: "",
    sport: "Football",
    stadiumName: "",
    website: "",
    size: "medium",
  });

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validateStep1() {
    if (!form.fullName.trim()) return "Full name is required";
    if (!form.email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email";
    if (form.password.length < 8) return "Password must be at least 8 characters";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    return null;
  }

  function validateStep2() {
    if (!form.clubName.trim()) return "Club name is required";
    if (!form.country.trim()) return "Country is required";
    if (!form.city.trim()) return "City is required";
    return null;
  }

  function handleNextStep(e) {
    e.preventDefault();
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError("");
    setStep(2);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateStep2();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      const res = await authApi.signup({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        jobTitle: form.jobTitle,
        clubName: form.clubName,
        country: form.country,
        city: form.city,
        sport: form.sport,
        stadiumName: form.stadiumName,
        website: form.website,
        size: form.size,
      });
      const token = res.data.token;
      localStorage.setItem("coxa_token", token);
      window.location.replace(`${DASHBOARD_URL}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="brand brand--pill">Coxa Club</div>
        <h1>{step === 1 ? "Create your account" : "Set up your club"}</h1>
        <p>
          {step === 1
            ? "Your personal admin account — step 1 of 2"
            : "Your organization — step 2 of 2"}
        </p>

        {/* Step indicator */}
        <div className="step-indicator">
          <div className={`step-dot${step >= 1 ? " done" : ""}`}>1</div>
          <div className="step-line" />
          <div className={`step-dot${step >= 2 ? " done" : ""}`}>2</div>
        </div>

        {error && <div className="auth-alert">{error}</div>}

        {/* ── Step 1: User ── */}
        {step === 1 && (
          <form onSubmit={handleNextStep} noValidate>
            <label htmlFor="fullName">Full name *</label>
            <input id="fullName" type="text" placeholder="Jane Smith" value={form.fullName} onChange={set("fullName")} autoComplete="name" required />

            <label htmlFor="email">Work email *</label>
            <input id="email" type="email" placeholder="jane@club.com" value={form.email} onChange={set("email")} autoComplete="email" required />

            <label htmlFor="jobTitle">Job title</label>
            <input id="jobTitle" type="text" placeholder="Club Director" value={form.jobTitle} onChange={set("jobTitle")} />

            <label htmlFor="phone">Phone number</label>
            <input id="phone" type="tel" placeholder="+55 11 99999-0000" value={form.phone} onChange={set("phone")} autoComplete="tel" />

            <label htmlFor="password">Password *</label>
            <input id="password" type="password" placeholder="Min 8 characters" value={form.password} onChange={set("password")} autoComplete="new-password" required />

            <label htmlFor="confirmPassword">Confirm password *</label>
            <input id="confirmPassword" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" required />

            <button type="submit">Continue →</button>
          </form>
        )}

        {/* ── Step 2: Club ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="clubName">Club / organization name *</label>
            <input id="clubName" type="text" placeholder="FC Example United" value={form.clubName} onChange={set("clubName")} required />

            <div className="form-row">
              <div className="form-col">
                <label htmlFor="country">Country *</label>
                <input id="country" type="text" placeholder="Brazil" value={form.country} onChange={set("country")} required />
              </div>
              <div className="form-col">
                <label htmlFor="city">City *</label>
                <input id="city" type="text" placeholder="São Paulo" value={form.city} onChange={set("city")} required />
              </div>
            </div>

            <label htmlFor="sport">Sport</label>
            <select id="sport" value={form.sport} onChange={set("sport")}>
              {SPORTS.map((s) => <option key={s}>{s}</option>)}
            </select>

            <label htmlFor="size">Club size</label>
            <select id="size" value={form.size} onChange={set("size")}>
              {CLUB_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <label htmlFor="stadiumName">Stadium name</label>
            <input id="stadiumName" type="text" placeholder="Example Arena" value={form.stadiumName} onChange={set("stadiumName")} />

            <label htmlFor="website">Website</label>
            <input id="website" type="url" placeholder="https://yourclub.com" value={form.website} onChange={set("website")} />

            <div className="form-row">
              <button type="button" className="btn-back" onClick={() => { setError(""); setStep(1); }}>← Back</button>
              <button type="submit" disabled={loading}>{loading ? "Creating…" : "Create club"}</button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          Already have an account? <a href="/">Sign in</a>
        </div>
      </div>
    </div>
  );
}
