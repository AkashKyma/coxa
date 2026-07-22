import { useState } from "react";

import { Outlet } from "react-router-dom";

import {

  LayoutDashboard,

  UserCircle,

  Activity,

  Users,

  Briefcase,

  Ticket,

  DoorOpen,

  Store,

  ShoppingCart,

  Smartphone,

  Tv,

  Footprints,

  UtensilsCrossed,

  Shirt,

  FolderKanban,

  ClipboardList,

  Vote,

  Gift,

  Trophy,

  MessageSquare,

  Filter,

  Lightbulb,

  Megaphone,

  WandSparkles,

  FileText,

  Settings,

  Upload,

  LogOut,

  ChevronsUpDown,

  GitBranch,

} from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";

import { MODULE, usePermissions } from "../lib/permissions.js";

import SidebarNavLink from "../components/SidebarNavLink.jsx";



const navHome = [

  { to: "/", label: "Overview", end: true, icon: LayoutDashboard },

];



const navFans = [

  { to: "/fans/single", label: "Single Fan View", icon: UserCircle },

  { to: "/fans/engagement", label: "Engagement", icon: Activity },

  { to: "/fans/profiles", label: "Profile Demographics", icon: Users },

];



const navBusiness = [

  { to: "/business/membership", label: "Membership", icon: Briefcase },

  { to: "/business/tickets", label: "Tickets", icon: Ticket },

  { to: "/business/access", label: "Access", icon: DoorOpen },

  { to: "/business/stores", label: "Stores", icon: Store },

  { to: "/business/ecommerce", label: "E-Commerce", icon: ShoppingCart },

  { to: "/business/app", label: "Official App", icon: Smartphone },

  { to: "/business/ott", label: "Coxa Prime TV", icon: Tv },

  { to: "/business/coxa-run", label: "Coxa Run", icon: Footprints },

  { to: "/business/coxa-foods", label: "Coxa Foods", icon: UtensilsCrossed },

  { to: "/business/manto", label: "Manto", icon: Shirt },

];



const navProjects = [

  { to: "/projects/surveys", label: "Surveys", icon: ClipboardList },

  { to: "/projects/votes", label: "Votes", icon: Vote },

  { to: "/projects/raffles", label: "Raffles", icon: Gift },

  { to: "/projects/contests", label: "Contests", icon: Trophy },

  { to: "/projects/nps", label: "NPS", icon: MessageSquare },

];



const navIntelligence = [

  { to: "/intelligence/filters", label: "Segments & Filters", icon: Filter },

  { to: "/intelligence/workflows", label: "Automation Workflows", icon: GitBranch },

  { to: "/intelligence/insights", label: "Insights", icon: Lightbulb },

];



const navCampaigns = [

  { to: "/campaigns", label: "Campaigns", end: true, icon: Megaphone },

  { to: "/campaigns/new", label: "Campaign Wizard", icon: WandSparkles },

  { to: "/campaigns/templates", label: "Templates", icon: FileText },

];



const navControl = [

  { to: "/control/users", label: "Account Management", icon: Settings },

  { to: "/control/import", label: "CSV Import", icon: Upload },

];



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



export default function FanboxLayout() {

  const { user, club, membership, allMemberships, switchClub, logout } = useAuth();

  const { can, isAdmin } = usePermissions();

  const [switcherOpen, setSwitcherOpen] = useState(false);



  const roleBadge = membership?.role?.replace(/_/g, " ");



  return (

    <div className="shell shell--sidebar-fixed">

      <aside className="sidebar sidebar--fixed">

        <div className="sidebar__brand">

          <span className="sidebar__brand-mark">F</span>

          <span>FanBox</span>

        </div>



        <div className="sidebar__body">

          <div className="club-switcher club-switcher--compact">

            <button

              type="button"

              className="club-switcher__trigger"

              onClick={() => setSwitcherOpen((o) => !o)}

              aria-expanded={switcherOpen}

            >

              <span className="club-switcher__name">{club?.name ?? "Club"}</span>

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

              </div>

            )}

          </div>



          <nav className="sidebar-nav">

            {navHome.map((item) => (

              <SidebarNavLink key={item.to} {...item} />

            ))}



            {(isAdmin || can(MODULE.FANS)) && (

              <NavSection title="Fans" items={navFans} />

            )}



            {(isAdmin || can(MODULE.BUSINESS)) && (

              <NavSection title="Business" items={navBusiness} />

            )}



            {(isAdmin || can(MODULE.PROJECTS)) && (

              <NavSection title="Projects" items={navProjects} />

            )}



            {(isAdmin || can(MODULE.INTELLIGENCE)) && (

              <NavSection title="Fan Intelligence" items={navIntelligence} />

            )}



            {(isAdmin || can(MODULE.CAMPAIGNS)) && (

              <NavSection title="Campaigns" items={navCampaigns} />

            )}



            {(isAdmin || can(MODULE.CONTROL)) && (

              <NavSection title="Control Panel" items={navControl} />

            )}

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

    </div>

  );

}


