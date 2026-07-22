import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, Calendar, Users, MapPin, Star, Shirt, Globe, Mail, Check, ChevronLeft } from "lucide-react";
import { profileApi } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const GENDER_OPTIONS = [
  { value: "", label: "Select..." },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
];

const JERSEY_OPTIONS = ["PP", "P", "M", "G", "GG", "XGG"];

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Português" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

function formatDateInput(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d)) return "";
  return d.toISOString().split("T")[0];
}

function SkeletonBlock({ h = "1.1rem", w = "100%", mb = "0.5rem" }) {
  return (
    <div
      className="fedit-skeleton"
      style={{ height: h, width: w, marginBottom: mb }}
    />
  );
}

export default function ProfileEditPage() {
  const { fanProfile: ctxProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const successTimer = useRef(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    postalCode: "",
    street: "",
    city: "",
    state: "",
    favoritePlayer: "",
    jerseySize: "",
    preferredLanguage: "pt-BR",
    consent_email: false,
    consent_sms: false,
    consent_whatsapp: false,
    consent_push: false,
  });

  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    profileApi
      .me()
      .then((res) => {
        const fp = res.data.fanProfile;
        const consents = (() => {
          try { return JSON.parse(localStorage.getItem("coxa_consents") || "{}"); } catch { return {}; }
        })();
        setForm({
          fullName: fp.fullName ?? "",
          email: fp.email ?? "",
          phone: fp.phone ?? "",
          dateOfBirth: formatDateInput(fp.dateOfBirth ?? fp.birthDate),
          gender: fp.gender ?? "",
          postalCode: fp.address?.postalCode ?? "",
          street: fp.address?.street ?? "",
          city: fp.address?.city ?? "",
          state: fp.address?.state ?? "",
          favoritePlayer: fp.favoritePlayer ?? "",
          jerseySize: fp.jerseySize ?? "",
          preferredLanguage: fp.preferredLanguage ?? "pt-BR",
          consent_email: consents.email_marketing ?? false,
          consent_sms: consents.sms ?? false,
          consent_whatsapp: consents.whatsapp ?? false,
          consent_push: consents.push_notifications ?? false,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((e) => ({ ...e, [field]: null }));
  }

  async function handleCepBlur(e) {
    const cep = e.target.value.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro ?? f.street,
          city: data.localidade ?? f.city,
          state: data.uf ?? f.state,
        }));
      }
    } catch {
      // silently ignore CEP lookup failure
    } finally {
      setCepLoading(false);
    }
  }

  function validate() {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required";
    if (form.postalCode && form.postalCode.replace(/\D/g, "").length > 0 && form.postalCode.replace(/\D/g, "").length !== 8) {
      errs.postalCode = "Postal code must be 8 digits";
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await profileApi.updateProfile({
        fullName: form.fullName.trim(),
        phone: form.phone,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || undefined,
        address: {
          postalCode: form.postalCode,
          street: form.street,
          city: form.city,
          state: form.state,
        },
        favoritePlayer: form.favoritePlayer,
        jerseySize: form.jerseySize || undefined,
        preferredLanguage: form.preferredLanguage,
      });

      // Persist consent flags to localStorage
      const consents = (() => {
        try { return JSON.parse(localStorage.getItem("coxa_consents") || "{}"); } catch { return {}; }
      })();
      const updated = {
        ...consents,
        email_marketing: form.consent_email,
        sms: form.consent_sms,
        whatsapp: form.consent_whatsapp,
        push_notifications: form.consent_push,
      };
      localStorage.setItem("coxa_consents", JSON.stringify(updated));

      setSuccess(true);
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fedit-page">
        <div className="fedit-header">
          <button type="button" className="fedit-back" onClick={() => navigate(-1)}>
            <ChevronLeft size={20} />
          </button>
          <h1 className="fedit-title">Edit Profile</h1>
        </div>
        <div className="fedit-skeleton-wrap">
          <SkeletonBlock h="1.5rem" w="60%" mb="1.5rem" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ marginBottom: "1.1rem" }}>
              <SkeletonBlock h="0.75rem" w="40%" mb="0.4rem" />
              <SkeletonBlock h="2.75rem" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fedit-page">
      <div className="fedit-header">
        <button type="button" className="fedit-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="fedit-title">
          <User size={22} strokeWidth={2.2} style={{ marginRight: "0.45rem", verticalAlign: "middle" }} />
          Editar Perfil
        </h1>
      </div>

      {error && <div className="fedit-alert fedit-alert--error">{error}</div>}
      {success && (
        <div className="fedit-alert fedit-alert--success">
          <Check size={16} style={{ marginRight: "0.4rem" }} />
          Profile updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Personal info */}
        <div className="fedit-section">
          <div className="fedit-section__title">Personal information</div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="fullName">
              <User size={14} /> Full name *
            </label>
            <input
              id="fullName"
              type="text"
              className={`fedit-input${fieldErrors.fullName ? " fedit-input--error" : ""}`}
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              required
            />
            {fieldErrors.fullName && <span className="fedit-field-error">{fieldErrors.fullName}</span>}
          </div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="email">
              <Mail size={14} /> E-mail
            </label>
            <input
              id="email"
              type="email"
              className="fedit-input fedit-input--readonly"
              value={form.email}
              readOnly
            />
            <span className="fedit-hint">Email cannot be changed here.</span>
          </div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="phone">
              <Phone size={14} /> Phone
            </label>
            <input
              id="phone"
              type="tel"
              className="fedit-input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="dateOfBirth">
              <Calendar size={14} /> Date of birth
            </label>
            <input
              id="dateOfBirth"
              type="date"
              className="fedit-input"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
            />
          </div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="gender">
              <Users size={14} /> Gender
            </label>
            <select
              id="gender"
              className="fedit-select"
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Address */}
        <div className="fedit-section">
          <div className="fedit-section__title">
            <MapPin size={14} /> Address
          </div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="postalCode">
              Postal Code {cepLoading && <span className="fedit-cep-loading">looking up…</span>}
            </label>
            <input
              id="postalCode"
              type="text"
              inputMode="numeric"
              maxLength={9}
              className={`fedit-input${fieldErrors.postalCode ? " fedit-input--error" : ""}`}
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
              onBlur={handleCepBlur}
              placeholder="00000-000"
            />
            {fieldErrors.postalCode && <span className="fedit-field-error">{fieldErrors.postalCode}</span>}
          </div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="street">Street</label>
            <input
              id="street"
              type="text"
              className="fedit-input"
              value={form.street}
              onChange={(e) => set("street", e.target.value)}
            />
          </div>

          <div className="fedit-row2">
            <div className="fedit-field">
              <label className="fedit-label" htmlFor="city">City</label>
              <input
                id="city"
                type="text"
                className="fedit-input"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div className="fedit-field">
              <label className="fedit-label" htmlFor="state">State</label>
              <input
                id="state"
                type="text"
                className="fedit-input"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                maxLength={2}
                placeholder="SP"
              />
            </div>
          </div>
        </div>

        {/* Fan preferences */}
        <div className="fedit-section">
          <div className="fedit-section__title">Preferences</div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="favoritePlayer">
              <Star size={14} /> Favourite player
            </label>
            <input
              id="favoritePlayer"
              type="text"
              className="fedit-input"
              value={form.favoritePlayer}
              onChange={(e) => set("favoritePlayer", e.target.value)}
              placeholder="Ex: Gerson"
            />
          </div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="jerseySize">
              <Shirt size={14} /> Jersey size
            </label>
            <select
              id="jerseySize"
              className="fedit-select"
              value={form.jerseySize}
              onChange={(e) => set("jerseySize", e.target.value)}
            >
              <option value="">Select...</option>
              {JERSEY_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="fedit-field">
            <label className="fedit-label" htmlFor="preferredLanguage">
              <Globe size={14} /> Preferred language
            </label>
            <select
              id="preferredLanguage"
              className="fedit-select"
              value={form.preferredLanguage}
              onChange={(e) => set("preferredLanguage", e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Communication consent */}
        <div className="fedit-section">
          <div className="fedit-section__title">Communication consent</div>
          <p className="fedit-section__desc">
            Choose how you want to receive communications from the club.
          </p>

          {[
            { key: "consent_email", label: "Email marketing", detail: "Offers, promotions and news" },
            { key: "consent_sms", label: "SMS", detail: "Updates via text message" },
            { key: "consent_whatsapp", label: "WhatsApp", detail: "Messages via WhatsApp" },
            { key: "consent_push", label: "Push notifications", detail: "Alerts on your device" },
          ].map(({ key, label, detail }) => (
            <label key={key} className="fedit-toggle-row">
              <div className="fedit-toggle-body">
                <span className="fedit-toggle-label">{label}</span>
                <span className="fedit-toggle-detail">{detail}</span>
              </div>
              <div className={`fedit-toggle${form[key] ? " fedit-toggle--on" : ""}`}>
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => set(key, e.target.checked)}
                  className="fedit-toggle__input"
                />
                <span className="fedit-toggle__knob" />
              </div>
            </label>
          ))}
        </div>

        <button
          type="submit"
          className="fedit-submit"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
