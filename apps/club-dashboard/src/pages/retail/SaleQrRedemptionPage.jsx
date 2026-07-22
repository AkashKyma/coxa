import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import { QrCode, CheckCircle2, XCircle, ScanLine, Clock } from "lucide-react";

function ResultBanner({ result }) {
  if (!result) return null;
  return (
    <div className={`redeem-banner redeem-banner--${result.ok ? "success" : "error"}`}>
      {result.ok
        ? <CheckCircle2 size={26} strokeWidth={2} />
        : <XCircle size={26} strokeWidth={2} />}
      <div className="redeem-banner__body">
        <div className="redeem-banner__status">{result.ok ? "Redeemed ✓" : "Failed"}</div>
        <div className="redeem-banner__msg">{result.message}</div>
        {result.ok && result.data?.saleNumber && (
          <div className="redeem-banner__detail">
            <span>Sale #{result.data.saleNumber}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SaleQrRedemptionPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);

  // Re-focus input after each result so the scanner keeps working
  useEffect(() => {
    if (result) inputRef.current?.focus();
  }, [result]);

  async function handleRedeem(e) {
    e.preventDefault();
    const t = token.trim();
    if (!t) return;
    setRedeeming(true);
    setResult(null);
    try {
      const res = await api.redeemSaleQr(t);
      const entry = {
        token: t,
        ok: true,
        message: res.data?.productName ? `${res.data.productName} redeemed` : "Redeemed",
        data: res.data,
        ts: new Date(),
      };
      setResult(entry);
      setHistory((h) => [entry, ...h.slice(0, 19)]);
      setToken("");
    } catch (err) {
      const entry = { token: t, ok: false, message: err.message, ts: new Date() };
      setResult(entry);
      setHistory((h) => [entry, ...h.slice(0, 19)]);
    } finally {
      setRedeeming(false);
    }
  }

  const successCount = history.filter((h) => h.ok).length;
  const failCount = history.filter((h) => !h.ok).length;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <QrCode size={22} strokeWidth={2} />
          <div>
            <h1>QR Redemption</h1>
            <p className="page-header__sub">Scan or paste a product QR to redeem. Each code is single-use.</p>
          </div>
        </div>
        {history.length > 0 && (
          <div className="page-header__actions">
            <span className="badge badge--green">{successCount} redeemed</span>
            {failCount > 0 && <span className="badge badge--red">{failCount} failed</span>}
          </div>
        )}
      </div>

      <div className="redeem-layout">
        {/* Scanner panel */}
        <div className="card">
          <div className="card__header">
            <ScanLine size={16} strokeWidth={2} />
            <h2>Scan QR code</h2>
          </div>

          <form onSubmit={handleRedeem} className="vertical-form">
            <input
              ref={inputRef}
              type="text"
              className="input redeem-input"
              placeholder="Scan QR or paste token here…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <button
              type="submit"
              className="btn btn--primary btn--lg btn--block"
              disabled={redeeming || !token.trim()}
            >
              {redeeming ? "Redeeming…" : "Redeem"}
            </button>
          </form>

          <div style={{ marginTop: "var(--coxa-space-4)", minHeight: 72 }}>
            <ResultBanner result={result} />
          </div>

          <p className="text-muted text-xs mt-3">
            Tip: a USB or Bluetooth QR scanner acts as a keyboard — it submits automatically on Enter.
          </p>
        </div>

        {/* History panel */}
        <div className="card">
          <div className="card__header">
            <Clock size={16} strokeWidth={2} />
            <h2>Session history</h2>
            <span className="badge badge--gray">{history.length}</span>
          </div>
          {history.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem 0" }}>
              <p>No scans this session.</p>
            </div>
          ) : (
            <div className="table-wrapper table-wrapper--sm">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Token</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td className="link-muted">{h.ts.toLocaleTimeString()}</td>
                      <td><code className="code-token">{h.token.slice(0, 12)}…</code></td>
                      <td>
                        <span className={`badge badge--${h.ok ? "green" : "red"}`}>
                          {h.ok ? "OK" : "Fail"}
                        </span>
                        <span className="text-xs text-muted" style={{ marginLeft: "0.35rem" }}>
                          {h.message}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
