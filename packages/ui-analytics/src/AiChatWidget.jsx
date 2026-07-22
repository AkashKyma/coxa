/**
 * AiChatWidget — shared RAG-powered assistant for FanBox and Club dashboards.
 *
 * Props:
 *   apiBase      – base URL for the AI service (default "/api/v1/ai")
 *   role         – current operator role (for display only; server enforces)
 *   tenantName   – club name shown in the header
 *   kpiContext   – optional { [key]: value } snapshot of current dashboard KPIs
 *   position     – "bottom-right" | "bottom-left" (default "bottom-right")
 */

import React, { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles, MessageCircle, Loader2 } from "lucide-react";

const PRESETS = [
  "How do I add a new fan?",
  "What does Sell-Through % mean?",
  "How do I export data?",
  "Explain the no-show rate",
  "What permissions does a Manager have?",
  "How does CPF validation work?",
];

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "10px 12px" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%", background: "#6366f1",
            animation: "aiDotBounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

// ─── Single message bubble ────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10, gap: 8, alignItems: "flex-end" }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Bot size={14} color="#fff" strokeWidth={2} />
        </div>
      )}
      <div style={{
        maxWidth: "78%",
        padding: "9px 13px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
        background: isUser ? "#6366f1" : "#f1f5f9",
        color: isUser ? "#fff" : "#1e293b",
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        {msg.content}
        {msg.stub && (
          <div style={{ fontSize: 11, color: isUser ? "rgba(255,255,255,0.65)" : "#94a3b8", marginTop: 5, paddingTop: 5, borderTop: isUser ? "1px solid rgba(255,255,255,0.2)" : "1px solid #e2e8f0" }}>
            AI not configured — set OPENAI_API_KEY
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────
export default function AiChatWidget({
  apiBase = "/api/v1/ai",
  authHeaders = {},
  role = "viewer",
  tenantName = "Club",
  kpiContext = null,
  position = "bottom-right",
}) {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: `Hi! I'm the ${tenantName} AI assistant.\nAsk me anything about fan management, ticketing, retail, memberships, or analytics.`,
  }]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const endRef  = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);

  async function send(text) {
    const query = (text ?? input).trim();
    if (!query || loading) return;
    setInput("");

    const next = [...messages, { role: "user", content: query }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), kpiContext }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      const reply = json.data?.content ?? "Sorry, I could not generate a response.";
      setMessages((p) => [...p, { role: "assistant", content: reply, stub: json.data?.stub }]);
    } catch (err) {
      setMessages((p) => [...p, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const posStyle = position === "bottom-left" ? { left: 24, right: "auto" } : { right: 24, left: "auto" };

  return (
    <>
      <style>{`
        @keyframes aiDotBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes aiSlideUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .ai-chat-fab:hover { transform:scale(1.08) !important; }
        .ai-chat-preset:hover { background:#e0e7ff !important; border-color:#6366f1 !important; color:#4f46e5 !important; }
        .ai-send-btn:hover:not(:disabled) { background:#4f46e5 !important; }
        .ai-send-btn:disabled { opacity:0.45; cursor:default; }
      `}</style>

      {/* ── Floating action button ────────────────────────── */}
      <button
        className="ai-chat-fab"
        onClick={() => setOpen((v) => !v)}
        title="AI Assistant"
        style={{
          position: "fixed", bottom: 24, ...posStyle, zIndex: 9999,
          width: 52, height: 52, borderRadius: "50%", border: "none",
          background: open ? "#475569" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
          transition: "background 0.2s, transform 0.2s",
        }}
      >
        {open
          ? <X size={20} strokeWidth={2.5} />
          : <MessageCircle size={22} strokeWidth={2} />}
      </button>

      {/* ── Chat panel ────────────────────────────────────── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 88, ...posStyle, zIndex: 9998,
          width: 368, maxHeight: "72vh",
          display: "flex", flexDirection: "column",
          background: "#fff", borderRadius: 18,
          boxShadow: "0 12px 48px rgba(0,0,0,0.16)",
          animation: "aiSlideUp 0.2s ease",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}>

          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={18} color="#fff" strokeWidth={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", lineHeight: 1.2 }}>{tenantName} AI Assistant</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>RAG-powered · {role}</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.75)", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}>
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px 4px", scrollbarWidth: "thin" }}>
            {messages.map((m, i) => <Message key={i} msg={m} />)}
            {loading && <TypingIndicator />}
            <div ref={endRef} />
          </div>

          {/* Preset chips — shown only on first open */}
          {messages.length <= 1 && !loading && (
            <div style={{ padding: "6px 12px 2px", display: "flex", flexWrap: "wrap", gap: 5 }}>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="ai-chat-preset"
                  style={{
                    padding: "4px 10px", fontSize: 11, borderRadius: 20,
                    background: "#f8fafc", border: "1px solid #e2e8f0",
                    cursor: "pointer", color: "#475569",
                    transition: "all 0.15s", fontFamily: "inherit",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything… (Enter to send)"
              rows={1}
              style={{
                flex: 1, resize: "none", border: "1px solid #e2e8f0", borderRadius: 10,
                padding: "8px 11px", fontSize: 13, outline: "none",
                fontFamily: "inherit", lineHeight: 1.5,
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
              onBlur={(e)  => (e.target.style.borderColor = "#e2e8f0")}
              onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px"; }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="ai-send-btn"
              style={{
                width: 36, height: 36, borderRadius: 10, border: "none",
                background: "#6366f1", color: "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.15s",
              }}
            >
              {loading
                ? <Loader2 size={16} strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }} />
                : <Send size={15} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
