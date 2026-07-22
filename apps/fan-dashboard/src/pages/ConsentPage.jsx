import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Download, Trash2, FileEdit, Eye, ChevronLeft, Check } from "lucide-react";

const PURPOSES = [
  { key: "email_marketing", label: "Email marketing", description: "Offers, promotions and news by email", legalBasis: "Consent (Art. 7, I)" },
  { key: "sms", label: "SMS", description: "Text messages with important updates", legalBasis: "Consent (Art. 7, I)" },
  { key: "whatsapp", label: "WhatsApp", description: "Messages via WhatsApp", legalBasis: "Consent (Art. 7, I)" },
  { key: "push_notifications", label: "Push notifications", description: "Alerts on your device", legalBasis: "Consent (Art. 7, I)" },
  { key: "analytics", label: "Behaviour analytics", description: "We use usage data to improve your experience", legalBasis: "Legitimate interest (Art. 7, IX)" },
  { key: "personalization", label: "Personalization", description: "Recommendations based on your profile", legalBasis: "Consent (Art. 7, I)" },
  { key: "third_party_sharing", label: "Sharing with partners", description: "We share data with club sponsors", legalBasis: "Consent (Art. 7, I)" },
];

function loadConsents() {
  try { return JSON.parse(localStorage.getItem("coxa_consents") || "{}"); } catch { return {}; }
}

function saveConsents(obj) {
  localStorage.setItem("coxa_consents", JSON.stringify(obj));
}

export default function ConsentPage() {
  const navigate = useNavigate();
  const [consents, setConsents] = useState(loadConsents);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  function toggleConsent(key) {
    const next = { ...consents, [key]: !consents[key] };
    setConsents(next);
    saveConsents(next);
    showToast(next[key] ? "Consent enabled." : "Consent removed.");
  }

  function handleAccessData() {
    showToast("Request sent. You will receive it by email within 15 days.");
  }

  function handleExportData() {
    showToast("Export requested. Available within 15 days.");
  }

  async function handleDeleteAccount() {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    await new Promise((r) => setTimeout(r, 800));
    showToast("Deletion request submitted. You will receive a confirmation email.");
    setDeleteModal(false);
    setDeleteInput("");
    setDeleting(false);
  }

  return (
    <div className="fcon-page">
      {/* Header */}
      <div className="fcon-header">
        <button type="button" className="fcon-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="fcon-title">
          <Shield size={22} strokeWidth={2.2} style={{ marginRight: "0.45rem", verticalAlign: "middle" }} />
          Privacy & Consent
        </h1>
      </div>

      {toast && (
        <div className="fcon-toast">
          <Check size={14} style={{ marginRight: "0.35rem", flexShrink: 0 }} />
          {toast}
        </div>
      )}

      <p className="fcon-intro">
        Manage how Coritiba Football Club uses your personal data, in compliance with the General Data Protection Law (LGPD).
      </p>

      {/* My Consents */}
      <section className="fcon-section">
        <div className="fcon-section__title">My consents</div>

        {PURPOSES.map((purpose) => {
          const isLegitimate = purpose.legalBasis.startsWith("Legitimate interest");
          const enabled = isLegitimate ? true : (consents[purpose.key] ?? false);

          return (
            <div key={purpose.key} className="fcon-consent-row">
              <div className="fcon-consent-body">
                <span className="fcon-consent-label">{purpose.label}</span>
                <span className="fcon-consent-desc">{purpose.description}</span>
                <span className="fcon-consent-basis">{purpose.legalBasis}</span>
              </div>
              <div className={`fcon-toggle${enabled ? " fcon-toggle--on" : ""}${isLegitimate ? " fcon-toggle--locked" : ""}`}>
                <input
                  type="checkbox"
                  className="fcon-toggle__input"
                  checked={enabled}
                  disabled={isLegitimate}
                  onChange={() => !isLegitimate && toggleConsent(purpose.key)}
                />
                <span className="fcon-toggle__knob" />
              </div>
            </div>
          );
        })}
      </section>

      {/* My Rights */}
      <section className="fcon-section">
        <div className="fcon-section__title">My rights (LGPD Art. 18)</div>
        <p className="fcon-section__desc">
          You have the right to access, correct, export or delete your data at any time.
        </p>

        <div className="fcon-rights-grid">
          {/* Access */}
          <button type="button" className="fcon-right-card" onClick={handleAccessData}>
            <span className="fcon-right-card__icon fcon-right-card__icon--blue">
              <Eye size={22} />
            </span>
            <span className="fcon-right-card__label">Access my data</span>
            <span className="fcon-right-card__desc">Request a copy of all the data we hold about you</span>
          </button>

          {/* Correct */}
          <Link to="/profile/edit" className="fcon-right-card">
            <span className="fcon-right-card__icon fcon-right-card__icon--green">
              <FileEdit size={22} />
            </span>
            <span className="fcon-right-card__label">Correct my data</span>
            <span className="fcon-right-card__desc">Update incorrect or outdated information</span>
          </Link>

          {/* Export */}
          <button type="button" className="fcon-right-card" onClick={handleExportData}>
            <span className="fcon-right-card__icon fcon-right-card__icon--gold">
              <Download size={22} />
            </span>
            <span className="fcon-right-card__label">Export my data</span>
            <span className="fcon-right-card__desc">Download all your data in a portable format</span>
          </button>

          {/* Delete */}
          <button type="button" className="fcon-right-card fcon-right-card--danger" onClick={() => setDeleteModal(true)}>
            <span className="fcon-right-card__icon fcon-right-card__icon--red">
              <Trash2 size={22} />
            </span>
            <span className="fcon-right-card__label">Delete my account</span>
            <span className="fcon-right-card__desc">Request permanent deletion of all your data</span>
          </button>
        </div>
      </section>

      {/* Privacy policy link */}
      <div className="fcon-policy-link">
        <a href="/privacy-policy" className="fcon-policy-link__a">
          Full Privacy Policy →
        </a>
      </div>

      {/* Delete modal */}
      {deleteModal && (
        <div className="fcon-modal-backdrop" onClick={() => { if (!deleting) { setDeleteModal(false); setDeleteInput(""); } }}>
          <div className="fcon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fcon-modal__icon">
              <Trash2 size={28} style={{ color: "#D63B3B" }} />
            </div>
            <h2 className="fcon-modal__title">Delete account</h2>
            <p className="fcon-modal__body">
              This action is <strong>irreversible</strong>. All your data, history and benefits will be permanently removed.
            </p>
            <p className="fcon-modal__body">
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              className="fcon-modal__input"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            <div className="fcon-modal__actions">
              <button
                type="button"
                className="fcon-modal__btn fcon-modal__btn--danger"
                disabled={deleteInput !== "DELETE" || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? "Please wait…" : "Confirm deletion"}
              </button>
              <button
                type="button"
                className="fcon-modal__btn fcon-modal__btn--cancel"
                disabled={deleting}
                onClick={() => { setDeleteModal(false); setDeleteInput(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
