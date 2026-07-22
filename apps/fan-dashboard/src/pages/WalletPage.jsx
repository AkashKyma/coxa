import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loyaltyApi, profileApi, formatBrl } from "../lib/api.js";
import "./fan-engagement-pages.css";

const FAKE_PIX_KEY = "00020126580014BR.GOV.BCB.PIX0136coxa-club@pix.com.br5204000053039865802BR5913Coritiba FC6008Curitiba62070503***6304ABCD";

const MOCK_TRANSACTIONS = [
  { id: "t1", icon: "🎁", label: "Prize — Shop Redemption",        date: "18 Jul 2026", amount: +250, pos: true  },
  { id: "t2", icon: "🛒", label: "Purchase — Official Jersey",      date: "15 Jul 2026", amount: -180, pos: false },
  { id: "t3", icon: "💳", label: "PIX Top-up",                      date: "10 Jul 2026", amount: +500, pos: true  },
  { id: "t4", icon: "🛒", label: "Purchase — North Stand Ticket",   date: "5 Jul 2026",  amount: -90,  pos: false },
  { id: "t5", icon: "🎁", label: "Member Bonus — Silver Tier",      date: "1 Jul 2026",  amount: +100, pos: true  },
  { id: "t6", icon: "💳", label: "Bank slip Top-up",                date: "25 Jun 2026", amount: +200, pos: true  },
];

function tierKey(tier = "") {
  const t = (tier ?? "").toLowerCase();
  if (t === "gold" || t === "ouro") return "gold";
  if (t === "silver" || t === "prata") return "silver";
  return "default";
}

function tierLabel(tier = "") {
  const t = (tier ?? "").toLowerCase();
  if (t === "gold") return "Gold";
  if (t === "silver") return "Silver";
  if (t === "ouro") return "Gold";
  if (t === "prata") return "Silver";
  if (t === "bronze") return "Bronze";
  return "Member";
}

function SocioCard({ profile, loyaltyTier }) {
  const tk = tierKey(loyaltyTier);
  const tl = tierLabel(loyaltyTier);
  const name = profile?.fullName ?? profile?.name ?? "Coritiba Member";
  const memberId = profile?.memberId ?? profile?.id ?? "000000";
  const since = profile?.createdAt
    ? new Date(profile.createdAt).getFullYear()
    : 2024;

  return (
    <div className={`wlt-socio-card wlt-socio-card--${tk}`}>
      <div className="wlt-socio-card__shine" />
      <div className="wlt-socio-card__top">
        <span className="wlt-socio-card__club">Coritiba FC</span>
        <span className="wlt-socio-card__tier">{tl}</span>
      </div>
      <div className="wlt-socio-card__name">{name}</div>
      <div className="wlt-socio-card__num">Member no. {String(memberId).padStart(6, "0")}</div>
      <div className="wlt-socio-card__bottom">
        <span className="wlt-socio-card__since">Since {since}</span>
        <div className="wlt-qr-placeholder" title="QR do cartão">QR</div>
      </div>
    </div>
  );
}

function AddFundsSheet({ onClose }) {
  const [pixCopied, setPixCopied] = useState(false);

  function copyPix() {
    navigator.clipboard.writeText(FAKE_PIX_KEY).catch(() => {});
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
  }

  return (
    <div className="eng-sheet-overlay" onClick={onClose}>
      <div className="eng-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="eng-sheet__handle" />
        <h2>Add Funds</h2>

        <div className="wlt-payment-options">
          <div className="wlt-payment-option" onClick={copyPix} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && copyPix()}>
            <span className="wlt-payment-option__icon">⚡</span>
            <div className="wlt-payment-option__info">
              <p className="wlt-payment-option__label">PIX</p>
              <p className="wlt-payment-option__desc">Tap to copy PIX key</p>
            </div>
          </div>

          {pixCopied && (
            <div className="wlt-pix-copied">
              ✅ PIX key copied! Paste it in your bank app to pay.
            </div>
          )}

          <div className="wlt-payment-option" role="button" tabIndex={0}>
            <span className="wlt-payment-option__icon">📄</span>
            <div className="wlt-payment-option__info">
              <p className="wlt-payment-option__label">
                Bank slip <span className="wlt-badge-soon">Coming soon</span>
              </p>
              <p className="wlt-payment-option__desc">Available soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const [loyalty, setLoyalty] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [showAddFunds, setShowAddFunds] = useState(false);

  useEffect(() => {
    loyaltyApi.me()
      .then((res) => setLoyalty(res.data))
      .catch((err) => setError(err.message));

    profileApi.me()
      .then((res) => setProfile(res.data ?? res))
      .catch(() => {});
  }, []);

  const loyaltyTier = loyalty?.fan?.loyaltyTier ?? loyalty?.loyaltyTier ?? "";

  return (
    <div>
      <header className="page-header">
        <h1>Wallet</h1>
        <p>Balance, cashback and payment history.</p>
      </header>

      {error && <div className="alert error">{error}</div>}

      {/* Virtual Member Card */}
      <SocioCard profile={profile} loyaltyTier={loyaltyTier} />

      <button className="wlt-add-funds-btn" onClick={() => setShowAddFunds(true)}>
        + Add Funds
      </button>

      {/* Original balance cards */}
      <div className="cards" style={{ padding: "0 1rem" }}>
        <article className="card">
          <h3>Account balance</h3>
          <p className="value">{formatBrl(0)}</p>
          <p className="panel__desc">Top up via PIX and cashback available.</p>
        </article>
        <article className="card card--interactive">
          <h3>Loyalty points</h3>
          <p className="value">{(loyalty?.balance ?? 0).toLocaleString()} pts</p>
          <p style={{ marginTop: "0.75rem" }}>
            <Link to="/rewards">Ver recompensas →</Link>
          </p>
        </article>
      </div>

      {/* Transaction history */}
      <div className="wlt-tx-section">
        <p className="wlt-tx-title">Transaction History</p>
        <div className="wlt-tx-list">
          {MOCK_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="wlt-tx-item">
              <span className="wlt-tx-item__icon">{tx.icon}</span>
              <div className="wlt-tx-item__info">
                <p className="wlt-tx-item__label">{tx.label}</p>
                <p className="wlt-tx-item__date">{tx.date}</p>
              </div>
              <span className={`wlt-tx-item__amount${tx.pos ? " wlt-tx-item__amount--pos" : " wlt-tx-item__amount--neg"}`}>
                {tx.pos ? "+" : ""}
                {formatBrl(Math.abs(tx.amount) * 100)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {showAddFunds && <AddFundsSheet onClose={() => setShowAddFunds(false)} />}
    </div>
  );
}
