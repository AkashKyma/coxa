import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Settings, Lock, Link2, Bell, BellOff, Shield, Globe, Sun, Moon, Monitor, Trash2, Download, ChevronLeft, ChevronRight, Check } from "lucide-react";

function SectionHeader({ id, label, icon: Icon, open, onToggle }) {
  return (
    <button
      type="button"
      className="fset-accordion-head"
      onClick={() => onToggle(id)}
      aria-expanded={open}
    >
      <span className="fset-accordion-head__icon">
        <Icon size={18} />
      </span>
      <span className="fset-accordion-head__label">{label}</span>
      <ChevronRight
        size={16}
        className="fset-accordion-head__chevron"
        style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
      />
    </button>
  );
}

function Toggle({ checked, onChange, label, detail }) {
  return (
    <label className="fset-toggle-row">
      <div className="fset-toggle-body">
        <span className="fset-toggle-label">{label}</span>
        {detail && <span className="fset-toggle-detail">{detail}</span>}
      </div>
      <div className={`fset-toggle${checked ? " fset-toggle--on" : ""}`}>
        <input type="checkbox" checked={checked} onChange={onChange} className="fset-toggle__input" />
        <span className="fset-toggle__knob" />
      </div>
    </label>
  );
}

const DEFAULT_NOTIF = {
  push: true,
  email: true,
  matchReminder: true,
  exclusiveOffers: false,
  membershipUpdates: true,
  dnd: false,
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState("account");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Notification preferences
  const [notif, setNotif] = useState(() => {
    try { return { ...DEFAULT_NOTIF, ...JSON.parse(localStorage.getItem("coxa_notif_settings") || "{}") }; }
    catch { return DEFAULT_NOTIF; }
  });

  // Language
  const [language, setLanguage] = useState(() => localStorage.getItem("coxa_language") || "pt-BR");

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem("coxa_theme") || "system");

  // Delete account confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function toggleSection(id) {
    setOpen((prev) => (prev === id ? null : id));
  }

  function updateNotif(key, value) {
    const next = { ...notif, [key]: value };
    setNotif(next);
    localStorage.setItem("coxa_notif_settings", JSON.stringify(next));
  }

  function handleLanguage(lang) {
    setLanguage(lang);
    localStorage.setItem("coxa_language", lang);
    showToast("Language saved.");
  }

  function handleTheme(t) {
    setTheme(t);
    localStorage.setItem("coxa_theme", t);
    if (t === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else if (t === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
    showToast("Appearance saved.");
  }

  function handleDownloadData() {
    showToast("Request sent. You will receive it by email within 15 days.");
  }

  async function handleDeleteAccount() {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    await new Promise((r) => setTimeout(r, 800)); // stub delay
    showToast("Deletion request submitted.");
    setDeleteConfirm(false);
    setDeleteInput("");
    setDeleting(false);
  }

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("coxa_theme") || "system";
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else if (saved === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
  }, []);

  return (
    <div className="fset-page">
      <div className="fset-header">
        <button type="button" className="fset-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
          <h1 className="fset-title">
          <Settings size={22} strokeWidth={2.2} style={{ marginRight: "0.45rem", verticalAlign: "middle" }} />
          Settings
        </h1>
      </div>

      {toast && (
        <div className="fset-toast">
          <Check size={14} style={{ marginRight: "0.35rem", flexShrink: 0 }} />
          {toast}
        </div>
      )}

      <div className="fset-accordion">
        {/* ── Account ─────────────────────────── */}
        <div className="fset-accordion-card">
          <SectionHeader id="account" label="Account" icon={Lock} open={open === "account"} onToggle={toggleSection} />
          {open === "account" && (
            <div className="fset-accordion-body">
              <button
                type="button"
                className="fset-list-row"
                onClick={() => { navigate("/profile"); showToast("Password change coming soon."); }}
              >
                <Lock size={16} className="fset-list-row__icon" />
                <span className="fset-list-row__label">Change password</span>
                <ChevronRight size={15} className="fset-list-row__chevron" />
              </button>

              <div className="fset-subsection-label">Connected accounts</div>
              {["Google", "Facebook", "Apple"].map((provider) => (
                <div key={provider} className="fset-list-row fset-list-row--static">
                  <Link2 size={16} className="fset-list-row__icon" />
                  <span className="fset-list-row__label">{provider}</span>
                  <button
                    type="button"
                    className="fset-connect-btn"
                    onClick={() => showToast(`${provider} connection coming soon.`)}
                  >
                    Connect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Notifications ───────────────────── */}
        <div className="fset-accordion-card">
          <SectionHeader id="notifications" label="Notifications" icon={Bell} open={open === "notifications"} onToggle={toggleSection} />
          {open === "notifications" && (
            <div className="fset-accordion-body">
              <Toggle checked={notif.push} onChange={(e) => updateNotif("push", e.target.checked)} label="Push notifications" />
              <Toggle checked={notif.email} onChange={(e) => updateNotif("email", e.target.checked)} label="Email notifications" />
              <Toggle checked={notif.matchReminder} onChange={(e) => updateNotif("matchReminder", e.target.checked)} label="Match reminder" />
              <Toggle checked={notif.exclusiveOffers} onChange={(e) => updateNotif("exclusiveOffers", e.target.checked)} label="Exclusive offers" />
              <Toggle checked={notif.membershipUpdates} onChange={(e) => updateNotif("membershipUpdates", e.target.checked)} label="Membership updates" />
              <Toggle
                checked={notif.dnd}
                onChange={(e) => updateNotif("dnd", e.target.checked)}
                label="Do not disturb"
                detail="Silences notifications from 10PM to 8AM"
              />
            </div>
          )}
        </div>

        {/* ── Privacy ─────────────────────────── */}
        <div className="fset-accordion-card">
          <SectionHeader id="privacy" label="Privacy" icon={Shield} open={open === "privacy"} onToggle={toggleSection} />
          {open === "privacy" && (
            <div className="fset-accordion-body">
              <Link to="/consent" className="fset-list-row">
                <Shield size={16} className="fset-list-row__icon" />
                <span className="fset-list-row__label">Manage my data and consents</span>
                <ChevronRight size={15} className="fset-list-row__chevron" />
              </Link>

              <button type="button" className="fset-list-row" onClick={handleDownloadData}>
                <Download size={16} className="fset-list-row__icon" />
                <span className="fset-list-row__label">Download my data</span>
                <ChevronRight size={15} className="fset-list-row__chevron" />
              </button>

              <button
                type="button"
                className="fset-list-row fset-list-row--danger"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 size={16} className="fset-list-row__icon" />
                <span className="fset-list-row__label">Delete my account</span>
                <ChevronRight size={15} className="fset-list-row__chevron" />
              </button>

              {deleteConfirm && (
                <div className="fset-danger-confirm">
                  <p>This action is <strong>irreversible</strong>. Type <code>DELETE</code> to confirm.</p>
                  <input
                    type="text"
                    className="fset-danger-input"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="DELETE"
                  />
                  <div className="fset-danger-actions">
                    <button
                      type="button"
                      className="fset-danger-btn fset-danger-btn--confirm"
                      disabled={deleteInput !== "DELETE" || deleting}
                      onClick={handleDeleteAccount}
                    >
                      {deleting ? "Please wait…" : "Confirm deletion"}
                    </button>
                    <button
                      type="button"
                      className="fset-danger-btn fset-danger-btn--cancel"
                      onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Language ────────────────────────── */}
        <div className="fset-accordion-card">
          <SectionHeader id="language" label="Language" icon={Globe} open={open === "language"} onToggle={toggleSection} />
          {open === "language" && (
            <div className="fset-accordion-body">
              {[
                { value: "pt-BR", label: "Português (BR)" },
                { value: "en", label: "English" },
                { value: "es", label: "Español" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`fset-list-row${language === opt.value ? " fset-list-row--selected" : ""}`}
                  onClick={() => handleLanguage(opt.value)}
                >
                  <Globe size={16} className="fset-list-row__icon" />
                  <span className="fset-list-row__label">{opt.label}</span>
                  {language === opt.value && <Check size={16} style={{ color: "#0C6B3A", marginLeft: "auto" }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Appearance ──────────────────────── */}
        <div className="fset-accordion-card">
          <SectionHeader id="appearance" label="Appearance" icon={Sun} open={open === "appearance"} onToggle={toggleSection} />
          {open === "appearance" && (
            <div className="fset-accordion-body">
              {[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`fset-list-row${theme === value ? " fset-list-row--selected" : ""}`}
                  onClick={() => handleTheme(value)}
                >
                  <Icon size={16} className="fset-list-row__icon" />
                  <span className="fset-list-row__label">{label}</span>
                  {theme === value && <Check size={16} style={{ color: "#0C6B3A", marginLeft: "auto" }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notification hint at bottom */}
      <div className="fset-footer-hint">
        <BellOff size={14} />
        Do not disturb: 10PM–8AM
      </div>
    </div>
  );
}
