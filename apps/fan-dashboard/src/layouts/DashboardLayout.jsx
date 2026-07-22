import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, Ticket, ShoppingBag, Star, User, UserCheck, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const tabs = [
  { to: "/", label: "Home", end: true, icon: Home },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/rewards", label: "Rewards", icon: Star },
  { to: "/membership", label: "Sócio", icon: UserCheck },
  { to: "/profile", label: "Profile", icon: User },
];

function pageTitle(pathname) {
  if (pathname.startsWith("/shop")) return "Shop";
  if (pathname.startsWith("/tickets")) return "Tickets";
  if (pathname.startsWith("/rewards")) return "Rewards";
  if (pathname.startsWith("/wallet")) return "Wallet";
  if (pathname.startsWith("/membership/referrals")) return "Referrals";
  if (pathname.startsWith("/membership")) return "Sócio Coxa";
  if (pathname.startsWith("/profile")) return "Profile";
  return "Home";
}

export default function DashboardLayout() {
  const { user, fanProfile, logout } = useAuth();
  const location = useLocation();
  const mainRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const displayName = fanProfile?.fullName ?? user?.fullName ?? "Fan";
  const firstName = displayName.split(" ")[0];
  const isHome = location.pathname === "/";
  const title = pageTitle(location.pathname);

  const onMainScroll = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    setScrolled(el.scrollTop > 12);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    onMainScroll();
    el.addEventListener("scroll", onMainScroll, { passive: true });
    return () => el.removeEventListener("scroll", onMainScroll);
  }, [location.pathname, onMainScroll]);

  return (
    <div className="fan-app-viewport">
      <div className="fan-app-frame">
        <div className={`fan-shell${scrolled ? " fan-shell--scrolled" : ""}`}>
          <header
            className={`fan-header${scrolled ? " fan-header--scrolled" : ""}${isHome ? " fan-header--home" : ""}`}
          >
            <div className="fan-header__brand">
              <span className="fan-header__mark">C</span>
              <div className={`fan-header__titles${scrolled || !isHome ? " fan-header__titles--visible" : ""}`}>
                <div className="fan-header__title">{title}</div>
                <div className="fan-header__subtitle">Olá, {firstName}</div>
              </div>
            </div>
            <button type="button" className="fan-header__signout" onClick={logout}>
              Sign out
            </button>
          </header>

          <main ref={mainRef} className="fan-main">
            <Outlet context={{ firstName, scrolled }} />
          </main>

          <nav
            className={`fan-tabbar${scrolled ? " fan-tabbar--scrolled" : ""}`}
            aria-label="Main navigation"
          >
            <div className="fan-tabbar__inner">
              {tabs.map(({ to, label, end, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `fan-tabbar__link${isActive ? " fan-tabbar__link--active" : ""}`
                  }
                >
                  <span className="fan-tabbar__icon">
                    <Icon size={22} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="fan-tabbar__label">{label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
