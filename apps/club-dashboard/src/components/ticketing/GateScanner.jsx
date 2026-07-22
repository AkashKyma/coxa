import { useEffect, useRef, useState } from "react";
import { ScanLine, CheckCircle2, XCircle } from "lucide-react";
import { api } from "../../lib/api.js";

const GATES = [
  { id: "GATE-A", label: "Gate A — Main" },
  { id: "GATE-B", label: "Gate B — North" },
  { id: "GATE-VIP", label: "VIP entrance" },
  { id: "GATE-MEMBER", label: "Member zone" },
];

function resultTone(result) {
  if (!result) return "";
  return result.allowed ? "gate-result--ok" : "gate-result--deny";
}

function scanSummary(result) {
  if (!result) return null;
  const ticket = result.ticket;
  const fan = ticket?.fanProfileId;
  return {
    ticketNumber: ticket?.ticketNumber,
    fanName: fan?.fullName ?? fan?.email ?? "Walk-in",
    section: ticket?.sectionCode ?? ticket?.ticketProductId?.sectionCode,
    product: ticket?.ticketProductId?.name,
  };
}

export default function GateScanner({ matchEventId, eventTitle, onAdmitted, initialToken = "" }) {
  const inputRef = useRef(null);
  const [gateId, setGateId] = useState("GATE-A");
  const [qrToken, setQrToken] = useState(initialToken);
  const [autoAdmit, setAutoAdmit] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (initialToken) {
      setQrToken(initialToken);
      inputRef.current?.focus();
    }
  }, [initialToken]);

  async function runScan(markUsed) {
    const token = qrToken.trim();
    if (!token || scanning) return;

    setScanning(true);
    try {
      const res = await api.validateEntitlement(token, {
        markUsed,
        gateId,
        matchEventId,
      });
      const result = res.data;
      setLastResult(result);

      const entry = {
        id: `${Date.now()}-${token.slice(0, 8)}`,
        at: new Date(),
        token: token.slice(0, 12) + "…",
        allowed: result.allowed,
        reason: result.reason,
        message: result.message,
        ticketNumber: result.ticket?.ticketNumber,
      };
      setHistory((prev) => [entry, ...prev].slice(0, 12));

      if (result.allowed && markUsed) {
        onAdmitted?.();
        setQrToken("");
        inputRef.current?.focus();
      }
    } catch (err) {
      setLastResult({
        allowed: false,
        reason: "ERROR",
        message: err.message,
      });
    } finally {
      setScanning(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runScan(autoAdmit);
  }

  const summary = scanSummary(lastResult);

  return (
    <div className="gate-scanner">
      <div className="gate-scanner__head">
        <div className="gate-scanner__icon">
          <ScanLine size={22} strokeWidth={2} />
        </div>
        <div>
          <h3>Gate entry</h3>
          <p>Scan or paste ticket QR for {eventTitle ?? "this event"}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="gate-scanner__form">
        <div className="form-field">
          <label className="field-label">Gate</label>
          <select value={gateId} onChange={(e) => setGateId(e.target.value)}>
            {GATES.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field form-field--full">
          <label className="field-label">QR token</label>
          <input
            ref={inputRef}
            value={qrToken}
            onChange={(e) => setQrToken(e.target.value)}
            placeholder="Scan barcode or paste qrToken…"
            className="gate-scanner__input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <label className="gate-scanner__auto">
          <input
            type="checkbox"
            checked={autoAdmit}
            onChange={(e) => setAutoAdmit(e.target.checked)}
          />
          Auto-admit on scan (mark ticket used)
        </label>

        <div className="gate-scanner__actions">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!qrToken.trim() || scanning}
            onClick={() => runScan(false)}
          >
            Check only
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!qrToken.trim() || scanning}
          >
            {scanning ? "Scanning…" : autoAdmit ? "Scan & admit" : "Validate"}
          </button>
        </div>
      </form>

      {lastResult && (
        <div className={`gate-result ${resultTone(lastResult)}`}>
          <div className="gate-result__icon">
            {lastResult.allowed ? (
              <CheckCircle2 size={28} strokeWidth={2} />
            ) : (
              <XCircle size={28} strokeWidth={2} />
            )}
          </div>
          <div className="gate-result__body">
            <strong>{lastResult.message}</strong>
            <span className="gate-result__code">{lastResult.reason}</span>
            {summary?.ticketNumber && (
              <dl className="gate-result__meta">
                <div>
                  <dt>Ticket</dt>
                  <dd>{summary.ticketNumber}</dd>
                </div>
                <div>
                  <dt>Fan</dt>
                  <dd>{summary.fanName}</dd>
                </div>
                <div>
                  <dt>Section</dt>
                  <dd>{summary.section ?? "—"}</dd>
                </div>
                <div>
                  <dt>Product</dt>
                  <dd>{summary.product ?? "—"}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="gate-history">
          <h4>Recent scans</h4>
          <ul>
            {history.map((h) => (
              <li key={h.id} className={h.allowed ? "ok" : "deny"}>
                <span className="gate-history__time">
                  {h.at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="gate-history__msg">
                  {h.ticketNumber ? `#${h.ticketNumber}` : h.token} — {h.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
