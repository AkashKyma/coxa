import { useState } from "react";
import { Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Shield,
  Users,
  Package,
  Tags,
  MapPin,
  Boxes,
  ArrowLeftRight,
  Receipt,
  RotateCcw,
  Zap,
  UtensilsCrossed,
  Layers,
  UserCircle,
  Star,
  CalendarDays,
  Building2,
  Settings,
  LogOut,
  ChevronsUpDown,
  Plus,
  ScanLine,
  LifeBuoy,
  Sparkles,
  ShoppingBag,
  QrCode,
  ActivitySquare,
  UserCheck,
  Trophy,
  Percent,
  BarChart3,
  GitBranch,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { MODULE, usePermissions } from "../lib/permissions.js";
import SidebarNavLink from "../components/SidebarNavLink.jsx";

const navMain = [
  { to: "/", label: "Overview", end: true, icon: LayoutDashboard },
  { to: "/analytics", label: "Club Intelligence", icon: BarChart3 },
];

const navAdmin = [
  { to: "/roles", label: "Roles", icon: Shield },
  { to: "/users", label: "Users", icon: Users },
];

const navRetail = [
  { to: "/retail/products", label: "Products", icon: Package },
  { to: "/retail/categories", label: "Categories", icon: Tags },
  { to: "/retail/locations", label: "Locations", icon: MapPin },
  { to: "/retail/stock", label: "Stock", icon: Boxes },
  { to: "/retail/transfers", label: "Transfers", icon: ArrowLeftRight },
  { to: "/retail/sales", label: "Sales", icon: Receipt },
  { to: "/retail/returns", label: "Returns", icon: RotateCcw },
  { to: "/retail/qr-redeem", label: "QR Redemption", icon: QrCode },
];

const navFnb = [
  { to: "/fnb/products", label: "Products", icon: Package },
  { to: "/fnb/inventory", label: "Food inventory", icon: UtensilsCrossed },
  { to: "/fnb/sales", label: "F&B Sales", icon: ShoppingBag },
  { to: "/fnb/qr-redeem", label: "QR Redemption", icon: QrCode },
];

const navCdp = [
  { to: "/cdp/events", label: "Events", icon: Zap },
  { to: "/cdp/segments", label: "Segments", icon: Layers },
  { to: "/cdp/customer-360", label: "Customer 360", icon: UserCircle },
  { to: "/cdp/workflows", label: "Automation Workflows", icon: GitBranch },
];

const navPersonalization = [
  { to: "/personalization", label: "Overview & NBO", icon: Sparkles, end: true },
  { to: "/personalization/offers", label: "Offers", icon: Percent },
];

const navLoyalty = [
  { to: "/loyalty", label: "Program rules", icon: Star },
  { to: "/loyalty/tiers", label: "Tiers", icon: Trophy },
];

const navMembership = [
  { to: "/membership/plans", label: "Plans", icon: UserCheck },
  { to: "/membership/members", label: "Members", icon: Users },
  { to: "/membership/priority", label: "Priority ranking", icon: Trophy },
];

const navTicketing = [
  { to: "/ticketing/events", label: "Events", icon: CalendarDays },
  { to: "/ticketing/venues", label: "Venues", icon: Building2 },
  { to: "/ticketing/check-in", label: "Check-in dashboard", icon: ActivitySquare },
  { to: "/ticketing/support", label: "Support & override", icon: LifeBuoy },
];

const navSupport = [
  { to: "/ticketing/support", label: "Fan support", icon: LifeBuoy },
  { to: "/cdp/customer-360", label: "Customer 360", icon: UserCircle },
];

const navFooter = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/retail/qr-redeem", label: "QR Redemption", icon: ScanLine },
];

const SPORTS = ["Football", "Basketball", "Volleyball", "Rugby", "Cricket", "Other"];
const SIZES = [
  { value: "small", label: "Small (< 50 staff)" },
  { value: "medium", label: "Medium (50–200 staff)" },
  { value: "large", label: "Large (200–1000 staff)" },
  { value: "professional", label: "Professional / Elite" },
];

const BLANK_FORM = { clubName: "", country: "", city: "", sport: "Football", size: "medium", stadiumName: "", website: "" };

function NavSection({ title, items }) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-section__title">{title}</div>
      {items.map((item) => (
        <SidebarNavLink key={item.to} {...item} />
      ))}
    </div>
  );
}

