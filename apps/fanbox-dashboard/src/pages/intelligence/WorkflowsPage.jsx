import { useState, useEffect, useRef, useCallback } from "react";
import { GitBranch, Plus, Play, Pause, Archive, Save, ChevronDown } from "lucide-react";
import "./journey-builder-fanbox.css";

const API = import.meta.env.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("fanbox_token"); }
function getClub()  { return localStorage.getItem("fanbox_selected_club_id"); }

async function jApi(path, opts = {}) {
  const token = getToken();
  const club  = getClub();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(club  && { "X-Club-Id": club }),
      ...opts.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

const NODE_TYPES = [
  { type: "trigger",    label: "Trigger",      icon: "⚡" },
  { type: "send_email", label: "Send Email",   icon: "✉️" },
  { type: "send_push",  label: "Send Push",    icon: "🔔" },
  { type: "send_sms",   label: "Send SMS",     icon: "💬" },
  { type: "wait",       label: "Wait",         icon: "⏱️" },
  { type: "condition",  label: "Condition",    icon: "🔀" },
  { type: "ab_split",   label: "A/B Split",    icon: "⚖️" },
  { type: "end",        label: "End",          icon: "🏁" },
];

function labelOf(type) { return NODE_TYPES.find(n => n.type === type)?.label ?? type; }
function iconOf(type)  { return NODE_TYPES.find(n => n.type === type)?.icon ?? "📦"; }

const STATUS_EN = { draft: "Draft", active: "Active", paused: "Paused", archived: "Archived" };
function StatusBadge({ status }) {
  return <span className={`jb-badge jb-badge--${status}`}>{STATUS_EN[status] ?? status}</span>;
}

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

const TEMPLATES = [
  {
    name: "Member Welcome",
    trigger: { type: "event", eventName: "member_signup" },
    nodes: [
      { id: "n1", type: "trigger",    label: "Member Sign-up",    config: {}, position: { x: 100, y: 60 } },
      { id: "n2", type: "wait",       label: "Wait 1h",           config: { duration: 1, unit: "hours" }, position: { x: 100, y: 200 } },
      { id: "n3", type: "send_email", label: "Welcome Email",     config: { subject: "Welcome!" }, position: { x: 100, y: 340 } },
      { id: "n4", type: "end",        label: "End",               config: {}, position: { x: 100, y: 480 } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
    ],
  },
  {
    name: "Re-engage Inactive Fan",
    trigger: { type: "segment_enter" },
    nodes: [
      { id: "n1", type: "trigger",    label: "Entered: Inactive 90d",    config: {}, position: { x: 100, y: 60 } },
      { id: "n2", type: "send_push",  label: "Re-engagement Push",       config: { title: "We miss you!" }, position: { x: 100, y: 200 } },
      { id: "n3", type: "wait",       label: "Wait 3 days",              config: { duration: 3, unit: "days" }, position: { x: 100, y: 340 } },
      { id: "n4", type: "send_email", label: "Re-engagement Email",      config: { subject: "Come back to the game" }, position: { x: 100, y: 480 } },
      { id: "n5", type: "end",        label: "End",                      config: {}, position: { x: 100, y: 620 } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
      { id: "e4", source: "n4", target: "n5" },
    ],
  },
  {
    name: "Post-Match MOTM",
    trigger: { type: "event", eventName: "match_ended" },
    nodes: [
      { id: "n1", type: "trigger",   label: "Match ended",        config: {}, position: { x: 100, y: 60 } },
      { id: "n2", type: "send_push", label: "MOTM Vote Push",     config: { title: "Vote for the best player!" }, position: { x: 100, y: 200 } },
      { id: "n3", type: "end",       label: "End",                config: {}, position: { x: 100, y: 340 } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
    ],
  },
  {
    name: "Member Renewal",
    trigger: { type: "schedule", cronExpression: "0 9 * * *" },
    nodes: [
      { id: "n1", type: "trigger",    label: "30d before expiry",       config: {}, position: { x: 100, y: 60 } },
      { id: "n2", type: "send_email", label: "Renewal Email",            config: { subject: "Renew your membership" }, position: { x: 100, y: 200 } },
      { id: "n3", type: "wait",       label: "Wait 7 days",              config: { duration: 7, unit: "days" }, position: { x: 100, y: 340 } },
      { id: "n4", type: "end",        label: "End",                      config: {}, position: { x: 100, y: 480 } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
    ],
  },
  {
    name: "Birthday",
    trigger: { type: "schedule", cronExpression: "0 8 * * *" },
    nodes: [
      { id: "n1", type: "trigger",    label: "Fan Birthday",       config: {}, position: { x: 100, y: 60 } },
      { id: "n2", type: "send_email", label: "Birthday Email",     config: { subject: "Happy birthday!" }, position: { x: 100, y: 200 } },
      { id: "n3", type: "send_push",  label: "Birthday Push",      config: { title: "🎂 Congratulations!" }, position: { x: 100, y: 340 } },
      { id: "n4", type: "end",        label: "End",                config: {}, position: { x: 100, y: 480 } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
    ],
  },
];

function NodeConfigPanel({ node, onChange }) {
  if (!node) return null;

  function set(field, value) {
    onChange({ ...node, config: { ...node.config, [field]: value } });
  }
  function setLabel(value) {
    onChange({ ...node, label: value });
  }

  return (
    <div className="jb-config-panel">
      <h3><span>{iconOf(node.type)}</span> {labelOf(node.type)} — Configuration</h3>
      <div className="jb-config-grid">
        <div className="jb-config-field">
          <label>Node label</label>
          <input value={node.label ?? ""} onChange={e => setLabel(e.target.value)} placeholder="Step name" />
        </div>
        {node.type === "send_email" && (
          <>
            <div className="jb-config-field">
              <label>Template</label>
              <select value={node.config.templateId ?? ""} onChange={e => set("templateId", e.target.value)}>
                <option value="">— Select template —</option>
                <option value="welcome">Welcome</option>
                <option value="renewal">Renewal</option>
                <option value="birthday">Birthday</option>
                <option value="promo">Promotion</option>
              </select>
            </div>
            <div className="jb-config-field">
              <label>Subject</label>
              <input value={node.config.subject ?? ""} onChange={e => set("subject", e.target.value)} placeholder="Email subject" />
            </div>
          </>
        )}
        {node.type === "send_push" && (
          <>
            <div className="jb-config-field">
              <label>Title</label>
              <input value={node.config.title ?? ""} onChange={e => set("title", e.target.value)} placeholder="Notification title" />
            </div>
            <div className="jb-config-field">
              <label>Body</label>
              <input value={node.config.body ?? ""} onChange={e => set("body", e.target.value)} placeholder="Text" />
            </div>
          </>
        )}
        {node.type === "send_sms" && (
          <div className="jb-config-field">
            <label>Message</label>
            <input value={node.config.message ?? ""} onChange={e => set("message", e.target.value)} placeholder="SMS text" />
          </div>
        )}
        {node.type === "wait" && (
          <>
            <div className="jb-config-field">
              <label>Duration</label>
              <input type="number" min="1" value={node.config.duration ?? 1} onChange={e => set("duration", Number(e.target.value))} />
            </div>
            <div className="jb-config-field">
              <label>Unit</label>
              <select value={node.config.unit ?? "hours"} onChange={e => set("unit", e.target.value)}>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </>
        )}
        {node.type === "condition" && (
          <>
            <div className="jb-config-field">
              <label>Field</label>
              <input value={node.config.field ?? ""} onChange={e => set("field", e.target.value)} placeholder="e.g. membership.active" />
            </div>
            <div className="jb-config-field">
              <label>Operator</label>
              <select value={node.config.op ?? "eq"} onChange={e => set("op", e.target.value)}>
                <option value="eq">Equals</option>
                <option value="neq">Not equals</option>
                <option value="gt">Greater than</option>
                <option value="lt">Less than</option>
                <option value="exists">Exists</option>
              </select>
            </div>
            <div className="jb-config-field">
              <label>Value</label>
              <input value={node.config.value ?? ""} onChange={e => set("value", e.target.value)} placeholder="Value" />
            </div>
          </>
        )}
        {node.type === "ab_split" && (
          <>
            <div className="jb-config-field">
              <label>% Variant A</label>
              <input type="number" min="1" max="99" value={node.config.splitA ?? 50} onChange={e => set("splitA", Number(e.target.value))} />
            </div>
            <div className="jb-config-field">
              <label>% Variant B</label>
              <input type="number" min="1" max="99" value={node.config.splitB ?? 50} onChange={e => set("splitB", Number(e.target.value))} />
            </div>
          </>
        )}
        {node.type === "trigger" && (
          <>
            <div className="jb-config-field">
              <label>Trigger type</label>
              <select value={node.config.triggerType ?? "manual"} onChange={e => set("triggerType", e.target.value)}>
                <option value="manual">Manual</option>
                <option value="event">Event</option>
                <option value="schedule">Schedule</option>
                <option value="segment_enter">Entered segment</option>
                <option value="segment_exit">Left segment</option>
              </select>
            </div>
            {node.config.triggerType === "event" && (
              <div className="jb-config-field">
                <label>Event name</label>
                <input value={node.config.eventName ?? ""} onChange={e => set("eventName", e.target.value)} placeholder="e.g. ticket_purchased" />
              </div>
            )}
            {node.config.triggerType === "schedule" && (
              <div className="jb-config-field">
                <label>Cron expression</label>
                <input value={node.config.cron ?? ""} onChange={e => set("cron", e.target.value)} placeholder="0 9 * * *" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState("New Journey");
  const [triggerType, setTriggerType] = useState("manual");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await jApi("/api/v1/journeys", {
        method: "POST",
        body: JSON.stringify({ name, trigger: { type: triggerType }, nodes: [], edges: [] }),
      });
      onCreate(data.journey);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="jb-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jb-modal">
        <h3>New Journey</h3>
        <form onSubmit={submit}>
          <div className="jb-modal-field">
            <label>Journey name</label>
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className="jb-modal-field">
            <label>Trigger type</label>
            <select value={triggerType} onChange={e => setTriggerType(e.target.value)}>
              <option value="manual">Manual</option>
              <option value="event">Event</option>
              <option value="schedule">Schedule</option>
              <option value="segment_enter">Entered segment</option>
              <option value="segment_exit">Left segment</option>
            </select>
          </div>
          <div className="jb-modal-actions">
            <button type="button" className="jb-btn jb-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="jb-btn jb-btn--primary" disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Canvas({ nodes, edges, selectedId, onSelectNode, onMoveNode, onDeleteNode, onDropFromPalette }) {
  const canvasRef = useRef(null);
  const dragging  = useRef(null);

  function onMouseDown(e, nodeId) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelectNode(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    dragging.current = {
      id: nodeId,
      startX: e.clientX - node.position.x,
      startY: e.clientY - node.position.y,
    };
  }

  function onMouseMove(e) {
    if (!dragging.current) return;
    const { id, startX, startY } = dragging.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left + canvas.scrollLeft - startX);
    const y = Math.max(0, e.clientY - rect.top  + canvas.scrollTop  - startY);
    onMoveNode(id, { x, y });
  }

  function onMouseUp() { dragging.current = null; }

  function onDragOver(e) { e.preventDefault(); }

  function onDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData("nodeType");
    if (!type) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + canvas.scrollLeft - 100;
    const y = e.clientY - rect.top  + canvas.scrollTop  - 35;
    onDropFromPalette(type, { x: Math.max(0, x), y: Math.max(0, y) });
  }

  function getCenter(nodeId, side) {
    const n = nodes.find(nd => nd.id === nodeId);
    if (!n) return null;
    return { x: n.position.x + 100, y: n.position.y + (side === "bottom" ? 70 : 0) };
  }

  return (
    <div
      className="jb-canvas"
      ref={canvasRef}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="jb-canvas-inner">
        <svg className="jb-edges-svg">
          <defs>
            <marker id="arrow-fb" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
            </marker>
          </defs>
          {edges.map(edge => {
            const src = getCenter(edge.source, "bottom");
            const tgt = getCenter(edge.target, "top");
            if (!src || !tgt) return null;
            const my = (src.y + tgt.y) / 2;
            return (
              <polyline
                key={edge.id}
                points={`${src.x},${src.y} ${src.x},${my} ${tgt.x},${my} ${tgt.x},${tgt.y}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeDasharray="5,3"
                markerEnd="url(#arrow-fb)"
              />
            );
          })}
        </svg>
        {nodes.map(node => (
          <div
            key={node.id}
            className={`jb-node${selectedId === node.id ? " selected" : ""}`}
            style={{ left: node.position.x, top: node.position.y }}
            onMouseDown={e => onMouseDown(e, node.id)}
          >
            <button
              className="jb-node-delete"
              onClick={e => { e.stopPropagation(); onDeleteNode(node.id); }}
            >×</button>
            <div className="jb-node-header">
              <div className={`jb-node-icon jb-icon--${node.type}`}>{iconOf(node.type)}</div>
              <span className="jb-node-label">{node.label || labelOf(node.type)}</span>
            </div>
            <div className="jb-node-type-badge">{labelOf(node.type)}</div>
          </div>
        ))}
        {nodes.length === 0 && (
          <div className="jb-empty">
            <div className="jb-empty-icon">🗺️</div>
            <div className="jb-empty-title">Empty canvas</div>
            <div className="jb-empty-desc">Drag nodes from the palette or choose a template</div>
          </div>
        )}
      </div>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

export default function WorkflowsPage() {
  const [journeys, setJourneys]             = useState([]);
  const [current, setCurrent]               = useState(null);
  const [sidebarTab, setSidebarTab]         = useState("journeys");
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showCreate, setShowCreate]         = useState(false);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [statusMenu, setStatusMenu]         = useState(false);
  const { toast, show: showToast }          = useToast();

  const selectedNode = current?.nodes?.find(n => n.id === selectedNodeId) ?? null;

  useEffect(() => {
    jApi("/api/v1/journeys")
      .then(data => setJourneys(data.journeys ?? []))
      .catch(err => showToast(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  async function loadJourney(id) {
    try {
      const data = await jApi(`/api/v1/journeys/${id}`);
      setCurrent(data.journey);
      setSelectedNodeId(null);
    } catch (err) { showToast(err.message, "error"); }
  }

  async function saveDraft() {
    if (!current) return;
    setSaving(true);
    try {
      const data = await jApi(`/api/v1/journeys/${current._id}`, {
        method: "PUT",
        body: JSON.stringify({ name: current.name, nodes: current.nodes, edges: current.edges }),
      });
      setCurrent(data.journey);
      setJourneys(prev => prev.map(j => j._id === data.journey._id ? { ...j, name: data.journey.name, status: data.journey.status } : j));
      showToast("Draft saved!");
    } catch (err) { showToast(err.message, "error"); }
    finally { setSaving(false); }
  }

  async function publish() {
    if (!current) return;
    try {
      const data = await jApi(`/api/v1/journeys/${current._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      });
      setCurrent(data.journey);
      setJourneys(prev => prev.map(j => j._id === data.journey._id ? { ...j, status: "active" } : j));
      showToast("Journey published!");
    } catch (err) { showToast(err.message, "error"); }
  }

  async function changeStatus(status) {
    if (!current) return;
    setStatusMenu(false);
    try {
      const data = await jApi(`/api/v1/journeys/${current._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setCurrent(data.journey);
      setJourneys(prev => prev.map(j => j._id === data.journey._id ? { ...j, status } : j));
      showToast("Status updated!");
    } catch (err) { showToast(err.message, "error"); }
  }

  function onJourneyCreated(journey) {
    setJourneys(prev => [journey, ...prev]);
    setCurrent(journey);
    setShowCreate(false);
    showToast("Journey created!");
  }

  function addNode(type, position) {
    const id = uid();
    setCurrent(prev => ({ ...prev, nodes: [...(prev.nodes ?? []), { id, type, label: labelOf(type), config: {}, position }] }));
    setSelectedNodeId(id);
  }

  function deleteNode(id) {
    setCurrent(prev => ({
      ...prev,
      nodes: (prev.nodes ?? []).filter(n => n.id !== id),
      edges: (prev.edges ?? []).filter(e => e.source !== id && e.target !== id),
    }));
    if (selectedNodeId === id) setSelectedNodeId(null);
  }

  function moveNode(id, position) {
    setCurrent(prev => ({ ...prev, nodes: (prev.nodes ?? []).map(n => n.id === id ? { ...n, position } : n) }));
  }

  function updateNode(updated) {
    setCurrent(prev => ({ ...prev, nodes: (prev.nodes ?? []).map(n => n.id === updated.id ? updated : n) }));
  }

  function loadTemplate(tpl) {
    setCurrent(prev => prev
      ? { ...prev, name: tpl.name, trigger: tpl.trigger, nodes: tpl.nodes, edges: tpl.edges }
      : { _id: null, name: tpl.name, status: "draft", trigger: tpl.trigger, nodes: tpl.nodes, edges: tpl.edges }
    );
    setSidebarTab("journeys");
    setSelectedNodeId(null);
  }

  function formatDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  return (
    <div className="jb-root">
      {/* Sidebar */}
      <div className="jb-sidebar">
        <div className="jb-sidebar-header">
          <h2>Journeys</h2>
          <button className="jb-new-btn" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Journey
          </button>
        </div>
        <div className="jb-sidebar-tabs">
          <button className={`jb-sidebar-tab${sidebarTab === "journeys" ? " active" : ""}`} onClick={() => setSidebarTab("journeys")}>Mine</button>
          <button className={`jb-sidebar-tab${sidebarTab === "templates" ? " active" : ""}`} onClick={() => setSidebarTab("templates")}>Templates</button>
        </div>
        <div className="jb-list">
          {sidebarTab === "journeys" && (
            loading
              ? <div style={{ padding: "16px 14px", fontSize: 12, color: "#9ca3af" }}>Loading…</div>
              : journeys.length === 0
                ? <div style={{ padding: "16px 14px", fontSize: 12, color: "#9ca3af" }}>No journeys yet.</div>
                : journeys.map(j => (
                    <div
                      key={j._id}
                      className={`jb-list-item${current?._id === j._id ? " selected" : ""}`}
                      onClick={() => loadJourney(j._id)}
                    >
                      <div className="jb-item-name">{j.name}</div>
                      <div className="jb-item-meta">
                        <StatusBadge status={j.status} />
                        <span className="jb-item-date">{formatDate(j.createdAt)}</span>
                      </div>
                    </div>
                  ))
          )}
          {sidebarTab === "templates" && TEMPLATES.map((tpl, i) => (
            <div key={i} className="jb-template-item" onClick={() => loadTemplate(tpl)}>
              <div className="jb-template-name">{tpl.name}</div>
              <div className="jb-template-desc">{tpl.nodes.length} steps · {tpl.trigger?.type}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="jb-main">
        {!current ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", flexDirection: "column", gap: 10 }}>
            <GitBranch size={48} strokeWidth={1} />
            <div style={{ fontWeight: 700, fontSize: 16, color: "#6b7280" }}>Select or create a journey</div>
            <div style={{ fontSize: 13 }}>Use the left sidebar to get started</div>
          </div>
        ) : (
          <>
            <div className="jb-toolbar">
              <input
                className="jb-journey-name"
                value={current.name}
                onChange={e => setCurrent(prev => ({ ...prev, name: e.target.value }))}
              />
              <StatusBadge status={current.status} />
              <div className="jb-toolbar-sep" />
              <button className="jb-btn jb-btn--ghost" onClick={saveDraft} disabled={saving}>
                <Save size={13} /> {saving ? "Saving…" : "Save Draft"}
              </button>
              {current.status !== "active" && (
                <button className="jb-btn jb-btn--primary" onClick={publish}>
                  <Play size={13} /> Publish
                </button>
              )}
              <div style={{ position: "relative" }}>
                <button className="jb-btn jb-btn--ghost" onClick={() => setStatusMenu(v => !v)}>
                  <ChevronDown size={13} /> Actions
                </button>
                {statusMenu && (
                  <div style={{ position: "absolute", right: 0, top: "110%", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 140, overflow: "hidden" }}>
                    {current.status === "active" && (
                      <button className="jb-btn jb-btn--ghost" style={{ width: "100%", borderRadius: 0, justifyContent: "flex-start" }} onClick={() => changeStatus("paused")}>
                        <Pause size={13} /> Pause
                      </button>
                    )}
                    {current.status === "paused" && (
                      <button className="jb-btn jb-btn--primary" style={{ width: "100%", borderRadius: 0, justifyContent: "flex-start" }} onClick={() => changeStatus("active")}>
                        <Play size={13} /> Resume
                      </button>
                    )}
                    <button className="jb-btn jb-btn--danger" style={{ width: "100%", borderRadius: 0, justifyContent: "flex-start" }} onClick={() => changeStatus("archived")}>
                      <Archive size={13} /> Archive
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="jb-canvas-area">
              <Canvas
                nodes={current.nodes ?? []}
                edges={current.edges ?? []}
                selectedId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onMoveNode={moveNode}
                onDeleteNode={deleteNode}
                onDropFromPalette={(type, pos) => addNode(type, pos)}
              />
              <div className="jb-palette">
                <div className="jb-palette-header">Add Node</div>
                <div className="jb-palette-list">
                  {NODE_TYPES.map(nt => (
                    <div
                      key={nt.type}
                      className="jb-palette-item"
                      draggable
                      onDragStart={e => e.dataTransfer.setData("nodeType", nt.type)}
                      onClick={() => addNode(nt.type, { x: 120 + Math.random() * 200, y: 80 + Math.random() * 300 })}
                    >
                      <span className={`jb-node-icon jb-icon--${nt.type}`} style={{ width: 24, height: 24, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                        {nt.icon}
                      </span>
                      {nt.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {selectedNode && <NodeConfigPanel node={selectedNode} onChange={updateNode} />}
          </>
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={onJourneyCreated} />}
      {toast && <div className={`jb-toast jb-toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
