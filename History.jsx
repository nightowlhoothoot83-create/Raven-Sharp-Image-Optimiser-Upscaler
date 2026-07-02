import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { History, LogOut, Sparkles } from "lucide-react";

const LOGO_URL = "/raven-logo.png";

export default function TopNav() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const NavLink = ({ to, label, icon: Icon, testid }) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        data-testid={testid}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
          active ? "text-raven-violetBright bg-raven-violet/10 border border-raven-violet/30" : "text-raven-muted hover:text-raven-text border border-transparent"
        }`}
      >
        <Icon size={14} />
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 glass" data-testid="top-nav">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
          <img
            src={LOGO_URL}
            alt="Raven Sharp"
            className="h-12 w-auto object-contain logo-plate"
          />
          <div className="hidden sm:block label-tiny">Image Optimiser</div>
        </Link>

        <nav className="flex items-center gap-2">
          <NavLink to="/" label="Optimiser" icon={Sparkles} testid="nav-optimiser" />
          <NavLink to="/history" label="History" icon={History} testid="nav-history" />
          {user ? (
            <div className="flex items-center gap-3 pl-3 ml-1 border-l border-raven-border">
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-sm">{user.name || user.email}</div>
                <div className="label-tiny">{user.email}</div>
              </div>
              <button
                onClick={async () => { await logout(); navigate("/login"); }}
                className="btn-ghost"
                data-testid="logout-button"
              >
                <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
