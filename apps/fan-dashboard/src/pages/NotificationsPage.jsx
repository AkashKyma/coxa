import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Ticket, Star, User, Gift, CheckCheck, ChevronLeft } from "lucide-react";

const MOCK_NOTIFICATIONS = [
  { id: "1", category: "tickets", title: "Ticket confirmed!", body: "Your ticket for Coritiba vs Atlético-PR has been confirmed.", read: false, createdAt: new Date(Date.now() - 3600000), link: "/tickets" },
  { id: "2", category: "rewards", title: "Points added", body: "You earned 150 points for your purchase in the shop.", read: false, createdAt: new Date(Date.now() - 86400000), link: "/rewards" },
  { id: "3", category: "membership", title: "Renewal in 30 days", body: "Your Bronze Membership plan expires in 30 days. Renew now!", read: true, createdAt: new Date(Date.now() - 172800000), link: "/membership" },
  { id: "4", category: "offers", title: "Exclusive offer for you", body: "15% off in the official shop. Valid for 48h.", read: false, createdAt: new Date(Date.now() - 7200000), link: "/shop" },
  { id: "5", category: "system", title: "Welcome to Coxa!", body: "Explore all the benefits of your membership plan.", read: true, createdAt: new Date(Date.now() - 604800000), link: "/" },
  { id: "6", category: "tickets", title: "Ticket promotion", body: "Tickets 20% off for the next derby. Get yours!", read: false, createdAt: new Date(Date.now() - 10800000), link: "/tickets" },
  { id: "7", category: "rewards", title: "Reward redeemed", body: "Your discount voucher has been generated. Valid for 7 days.", read: true, createdAt: new Date(Date.now() - 259200000), link: "/rewards" },
  { id: "8", category: "offers", title: "New product available", body: "The new official Coritiba jersey is now in the shop.", read: false, createdAt: new Date(Date.now() - 43200000), link: "/shop" },
];

const CATEGORY_ICONS = {
  tickets: Ticket,
  rewards: Star,
  membership: User,
  offers: Gift,
  system: Bell,
};

const TABS = [
  { id: "all", label: "All" },
  { id: "tickets", label: "Tickets" },
  { id: "rewards", label: "Points" },
  { id: "membership", label: "Plan" },
  { id: "offers", label: "Offers" },
  { id: "system", label: "System" },
];

function relativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}min ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState("all");
  const [contextMenu, setContextMenu] = useState(null); // { id, x, y }

  const filtered = activeTab === "all"
    ? notifications
    : notifications.filter((n) => n.category === activeTab);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markRead(id) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function deleteNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setContextMenu(null);
  }

  function handleClick(notif) {
    markRead(notif.id);
    navigate(notif.link);
  }

  function handleContextMenu(e, id) {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }

  function handleLongPress(id) {
    setContextMenu({ id, x: null, y: null });
  }

  return (
    <div className="fnot-page" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="fnot-header">
        <button type="button" className="fnot-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="fnot-title">
          <Bell size={22} strokeWidth={2.2} style={{ marginRight: "0.45rem", verticalAlign: "middle" }} />
          Notifications
          {unreadCount > 0 && (
            <span className="fnot-badge">{unreadCount}</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button type="button" className="fnot-mark-all" onClick={markAllRead}>
            <CheckCheck size={16} />
            Mark all
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="fnot-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fnot-tab${activeTab === tab.id ? " fnot-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="fnot-empty">
          <Bell size={40} strokeWidth={1.5} style={{ color: "#64748b", marginBottom: "0.75rem" }} />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <ul className="fnot-list">
          {filtered.map((notif) => {
            const Icon = CATEGORY_ICONS[notif.category] ?? Bell;
            return (
              <li key={notif.id} className="fnot-item">
                <NotifRow
                  notif={notif}
                  Icon={Icon}
                  onClick={() => handleClick(notif)}
                  onContextMenu={(e) => handleContextMenu(e, notif.id)}
                  onLongPress={() => handleLongPress(notif.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fnot-context-menu"
          style={
            contextMenu.x !== null
              ? { position: "fixed", top: contextMenu.y, left: contextMenu.x }
              : { position: "fixed", bottom: "5rem", left: "50%", transform: "translateX(-50%)" }
          }
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="fnot-context-item"
            onClick={() => { markRead(contextMenu.id); setContextMenu(null); }}
          >
            <CheckCheck size={15} /> Mark as read
          </button>
          <button
            type="button"
            className="fnot-context-item fnot-context-item--danger"
            onClick={() => deleteNotification(contextMenu.id)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NotifRow({ notif, Icon, onClick, onContextMenu, onLongPress }) {
  const pressTimer = useRef(null);

  function handlePointerDown() {
    pressTimer.current = setTimeout(() => onLongPress(), 600);
  }

  function handlePointerUp() {
    clearTimeout(pressTimer.current);
  }

  return (
    <button
      type="button"
      className={`fnot-row${notif.read ? " fnot-row--read" : ""}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {!notif.read && <span className="fnot-row__dot" />}
      <span className={`fnot-row__icon fnot-row__icon--${notif.category}`}>
        <Icon size={18} />
      </span>
      <span className="fnot-row__body">
        <span className="fnot-row__title">{notif.title}</span>
        <span className="fnot-row__text">{notif.body}</span>
      </span>
      <span className="fnot-row__time">{relativeTime(notif.createdAt)}</span>
    </button>
  );
}