export default function DashboardLayout() {
  const { user, club, membership, allMemberships, switchClub, addClub, logout } = useAuth();
  const { can, isAdmin } = usePermissions();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleCreateClub(e) {
    e.preventDefault();
    setCreateError("");
    if (!form.clubName || !form.country || !form.city) {
      setCreateError("Club name, country and city are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await api.createClub(form);
      addClub({
        club: res.data.club,
        role: res.data.role,
        moduleAccess: [],
        membershipId: res.data.membershipId,
      });
      setShowCreate(false);
      setForm(BLANK_FORM);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const roleBadge = membership?.role
    ? membership.role.replace(/_/g, " ")
    : null;

  return (
    <div className="shell shell--sidebar-fixed">
      <aside className="sidebar sidebar--fixed">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">C</span>
          <span>Coxa Club</span>
        </div>

        <div className="sidebar__body">
          <div className="club-switcher club-switcher--compact">
            <button
              type="button"
              className="club-switcher__trigger"
              onClick={() => setSwitcherOpen((o) => !o)}
              aria-expanded={switcherOpen}
            >
              <span className="club-switcher__name">{club?.name ?? "No club"}</span>
              <ChevronsUpDown size={14} strokeWidth={2} className="club-switcher__caret-icon" />
            </button>

            {switcherOpen && (
              <div className="club-switcher__menu">
                {allMemberships.map((m) => {
                  const id = m.club?.id ?? m.club?._id;
                  const isActive = id === (club?.id ?? club?._id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`club-switcher__item${isActive ? " active" : ""}`}
                      onClick={() => { switchClub(id); setSwitcherOpen(false); }}
                    >
                      <span className="club-switcher__item-name">{m.club?.name}</span>
                      <span className="club-switcher__item-role">{m.role}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="club-switcher__item club-switcher__item--new"
                  onClick={() => { setSwitcherOpen(false); setShowCreate(true); }}
                >
                  <Plus size={14} strokeWidth={2} />
                  Create club
                </button>
              </div>
            )}
          </div>

          <nav className="sidebar-nav">
            {navMain.map((item) => (
              <SidebarNavLink key={item.to} {...item} />
            ))}

            {isAdmin && (
              <NavSection title="Admin" items={navAdmin} />
            )}

            {can(MODULE.RETAIL) && (
              <NavSection title="Retail" items={navRetail} />
            )}

            {can(MODULE.FNB) && (
              <NavSection title="F&B" items={navFnb} />
            )}

            {can(MODULE.TICKETING) && (
              <NavSection title="Ticketing" items={navTicketing} />
            )}

            {can(MODULE.CDP) && (
              <NavSection title="Marketing & CDP" items={navCdp} />
            )}

            {can(MODULE.PERSONALIZATION) && (
              <NavSection title="Personalization" items={navPersonalization} />
            )}

            {can(MODULE.LOYALTY) && (
              <NavSection title="Loyalty" items={navLoyalty} />
            )}

            {can(MODULE.MEMBERSHIP) && (
              <NavSection title="Membership" items={navMembership} />
            )}

            {can(MODULE.SUPPORT) && !can(MODULE.TICKETING) && (
              <NavSection title="Support" items={navSupport} />
            )}

            <div className="sidebar-section sidebar-section--footer">
              {navFooter.map((item) => (
                <SidebarNavLink key={item.to} {...item} />
              ))}
            </div>
          </nav>
        </div>

        <div className="sidebar-footer sidebar-footer--compact">
          <div className="sidebar-user">
            <div className="sidebar-user__avatar">
              {(user?.fullName ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user__info">
              <div className="sidebar-user__name">{user?.fullName ?? "—"}</div>
              <div className="sidebar-user__meta">{roleBadge ?? "member"}</div>
            </div>
          </div>
          <button type="button" className="sidebar-signout" onClick={logout}>
            <LogOut size={14} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main main--with-sidebar">
        <Outlet />
      </main>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Create new club</h2>
              <button type="button" className="modal__close" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            {createError && <div className="alert error">{createError}</div>}

            <form onSubmit={handleCreateClub} noValidate>
              <div className="form-row">
                <div className="form-group">
                  <label>Club name *</label>
                  <input value={form.clubName} onChange={set("clubName")} placeholder="FC Example" />
                </div>
                <div className="form-group">
                  <label>Sport</label>
                  <select value={form.sport} onChange={set("sport")}>
                    {SPORTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Country *</label>
                  <input value={form.country} onChange={set("country")} placeholder="Spain" />
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <input value={form.city} onChange={set("city")} placeholder="Madrid" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Stadium name</label>
                  <input value={form.stadiumName} onChange={set("stadiumName")} placeholder="Stadium Bernabéu" />
                </div>
                <div className="form-group">
                  <label>Club size</label>
                  <select value={form.size} onChange={set("size")}>
                    {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Website</label>
                <input value={form.website} onChange={set("website")} placeholder="https://yourclub.com" />
              </div>

              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={creating}>
                  {creating ? "Creating…" : "Create club"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
